/**
 * Username Availability Check API
 * 
 * @description
 * Validates username availability during onboarding process. Provides
 * intelligent suggestions if requested username is taken. Sanitizes
 * usernames to ensure platform consistency and safety.
 * 
 * **Features:**
 * - Real-time availability checking
 * - Automatic username sanitization
 * - Smart suggestions (appends numbers)
 * - Fallback random suffix if needed
 * - Case-insensitive checking
 * - Special character removal
 * 
 * **Username Rules:**
 * - Length: 3-20 characters
 * - Allowed: a-z, A-Z, 0-9, underscore (_)
 * - Converted to lowercase
 * - Special chars converted to underscores
 * - Leading @ symbol removed
 * 
 * **Suggestion Algorithm:**
 * 1. Check base username
 * 2. If taken, try username1, username2, ... username9999
 * 3. If all taken, append random 4-digit suffix
 * 
 * @openapi
 * /api/onboarding/check-username:
 *   get:
 *     tags:
 *       - Onboarding
 *     summary: Check username availability
 *     description: Validates username availability and provides suggestions if taken
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 3
 *           maxLength: 20
 *         description: Desired username to check
 *         example: alice_trader
 *     responses:
 *       200:
 *         description: Username check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                   description: Whether username is available
 *                 username:
 *                   type: string
 *                   description: Sanitized username checked
 *                 suggestion:
 *                   type: string
 *                   description: Suggested alternative (if unavailable)
 *             examples:
 *               available:
 *                 value:
 *                   available: true
 *                   username: alice_trader
 *               unavailable:
 *                 value:
 *                   available: false
 *                   username: alice
 *                   suggestion: alice1
 *       400:
 *         description: Invalid username (too short, too long, or missing)
 * 
 * @example
 * ```typescript
 * // Check if username is available
 * const response = await fetch('/api/onboarding/check-username?username=alice');
 * const { available, username, suggestion } = await response.json();
 * 
 * if (available) {
 *   console.log(`✓ ${username} is available!`);
 * } else {
 *   console.log(`✗ ${username} is taken. Try: ${suggestion}`);
 * }
 * 
 * // Username sanitization examples:
 * // Input: "@Alice_Trader!" -> Output: "alice_trader"
 * // Input: "Bob Smith" -> Output: "bob_smith"
 * ```
 * 
 * @see {@link /src/app/onboarding/page.tsx} Onboarding flow
 * @see {@link /lib/db/context} RLS context
 */

import type { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api/auth-middleware';
import { optionalAuth } from '@/lib/api/auth-middleware';
import { asUser, asPublic } from '@/lib/db/context';
import { logger } from '@/lib/logger';
import type { PrismaClient } from '@prisma/client';

interface UsernameCheckResult {
  available: boolean;
  username: string;
  suggestion?: string;
}

/**
 * Check if a username is available and suggest an alternative if not
 */
async function checkUsernameAvailability(baseUsername: string, db: PrismaClient): Promise<UsernameCheckResult> {
  // Sanitize username
  const cleanUsername = baseUsername
    .replace(/^@/, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase()
    .slice(0, 20);

  // Check if base username is available
  const existingUser = await db.user.findUnique({
    where: { username: cleanUsername },
    select: { id: true },
  });

  if (!existingUser) {
    return {
      available: true,
      username: cleanUsername,
    };
  }

  // Username taken, find an available one by adding numbers
  let attempt = 1;
  let suggestedUsername = `${cleanUsername}${attempt}`;
  
  // Keep incrementing until we find an available username
  while (attempt < 9999) {
    const exists = await db.user.findUnique({
      where: { username: suggestedUsername },
      select: { id: true },
    });

    if (!exists) {
      return {
        available: false,
        username: cleanUsername,
        suggestion: suggestedUsername,
      };
    }

    attempt++;
    suggestedUsername = `${cleanUsername}${attempt}`;
  }

  // If we somehow exhausted all numbers, add a random suffix
  const randomSuffix = Math.floor(Math.random() * 10000);
  suggestedUsername = `${cleanUsername.slice(0, 15)}_${randomSuffix}`;

  return {
    available: false,
    username: cleanUsername,
    suggestion: suggestedUsername,
  };
}

/**
 * GET /api/onboarding/check-username
 * Check username availability
 * Query params: username (required)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return errorResponse('Username is required', 400);
  }

  if (username.length < 3) {
    return errorResponse('Username must be at least 3 characters', 400);
  }

  if (username.length > 20) {
    return errorResponse('Username must be 20 characters or less', 400);
  }

  // Optional auth - username checks are public but RLS still applies
  const authUser = await optionalAuth(request).catch(() => null);

  // Check username availability with RLS (public or user context)
  // Verify authUser has userId before using asUser()
  const result = (authUser && authUser.userId)
    ? await asUser(authUser, async (db) => {
        return await checkUsernameAvailability(username, db);
      })
    : await asPublic(async (db) => {
        return await checkUsernameAvailability(username, db);
      });

  logger.info('Username check result', result, 'GET /api/onboarding/check-username');

  return successResponse(result);
}

