import express, { NextFunction, Request, Response } from "express";
import logger from "morgan";
import config from "@/config";
import NotFoundException from "@/exception/NotFoundException";
import HttpException from "@/types/exception";
import routes from "@/routes/";
import { sendError } from "./utils/responseHandler";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(logger("dev"));

app.use(routes);

app.use((req: Request, res: Response, next: NextFunction) => {
	throw new NotFoundException();
});

app.use((err: HttpException, req: Request, res: Response, next: NextFunction) => {
	try {
		sendError(res, err.status, err.message);
	} catch (error) {
		console.log(error);
		sendError(res, 500, "Internal Server Error");
	}
});

app.listen(config.port, () => {
	console.log(`Server is running on ${config.baseUrl}:${config.port}`);
});
