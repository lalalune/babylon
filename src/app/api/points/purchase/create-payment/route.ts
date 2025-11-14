/**
 * API Route: Create x402 payment request for points purchase
 * POST /api/points/purchase/create-payment
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { X402Manager } from '@/lib/a2a/payments/x402-manager'
import { logger } from '@/lib/logger'
import { trackServerEvent } from '@/lib/posthog/server'

// Initialize x402 manager (you'll need to configure RPC URL)
const x402Manager = new X402Manager({
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org',
  paymentTimeout: 15 * 60 * 1000, // 15 minutes
})

// Payment receiver address (configure this in your environment)
const PAYMENT_RECEIVER = process.env.POINTS_PAYMENT_RECEIVER || process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '0x0000000000000000000000000000000000000000'

interface CreatePaymentBody {
  amountUSD: number // Amount in USD
  fromAddress: string // User's wallet address
}

export async function POST(req: NextRequest) {
  const authUser = await authenticate(req)
  const userId = authUser.dbUserId!

  const body: CreatePaymentBody = await req.json()
  const { amountUSD, fromAddress } = body

  const pointsAmount = Math.floor(amountUSD * 100)

  const ethEquivalent = amountUSD * 0.001
  const amountInWei = (ethEquivalent * 1_000_000_000_000_000_000).toString()

  const paymentRequest = await x402Manager.createPaymentRequest(
    fromAddress,
    PAYMENT_RECEIVER,
    amountInWei,
    'points_purchase',
    {
      userId,
      amountUSD,
      pointsAmount,
    }
  )

  logger.info(
    `Created payment request for ${pointsAmount} points ($${amountUSD})`,
    { 
      userId, 
      requestId: paymentRequest.requestId,
      amountUSD,
      pointsAmount 
    },
    'PointsPurchase'
  )

  trackServerEvent(userId, 'points_purchase_initiated', {
    amountUSD,
    pointsAmount,
    requestId: paymentRequest.requestId,
  })

  return NextResponse.json({
    success: true,
    paymentRequest: {
      requestId: paymentRequest.requestId,
      amount: paymentRequest.amount,
      from: paymentRequest.from,
      to: paymentRequest.to,
      expiresAt: paymentRequest.expiresAt,
      pointsAmount,
      amountUSD,
    },
  })
}

