/**
 * Admin Authentication Middleware
 * 
 * Verifies that the authenticated user has admin privileges
 */

import type { NextRequest } from 'next/server';
import type { AuthenticatedUser } from '@/lib/api/auth-middleware';
import { authenticate } from '@/lib/api/auth-middleware';
import { AuthorizationError } from '@/lib/errors';
import { prisma } from '@/lib/database-service';
import { logger } from '@/lib/logger';

/**
 * Authenticate request and verify admin privileges
 * @throws {AuthorizationError} if user is not authenticated or not an admin
 */
export async function requireAdmin(request: NextRequest): Promise<AuthenticatedUser> {
  // First authenticate the user
  const user = await authenticate(request);
  
  // In localhost, allow any authenticated user to access admin
  const isLocalhost = request.headers.get('host')?.includes('localhost') || 
                      request.headers.get('host')?.includes('127.0.0.1');
  
  if (isLocalhost) {
    logger.info(`Admin access granted (localhost bypass)`, { 
      userId: user.userId 
    }, 'requireAdmin');
    return user;
  }
  
  // Check if user is an admin in the database
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: {
      isAdmin: true,
      isBanned: true,
      username: true,
      displayName: true,
    },
  });

  if (!dbUser) {
    logger.warn(`Admin check failed: User not found in database`, { userId: user.userId }, 'requireAdmin');
    throw new AuthorizationError('User not found', 'admin', 'access');
  }

  if (dbUser.isBanned) {
    logger.warn(`Admin check failed: User is banned`, { userId: user.userId }, 'requireAdmin');
    throw new AuthorizationError('User is banned', 'admin', 'access');
  }

  if (!dbUser.isAdmin) {
    logger.warn(`Admin check failed: User is not an admin`, { 
      userId: user.userId,
      username: dbUser.username 
    }, 'requireAdmin');
    throw new AuthorizationError('Admin access required', 'admin', 'access');
  }

  logger.info(`Admin access granted`, { 
    userId: user.userId,
    username: dbUser.username 
  }, 'requireAdmin');

  return user;
}

/**
 * Check if a user ID has admin privileges (without requiring request auth)
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, isBanned: true },
  });

  return user ? user.isAdmin && !user.isBanned : false;
}

