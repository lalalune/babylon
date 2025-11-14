/**
 * API Route: Verify x402 payment and credit points
 * POST /api/points/purchase/verify-payment
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { X402Manager } from '@/a2a/payments/x402-manager'
import { PointsService } from '@/lib/services/points-service'
import { logger } from '@/lib/logger'
import { trackServerEvent } from '@/lib/posthog/server'

// Initialize x402 manager
const x402Manager = new X402Manager({
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org',
  paymentTimeout: 15 * 60 * 1000, // 15 minutes
})

interface VerifyPaymentBody {
  requestId: string
  txHash: string
  fromAddress: string
  toAddress: string
  amount: string
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const authUser = await authenticate(req)
    const userId = authUser.dbUserId
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 401 }
      )
    }

    const body: VerifyPaymentBody = await req.json()
    const { requestId, txHash, fromAddress, toAddress, amount } = body

    // Validate input
    if (!requestId || !txHash || !fromAddress || !toAddress || !amount) {
      return NextResponse.json(
        { error: 'Missing required payment verification data' },
        { status: 400 }
      )
    }

    // Verify payment with x402 manager
    const verificationResult = await x402Manager.verifyPayment({
      requestId,
      txHash,
      from: fromAddress,
      to: toAddress,
      amount,
      timestamp: Date.now(),
      confirmed: true,
    })

    if (!verificationResult.verified) {
      logger.warn(
        `Payment verification failed for request ${requestId}`,
        { requestId, txHash, error: verificationResult.error },
        'PointsPurchase'
      )
      return NextResponse.json(
        { 
          success: false, 
          error: verificationResult.error || 'Payment verification failed' 
        },
        { status: 400 }
      )
    }

    // Get payment request details
    const paymentRequest = x402Manager.getPaymentRequest(requestId)
    if (!paymentRequest || !paymentRequest.metadata) {
      return NextResponse.json(
        { error: 'Payment request not found' },
        { status: 404 }
      )
    }

    const metadata = paymentRequest.metadata
    const amountUSD = metadata.amountUSD as number

    // Credit points to user
    const result = await PointsService.purchasePoints(
      userId,
      amountUSD,
      requestId,
      txHash
    )

    if (!result.success) {
      logger.error(
        `Failed to credit points after payment verification`,
        { userId, requestId, error: result.error },
        'PointsPurchase'
      )
      return NextResponse.json(
        { error: result.error || 'Failed to credit points' },
        { status: 500 }
      )
    }

    logger.info(
      `Successfully credited ${result.pointsAwarded} points to user ${userId}`,
      { 
        userId, 
        requestId, 
        txHash,
        pointsAwarded: result.pointsAwarded,
        newTotal: result.newTotal 
      },
      'PointsPurchase'
    )

    // Track points purchase completed
    trackServerEvent(userId, 'points_purchase_completed', {
      amountUSD,
      pointsAwarded: result.pointsAwarded,
      newTotal: result.newTotal,
      requestId,
      txHash,
    }).catch((error) => {
      logger.warn('Failed to track points_purchase_completed event', { error });
    });

    return NextResponse.json({
      success: true,
      pointsAwarded: result.pointsAwarded,
      newTotal: result.newTotal,
      txHash,
    })
  } catch (error) {
    logger.error('Failed to verify payment', error, 'PointsPurchase')
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    )
  }
}

