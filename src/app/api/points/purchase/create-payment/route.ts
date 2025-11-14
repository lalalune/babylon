/**
 * API Route: Create x402 payment request for points purchase
 * POST /api/points/purchase/create-payment
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { X402Manager } from '@/a2a/payments/x402-manager'
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

    const body: CreatePaymentBody = await req.json()
    const { amountUSD, fromAddress } = body

    // Validate input
    if (!amountUSD || amountUSD < 1) {
      return NextResponse.json(
        { error: 'Minimum purchase is $1' },
        { status: 400 }
      )
    }

    if (amountUSD > 1000) {
      return NextResponse.json(
        { error: 'Maximum purchase is $1000' },
        { status: 400 }
      )
    }

    if (!fromAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    // Calculate points (100 points per $1)
    const pointsAmount = Math.floor(amountUSD * 100)

    // Create payment request
    // Note: For x402, we need to convert USD to wei (assuming USDC or similar stablecoin)
    // For simplicity, we'll use a 1:1 conversion with 6 decimals (USDC standard)
    const amountInWei = (amountUSD * 1_000_000).toString() // 6 decimals for USDC

    const paymentRequest = x402Manager.createPaymentRequest(
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

    // Track points purchase initiated
    trackServerEvent(userId, 'points_purchase_initiated', {
      amountUSD,
      pointsAmount,
      requestId: paymentRequest.requestId,
    }).catch((error) => {
      logger.warn('Failed to track points_purchase_initiated event', { error });
    });

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
  } catch (error) {
    logger.error('Failed to create payment request', error, 'PointsPurchase')
    return NextResponse.json(
      { error: 'Failed to create payment request' },
      { status: 500 }
    )
  }
}

