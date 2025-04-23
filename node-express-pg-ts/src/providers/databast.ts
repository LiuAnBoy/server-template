import { Pool, PoolClient, QueryResultRow } from "pg";

import ConsoleHandler from "../utils/consoleHandler"; // 確保路徑正確
import ConfigService from "./config"; // 確保路徑正確

class Database {
  // 單例實例
  private static instance: Database;
  // Pool 可以是 null，表示尚未初始化或已關閉
  private pool: Pool | null = null;
  private logger: ConsoleHandler;

  // 私有建構子，防止外部直接 new
  private constructor() {
    this.logger = ConsoleHandler.getInstance("Database");
  }

  // 獲取單例實例的方法
  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * 初始化資料庫連線池。
   * 如果已經初始化，則不會重複執行。
   * 會嘗試連線以確保資料庫可訪問。
   */
  public async init(): Promise<void> {
    // 如果已經有連線池，直接返回
    if (this.pool) {
      this.logger.log("Database pool already initialized.");
      return;
    }

    const config = ConfigService.getInstance().getConfig();
    this.logger.log("Attempting to initialize database connection...");
    try {
      this.pool = new Pool({
        host: config.PG_HOST,
        port: config.PG_PORT,
        user: config.PG_USER,
        password: config.PG_PASSWORD,
        database: config.PG_DATABASE,
        // 可選：增加更多配置，如連線超時、最大連線數
        // connectionTimeoutMillis: 3000,
        // max: 10,
      });

      // 嘗試獲取一個客戶端來測試連線
      const client = await this.pool.connect();
      this.logger.log("Database pool connected successfully.");
      client.release(); // 測試完畢，釋放客戶端回連線池
    } catch (error) {
      this.logger.error(`Database initialization failed: ${error}`);
      // 初始化失敗時，將 pool 設回 null
      if (this.pool) {
        // 如果 Pool 已建立但 connect 失敗，嘗試關閉它
        await this.pool.end().catch((closeError) => {
          this.logger.error(
            `Error closing pool after connection failure: ${closeError}`,
          );
        });
      }
      this.pool = null;
      // 拋出錯誤，讓呼叫者知道初始化失敗
      throw error;
    }
  }

  /**
   * 執行 SQL 查詢。
   * @param sql SQL 查詢語句，可以使用 $1, $2... 作為參數佔位符。
   * @param params 查詢參數陣列。
   * @returns 返回查詢結果的陣列。
   * @throws 如果資料庫未初始化或查詢失敗，則拋出錯誤。
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  public async query<T extends QueryResultRow = any>(
    sql: string,
    params: any[] = [],
  ): Promise<T[]> {
    // 檢查連線池是否存在
    if (!this.pool) {
      this.logger.error("Query attempt failed: Database is not initialized.");
      throw new Error("Database is not initialized. Call init() first.");
    }

    let client: PoolClient | null = null;
    try {
      // 從連線池獲取一個客戶端
      client = await this.pool.connect();
      // 執行查詢
      const result = await client.query<T>(sql, params);
      // 返回查詢結果的 rows 屬性
      return result.rows;
    } catch (error) {
      // 記錄詳細錯誤信息
      this.logger.error(
        `Query failed: SQL="${sql}" PARAMS=${JSON.stringify(params)} ERROR=${error}`,
      );
      // 重新拋出錯誤
      throw error;
    } finally {
      // 無論成功或失敗，只要獲取了客戶端，就必須釋放它
      if (client) {
        client.release();
      }
    }
  }

  /**
   * 優雅地關閉資料庫連線池。
   * 釋放所有客戶端並斷開與資料庫的連線。
   */
  public async close(): Promise<void> {
    if (this.pool) {
      this.logger.log("Attempting to close database pool...");
      try {
        // 等待所有客戶端釋放並關閉連線池
        await this.pool.end();
        this.logger.log("Database pool closed successfully.");
        // 將 pool 設為 null 表示已關閉
        this.pool = null;
      } catch (error) {
        this.logger.error(`Failed to close database pool gracefully: ${error}`);
        // 即使關閉失敗，也嘗試將 pool 設為 null
        this.pool = null;
        throw error; // 重新拋出錯誤
      }
    } else {
      this.logger.warn(
        "Database pool was not initialized or already closed. No action taken.",
      );
    }
  }
}

// 導出的是類別本身，需要透過 Database.getInstance() 來獲取實例
export default Database;
