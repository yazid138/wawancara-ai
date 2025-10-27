import express, { NextFunction, Request, Response } from "express";
import logger from "morgan";
import config from "@/config";
import NotFoundException from "@/exception/NotFoundException";
import routes from "@/routes/";
import passport from "passport";
import dotenv from "dotenv";
import errorHandler from "@/middleware/errorHandler";

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

app.use(errorHandler());

app.listen(config.port, () => {
	console.log(`Server is running on ${config.baseUrl}:${config.port}`);
});
