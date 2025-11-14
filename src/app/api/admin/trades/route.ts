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
  type: z.enum(['all', 'balance', 'npc', 'position']).default('all'),
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
    where: params.type === 'balance' ? {} : undefined,
  });

  // Fetch users for balance transactions
  const balanceUserIds = [...new Set(balanceTransactions.map(tx => tx.userId))];
  const balanceUsers = await prisma.user.findMany({
    where: { id: { in: balanceUserIds } },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileImageUrl: true,
      isActor: true,
    },
  });
  const balanceUsersMap = new Map(balanceUsers.map(u => [u.id, u]));

  // Get recent NPC trades
  const npcTrades = await prisma.nPCTrade.findMany({
    take: params.limit,
    skip: params.offset,
    orderBy: { executedAt: 'desc' },
    where: params.type === 'npc' ? {} : undefined,
  });

  // Fetch actors for NPC trades
  const actorIds = [...new Set(npcTrades.map(trade => trade.npcActorId))];
  
  const actors = await prisma.actor.findMany({
    where: { id: { in: actorIds } },
    select: {
      id: true,
      name: true,
      profileImageUrl: true,
    },
  });
  
  const actorsMap = new Map(actors.map(a => [a.id, a]));

  // Get recent position changes
  const positions = await prisma.position.findMany({
    take: params.limit,
    skip: params.offset,
    orderBy: { updatedAt: 'desc' },
    where: params.type === 'position' ? {} : undefined,
  });

  // Fetch users and markets for positions
  const positionUserIds = [...new Set(positions.map(pos => pos.userId))];
  const marketIds = [...new Set(positions.map(pos => pos.marketId))];
  
  const [positionUsers, markets] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: positionUserIds } },
      select: {
        id: true,
        username: true,
        displayName: true,
        profileImageUrl: true,
        isActor: true,
      },
    }),
    prisma.market.findMany({
      where: { id: { in: marketIds } },
      select: {
        id: true,
        question: true,
        resolved: true,
        resolution: true,
      },
    }),
  ]);
  
  const positionUsersMap = new Map(positionUsers.map(u => [u.id, u]));
  const marketsMap = new Map(markets.map(m => [m.id, m]));

  // Merge and sort by timestamp
  const allTrades = [
    ...balanceTransactions.map(tx => ({
      type: 'balance' as const,
      id: tx.id,
      timestamp: tx.createdAt,
      user: balanceUsersMap.get(tx.userId) || null,
      amount: tx.amount.toString(),
      balanceBefore: tx.balanceBefore.toString(),
      balanceAfter: tx.balanceAfter.toString(),
      transactionType: tx.type,
      description: tx.description,
      relatedId: tx.relatedId,
    })),
    ...npcTrades.map(trade => {
      const actor = actorsMap.get(trade.npcActorId);
      return {
        type: 'npc' as const,
        id: trade.id,
        timestamp: trade.executedAt,
        user: actor ? {
          id: actor.id,
          username: actor.name,
          displayName: actor.name,
          profileImageUrl: actor.profileImageUrl,
          isActor: true,
        } : null,
        marketType: trade.marketType,
        ticker: trade.ticker,
        marketId: trade.marketId,
        action: trade.action,
        side: trade.side,
        amount: trade.amount,
        price: trade.price,
        sentiment: trade.sentiment,
        reason: trade.reason,
      };
    }),
    ...positions.map(pos => ({
      type: 'position' as const,
      id: pos.id,
      timestamp: pos.updatedAt,
      user: positionUsersMap.get(pos.userId) || null,
      market: marketsMap.get(pos.marketId) || null,
      side: pos.side ? 'YES' : 'NO',
      shares: pos.shares.toString(),
      avgPrice: pos.avgPrice.toString(),
      createdAt: pos.createdAt,
    })),
  ].filter(trade => trade.user !== null); // Filter out trades with missing users

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

