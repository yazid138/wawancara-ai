import express, { NextFunction, Request, Response } from "express";
import logger from "morgan";
import config from "@/config";
import NotFoundException from "@/exception/NotFoundException";
import HttpException from "@/types/exception";
import routes from "@/routes/";
import sendResponse from "./utils/responseHandler";
import passport from "passport";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(logger("dev"));
app.use(passport.initialize());

app.use(routes);

app.use((req: Request, res: Response, next: NextFunction) => {
	throw new NotFoundException();
});

app.use((err: HttpException, req: Request, res: Response, next: NextFunction) => {
	try {
		sendResponse(res, { status: err.status, message: err.message, error: err.error || undefined });
	} catch (error) {
		console.error(error);
		sendResponse(res, { status: 500, message: "Internal Server Error" });
	}
});

app.listen(config.port, () => {
	console.log(`Server is running on ${config.baseUrl}:${config.port}`);
});
