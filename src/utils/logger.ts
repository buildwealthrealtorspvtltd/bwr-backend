import { env } from '../config/env';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

class Logger {
  private format(level: LogLevel, message: string, meta?: Record<string, unknown>): LogPayload {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta ? { meta } : {}),
    };
  }

  info(message: string, meta?: Record<string, unknown>) {
    const payload = this.format('info', message, meta);
    console.log(JSON.stringify(payload));
  }

  warn(message: string, meta?: Record<string, unknown>) {
    const payload = this.format('warn', message, meta);
    console.warn(JSON.stringify(payload));
  }

  error(message: string, meta?: Record<string, unknown>) {
    const payload = this.format('error', message, meta);
    console.error(JSON.stringify(payload));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (env.NODE_ENV !== 'production') {
      const payload = this.format('debug', message, meta);
      console.debug(JSON.stringify(payload));
    }
  }
}

export const logger = new Logger();
