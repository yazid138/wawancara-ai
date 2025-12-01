import express from "express";
import logger from "morgan";
import routes from "@/routes/";
import passport from "passport";
import error from "@/middleware/error";
import "@/config/passport";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(logger("dev"));
app.use(passport.initialize());

app.use(routes);

app.use(error.notFoundHandler());
app.use(error.errorHandler());

export default app;
