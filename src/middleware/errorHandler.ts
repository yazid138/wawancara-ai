import { NextFunction, Request, Response } from "express";
import HttpException from "@/exception/HttpException";
import sendResponse from "@/utils/responseHandler";

export default () =>
  (err: HttpException, req: Request, res: Response, next: NextFunction) => {
    try {
      sendResponse(res, {
        status: err.status,
        message: err.message,
        error: err.error || undefined,
      });
    } catch (error) {
      console.error(error);
      sendResponse(res, { status: 500, message: "Internal Server Error" });
    }
  };
