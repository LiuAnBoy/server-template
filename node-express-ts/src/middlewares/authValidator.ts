import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import ResponseHandler from "../utils/responseHandler";

const authValidator = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token)
      return res
        .status(401)
        .send({ success: false, message: "Invalid Credential" });

    // const decoded = jwt.verify(
    //   token,
    //   res.app.locals.config.APP_SECRET,
    // ) as JwtPayload;

    // TODO: Check if the user is exist in the database

    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res
        .status(401)
        .send({ success: false, message: `Invalid Credential: ${error}` });
    }

    return ResponseHandler.handleError(res, error);
  }
};

export default authValidator;
