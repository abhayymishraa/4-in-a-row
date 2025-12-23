import winston from 'winston';
import path from 'path';
import fs from 'fs';

const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const logDir = path.join(process.cwd(), 'logs');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

const transports: winston.transport[] = [];

if (isServerless) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat
    })
  );
} else {
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (error: any) {
      console.warn('Failed to create logs directory, using console only:', error.message);
    }
  }

  if (fs.existsSync(logDir)) {
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error'
      }),
      new winston.transports.File({
        filename: path.join(logDir, 'app.log')
      })
    );
  }

  if (process.env.NODE_ENV !== 'production') {
    transports.push(
      new winston.transports.Console({
        format: consoleFormat
      })
    );
  }
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'emittr-game-backend' },
  transports
});

export function createLogger(context?: Record<string, any>) {
  if (!context) {
    return logger;
  }

  return logger.child(context);
}

