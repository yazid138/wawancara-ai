import { NextFunction, Request, Response } from "express";
import HttpException from "@/types/httpException";
import sendResponse from "@/utils/responseHandler";
import NotFoundException from "@/exception/NotFoundException";
import logger from "@/utils/logger";

const notFoundHandler =
  () => (req: Request, res: Response, next: NextFunction) => {
    throw new NotFoundException();
  };

const errorHandler =
  () =>
  (err: HttpException, req: Request, res: Response, next: NextFunction) => {
    logger.error("", err);
    sendResponse(res, {
      status: err.status || 500,
      message: err.status ? err.message : "Internal Server Error",
      error: err.error || undefined,
    });
  };

export default { notFoundHandler, errorHandler };
