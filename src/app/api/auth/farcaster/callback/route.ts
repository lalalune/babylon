/**
 * Farcaster Auth Callback Handler
 * Handles the Farcaster Sign-In With Farcaster (SIWF) flow
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import { PointsService } from '@/lib/services/points-service'

interface FarcasterCallbackBody {
  message: string
  signature: string
  fid: number
  username: string
  displayName?: string
  pfpUrl?: string
  state: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as FarcasterCallbackBody

    if (!body.message || !body.signature || !body.fid || !body.username || !body.state) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify state format and get user ID
    const stateParts = body.state.split(':')
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
    const isValid = await verifyFarcasterSignature(body.message, body.signature, body.fid)
    
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
        farcasterFid: body.fid.toString(),
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
        farcasterFid: body.fid.toString(),
        farcasterUsername: body.username,
        hasFarcaster: true,
        farcasterDisplayName: body.displayName,
        farcasterPfpUrl: body.pfpUrl,
        farcasterVerifiedAt: new Date(),
      },
    })

    // Award points if this is the first time linking Farcaster
    const pointsResult = await PointsService.awardFarcasterLink(userId, body.username)

    logger.info(
      'Farcaster account linked successfully',
      { userId, farcasterUsername: body.username, fid: body.fid, pointsAwarded: pointsResult.pointsAwarded },
      'FarcasterCallback'
    )

    return NextResponse.json({
      success: true,
      pointsAwarded: pointsResult.pointsAwarded,
      newTotal: pointsResult.newTotal,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Farcaster auth callback error', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined }, 'FarcasterCallback')
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
    // Use Neynar API for verification
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

    // For development/MVP without Neynar API key
    // TODO: Implement proper Farcaster signature verification or require Neynar in production
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

