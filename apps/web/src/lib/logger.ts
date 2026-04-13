// @ts-ignore - vendored pino browser implementation
import { pino } from './pino-browser'

const LOG_LEVEL =
  process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'warn' : 'debug')

export const logger = pino({
  level: LOG_LEVEL,
  browser: {
    asObject: false,
  },
})

export type Logger = typeof logger
