import { Response } from "express";

import { ServiceResponse } from "../types/service";
import { ServerError } from "./consoleHandler";

class ResponseHandler {
  public static handleError(res: Response, error: Error | unknown): Response {
    if (error instanceof ServerError) {
      return res
        .status(error.statusCode)
        .send({ success: false, message: error.message });
    } else {
      return res
        .status(500)
        .send({ success: false, message: `Internal Server Error: ${error}` });
    }
  }

  public static handleResponse(
    res: Response,
    response: ServiceResponse,
  ): Response {
    let controllerResponse: ControllerResponse = {};

    if (response.success) {
      controllerResponse = {
        success: response.success,
        ...(response.data && { data: response.data }),
        ...(response.message && { message: response.message }),
      };
    }

    if (!response.success) {
      controllerResponse = {
        success: response.success,
        message: response.message,
      };
    }

    return res.status(response.statusCode).send(controllerResponse);
  }
}

export default ResponseHandler;

interface ControllerResponse {
  success?: boolean;
  data?: any;
  message?: string;
}
