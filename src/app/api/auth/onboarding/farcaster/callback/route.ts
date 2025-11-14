/**
 * Farcaster Auth Callback for Onboarding
 * Imports Farcaster profile data during onboarding
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/database-service'
import { z } from 'zod'
import { withErrorHandling } from '@/lib/errors/error-handler'

const FarcasterOnboardingCallbackBodySchema = z.object({
  message: z.string(),
  signature: z.string(),
  fid: z.number(),
  username: z.string(),
  displayName: z.string().optional(),
  pfpUrl: z.string().url().optional(),
  bio: z.string().optional(),
  state: z.string(),
});

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json()
  const parsed = FarcasterOnboardingCallbackBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { message, signature, fid, username, displayName, pfpUrl, bio, state } = parsed.data;

  // Verify state format: "onboarding:userId:timestamp:random"
  const stateParts = state.split(':')
  if (stateParts.length < 3) {
    return NextResponse.json(
      { error: 'Invalid state format' },
      { status: 400 }
    )
  }

  const [prefix, userId, timestampStr] = stateParts
  
  if (prefix !== 'onboarding') {
    return NextResponse.json(
      { error: 'Invalid state format' },
      { status: 400 }
    )
  }

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
    logger.warn('Invalid Farcaster signature', { fid: fid, username: username }, 'FarcasterOnboardingCallback')
    return NextResponse.json(
      { error: 'Invalid Farcaster signature. Please try again.' },
      { status: 401 }
    )
  }

  // Check for duplicate Farcaster account
  const existingUser = await prisma.user.findFirst({
    where: {
      farcasterFid: fid.toString(),
      id: { not: userId },
    },
  })

  if (existingUser) {
    logger.warn('Farcaster account already linked', { fid: fid, existingUserId: existingUser.id }, 'FarcasterOnboardingCallback')
    return NextResponse.json(
      { error: 'This Farcaster account is already linked to another user' },
      { status: 409 }
    )
  }

  // Prepare profile data for import with fallbacks
  const profileData = {
    platform: 'farcaster' as const,
    username: username,
    displayName: displayName || username,
    bio: bio || '',
    profileImageUrl: pfpUrl || null,
    farcasterFid: fid.toString(),
    farcasterUsername: username,
  }

  logger.info(
    'Farcaster profile imported for onboarding',
    { userId, farcasterUsername: username, fid: fid },
    'FarcasterOnboardingCallback'
  )

  return NextResponse.json({
    success: true,
    profileData,
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

