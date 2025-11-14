/**
 * Shared Logger Utility
 * Production-ready logging with configurable levels and environment awareness
 */

import type { LogData } from '@/types/common'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: LogData
  context?: string
}

class Logger {
  private level: LogLevel
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  }

  constructor() {
    // Set log level based on environment
    const envLevel = process.env.LOG_LEVEL as LogLevel | undefined
    if (envLevel && this.levelPriority[envLevel] !== undefined) {
      this.level = envLevel
    } else {
      // Default: debug in development, info in production
      this.level = process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.level]
  }

  private formatLog(entry: LogEntry): string {
    const contextStr = entry.context ? `[${entry.context}]` : ''
    let dataStr = ''
    if (entry.data) {
      // Handle cyclic structures and errors
      dataStr = ` ${JSON.stringify(entry.data, (_key, value) => {
        // Handle Error objects specially
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
          }
        }
        return value
      })}`
    }
    return `[${entry.timestamp}] ${contextStr} [${entry.level.toUpperCase()}] ${entry.message}${dataStr}`
  }

  private log(level: LogLevel, message: string, data?: LogData, context?: string): void {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context
    }

    const formatted = this.formatLog(entry)

    // In production, we might want to send errors to external logging service
    // For now, use console methods but through a structured logger
    switch (level) {
      case 'debug':
      case 'info':
        console.log(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
        console.error(formatted)
        break
    }
  }

  debug(message: string, data?: LogData, context?: string): void {
    this.log('debug', message, data, context)
  }

  info(message: string, data?: LogData, context?: string): void {
    this.log('info', message, data, context)
  }

  warn(message: string, data?: LogData, context?: string): void {
    this.log('warn', message, data, context)
  }

  error(message: string, data?: LogData, context?: string): void {
    this.log('error', message, data, context)
  }

  setLevel(level: LogLevel): void {
    this.level = level
  }

  getLevel(): LogLevel {
    return this.level
  }
}

// Export singleton instance
export const logger = new Logger()

// Export class for testing or custom instances
export { Logger }


