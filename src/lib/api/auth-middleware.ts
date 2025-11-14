/**
 * API Authentication Middleware
 *
 * Supports both Privy user authentication and agent session tokens
 */

import { verifyAgentSession } from '@/lib/auth/agent-auth';
import { prisma } from '@/lib/database-service';
// import { logger } from '@/lib/logger';
import { PrivyClient } from '@privy-io/server-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import type { ErrorLike, JsonValue } from '@/types/common';

// Define error types locally since they were not in a shared file
export type AuthenticationError = Error & {
  code: 'AUTH_FAILED';
};

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'AUTH_FAILED'
  );
}

export function extractErrorMessage(error: Error | ErrorLike | string | unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const errorLike = error as ErrorLike
    if (typeof errorLike.message === 'string') {
      return errorLike.message;
    }
  }
  return 'An unknown error occurred';
}

// Lazy initialization of Privy client to prevent build-time errors
let privyClient: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const privyAppSecret = process.env.PRIVY_APP_SECRET;
    
    if (!privyAppId || !privyAppSecret) {
      throw new Error('Privy credentials not configured');
    }
    
    privyClient = new PrivyClient(privyAppId, privyAppSecret);
  }
  return privyClient;
}

export interface AuthenticatedUser {
  userId: string;
  dbUserId?: string;
  privyId?: string;
  walletAddress?: string;
  email?: string;
  isAgent?: boolean;
}

/**
 * Authenticate request and return user info
 * Supports both Privy user tokens and agent session tokens
 * Checks both Authorization header and privy-token cookie
 */
export async function authenticate(request: NextRequest): Promise<AuthenticatedUser> {
  const authHeader = request.headers.get('authorization');
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = request.cookies.get('privy-token')?.value;
  }

  if (!token) {
    const error = new Error('Missing or invalid authorization header or cookie') as AuthenticationError;
    error.code = 'AUTH_FAILED';
    throw error;
  }

  // Try agent session authentication first (faster)
  const agentSession = await verifyAgentSession(token);
  if (agentSession) {
    return {
      userId: agentSession.agentId,
      privyId: agentSession.agentId,
      isAgent: true,
    };
  }

  const privy = getPrivyClient();
  const claims = await privy.verifyAuthToken(token);

  const dbUser = await prisma.user.findUnique({
    where: { privyId: claims.userId },
    select: { id: true, walletAddress: true },
  });

  return {
    userId: dbUser?.id ?? claims.userId,
    dbUserId: dbUser?.id,
    privyId: claims.userId,
    walletAddress: dbUser?.walletAddress ?? undefined,
    email: undefined,
    isAgent: false,
  };
}

/**
 * Authenticate and require that the user has a database record
 * Throws an error if the user hasn't completed onboarding
 */
export async function authenticateWithDbUser(request: NextRequest): Promise<AuthenticatedUser & { dbUserId: string }> {
  const authUser = await authenticate(request);
  
  if (!authUser.dbUserId) {
    const error = new Error('User profile not found. Please complete onboarding first.') as AuthenticationError;
    error.code = 'AUTH_FAILED';
    throw error;
  }
  
  return authUser as AuthenticatedUser & { dbUserId: string };
}

/**
 * Optional authentication - returns user if authenticated, null otherwise
 */
export async function optionalAuth(request: NextRequest): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.get('authorization');
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = request.cookies.get('privy-token')?.value;
  }

  if (!token) {
    return null;
  }

  const agentSession = await verifyAgentSession(token);
  if (agentSession) {
    return {
      userId: agentSession.agentId,
      privyId: agentSession.agentId,
      isAgent: true,
    };
  }

  const privy = getPrivyClient();
  const claims = await privy.verifyAuthToken(token);

  const dbUser = await prisma.user.findUnique({
    where: { privyId: claims.userId },
    select: { id: true, walletAddress: true },
  });

  return {
    userId: dbUser?.id ?? claims.userId,
    dbUserId: dbUser?.id,
    privyId: claims.userId,
    walletAddress: dbUser?.walletAddress ?? undefined,
    email: undefined,
    isAgent: false,
  };
}

/**
 * Optional authentication from headers - for use when NextRequest is not available
 * Returns user if authenticated, null otherwise
 */
export async function optionalAuthFromHeaders(headers: Headers): Promise<AuthenticatedUser | null> {
  const authHeader = headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  const agentSession = await verifyAgentSession(token);
  if (agentSession) {
    return {
      userId: agentSession.agentId,
      isAgent: true,
    };
  }

  const privy = getPrivyClient();
  const claims = await privy.verifyAuthToken(token);

  return {
    userId: claims.userId,
    walletAddress: undefined,
    email: undefined,
    isAgent: false,
  };
}

/**
 * Standard error responses
 */
export function authErrorResponse(message: string = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function errorResponse(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function successResponse<T = JsonValue>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}
