/**
 * Admin API: Trading Feed
 * GET /api/admin/trades
 * 
 * Returns recent trades across all markets
 */

import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/admin-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/database-service';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  type: z.enum(['all', 'balance', 'npc', 'position']).optional(),
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Require admin authentication
  await requireAdmin(request);

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const params = QuerySchema.parse({
    limit: searchParams.get('limit') || '50',
    offset: searchParams.get('offset') || '0',
    type: searchParams.get('type') || undefined,
  });

  logger.info(`Admin trading feed requested`, { params }, 'GET /api/admin/trades');

  // Get recent balance transactions (deposits, withdrawals, trades)
  const balanceTransactions = await prisma.balanceTransaction.findMany({
    take: params.limit,
    skip: params.offset,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
          isActor: true,
        },
      },
    },
    where: params.type === 'balance' ? {} : undefined,
  });

  // Get recent NPC trades
  const npcTrades = await prisma.nPCTrade.findMany({
    take: params.limit,
    skip: params.offset,
    orderBy: { executedAt: 'desc' },
    include: {
      npcActor: {
        select: {
          id: true,
          name: true,
          profileImageUrl: true,
        },
      },
      pool: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    where: params.type === 'npc' ? {} : undefined,
  });

  // Get recent position changes
  const positions = await prisma.position.findMany({
    take: params.limit,
    skip: params.offset,
    orderBy: { updatedAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
          isActor: true,
        },
      },
      market: {
        select: {
          id: true,
          question: true,
          resolved: true,
          resolution: true,
        },
      },
    },
    where: params.type === 'position' ? {} : undefined,
  });

  // Merge and sort by timestamp
  const allTrades = [
    ...balanceTransactions.map(tx => ({
      type: 'balance' as const,
      id: tx.id,
      timestamp: tx.createdAt,
      user: tx.user,
      amount: tx.amount.toString(),
      balanceBefore: tx.balanceBefore.toString(),
      balanceAfter: tx.balanceAfter.toString(),
      transactionType: tx.type,
      description: tx.description,
      relatedId: tx.relatedId,
    })),
    ...npcTrades.map(trade => ({
      type: 'npc' as const,
      id: trade.id,
      timestamp: trade.executedAt,
      user: {
        id: trade.npcActor.id,
        username: trade.npcActor.name,
        displayName: trade.npcActor.name,
        profileImageUrl: trade.npcActor.profileImageUrl,
        isActor: true,
      },
      marketType: trade.marketType,
      ticker: trade.ticker,
      marketId: trade.marketId,
      action: trade.action,
      side: trade.side,
      amount: trade.amount,
      price: trade.price,
      sentiment: trade.sentiment,
      reason: trade.reason,
      pool: trade.pool,
    })),
    ...positions.map(pos => ({
      type: 'position' as const,
      id: pos.id,
      timestamp: pos.updatedAt,
      user: pos.user,
      market: pos.market,
      side: pos.side ? 'YES' : 'NO',
      shares: pos.shares.toString(),
      avgPrice: pos.avgPrice.toString(),
      createdAt: pos.createdAt,
    })),
  ];

  // Sort by timestamp
  allTrades.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Limit to requested amount
  const limitedTrades = allTrades.slice(0, params.limit);

  // Get total counts for pagination
  const [balanceCount, npcCount, positionCount] = await Promise.all([
    prisma.balanceTransaction.count(),
    prisma.nPCTrade.count(),
    prisma.position.count(),
  ]);

  return successResponse({
    trades: limitedTrades,
    pagination: {
      limit: params.limit,
      offset: params.offset,
      total: balanceCount + npcCount + positionCount,
    },
    counts: {
      balance: balanceCount,
      npc: npcCount,
      position: positionCount,
    },
  });
});

