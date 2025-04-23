import { Application } from "express";

import apiRoute from "../routes";
import ConsoleHandler from "../utils/consoleHandler";

class Routes {
  private logger = ConsoleHandler.getInstance("Route");

  private mountRoutes(_express: Application): Application {
    this.logger.log("API Routes mounted");
    return _express.use("/", apiRoute);
  }

  public init(_express: Application): Application {
    this.mountRoutes(_express);
    return _express;
  }
}

export default new Routes();
