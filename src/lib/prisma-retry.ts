/**
 * Prisma Retry Wrapper
 * 
 * Wraps Prisma operations with exponential backoff retry logic.
 * Automatically retries on connection failures, timeouts, and transient errors.
 * 
 * Features:
 * - Exponential backoff with jitter
 * - Configurable max retries
 * - Detailed logging
 * - Error classification (retryable vs non-retryable)
 */

import { logger } from './logger';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 5,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Error types that should be retried
 */
const RETRYABLE_ERROR_CODES = [
  'P1001', // Can't reach database server
  'P1002', // Database server timeout
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection
  'P2024', // Timed out fetching a new connection from the connection pool
];

const RETRYABLE_ERROR_MESSAGES = [
  'Can\'t reach database server',
  'Connection timeout',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'Connection terminated unexpectedly',
  'Connection is closed',
  'connection closed',
];

/**
 * Check if error is retryable based on error code and message
 * Exported for testing
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorObj = error as Error & { code?: string };
  
  // Check Prisma error codes
  if (errorObj.code && RETRYABLE_ERROR_CODES.includes(errorObj.code)) {
    return true;
  }

  // Check error messages
  const message = error.message || '';
  if (RETRYABLE_ERROR_MESSAGES.some(msg => message.includes(msg))) {
    return true;
  }

  // Only retry initialization errors (connection issues)
  // DO NOT retry PrismaClientKnownRequestError - these are usually validation/logic errors
  // that won't be fixed by retrying (like InvalidArg, unique constraint violations, etc.)
  if (error.name === 'PrismaClientInitializationError') {
    return true;
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  options: Required<RetryOptions>
): number {
  const exponentialDelay = Math.min(
    options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt),
    options.maxDelayMs
  );

  if (!options.jitter) {
    return exponentialDelay;
  }

  // Add jitter: random value between 0 and exponentialDelay
  return Math.floor(Math.random() * exponentialDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract error details for logging (without Symbol properties)
 */
function extractErrorDetails(error: Error, operation: string): Record<string, string | number> {
  const details: Record<string, string | number> = {
    operation,
    error: error.message,
    errorName: error.name,
  };
  
  const errorCode = (error as Error & { code?: string | number }).code;
  if (errorCode !== undefined && typeof errorCode !== 'symbol') {
    details.errorCode = errorCode;
  }
  
  return details;
}

/**
 * Execute operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await operation();
      
      // Log successful retry
      if (attempt > 0) {
        logger.info(
          `Operation succeeded after ${attempt} retries`,
          { operation: operationName, attempt },
          'PrismaRetry'
        );
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      if (!isRetryableError(error)) {
        // Suppress logging for known JsonBody enum issues with $queryRaw (these are expected when using retry proxy)
        // These errors occur when $queryRaw is used with Prisma.sql template literals through the proxy
        // Tests should use prismaBase.$queryRawUnsafe() instead to avoid this issue
        const isJsonBodyError = lastError.message?.includes('JsonBody') || 
                                lastError.message?.includes('$queryRaw');
        
        // Suppress logging for expected constraint violations in tests (P2002, P2003)
        // These are often intentionally triggered in tests to verify constraints work
        const errorCode = (lastError as Error & { code?: string }).code;
        const isConstraintViolation = errorCode === 'P2002' || errorCode === 'P2003';
        // Suppress logging for P2025 (record not found) errors - these are handled gracefully by callers
        // This prevents noise in logs when positions/records are deleted between operations
        const isRecordNotFoundError = errorCode === 'P2025';
        const isTestEnv = process.env.NODE_ENV === 'test' || 
                          process.env.BUN_ENV === 'test' ||
                          typeof Bun !== 'undefined' && Bun.main.includes('test');
        
        if (!isJsonBodyError && !(isConstraintViolation && isTestEnv) && !isRecordNotFoundError) {
          logger.warn(
            `Non-retryable error in operation`,
            extractErrorDetails(lastError, operationName),
            'PrismaRetry'
          );
        }
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt === opts.maxRetries) {
        logger.error(
          `Operation failed after ${opts.maxRetries} retries`,
          extractErrorDetails(lastError, operationName),
          'PrismaRetry'
        );
        throw error;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, opts);
      
      logger.warn(
        `Retrying operation after error`,
        {
          ...extractErrorDetails(lastError, operationName),
          attempt: attempt + 1,
          maxRetries: opts.maxRetries,
          delayMs: delay,
        },
        'PrismaRetry'
      );

      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Operation failed with unknown error');
}

/**
 * Create a retry-wrapped Prisma client proxy
 * 
 * Usage:
 *   const prismaWithRetry = createRetryProxy(prisma);
 *   const users = await prismaWithRetry.user.findMany();
 */
export function createRetryProxy<T extends object>(
  prismaClient: T,
  defaultOptions?: RetryOptions
): T {
  // Ensure we have a valid client to wrap
  if (!prismaClient || typeof prismaClient !== 'object') {
    throw new Error('Cannot create retry proxy: Prisma client is not initialized or invalid');
  }

  // Methods that should NOT be wrapped with retry logic
  // These are low-level Prisma operations with special serialization requirements
  const EXCLUDED_METHODS = new Set([
    '$transaction',     // Has its own retry/rollback logic
    '$executeRaw',      // Raw SQL operations shouldn't be auto-retried
    '$queryRaw',        // Raw SQL operations shouldn't be auto-retried
    '$queryRawUnsafe',  // Raw SQL operations shouldn't be auto-retried
    '$executeRawUnsafe',// Raw SQL operations shouldn't be auto-retried
    '$connect',         // Connection management
    '$disconnect',      // Connection management
    '$on',              // Event handlers
    '$use',             // Middleware
    '$extends',         // Extensions
  ]);

  return new Proxy(prismaClient, {
    get(target, modelName: string | symbol) {
      // Pass through Symbol properties without wrapping
      if (typeof modelName === 'symbol') {
        return target[modelName as keyof T];
      }
      
      // Pass through excluded methods without wrapping
      if (EXCLUDED_METHODS.has(String(modelName))) {
        return target[modelName as keyof T];
      }
      
      const model = target[modelName as keyof T];
      
      // If undefined or null, return as-is (don't proxy)
      if (model === undefined || model === null) {
        return model;
      }
      
      // If not an object, return as-is
      if (typeof model !== 'object') {
        return model;
      }

      // Return proxy for model methods
      // Use Reflect to properly access all properties including non-enumerable ones
      return new Proxy(model as Record<string | symbol, unknown>, {
        get(modelTarget, methodName: string | symbol) {
          // Pass through Symbol properties without wrapping
          if (typeof methodName === 'symbol') {
            return Reflect.get(modelTarget, methodName);
          }
          
          // Use Reflect.get to access the method (handles both enumerable and non-enumerable properties)
          const method = Reflect.get(modelTarget, methodName);
          
          // If undefined, return undefined
          if (method === undefined) {
            return undefined;
          }
          
          // If not a function, return as-is
          if (typeof method !== 'function') {
            return method;
          }

          // Wrap method with retry logic
          return function (...args: unknown[]) {
            const operationName = `${String(modelName)}.${methodName}`;
            return withRetry(
              () => (method as (...args: unknown[]) => Promise<unknown>).apply(modelTarget, args),
              operationName,
              defaultOptions
            );
          };
        },
      });
    },
  });
}

