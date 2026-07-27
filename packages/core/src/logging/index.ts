import pino, { Logger, Level } from 'pino';
import { getEnv } from '../config';

let loggerInstance: Logger | null = null;

export function getLogger(context?: Record<string, unknown>): Logger {
  if (loggerInstance) {
    return context ? loggerInstance.child(context) : loggerInstance;
  }

  const { NODE_ENV, LOG_LEVEL } = getEnv();

  const isDevelopment = NODE_ENV === 'development';

  loggerInstance = pino({
    level: LOG_LEVEL,
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: 'car-rental',
      environment: NODE_ENV,
    },
  });

  return context ? loggerInstance.child(context) : loggerInstance;
}

export function createLogger(context: Record<string, unknown>): Logger {
  return getLogger(context);
}

export const logger = getLogger();