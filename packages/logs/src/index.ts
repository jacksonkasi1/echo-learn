// ** import types
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: LogContext
}

// ** Configuration
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLogLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || 'info'

// ** Helper functions
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel]
}

function formatMessage(entry: LogEntry): string {
  const contextStr = entry.context
    ? ` ${JSON.stringify(entry.context)}`
    : ''
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${contextStr}`
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  }
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return

  const entry = createLogEntry(level, message, context)
  const formattedMessage = formatMessage(entry)

  switch (level) {
    case 'debug':
      console.debug(formattedMessage)
      break
    case 'info':
      console.info(formattedMessage)
      break
    case 'warn':
      console.warn(formattedMessage)
      break
    case 'error':
      console.error(formattedMessage)
      break
  }
}

// ** Logger interface
export const logger = {
  debug(message: string, context?: LogContext): void {
    log('debug', message, context)
  },

  info(message: string, context?: LogContext): void {
    log('info', message, context)
  },

  warn(message: string, context?: LogContext): void {
    log('warn', message, context)
  },

  error(message: string, error?: unknown): void {
    const context: LogContext = {}

    if (error instanceof Error) {
      context.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } else if (error !== undefined) {
      context.error = error
    }

    log('error', message, Object.keys(context).length > 0 ? context : undefined)
  },

  /**
   * Create a child logger with pre-set context
   */
  child(baseContext: LogContext) {
    return {
      debug: (message: string, context?: LogContext) =>
        log('debug', message, { ...baseContext, ...context }),
      info: (message: string, context?: LogContext) =>
        log('info', message, { ...baseContext, ...context }),
      warn: (message: string, context?: LogContext) =>
        log('warn', message, { ...baseContext, ...context }),
      error: (message: string, error?: unknown) => {
        const errorContext: LogContext = { ...baseContext }
        if (error instanceof Error) {
          errorContext.error = {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        } else if (error !== undefined) {
          errorContext.error = error
        }
        log('error', message, errorContext)
      },
    }
  },
}

// ** Export types
export type { LogLevel, LogContext, LogEntry }
