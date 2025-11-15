/**
 * API Route: List moderation escrow payments
 * GET /api/admin/moderation-escrow/list
 * 
 * Get list of escrow payments (filtered by recipient or admin)
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-middleware'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const ListEscrowQuerySchema = z.object({
  recipientId: z.string().optional(),
  adminId: z.string().optional(),
  status: z.enum(['pending', 'paid', 'refunded', 'expired']).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
})

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)

    const { searchParams } = new URL(req.url)
    const validation = ListEscrowQuerySchema.safeParse({
      recipientId: searchParams.get('recipientId'),
      adminId: searchParams.get('adminId'),
      status: searchParams.get('status'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
    })

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid query parameters' },
        { status: 400 }
      )
    }

    const { recipientId, adminId, status, limit, offset } = validation.data

    // Auto-expire old pending escrows before querying
    const now = new Date()
    await prisma.moderationEscrow.updateMany({
      where: {
        status: 'pending',
        expiresAt: {
          lt: now,
        },
      },
      data: {
        status: 'expired',
      },
    })

    const where: {
      recipientId?: string
      adminId?: string
      status?: string
    } = {}

    if (recipientId) where.recipientId = recipientId
    if (adminId) where.adminId = adminId
    if (status) where.status = status

    const [escrows, total] = await Promise.all([
      prisma.moderationEscrow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          User: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profileImageUrl: true,
            },
          },
          Admin: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
          RefundedByUser: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
      }),
      prisma.moderationEscrow.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      escrows: escrows.map((escrow) => ({
        id: escrow.id,
        recipientId: escrow.recipientId,
        recipient: escrow.User,
        adminId: escrow.adminId,
        admin: escrow.Admin,
        amountUSD: escrow.amountUSD,
        amountWei: escrow.amountWei,
        status: escrow.status,
        reason: escrow.reason,
        paymentRequestId: escrow.paymentRequestId,
        paymentTxHash: escrow.paymentTxHash,
        refundTxHash: escrow.refundTxHash,
        refundedBy: escrow.refundedBy,
        refundedByUser: escrow.RefundedByUser,
        refundedAt: escrow.refundedAt?.toISOString(),
        createdAt: escrow.createdAt.toISOString(),
        expiresAt: escrow.expiresAt.toISOString(),
      })),
      pagination: {
        total,
        limit,
        offset,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list escrow payments' },
      { status: 500 }
    )
  }
}

