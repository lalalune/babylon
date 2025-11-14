/**
 * A2A Logger Utility
 * Structured logging with configurable levels
 */

import type { LogData } from '@/types/common'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: LogData
}

export class Logger {
  private level: LogLevel
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  }

  constructor(level: LogLevel = 'info') {
    this.level = level
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.level]
  }

  private formatLog(entry: LogEntry): string {
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
    return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${dataStr}`
  }

  private log(level: LogLevel, message: string, data?: LogData): void {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    }

    const formatted = this.formatLog(entry)

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

  debug(message: string, data?: LogData): void {
    this.log('debug', message, data)
  }

  info(message: string, data?: LogData): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: LogData): void {
    this.log('warn', message, data)
  }

  error(message: string, data?: LogData): void {
    this.log('error', message, data)
  }

  setLevel(level: LogLevel): void {
    this.level = level
  }
}

// Export singleton instance
export const logger = new Logger(process.env.A2A_LOG_LEVEL as LogLevel || 'info')
