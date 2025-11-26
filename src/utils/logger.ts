import winston from "winston";

const { combine, timestamp, printf } = winston.format;

const logger = winston.createLogger({
  level: "info",
  format: combine(
    timestamp(),
    printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ""}`;
    }),
  ),
  transports: [new winston.transports.File({ filename: "application.log" })],
});

export default logger;
