import winston from "winston";
import { AsyncLocalStorage } from "async_hooks";

const asyncLocalStorage = new AsyncLocalStorage<Map<string, string>>();

const { combine, timestamp, json, colorize, printf } = winston.format;

const isProduction = process.env.NODE_ENV === "production";

const consoleFormat = combine(
  colorize(),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  printf(({ timestamp, level, message, correlationId, ...meta }) => {
    const correlationIdPart = correlationId ? ` [${correlationId}]` : "";

    const hasMeta = Object.keys(meta).length > 0;

    const metaPart = hasMeta ? ` ${JSON.stringify(meta)}` : "";

    return `${timestamp} ${level}${correlationIdPart}: ${message}${metaPart}`;
  }),
);

const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

export class Logger {
  static getStore() {
    return asyncLocalStorage.getStore();
  }

  static runWithContext(context: Map<string, string>, fn: () => void) {
    asyncLocalStorage.run(context, fn);
  }

  private static getCorrelationId(): string | undefined {
    return asyncLocalStorage.getStore()?.get("correlationId");
  }

  static info(message: string, meta?: any): void {
    winstonLogger.info(message, { ...meta, correlationId: this.getCorrelationId() });
  }

  static error(message: string, error?: any): void {
    if (error instanceof Error) {
      winstonLogger.error(message, {
        error: { message: error.message, stack: error.stack },
        correlationId: this.getCorrelationId(),
      });
    } else {
      winstonLogger.error(message, { error, correlationId: this.getCorrelationId() });
    }
  }

  static warn(message: string, meta?: any): void {
    winstonLogger.warn(message, { ...meta, correlationId: this.getCorrelationId() });
  }

  static debug(message: string, meta?: any): void {
    winstonLogger.debug(message, { ...meta, correlationId: this.getCorrelationId() });
  }
}
