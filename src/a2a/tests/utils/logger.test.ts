/**
 * Logger Tests
 * Unit tests for the Logger utility
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { Logger } from '../../utils/logger'

describe('Logger', () => {
  let consoleLogSpy: typeof console.log
  let consoleWarnSpy: typeof console.warn
  let consoleErrorSpy: typeof console.error
  let logCalls: string[] = []
  let warnCalls: string[] = []
  let errorCalls: string[] = []

  beforeEach(() => {
    logCalls = []
    warnCalls = []
    errorCalls = []

    consoleLogSpy = console.log
    consoleWarnSpy = console.warn
    consoleErrorSpy = console.error

    console.log = (...args: unknown[]) => {
      logCalls.push(args.join(' '))
    }
    console.warn = (...args: unknown[]) => {
      warnCalls.push(args.join(' '))
    }
    console.error = (...args: unknown[]) => {
      errorCalls.push(args.join(' '))
    }
  })

  afterEach(() => {
    console.log = consoleLogSpy
    console.warn = consoleWarnSpy
    console.error = consoleErrorSpy
  })

  test('should log messages at info level by default', () => {
    const logger = new Logger()
    logger.info('test message')

    expect(logCalls.length).toBe(1)
    expect(logCalls[0]).toContain('[INFO]')
    expect(logCalls[0]).toContain('test message')
  })

  test('should not log debug messages when level is info', () => {
    const logger = new Logger('info')
    logger.debug('debug message')
    logger.info('info message')

    expect(logCalls.length).toBe(1)
    expect(logCalls[0]).toContain('[INFO]')
  })

  test('should log debug messages when level is debug', () => {
    const logger = new Logger('debug')
    logger.debug('debug message')

    expect(logCalls.length).toBe(1)
    expect(logCalls[0]).toContain('[DEBUG]')
    expect(logCalls[0]).toContain('debug message')
  })

  test('should log warnings', () => {
    const logger = new Logger()
    logger.warn('warning message')

    expect(warnCalls.length).toBe(1)
    expect(warnCalls[0]).toContain('[WARN]')
    expect(warnCalls[0]).toContain('warning message')
  })

  test('should log errors', () => {
    const logger = new Logger()
    logger.error('error message')

    expect(errorCalls.length).toBe(1)
    expect(errorCalls[0]).toContain('[ERROR]')
    expect(errorCalls[0]).toContain('error message')
  })

  test('should include data in log messages', () => {
    const logger = new Logger()
    logger.info('test', { key: 'value' })

    expect(logCalls[0]).toContain('{"key":"value"}')
  })

  test('should respect log level hierarchy', () => {
    const logger = new Logger('error')

    logger.debug('debug')
    logger.info('info')
    logger.warn('warn')
    logger.error('error')

    expect(logCalls.length).toBe(0)
    expect(warnCalls.length).toBe(0)
    expect(errorCalls.length).toBe(1)
  })

  test('should allow changing log level', () => {
    const logger = new Logger('info')
    logger.debug('before')

    logger.setLevel('debug')
    logger.debug('after')

    expect(logCalls.length).toBe(1)
    expect(logCalls[0]).toContain('after')
  })

  test('should include timestamp in log messages', () => {
    const logger = new Logger()
    logger.info('test')

    expect(logCalls[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T/)
  })
})
