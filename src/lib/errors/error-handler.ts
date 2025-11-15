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
import * as Sentry from '@sentry/nextjs';
import type { JsonValue } from '@/types/common';

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

  // Handle authentication errors early - these are expected and shouldn't be logged as errors
  if (isAuthenticationError(error)) {
    // Skip logging for test tokens to reduce noise in test output
    const authHeader = request.headers.get('authorization');
    const isTestToken = authHeader?.includes('test-token');
    
    // Log authentication failures at warn level (expected behavior for unauthenticated requests)
    // But skip logging for test tokens
    if (!isTestToken) {
      logger.warn('Authentication failed', {
        error: error.message,
        ...errorContext
      });
    }

    return NextResponse.json(
      {
        error: error.message || 'Authentication required'
      },
      { status: 401 }
    );
  }

  // Handle validation errors early - these are expected client input issues
  if (error instanceof ZodError) {
    // Skip logging for test tokens to reduce noise in test output
    const authHeader = request.headers.get('authorization');
    const isTestToken = authHeader?.includes('test-token');
    
    // Log validation errors at warn level (expected behavior for invalid client input)
    // But skip logging for test requests
    if (!isTestToken) {
      logger.warn('Validation error', {
        error: error.message,
        issues: error.issues,
        name: error.name,
        ...errorContext
      });
    }

    return NextResponse.json(
      {
        error: 'Validation failed',
        details: error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      },
      { status: 400 }
    );
  }

  // Handle client errors (4xx) at lower log level - these are expected behavior
  if (error instanceof BabylonError && error.statusCode >= 400 && error.statusCode < 500) {
    // Log 4xx client errors at warn level (expected behavior for invalid requests)
    logger.warn('Client error', {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      name: error.name,
      ...errorContext
    });
  } else {
    // Log unexpected errors at ERROR level
    logger.error('API Error', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      ...errorContext
    });
  }

  // Track error with PostHog (async, don't await to avoid slowing down response)
  // Skip tracking authentication errors, validation errors, and 4xx client errors as they're expected behavior
  const userId = request.headers.get('x-user-id') || null;
  const isClientError = error instanceof BabylonError && error.statusCode >= 400 && error.statusCode < 500;
  if (!isAuthenticationError(error) && !(error instanceof ZodError) && !isClientError) {
    void trackServerError(userId, error, {
      endpoint: new URL(request.url).pathname,
      method: request.method,
    });
  }

  // Capture error in Sentry (only for server errors, not client errors like validation)
  // Skip capturing validation errors, authentication errors, and known operational errors
  const shouldCaptureInSentry = 
    error instanceof Error &&
    !(error instanceof ZodError) &&
    !(error instanceof BabylonError && error.isOperational && error.statusCode < 500) &&
    !isAuthenticationError(error) &&
    error.name !== 'ValidationError';

  if (shouldCaptureInSentry) {
    Sentry.withScope((scope) => {
      // Add request context
      scope.setContext('request', {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
      });

      // Add user context if available
      if (userId) {
        scope.setUser({ id: userId });
      }

      // Add additional context for Babylon errors
      if (error instanceof BabylonError && error.context) {
        scope.setContext('errorContext', error.context);
        scope.setTag('errorCode', error.code);
      }

      // Capture the exception
      Sentry.captureException(error);
    });
  }

  // Handle Babylon errors (our custom errors)
  if (error instanceof BabylonError) {
    const errorData: Record<string, JsonValue> = { error: error.message }
    if (error.context?.details) {
      errorData.details = error.context.details as JsonValue
    }
    if (process.env.NODE_ENV === 'development') {
      errorData.code = error.code
      if (error.stack) {
        errorData.stack = error.stack
      }
    }
    
    return NextResponse.json(
      errorData,
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
    const errorData: Record<string, JsonValue> = { error: 'Invalid database query' }
    if (process.env.NODE_ENV === 'development') {
      errorData.details = error.message
    }
    
    return NextResponse.json(errorData, { status: 400 });
  }

  // Handle native JavaScript errors
  if (error.name === 'SyntaxError') {
    return NextResponse.json(
      {
        error: 'Invalid JSON in request body'
      },
      { status: 400 }
    );
  }

  if (error.name === 'TypeError') {
    return NextResponse.json(
      {
        error: process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : error.message
      },
      { status: 500 }
    );
  }

  // Default error response
  const errorData: Record<string, JsonValue> = {
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error.message
  }
  
  if (process.env.NODE_ENV === 'development' && error.stack) {
    errorData.stack = error.stack
  }
  
  return NextResponse.json(errorData, { status: 500 });
}

/**
 * Handle Prisma-specific errors
 */
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): NextResponse {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      const fields = error.meta?.target as string[] | undefined;
      const errorData: Record<string, JsonValue> = { error: `Duplicate entry for field(s): ${fields?.join(', ') || 'unknown'}` }
      if (fields) errorData.fields = fields
      return NextResponse.json(errorData, { status: 409 });

    case 'P2025':
      // Record not found
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });

    case 'P2003':
      // Foreign key constraint failure
      const field = error.meta?.field_name as string | undefined;
      const fkErrorData: Record<string, JsonValue> = { error: `Foreign key constraint failed on field: ${field || 'unknown'}` }
      if (field) fkErrorData.field = field
      return NextResponse.json(fkErrorData, { status: 400 });

    case 'P2014':
      // Relation violation
      return NextResponse.json(
        {
          error: 'The change you are trying to make would violate the required relation'
        },
        { status: 400 }
      );

    case 'P2016':
      // Query interpretation error
      return NextResponse.json(
        {
          error: 'Query interpretation error'
        },
        { status: 400 }
      );

    default:
      // Generic database error
      const dbErrorData: Record<string, JsonValue> = { error: 'Database operation failed' }
      if (process.env.NODE_ENV === 'development') {
        dbErrorData.prismaCode = error.code
        dbErrorData.meta = error.meta as JsonValue
      }
      return NextResponse.json(dbErrorData, { status: 500 });
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
      const response = await handler(req, context!);
      return response;
    } catch (error) {
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
  return async (req: NextRequest, context?: TContext) => {
    // Run setup if provided
    if (setup) {
      await setup();
    }

    // Run the main handler
    if (!handler) {
      throw new Error('Handler function is required');
    }
    
    try {
      const response = await handler(req, context);

      // Run teardown if provided (only on success)
      if (teardown) {
        await teardown();
      }

      return response;
    } finally {
      // Run teardown even on error (if provided)
      if (teardown) {
        await teardown();
      }
    }
  };
}

/**
 * Type-safe error response helper
 */
export function errorResponse(
  message: string,
  code: string,
  statusCode: number,
  details?: Record<string, JsonValue>
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
