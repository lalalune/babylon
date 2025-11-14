/**
 * Global error handler and middleware for API routes
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { BabylonError } from './base.errors';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { isAuthenticationError } from '@/lib/api/auth-middleware';
import { trackServerError } from '@/lib/posthog/server';

/**
 * Main error handler that processes all errors and returns appropriate responses
 */
export function errorHandler(error: Error | unknown, request: NextRequest): NextResponse {
  // Log the error with context
  const errorContext = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    timestamp: new Date().toISOString()
  };

  // Handle unknown errors
  if (!(error instanceof Error)) {
    logger.error('Unknown error type', {
      error: String(error),
      ...errorContext
    });

    return NextResponse.json(
      {
        error: {
          message: 'An unexpected error occurred',
          code: 'UNKNOWN_ERROR'
        }
      },
      { status: 500 }
    );
  }

  // Log the error
  logger.error('API Error', {
    error: error.message,
    stack: error.stack,
    name: error.name,
    ...errorContext
  });

  // Track error with PostHog (async, don't await to avoid slowing down response)
  const userId = request.headers.get('x-user-id') || null;
  trackServerError(userId, error, {
    endpoint: new URL(request.url).pathname,
    method: request.method,
  }).catch((trackError) => {
    logger.warn('Failed to track error with PostHog', { error: trackError });
  });

  // Handle authentication errors consistently
  if (isAuthenticationError(error)) {
    return NextResponse.json(
      {
        error: {
          message: error.message || 'Authentication required',
          code: 'AUTH_FAILED'
        }
      },
      { status: 401 }
    );
  }

  // Handle Babylon errors (our custom errors)
  if (error instanceof BabylonError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          code: error.code,
          ...(process.env.NODE_ENV === 'development' && {
            stack: error.stack,
            context: error.context
          })
        }
      },
      {
        status: error.statusCode,
        headers: error.code === 'RATE_LIMIT' && error.context?.retryAfter
          ? { 'Retry-After': String(error.context.retryAfter) }
          : undefined
      }
    );
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(error);
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return NextResponse.json(
      {
        error: {
          message: 'Invalid database query',
          code: 'DATABASE_VALIDATION_ERROR',
          ...(process.env.NODE_ENV === 'development' && {
            details: error.message
          })
        }
      },
      { status: 400 }
    );
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          violations: error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        }
      },
      { status: 400 }
    );
  }

  // Handle native JavaScript errors
  if (error.name === 'SyntaxError') {
    return NextResponse.json(
      {
        error: {
          message: 'Invalid JSON in request body',
          code: 'INVALID_JSON'
        }
      },
      { status: 400 }
    );
  }

  if (error.name === 'TypeError') {
    return NextResponse.json(
      {
        error: {
          message: process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : error.message,
          code: 'TYPE_ERROR'
        }
      },
      { status: 500 }
    );
  }

  // Default error response
  return NextResponse.json(
    {
      error: {
        message: process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : error.message,
        code: 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack
        })
      }
    },
    { status: 500 }
  );
}

/**
 * Handle Prisma-specific errors
 */
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): NextResponse {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      const fields = error.meta?.target as string[] | undefined;
      return NextResponse.json(
        {
          error: {
            message: `Duplicate entry for field(s): ${fields?.join(', ') || 'unknown'}`,
            code: 'DUPLICATE_ENTRY',
            fields
          }
        },
        { status: 409 }
      );

    case 'P2025':
      // Record not found
      return NextResponse.json(
        {
          error: {
            message: 'Record not found',
            code: 'NOT_FOUND'
          }
        },
        { status: 404 }
      );

    case 'P2003':
      // Foreign key constraint failure
      const field = error.meta?.field_name as string | undefined;
      return NextResponse.json(
        {
          error: {
            message: `Foreign key constraint failed on field: ${field || 'unknown'}`,
            code: 'FOREIGN_KEY_CONSTRAINT',
            field
          }
        },
        { status: 400 }
      );

    case 'P2014':
      // Relation violation
      return NextResponse.json(
        {
          error: {
            message: 'The change you are trying to make would violate the required relation',
            code: 'RELATION_VIOLATION'
          }
        },
        { status: 400 }
      );

    case 'P2016':
      // Query interpretation error
      return NextResponse.json(
        {
          error: {
            message: 'Query interpretation error',
            code: 'QUERY_ERROR'
          }
        },
        { status: 400 }
      );

    default:
      // Generic database error
      return NextResponse.json(
        {
          error: {
            message: 'Database operation failed',
            code: 'DATABASE_ERROR',
            ...(process.env.NODE_ENV === 'development' && {
              prismaCode: error.code,
              meta: error.meta
            })
          }
        },
        { status: 500 }
      );
  }
}

/**
 * Route handler context type for Next.js API routes
 * Supports both sync and async (Promise) params for Next.js 14+
 */
export interface RouteContext {
  params?: Record<string, string | string[]> | Promise<Record<string, string | string[]>>;
}

/**
 * Higher-order function wrapper for API routes with error handling
 * @param handler The async route handler function
 * @returns A wrapped handler with automatic error handling
 */
// Overload 1: Handler without context (for routes without dynamic params)
export function withErrorHandling(
  handler: (req: NextRequest) => Promise<NextResponse> | NextResponse
): (req: NextRequest) => Promise<NextResponse>;

// Overload 2: Handler with context (for routes with dynamic params)
export function withErrorHandling<TContext extends RouteContext = RouteContext>(
  handler: (
    req: NextRequest,
    context: TContext
  ) => Promise<NextResponse> | NextResponse
): (req: NextRequest, context: TContext) => Promise<NextResponse>;

// Implementation
export function withErrorHandling<TContext extends RouteContext = RouteContext>(
  handler: (
    req: NextRequest,
    context?: TContext
  ) => Promise<NextResponse> | NextResponse
): (req: NextRequest, context?: TContext) => Promise<NextResponse> {
  return async (req: NextRequest, context?: TContext): Promise<NextResponse> => {
    try {
      // Execute the handler
      const response = await handler(req, context!);
      return response;
    } catch (error) {
      // Handle any errors that occur
      return errorHandler(error, req);
    }
  };
}

/**
 * Async wrapper for route handlers with error boundaries
 * Useful for handlers that need setup or teardown
 */
export function asyncHandler<TContext extends RouteContext = RouteContext>(
  setup?: () => Promise<void>,
  handler?: (req: NextRequest, context?: TContext) => Promise<NextResponse>,
  teardown?: () => Promise<void>
): (req: NextRequest, context?: TContext) => Promise<NextResponse> {
  return withErrorHandling(async (req: NextRequest, context?: TContext) => {
    try {
      // Run setup if provided
      if (setup) {
        await setup();
      }

      // Run the main handler
      if (!handler) {
        throw new Error('Handler function is required');
      }
      const response = await handler(req, context);

      // Run teardown if provided (only on success)
      if (teardown) {
        await teardown();
      }

      return response;
    } catch (error) {
      // Run teardown even on error (if provided)
      if (teardown) {
        try {
          await teardown();
        } catch (teardownError) {
          logger.error('Teardown failed', teardownError);
        }
      }
      throw error;
    }
  });
}

/**
 * Type-safe error response helper
 */
export function errorResponse(
  message: string,
  code: string,
  statusCode: number,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      error: {
        message,
        code,
        ...details
      }
    },
    { status: statusCode }
  );
}

/**
 * Success response helper
 */
export function successResponse<T>(
  data: T,
  statusCode: number = 200,
  headers?: HeadersInit
): NextResponse {
  return NextResponse.json(data, { status: statusCode, headers });
}
