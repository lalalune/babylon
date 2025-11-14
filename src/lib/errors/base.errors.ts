/**
 * Base error classes for the Babylon application
 * Provides structured error handling with proper context and metadata
 */

/**
 * Base error class for all Babylon errors
 * Extends the native Error class with additional context and metadata
 */
export abstract class BabylonError extends Error {
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging and API responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }
}

/**
 * Validation error for input validation failures
 */
export class ValidationError extends BabylonError {
  constructor(
    message: string,
    public readonly fields?: string[],
    public readonly violations?: Array<{ field: string; message: string }>
  ) {
    super(message, 'VALIDATION_ERROR', 400, true, { fields, violations });
  }
}

/**
 * Authentication error for auth failures
 */
export class AuthenticationError extends BabylonError {
  constructor(
    message: string,
    public readonly reason: 'NO_TOKEN' | 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'INVALID_CREDENTIALS'
  ) {
    super(message, `AUTH_${reason}`, 401, true, { reason });
  }
}

/**
 * Authorization error for permission failures
 */
export class AuthorizationError extends BabylonError {
  constructor(
    message: string,
    public readonly resource: string,
    public readonly action: string
  ) {
    super(
      message,
      'FORBIDDEN',
      403,
      true,
      { resource, action }
    );
  }
}

/**
 * Not found error for missing resources
 */
export class NotFoundError extends BabylonError {
  constructor(resource: string, identifier: string | number) {
    super(
      `${resource} not found: ${identifier}`,
      'NOT_FOUND',
      404,
      true,
      { resource, identifier }
    );
  }
}

/**
 * Conflict error for duplicate resources or conflicting operations
 */
export class ConflictError extends BabylonError {
  constructor(message: string, public readonly conflictingResource?: string) {
    super(message, 'CONFLICT', 409, true, { conflictingResource });
  }
}

/**
 * Database error for Prisma/database issues
 */
export class DatabaseError extends BabylonError {
  constructor(
    message: string,
    public readonly operation: string,
    originalError?: Error
  ) {
    super(
      message,
      'DATABASE_ERROR',
      500,
      true,
      {
        operation,
        originalError: originalError?.message,
        originalStack: process.env.NODE_ENV === 'development' ? originalError?.stack : undefined
      }
    );
  }
}

/**
 * External service error for third-party service failures
 */
export class ExternalServiceError extends BabylonError {
  constructor(
    service: string,
    message: string,
    public readonly originalStatusCode?: number
  ) {
    super(
      `${service}: ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      true,
      { service, originalStatusCode }
    );
  }
}

/**
 * Rate limit error for rate limiting
 */
export class RateLimitError extends BabylonError {
  constructor(
    public readonly limit: number,
    public readonly windowMs: number,
    public readonly retryAfter?: number
  ) {
    super(
      `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
      'RATE_LIMIT',
      429,
      true,
      { limit, windowMs, retryAfter }
    );
  }
}

/**
 * Business logic error for domain-specific errors
 */
export class BusinessLogicError extends BabylonError {
  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>
  ) {
    super(message, code, 400, true, context);
  }
}

/**
 * Bad request error for malformed requests
 */
export class BadRequestError extends BabylonError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'BAD_REQUEST', 400, true, details);
  }
}

/**
 * Internal server error for unexpected failures
 */
export class InternalServerError extends BabylonError {
  constructor(message: string = 'An unexpected error occurred', details?: Record<string, unknown>) {
    super(message, 'INTERNAL_ERROR', 500, false, details);
  }
}

/**
 * Service unavailable error for temporary outages
 */
export class ServiceUnavailableError extends BabylonError {
  constructor(
    message: string = 'Service temporarily unavailable',
    public readonly retryAfter?: number
  ) {
    super(message, 'SERVICE_UNAVAILABLE', 503, true, { retryAfter });
  }
}