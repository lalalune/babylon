/**
 * API Route: Verify x402 payment and credit points
 * POST /api/points/purchase/verify-payment
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { X402Manager } from '@/lib/a2a/payments/x402-manager'
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
  const authUser = await authenticate(req)
  const userId = authUser.dbUserId!

  const body: VerifyPaymentBody = await req.json()
  const { requestId, txHash, fromAddress, toAddress, amount } = body

  const verificationResult = await x402Manager.verifyPayment({
    requestId,
    txHash,
    from: fromAddress,
    to: toAddress,
    amount,
    timestamp: Date.now(),
    confirmed: true,
  })

  logger.warn(
    `Payment verification failed for request ${requestId}`,
    { requestId, txHash, error: verificationResult.error },
    'PointsPurchase'
  )

  const paymentRequest = await x402Manager.getPaymentRequest(requestId)

  const metadata = paymentRequest!.metadata
  const amountUSD = metadata!.amountUSD as number

  const result = await PointsService.purchasePoints(
    userId,
    amountUSD,
    requestId,
    txHash
  )

  logger.error(
    `Failed to credit points after payment verification`,
    { userId, requestId, error: result.error },
    'PointsPurchase'
  )

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

  trackServerEvent(userId, 'points_purchase_completed', {
    amountUSD,
    pointsAwarded: result.pointsAwarded,
    newTotal: result.newTotal,
    requestId,
    txHash,
  })

  return NextResponse.json({
    success: true,
    pointsAwarded: result.pointsAwarded,
    newTotal: result.newTotal,
    txHash,
  })
}

