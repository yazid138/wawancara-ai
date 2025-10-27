import { Response } from "express";
import ApiResponse from "@/types/response";

export const sendResponse = <T>(res: Response, response: ApiResponse<T>) => {
	res.status(response.status).json(response);
};

export const sendError = (res: Response, status: number, message: string) => {
	res.status(status).json({ status, message });
};
