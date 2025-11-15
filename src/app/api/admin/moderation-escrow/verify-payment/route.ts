/**
 * API Route: Verify moderation escrow payment
 * POST /api/admin/moderation-escrow/verify-payment
 * 
 * Verify that the escrow payment was completed on-chain
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-middleware'
import { X402Manager } from '@/lib/a2a/payments/x402-manager'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Initialize x402 manager
const x402Manager = new X402Manager({
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org',
  paymentTimeout: 15 * 60 * 1000, // 15 minutes
})

const VerifyEscrowPaymentSchema = z.object({
  escrowId: z.string().min(1, 'Escrow ID is required'),
  txHash: z.string().min(1, 'Transaction hash is required'),
  fromAddress: z.string().min(1, 'From address is required'),
  toAddress: z.string().min(1, 'To address is required'),
  amount: z.string().min(1, 'Amount is required'),
})

export async function POST(req: NextRequest) {
  let escrowId: string | undefined
  try {
    const adminUser = await requireAdmin(req)
    const adminId = adminUser.userId

    const body = await req.json()
    const validation = VerifyEscrowPaymentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid request data' },
        { status: 400 }
      )
    }

    const validationData = validation.data
    escrowId = validationData.escrowId
    const { txHash, fromAddress, toAddress, amount } = validationData

    // Get escrow record
    const escrow = await prisma.moderationEscrow.findUnique({
      where: { id: validationData.escrowId },
      include: {
        User: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        Admin: {
          select: {
            id: true,
            walletAddress: true,
          },
        },
      },
    })

    if (!escrow) {
      return NextResponse.json(
        { error: 'Escrow payment not found' },
        { status: 404 }
      )
    }

    // Check if expired
    if (new Date() > escrow.expiresAt) {
      // Auto-expire if expired
      await prisma.moderationEscrow.update({
        where: { id: escrowId },
        data: { status: 'expired' },
      })
      return NextResponse.json(
        { error: 'Escrow payment has expired' },
        { status: 400 }
      )
    }

    if (escrow.status !== 'pending') {
      return NextResponse.json(
        { error: `Escrow payment is already ${escrow.status}` },
        { status: 400 }
      )
    }

    if (!escrow.paymentRequestId) {
      return NextResponse.json(
        { error: 'Escrow payment request ID not found' },
        { status: 400 }
      )
    }

    // Verify admin is the one who created the escrow (or allow any admin)
    // Optionally: Only allow the creating admin to verify
    // if (escrow.adminId !== adminId) {
    //   return NextResponse.json(
    //     { error: 'Only the admin who created this escrow can verify it' },
    //     { status: 403 }
    //   )
    // }

    // Verify fromAddress matches admin's wallet (from metadata or Admin record)
    const expectedFromAddress = escrow.Admin?.walletAddress || (escrow.metadata as { adminWalletAddress?: string })?.adminWalletAddress
    if (expectedFromAddress && fromAddress.toLowerCase() !== expectedFromAddress.toLowerCase()) {
      return NextResponse.json(
        { error: 'Transaction sender does not match admin wallet address' },
        { status: 400 }
      )
    }

    // Use database transaction to prevent race conditions
    const verificationResult = await prisma.$transaction(async (tx) => {
      // Re-fetch escrow within transaction to get latest state
      const currentEscrow = await tx.moderationEscrow.findUnique({
        where: { id: escrowId },
      })

      if (!currentEscrow || currentEscrow.status !== 'pending') {
        throw new Error(`Escrow is already ${currentEscrow?.status || 'not found'}`)
      }

      if (!currentEscrow.paymentRequestId) {
        throw new Error('Escrow payment request ID not found')
      }

      // Verify payment via X402
      const x402Result = await x402Manager.verifyPayment({
        requestId: currentEscrow.paymentRequestId,
        txHash,
        from: fromAddress,
        to: toAddress,
        amount,
        timestamp: Date.now(),
        confirmed: true,
      })

      if (!x402Result.verified) {
        throw new Error(x402Result.error || 'Payment verification failed')
      }

      // Update escrow status atomically
      const updatedEscrow = await tx.moderationEscrow.update({
        where: { id: escrowId },
        data: {
          status: 'paid',
          paymentTxHash: txHash,
        },
      })

      return { verified: true, escrow: updatedEscrow }
    })

    logger.info(
      `Escrow payment verified successfully for ${escrowId}`,
      {
        escrowId,
        recipientId: escrow.recipientId,
        amountUSD: escrow.amountUSD,
        txHash,
        adminId,
      },
      'ModerationEscrow'
    )

    return NextResponse.json({
      success: true,
      escrow: {
        id: verificationResult.escrow.id,
        recipientId: verificationResult.escrow.recipientId,
        amountUSD: verificationResult.escrow.amountUSD,
        status: verificationResult.escrow.status,
        paymentTxHash: verificationResult.escrow.paymentTxHash,
      },
    })
  } catch (error) {
    logger.error('Failed to verify escrow payment', { error, escrowId }, 'ModerationEscrow')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify escrow payment' },
      { status: error instanceof Error && error.message.includes('already') ? 400 : 500 }
    )
  }
}

