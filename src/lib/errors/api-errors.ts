/**
 * API Error Handling Utilities
 *
 * Provides standardized error classes and handling for API routes.
 * Ensures consistent error responses across all endpoints.
 */

import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { z } from 'zod'

/**
 * Base API Error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends ApiError {
  constructor(message: string, code?: string) {
    super(message, 400, code)
    this.name = 'BadRequestError'
  }
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized', code?: string) {
    super(message, 401, code)
    this.name = 'UnauthorizedError'
  }
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden', code?: string) {
    super(message, 403, code)
    this.name = 'ForbiddenError'
  }
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource', code?: string) {
    super(`${resource} not found`, 404, code)
    this.name = 'NotFoundError'
  }
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends ApiError {
  constructor(message: string, code?: string) {
    super(message, 409, code)
    this.name = 'ConflictError'
  }
}

/**
 * Unprocessable Entity Error (422)
 */
export class ValidationError extends ApiError {
  constructor(
    message: string,
    public errors?: Record<string, string[]>,
    code?: string
  ) {
    super(message, 422, code)
    this.name = 'ValidationError'
  }
}

/**
 * Rate Limit Error (429)
 */
export class RateLimitError extends ApiError {
  constructor(
    message: string = 'Too many requests',
    public reset?: number,
    code?: string
  ) {
    super(message, 429, code)
    this.name = 'RateLimitError'
  }
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error', code?: string) {
    super(message, 500, code)
    this.name = 'InternalServerError'
  }
}

/**
 * Service Unavailable Error (503)
 */
export class ServiceUnavailableError extends ApiError {
  constructor(message: string = 'Service temporarily unavailable', code?: string) {
    super(message, 503, code)
    this.name = 'ServiceUnavailableError'
  }
}

/**
 * Error response interface
 * Note: The canonical ErrorResponse is in @/lib/errors/index.ts
 * This is a legacy version, import from index.ts instead
 */
import type { ErrorResponse } from './index';

/**
 * Create standardized error response
 *
 * @param error - Error object
 * @param request - Optional request object for path logging
 * @returns NextResponse with error details
 */
export function createErrorResponse(
  error: unknown,
  request?: Request
): NextResponse<ErrorResponse> {
  let statusCode = 500
  let message = 'An unexpected error occurred'
  let code: string | undefined
  let errors: Record<string, string[]> | undefined

  if (error instanceof ApiError) {
    statusCode = error.statusCode
    message = error.message
    code = error.code

    if (error instanceof ValidationError) {
      errors = error.errors
    }
  } else if (error instanceof z.ZodError) {
    // Handle Zod validation errors
    statusCode = 422
    message = 'Validation error'
    code = 'VALIDATION_ERROR'
    errors = {}

    for (const issue of error.issues) {
      const path = issue.path.join('.')
      if (!errors[path]) {
        errors[path] = []
      }
      errors[path].push(issue.message)
    }
  } else if (error instanceof Error) {
    message = error.message

    // Check for specific error patterns
    if (error.message.includes('not found')) {
      statusCode = 404
      code = 'NOT_FOUND'
    } else if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
      statusCode = 401
      code = 'UNAUTHORIZED'
    } else if (error.message.includes('forbidden') || error.message.includes('permission')) {
      statusCode = 403
      code = 'FORBIDDEN'
    } else if (error.message.includes('duplicate') || error.message.includes('already exists')) {
      statusCode = 409
      code = 'CONFLICT'
    }
  }

  const errorResponse: ErrorResponse = {
    error: {
      message,
      code: code || 'UNKNOWN_ERROR',
      violations: errors ? Object.entries(errors).map(([field, msgs]) => ({ field, message: msgs.join(', ') })) : undefined,
      context: request ? { path: new URL(request.url).pathname } : undefined
    }
  }

  // Log error
  if (statusCode >= 500) {
    logger.error('API error', {
      error: errorResponse,
      stack: error instanceof Error ? error.stack : undefined,
    })
  } else {
    logger.warn('API client error', errorResponse)
  }

  return NextResponse.json(errorResponse, { status: statusCode })
}

/**
 * Async error handler wrapper for API routes
 *
 * @param handler - Async API route handler
 * @returns Wrapped handler with error handling
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return createErrorResponse(error, args[0] as Request)
    }
  }
}

/**
 * Validate request body against Zod schema
 *
 * @param request - Request object
 * @param schema - Zod schema
 * @returns Validated data
 * @throws ValidationError if validation fails
 */
export async function validateRequestBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      throw new BadRequestError('Invalid JSON in request body', 'INVALID_JSON')
    }
    return schema.parse(body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error
    }

    throw new BadRequestError('Invalid JSON in request body')
  }
}

/**
 * Validate query parameters against Zod schema
 *
 * @param searchParams - URLSearchParams object
 * @param schema - Zod schema
 * @returns Validated data
 * @throws ValidationError if validation fails
 */
export function validateQueryParams<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> {
  const params = Object.fromEntries(searchParams.entries())
  return schema.parse(params)
}

/**
 * Assert user is authenticated
 *
 * @param userId - User ID from session
 * @throws UnauthorizedError if not authenticated
 */
export function requireAuth(userId: string | null | undefined): asserts userId is string {
  if (!userId) {
    throw new UnauthorizedError('Authentication required')
  }
}

/**
 * Assert user has required permission
 *
 * @param hasPermission - Permission check result
 * @param resource - Resource being accessed
 * @throws ForbiddenError if permission denied
 */
export function requirePermission(
  hasPermission: boolean,
  resource: string = 'this resource'
): asserts hasPermission {
  if (!hasPermission) {
    throw new ForbiddenError(`You don't have permission to access ${resource}`)
  }
}

/**
 * Assert resource exists
 *
 * @param resource - Resource to check
 * @param name - Resource name for error message
 * @throws NotFoundError if resource is null/undefined
 */
export function requireResource<T>(
  resource: T | null | undefined,
  name: string = 'Resource'
): asserts resource is T {
  if (resource === null || resource === undefined) {
    throw new NotFoundError(name)
  }
}
