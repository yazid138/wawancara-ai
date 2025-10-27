import { Response } from "express";
import ApiResponse from "@/types/response";

export default <T>(res: Response, response: ApiResponse<T>) => {
	res.status(response.status).json(response);
};
