/**
 * API Authentication Middleware
 *
 * Supports both Privy user authentication and agent session tokens
 */

import { verifyAgentSession } from '@/lib/auth/agent-auth';
import { prisma } from '@/lib/database-service';
import { logger } from '@/lib/logger';
import { PrivyClient } from '@privy-io/server-auth';
import type { User as PrivyUser } from '@privy-io/server-auth';
import { Prisma } from '@prisma/client';
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
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  const identityTokenHeader = request.headers.get('x-privy-identity-token');
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Fallback to privy-token cookie
    const cookieToken = request.cookies.get('privy-token')?.value;
    if (cookieToken) {
      token = cookieToken;
    }
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

  // Fall back to Privy user authentication
  try {
    const privy = getPrivyClient();
    const claims = await privy.verifyAuthToken(token);

    let dbUserId: string | undefined;
    let walletAddress: string | undefined;

    try {
      let dbUser = await prisma.user.findUnique({
        where: { privyId: claims.userId },
        select: { id: true, walletAddress: true },
      });

      let reLinked = false;
      if (!dbUser) {
        dbUser = await reconcilePrivyIdentity(claims.userId, identityTokenHeader);

        if (dbUser) {
          reLinked = true;
          logger.info(
            'Authenticated user re-linked to existing account',
            { privyId: claims.userId, userId: dbUser.id },
            'authenticate'
          );
        }
      }

      if (dbUser) {
        dbUserId = dbUser.id;
        walletAddress = dbUser.walletAddress ?? undefined;
      } else if (!reLinked) {
        logger.info(
          'Authenticated user has no existing DB record (new user)',
          { privyId: claims.userId },
          'authenticate'
        );
      }
    } catch (lookupError) {
      logger.warn('Failed to resolve database user after Privy auth', { privyId: claims.userId, error: lookupError }, 'authenticate');
    }

    return {
      userId: dbUserId ?? claims.userId,
      dbUserId,
      privyId: claims.userId,
      walletAddress,
      email: undefined,
      isAgent: false,
    };
  } catch (error) {
    // Handle specific authentication errors
    const errorMessage = extractErrorMessage(error);
    
    // Check if it's a token expiration error and try the cookie as a fallback
    if (errorMessage.includes('exp') || errorMessage.includes('expired') || errorMessage.includes('timestamp')) {
      // If we used the Authorization header, try the cookie as a fallback
      const cookieToken = request.cookies.get('privy-token')?.value;
      if (authHeader && cookieToken && cookieToken !== token) {
        try {
          const privy = getPrivyClient();
          const claims = await privy.verifyAuthToken(cookieToken);

          let dbUserId: string | undefined;
          let walletAddress: string | undefined;

          try {
            const dbUser = await prisma.user.findUnique({
              where: { privyId: claims.userId },
              select: { id: true, walletAddress: true },
            });

            if (dbUser) {
              dbUserId = dbUser.id;
              walletAddress = dbUser.walletAddress ?? undefined;
            }
          } catch (lookupError) {
            logger.warn('Failed to resolve database user after Privy auth', { privyId: claims.userId, error: lookupError }, 'authenticate');
          }

          return {
            userId: dbUserId ?? claims.userId,
            dbUserId,
            privyId: claims.userId,
            walletAddress,
            email: undefined,
            isAgent: false,
          };
        } catch {
          // Cookie token also failed, throw the original error
        }
      }
      
      const authError = new Error('Authentication token has expired. Please refresh your session.') as AuthenticationError;
      authError.code = 'AUTH_FAILED';
      throw authError;
    }
    
    // Generic authentication failure
    const authError = new Error('Authentication failed: ' + errorMessage) as AuthenticationError;
    authError.code = 'AUTH_FAILED';
    throw authError;
  }
}

type MinimalDbUser = { id: string; walletAddress: string | null };

async function reconcilePrivyIdentity(privyUserId: string, identityToken?: string | null): Promise<MinimalDbUser | null> {
  const privy = getPrivyClient();
  let privyProfile: PrivyUser | null = null;

  if (identityToken) {
    try {
      privyProfile = await privy.getUser({ idToken: identityToken });
    } catch (error) {
      logger.warn(
        'Failed to decode provided identity token while attempting identity reconciliation',
        { privyUserId, error },
        'authenticate'
      );
    }
  }

  if (!privyProfile) {
    try {
      privyProfile = await privy.getUser(privyUserId);
    } catch (error) {
      logger.warn(
        'Failed to fetch Privy profile while attempting identity reconciliation',
        { privyUserId, error },
        'authenticate'
      );
      return null;
    }
  }

  if (!privyProfile) {
    return null;
  }

  // Try wallet-based reconciliation first (most reliable & unique)
  const walletAddresses = extractWalletAddresses(privyProfile);
  const emails = extractEmailCandidates(privyProfile);
  const farcasterHandles = extractFarcasterHandles(privyProfile);

  for (const walletAddress of walletAddresses) {
    const existing = await prisma.user.findFirst({
      where: {
        walletAddress,
        isActor: false,
      },
      select: {
        id: true,
        walletAddress: true,
      },
    });

    if (existing && (await attachPrivyId(existing.id, privyUserId))) {
      logger.info(
        'Re-linked user to updated Privy app via wallet',
        { userId: existing.id, walletAddress, privyUserId },
        'authenticate'
      );
      return existing;
    }
  }

  for (const email of emails) {
    const existing = await prisma.user.findFirst({
      where: {
        isActor: false,
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        walletAddress: true,
      },
    });

    if (existing && (await attachPrivyId(existing.id, privyUserId))) {
      logger.info(
        'Re-linked user to updated Privy app via email',
        { userId: existing.id, email, privyUserId },
        'authenticate'
      );
      return existing;
    }
  }

  for (const farcaster of farcasterHandles) {
    const existing = await prisma.user.findFirst({
      where: {
        isActor: false,
        farcasterUsername: {
          equals: farcaster,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        walletAddress: true,
      },
    });

    if (existing && (await attachPrivyId(existing.id, privyUserId))) {
      logger.info(
        'Re-linked user to updated Privy app via farcaster',
        { userId: existing.id, farcaster, privyUserId },
        'authenticate'
      );
      return existing;
    }
  }

  return null;
}

async function attachPrivyId(userId: string, privyUserId: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { privyId: privyUserId },
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      logger.warn(
        'Unable to attach new privyId because it already exists on another record',
        { userId, privyUserId },
        'authenticate'
      );
      return false;
    }

    throw error;
  }
}

function extractWalletAddresses(privyUser: PrivyUser): string[] {
  const addresses = new Set<string>();
  const push = (value?: string | null) => {
    if (value) {
      addresses.add(value.toLowerCase());
    }
  };

  push(privyUser.wallet?.address);
  push(privyUser.smartWallet?.address);

  for (const account of privyUser.linkedAccounts ?? []) {
    if (
      account &&
      typeof account === 'object' &&
      'type' in account &&
      (account.type === 'wallet' || account.type === 'smart_wallet') &&
      'address' in account &&
      typeof account.address === 'string'
    ) {
      push(account.address);
    }
  }

  return Array.from(addresses);
}

function extractEmailCandidates(privyUser: PrivyUser): string[] {
  const emails = new Set<string>();
  const push = (value?: string | null) => {
    if (value) {
      emails.add(value.trim().toLowerCase());
    }
  };

  push(privyUser.email?.address);
  push(privyUser.apple?.email);
  push(privyUser.google?.email);
  push(privyUser.linkedin?.email);
  push(privyUser.discord?.email ?? undefined);
  push(privyUser.github?.email ?? undefined);

  for (const account of privyUser.linkedAccounts ?? []) {
    if (
      account &&
      typeof account === 'object' &&
      'type' in account &&
      'email' in account &&
      typeof account.email === 'string'
    ) {
      push(account.email);
    }

    if (
      account &&
      typeof account === 'object' &&
      account.type === 'email' &&
      'address' in account &&
      typeof account.address === 'string'
    ) {
      push(account.address);
    }
  }

  return Array.from(emails);
}

function extractFarcasterHandles(privyUser: PrivyUser): string[] {
  const handles = new Set<string>();
  const push = (value?: string | null) => {
    if (value) {
      handles.add(value.trim().toLowerCase());
    }
  };

  push(privyUser.farcaster?.username ?? privyUser.farcaster?.displayName ?? null);

  for (const account of privyUser.linkedAccounts ?? []) {
    if (
      account &&
      typeof account === 'object' &&
      'type' in account &&
      account.type === 'farcaster' &&
      'username' in account &&
      typeof account.username === 'string'
    ) {
      push(account.username);
    }

    if (
      account &&
      typeof account === 'object' &&
      'type' in account &&
      account.type === 'farcaster' &&
      'displayName' in account &&
      typeof account.displayName === 'string'
    ) {
      push(account.displayName);
    }
  }

  return Array.from(handles);
}

/**
 * Optional authentication - returns user if authenticated, null otherwise
 */
export async function optionalAuth(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    return await authenticate(request);
  } catch {
    return null;
  }
}

/**
 * Optional authentication from headers - for use when NextRequest is not available
 * Returns user if authenticated, null otherwise
 */
export async function optionalAuthFromHeaders(headers: Headers): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);

    // Try agent session authentication first (faster)
    const agentSession = await verifyAgentSession(token);
    if (agentSession) {
      return {
        userId: agentSession.agentId,
        isAgent: true,
      };
    }

    // Fall back to Privy user authentication
    const privy = getPrivyClient();
    const claims = await privy.verifyAuthToken(token);

    return {
      userId: claims.userId,
      walletAddress: undefined,
      email: undefined,
      isAgent: false,
    };
  } catch {
    return null;
  }
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
