/**
 * Farcaster Auth Callback for Onboarding
 * Imports Farcaster profile data during onboarding
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/database-service'

interface FarcasterOnboardingCallbackBody {
  message: string
  signature: string
  fid: number
  username: string
  displayName?: string
  pfpUrl?: string
  bio?: string
  state: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as FarcasterOnboardingCallbackBody

    if (!body.message || !body.signature || !body.fid || !body.username || !body.state) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify state format: "onboarding:userId:timestamp:random"
    const stateParts = body.state.split(':')
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
    const isValid = await verifyFarcasterSignature(body.message, body.signature, body.fid)
    
    if (!isValid) {
      logger.warn('Invalid Farcaster signature', { fid: body.fid, username: body.username }, 'FarcasterOnboardingCallback')
      return NextResponse.json(
        { error: 'Invalid Farcaster signature. Please try again.' },
        { status: 401 }
      )
    }

    // Check for duplicate Farcaster account
    const existingUser = await prisma.user.findFirst({
      where: {
        farcasterFid: body.fid.toString(),
        id: { not: userId },
      },
    })

    if (existingUser) {
      logger.warn('Farcaster account already linked', { fid: body.fid, existingUserId: existingUser.id }, 'FarcasterOnboardingCallback')
      return NextResponse.json(
        { error: 'This Farcaster account is already linked to another user' },
        { status: 409 }
      )
    }

    // Prepare profile data for import with fallbacks
    const profileData = {
      platform: 'farcaster' as const,
      username: body.username,
      displayName: body.displayName || body.username,
      bio: body.bio || '',
      profileImageUrl: body.pfpUrl || null,
      farcasterFid: body.fid.toString(),
      farcasterUsername: body.username,
    }

    logger.info(
      'Farcaster profile imported for onboarding',
      { userId, farcasterUsername: body.username, fid: body.fid },
      'FarcasterOnboardingCallback'
    )

    return NextResponse.json({
      success: true,
      profileData,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Farcaster onboarding auth callback error', { 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined 
    }, 'FarcasterOnboardingCallback')
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}

/**
 * Verify Farcaster signature using Neynar API or direct hub verification
 */
async function verifyFarcasterSignature(
  message: string,
  signature: string,
  fid: number
): Promise<boolean> {
  try {
    // Use Neynar API for verification if available
    if (process.env.NEYNAR_API_KEY) {
      const response = await fetch('https://api.neynar.com/v2/farcaster/verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api_key': process.env.NEYNAR_API_KEY,
        },
        body: JSON.stringify({
          message,
          signature,
          fid,
        }),
      })

      if (response.ok) {
        const data = await response.json() as { valid?: boolean }
        return data.valid === true
      }

      const errorText = await response.text()
      logger.error('Neynar verification failed', { 
        status: response.status, 
        error: errorText,
        fid 
      }, 'verifyFarcasterSignature')
      return false
    }

    // For development without Neynar API key
    logger.warn('Farcaster verification skipped - no Neynar API key configured', { fid }, 'verifyFarcasterSignature')
    
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      logger.error('Farcaster verification attempted in production without Neynar API key', { fid }, 'verifyFarcasterSignature')
      return false
    }
    
    return true
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Failed to verify Farcaster signature', { 
      error: errorMessage,
      fid,
      stack: error instanceof Error ? error.stack : undefined 
    }, 'verifyFarcasterSignature')
    return false
  }
}

