import winston from "winston";
import path from "path";
import fs from "fs";

const isServerless =
  !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const isCloudPlatform =
  !!process.env.RENDER ||
  !!process.env.RAILWAY_ENVIRONMENT ||
  !!process.env.FLY_APP_NAME;
const logDir = path.join(process.cwd(), "logs");

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  }),
);

const transports: winston.transport[] = [];

// Always add console transport for cloud platforms (Render, Railway, Fly.io)
// These platforms need stdout/stderr to display logs
if (isServerless || isCloudPlatform) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    }),
  );
} else {
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (error: any) {
      console.warn(
        "Failed to create logs directory, using console only:",
        error.message,
      );
    }
  }

  if (fs.existsSync(logDir)) {
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, "error.log"),
        level: "error",
      }),
      new winston.transports.File({
        filename: path.join(logDir, "app.log"),
      }),
    );
  }

  // Always add console transport for local development
  // For production on cloud platforms, console is added above
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    }),
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "emittr-game-backend" },
  transports,
});
