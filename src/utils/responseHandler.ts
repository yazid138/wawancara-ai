import { Response } from "express";
import ApiResponse from "@/types/apiResponse";

export default <T>(res: Response, response: ApiResponse<T>) => {
	res.status(response.status || 200).json(response);
};
