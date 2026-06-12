import winston from "winston";
import config from "@/config";
import { PRODUCTION } from "@/utils/constants";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const LOG_FILE = join(__dirname, "../../..", "application.log");

const { combine, timestamp, printf } = winston.format;

export default winston.createLogger({
  level: config.env === PRODUCTION ? "info" : "debug",
  format: combine(
    timestamp(),
    printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}${Object.keys(meta).length ? " " + JSON.stringify(meta) : ""}`;
    }),
  ),
  handleExceptions: config.env !== PRODUCTION,
  handleRejections: config.env !== PRODUCTION,
  transports: [new winston.transports.File({ filename: LOG_FILE })],
});
