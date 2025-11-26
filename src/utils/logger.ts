import winston from "winston";
import config from "@/config";
import { PRODUCTION } from "@/utils/constants";

const { combine, timestamp, printf } = winston.format;

const logger = winston.createLogger({
  level: config.env === PRODUCTION ? "info" : "debug",
  format: combine(
    timestamp(),
    printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ""}`;
    }),
  ),
  handleExceptions: config.env !== PRODUCTION,
  handleRejections: config.env !== PRODUCTION,
  transports: [new winston.transports.File({ filename: "application.log" })],
});

export default logger;
