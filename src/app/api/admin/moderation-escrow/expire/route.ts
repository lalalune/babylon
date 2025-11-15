/**
 * API Route: Expire old escrow payments
 * POST /api/admin/moderation-escrow/expire
 * 
 * Marks expired escrow payments as expired (can be called by cron or manually)
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-middleware'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)

    const now = new Date()
    
    // Find all pending escrows that have expired
    const expiredEscrows = await prisma.moderationEscrow.updateMany({
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

    logger.info(
      `Expired ${expiredEscrows.count} escrow payments`,
      { count: expiredEscrows.count },
      'ModerationEscrow'
    )

    return NextResponse.json({
      success: true,
      expiredCount: expiredEscrows.count,
    })
  } catch (error) {
    logger.error('Failed to expire escrow payments', { error }, 'ModerationEscrow')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to expire escrow payments' },
      { status: 500 }
    )
  }
}

