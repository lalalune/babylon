/**
 * Farcaster Authentication Callback API
 * 
 * @route POST /api/auth/farcaster/callback
 * @access Public
 * 
 * @description
 * Handles the Farcaster "Sign-In With Farcaster" (SIWF) authentication flow.
 * Verifies Farcaster signatures, links Farcaster accounts to user profiles,
 * and awards bonus points for first-time linkage. Uses Neynar API for
 * signature verification.
 * 
 * **Authentication Flow:**
 * 1. User initiates Farcaster authentication on frontend
 * 2. Farcaster app signs message with user's FID
 * 3. Frontend sends signature and message to this callback
 * 4. Server verifies signature using Neynar API
 * 5. Farcaster account linked to user profile
 * 6. Bonus points awarded on first link
 * 
 * **Security Features:**
 * - Cryptographic signature verification via Neynar
 * - State parameter with timestamp expiration (10 minutes)
 * - Prevention of duplicate account linking
 * - Validation against signature replay attacks
 * 
 * **POST /api/auth/farcaster/callback - Link Farcaster Account**
 * 
 * @param {string} message - Signed message from Farcaster
 * @param {string} signature - Cryptographic signature
 * @param {number} fid - Farcaster ID (FID)
 * @param {string} username - Farcaster username
 * @param {string} [displayName] - Display name from Farcaster
 * @param {string} [pfpUrl] - Profile picture URL
 * @param {string} state - State parameter (userId:timestamp)
 * 
 * @returns {object} Link result
 * @property {boolean} success - Link success status
 * @property {number} pointsAwarded - Bonus points awarded
 * @property {number} newTotal - New total points balance
 * 
 * @throws {400} Bad Request - Invalid payload or expired state
 * @throws {401} Unauthorized - Invalid signature
 * @throws {404} Not Found - User not found
 * @throws {409} Conflict - Farcaster account already linked
 * @throws {500} Internal Server Error
 * 
 * @example
 * ```typescript
 * // Link Farcaster account
 * const result = await fetch('/api/auth/farcaster/callback', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     message: '0x...',
 *     signature: '0x...',
 *     fid: 12345,
 *     username: 'alice',
 *     displayName: 'Alice',
 *     pfpUrl: 'https://...',
 *     state: 'user-123:1234567890'
 *   })
 * });
 * 
 * const { pointsAwarded, newTotal } = await result.json();
 * console.log(`Earned ${pointsAwarded} points!`);
 * ```
 * 
 * @see {@link /lib/services/points-service} Points service
 * @see {@link https://docs.neynar.com} Neynar API documentation
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import { PointsService } from '@/lib/services/points-service'
import { withErrorHandling } from '@/lib/errors/error-handler';
import { z } from 'zod';

const FarcasterCallbackBodySchema = z.object({
  message: z.string(),
  signature: z.string(),
  fid: z.number(),
  username: z.string(),
  displayName: z.string().optional(),
  pfpUrl: z.string().url().optional(),
  state: z.string(),
});

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = FarcasterCallbackBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { message, signature, fid, username, displayName, pfpUrl, state } = parsed.data;

  // Verify state format and get user ID
  const stateParts = state.split(':')
  if (stateParts.length < 2) {
    return NextResponse.json(
      { error: 'Invalid state format' },
      { status: 400 }
    )
  }

  const [userId, timestampStr] = stateParts
  if (!userId || !timestampStr) {
    return NextResponse.json(
      { error: 'Invalid state format' },
      { status: 400 }
    )
  }

  const stateTimestamp = parseInt(timestampStr, 10)
  if (isNaN(stateTimestamp)) {
    return NextResponse.json(
      { error: 'Invalid state timestamp' },
      { status: 400 }
    )
  }

  const now = Date.now()
  
  // State expires after 10 minutes
  if (now - stateTimestamp > 10 * 60 * 1000) {
    return NextResponse.json(
      { error: 'State expired' },
      { status: 400 }
    )
  }

  // Verify Farcaster signature
  const isValid = await verifyFarcasterSignature(message, signature, fid)
  
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    )
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })

  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    )
  }

  // Check if Farcaster account is already linked to another user
  const existingLink = await prisma.user.findFirst({
    where: {
      farcasterFid: fid.toString(),
      id: { not: userId },
    },
  })

  if (existingLink) {
    return NextResponse.json(
      { error: 'Farcaster account already linked to another user' },
      { status: 409 }
    )
  }

  // Update user with Farcaster info
  await prisma.user.update({
    where: { id: userId },
    data: {
      farcasterFid: fid.toString(),
      farcasterUsername: username,
      hasFarcaster: true,
      farcasterDisplayName: displayName,
      farcasterPfpUrl: pfpUrl,
      farcasterVerifiedAt: new Date(),
    },
  })

  // Award points if this is the first time linking Farcaster
  const pointsResult = await PointsService.awardFarcasterLink(userId, username)

  logger.info(
    'Farcaster account linked successfully',
    { userId, farcasterUsername: username, fid: fid, pointsAwarded: pointsResult.pointsAwarded },
    'FarcasterCallback'
  )

  return NextResponse.json({
    success: true,
    pointsAwarded: pointsResult.pointsAwarded,
    newTotal: pointsResult.newTotal,
  })
});

/**
 * Verify Farcaster signature using Neynar API or direct hub verification
 */
async function verifyFarcasterSignature(
  message: string,
  signature: string,
  fid: number
): Promise<boolean> {
  const response = await fetch('https://api.neynar.com/v2/farcaster/verification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api_key': process.env.NEYNAR_API_KEY!,
    },
    body: JSON.stringify({
      message,
      signature,
      fid,
    }),
  })

  const errorText = await response.text()
  logger.error('Neynar verification failed', { 
    status: response.status, 
    error: errorText,
    fid 
  }, 'verifyFarcasterSignature')

  const data = await response.json() as { valid: boolean }
  return data.valid
}

