import express, { Application } from "express";
import http from "http";

import Middleware from "../middlewares";
import ConsoleHandler from "../utils/consoleHandler";
import ConfigService from "./config";
import Database from "./databast";
import Routes from "./routes";

/* eslint-disable @typescript-eslint/no-explicit-any */
class Express {
  public express: Application;
  private server: http.Server | null;
  private activeConnections: { [key: string]: any } = {};
  private logger: ConsoleHandler;

  constructor() {
    this.express = express();
    this.server = null;
    this.logger = ConsoleHandler.getInstance("Express");
  }

  private mountConfig(): void {
    const config = ConfigService.getInstance();
    this.express = config.init(this.express);
  }

  private mountMiddlewares(): void {
    this.express = Middleware.init(this.express);
  }

  private mountRoutes(): void {
    this.express = Routes.init(this.express);
  }

  private async initializeServices(): Promise<void> {
    this.logger.log("Initializing core services...");
    try {
      // --- 2. 初始化資料庫 ---
      await Database.getInstance().init();
      // 可以在這裡初始化其他服務，例如快取、訊息佇列等
      this.logger.log("Core services initialized successfully.");
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error("FATAL: Failed to initialize core services:", error);
      } else {
        this.logger.error(
          "FATAL: Failed to initialize core services with unknown error:",
          new Error(String(error)),
        );
      }
      // 如果核心服務（如資料庫）初始化失敗，通常需要終止應用程式
      process.exit(1);
    }
  }

  public async init(): Promise<Application> {
    await this.initializeServices();
    await this.mountConfig();
    await this.mountMiddlewares();
    await this.mountRoutes();
    return this.express;
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const port = ConfigService.getInstance().getConfig().PORT;

        this.server = this.express.listen(port, () => {
          this.logger.log(`Running SERVER @ 'http://localhost:${port}'`);
          resolve();
        });

        this.server.on("error", (error) => {
          this.logger.error("Error");
          reject(error);
        });

        // handle HTTP keep-alive connections
        this.server.keepAliveTimeout = 65000;
        this.server.headersTimeout = 66000;

        // 監聽 connection 事件以追蹤活動連接 (用於 graceful shutdown)
        if (this.server) {
          this.server.on("connection", (socket) => {
            const socketId = `${socket.remoteAddress}:${socket.remotePort}`;
            this.activeConnections[socketId] = socket;
            socket.on("close", () => {
              delete this.activeConnections[socketId];
            });
          });
        }
      } catch (error) {
        this.logger.error("Failed to start:");
        reject(error);
      }
    });
  }

  public async shutdown(): Promise<void> {
    this.logger.warn("Initiating graceful shutdown...");

    // 1. 停止接受新的連線
    await new Promise<void>((resolve, reject) => {
      if (!this.server) {
        this.logger.warn("Server instance not found, skipping server close.");
        resolve();
        return;
      }
      this.server.close((err) => {
        if (err) {
          this.logger.error("Error during server close:", err);
          reject(err); // 或者你可以選擇僅記錄錯誤而不中斷關閉流程
        } else {
          this.logger.log("HTTP server stopped accepting new connections.");
          this.server = null; // 將 server 設為 null
          resolve();
        }
      });

      // 2. 關閉所有現有的活動連線 (可選但推薦)
      this.logger.log(
        `Closing ${Object.keys(this.activeConnections).length} active connections...`,
      );
      Object.values(this.activeConnections).forEach((socket: any) => {
        socket.destroy();
      });
      this.activeConnections = {}; // 清空追蹤列表

      // 設置一個超時，以防關閉過程卡住
      const shutdownTimeout = setTimeout(() => {
        this.logger.error("Shutdown timed out, forcing exit.");
        reject(new Error("Server shutdown timeout"));
      }, 15000); // 15 秒超時

      // 清除超時計時器，如果 close 正常完成
      this.server?.on("close", () => {
        clearTimeout(shutdownTimeout);
      });
    });

    // --- 4. 關閉資料庫連線 ---
    this.logger.log("Closing database connection pool...");
    try {
      await Database.getInstance().close();
    } catch (dbError) {
      // 記錄資料庫關閉錯誤，但不一定需要中斷整個關閉流程
      if (dbError instanceof Error) {
        this.logger.error(
          "Error closing database pool during shutdown:",
          dbError,
        );
      } else {
        this.logger.error(
          "Error closing database pool during shutdown with unknown error:",
          new Error(String(dbError)),
        );
      }
    }

    this.logger.log("Graceful shutdown completed.");
  }
}

// 導出單例
export default new Express();
