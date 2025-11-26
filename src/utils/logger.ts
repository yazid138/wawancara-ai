import winston from "winston";
import config from "@/config";

const { combine, timestamp, printf } = winston.format;

const logger = winston.createLogger({
  level: "info",
  format: combine(
    timestamp(),
    printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ""}`;
    }),
  ),
  handleExceptions: config.env === "development",
  handleRejections: config.env === "development",
  transports: [new winston.transports.File({ filename: "application.log" })],
});

export default logger;
