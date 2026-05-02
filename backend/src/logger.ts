import pino from 'pino';
import { config } from './config';

export const logger = pino({
  level: config.logLevel,
  base: { service: 'combar-backend' },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});
