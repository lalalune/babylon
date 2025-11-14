/**
 * Retry Utility for Network Calls
 * 
 * Provides retry logic for fetch calls and other async operations
 * with exponential backoff
 */

import { logger } from './logger'

interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
}

/**
 * Check if error is retryable (network errors, 5xx, rate limits)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true // Network errors
  }
  
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    // Retry on 5xx errors and 429 (rate limit)
    return status >= 500 || status === 429
  }
  
  return false
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry an async operation if it fails with a retryable error
 */
export async function retryIfRetryable<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | undefined

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      // Check if we should retry
      if (!isRetryableError(error)) {
        throw error // Not retryable, throw immediately
      }

      // Don't retry if we've exhausted attempts
      if (attempt === opts.maxAttempts - 1) {
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelayMs
      )

      logger.debug('Retrying operation', {
        attempt: attempt + 1,
        maxAttempts: opts.maxAttempts,
        delayMs: delay,
        error: error instanceof Error ? error.message : String(error),
      }, 'retry')

      await sleep(delay)
    }
  }

  throw lastError || new Error('Operation failed with unknown error')
}

/**
 * Retry with custom retry condition
 */
export async function retryWithCondition<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | undefined

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      if (!shouldRetry(error)) {
        throw error
      }

      if (attempt === opts.maxAttempts - 1) {
        throw error
      }

      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelayMs
      )

      await sleep(delay)
    }
  }

  throw lastError || new Error('Operation failed with unknown error')
}






