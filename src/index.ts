import express from "express";
import logger from "morgan";
import config from "@/config";
import routes from "@/routes/";
import passport from "passport";
import { notFoundHandler, errorHandler } from "@/middleware/errorHandler";
import "@/config/passport";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(logger("dev"));
app.use(passport.initialize());

app.use(routes);

app.use(notFoundHandler());
app.use(errorHandler());

app.listen(config.port, () => {
  console.log(`Server is running on ${config.baseUrl}:${config.port}`);
});
