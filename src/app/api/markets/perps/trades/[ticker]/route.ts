/**
 * Perpetual Futures Trades API
 * 
 * @route GET /api/markets/perps/trades/[ticker]
 * @access Public
 * 
 * @description
 * Get all trades for a specific perpetual futures market with pagination and Redis caching.
 * Returns trades from perp positions (opens/closes) and balance transactions related to this ticker.
 * 
 * **Features:**
 * - Redis caching with 30s TTL for fast access
 * - Pagination support (limit/offset)
 * - Automatic cache invalidation on new trades
 * - Includes user profiles and organization metadata
 * - Includes NPC/agent trades with reasoning
 * 
 * **Query Parameters:**
 * @query {number} limit - Trades per page (1-100, default: 50)
 * @query {number} offset - Pagination offset (default: 0)
 * 
 * **Response:**
 * @returns {object} Trades response
 * @property {array} trades - Array of trade objects
 * @property {number} total - Total trades count
 * @property {boolean} hasMore - Whether more trades available
 * @property {string} ticker - Market ticker symbol
 * @property {object} organization - Organization details
 * 
 * **Trade Object:**
 * @property {string} id - Trade ID
 * @property {string} type - 'perp' | 'balance' | 'npc'
 * @property {object} user - Trader profile
 * @property {string} side - 'long' | 'short'
 * @property {number} size - Position size in USD
 * @property {number} leverage - Leverage multiplier
 * @property {number} entryPrice - Entry price
 * @property {Date} timestamp - When trade occurred
 * @property {string} [reason] - NPC reasoning (for NPC trades)
 * @property {number} [sentiment] - NPC sentiment (for NPC trades)
 * 
 * @example
 * ```typescript
 * // Get recent trades for ticker
 * const response = await fetch('/api/markets/perps/trades/BTC?limit=20');
 * const { trades, hasMore } = await response.json();
 * ```
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { optionalAuth } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/prisma';
import { getCache, setCache } from '@/lib/cache-service';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import type { JsonValue } from '@/types/common';

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ ticker: string }> }
) => {
  // Optional auth - trades are public
  await optionalAuth(request).catch(() => null);

  const { ticker: tickerParam } = await context.params;
  const ticker = tickerParam.toUpperCase();
  
  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const queryParams = QuerySchema.parse({
    limit: searchParams.get('limit') || '50',
    offset: searchParams.get('offset') || '0',
  });

  logger.info(`Perp market trades requested`, { ticker, queryParams }, 'GET /api/markets/perps/trades/[ticker]');

  // Check Redis cache first
  const cacheKey = `perp-trades:${ticker}:${queryParams.limit}:${queryParams.offset}`;
  const cached = await getCache<Record<string, JsonValue>>(cacheKey);
  
  if (cached) {
    logger.debug('Cache hit for perp trades', { ticker }, 'PerpTrades');
    return successResponse(cached);
  }

  // Verify organization/ticker exists
  const organization = await prisma.organization.findUnique({
    where: { id: ticker },
    select: {
      id: true,
      name: true,
      type: true,
      currentPrice: true,
    },
  });

  if (!organization) {
    return NextResponse.json(
      { error: 'Market not found' },
      { status: 404 }
    );
  }

  // Get perp positions for this ticker
  const perpPositions = await prisma.perpPosition.findMany({
    where: {
      ticker: ticker,
    },
    orderBy: { openedAt: 'desc' },
    take: queryParams.limit,
    skip: queryParams.offset,
  });

  // Get total count for pagination
  const totalPositions = await prisma.perpPosition.count({
    where: { ticker: ticker },
  });

  // Fetch users for perp positions
  const perpUserIds = [...new Set(perpPositions.map(p => p.userId))];
  const perpUsers = await prisma.user.findMany({
    where: { id: { in: perpUserIds } },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileImageUrl: true,
      isActor: true,
    },
  });
  const perpUsersMap = new Map(perpUsers.map(u => [u.id, u]));

  // Get NPC trades for this ticker
  const npcTrades = await prisma.nPCTrade.findMany({
    where: {
      marketType: 'perp',
      ticker: ticker,
    },
    orderBy: { executedAt: 'desc' },
    take: queryParams.limit,
    skip: queryParams.offset,
  });

  // Fetch NPC actors
  const npcActorIds = [...new Set(npcTrades.map(t => t.npcActorId))];
  const actors = await prisma.user.findMany({
    where: { id: { in: npcActorIds }, isActor: true },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileImageUrl: true,
      isActor: true,
    },
  });
  const actorsMap = new Map(actors.map(a => [a.id, a]));

  // Get balance transactions for these perp positions
  const positionIds = perpPositions.map(p => p.id);
  const balanceTransactions = positionIds.length > 0 ? await prisma.balanceTransaction.findMany({
    where: {
      type: { in: ['perp_open', 'perp_close', 'perp_liquidation'] },
      relatedId: { in: positionIds },
    },
    orderBy: { createdAt: 'desc' },
    take: queryParams.limit,
    select: {
      id: true,
      type: true,
      amount: true,
      userId: true,
      createdAt: true,
      relatedId: true,
      description: true,
    },
  }) : [];

  // Fetch users for transactions
  const txUserIds = [...new Set(balanceTransactions.map(tx => tx.userId))];
  const txUsers = await prisma.user.findMany({
    where: { id: { in: txUserIds } },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileImageUrl: true,
      isActor: true,
    },
  });
  const txUsersMap = new Map(txUsers.map(u => [u.id, u]));

  // Format trades
  const trades = [
    // Perp position trades
    ...perpPositions.map(pos => ({
      id: pos.id,
      type: 'perp' as const,
      user: perpUsersMap.get(pos.userId) || null,
      side: pos.side,
      size: Number(pos.size),
      leverage: pos.leverage,
      entryPrice: Number(pos.entryPrice),
      currentPrice: Number(pos.currentPrice),
      unrealizedPnL: Number(pos.unrealizedPnL),
      liquidationPrice: Number(pos.liquidationPrice),
      timestamp: pos.openedAt,
      closedAt: pos.closedAt,
      ticker: pos.ticker,
    })),
    // NPC trades
    ...npcTrades.map(trade => ({
      id: trade.id,
      type: 'npc' as const,
      user: actorsMap.get(trade.npcActorId) || null,
      marketType: trade.marketType,
      ticker: trade.ticker,
      action: trade.action,
      side: trade.side,
      amount: trade.amount,
      price: trade.price,
      sentiment: trade.sentiment,
      reason: trade.reason,
      timestamp: trade.executedAt,
    })),
    // Balance transaction trades
    ...balanceTransactions.map(tx => ({
      id: tx.id,
      type: 'balance' as const,
      user: txUsersMap.get(tx.userId) || null,
      transactionType: tx.type,
      amount: Number(tx.amount),
      description: tx.description,
      relatedId: tx.relatedId,
      ticker,
      timestamp: tx.createdAt,
    })),
  ]
    // Sort by timestamp descending
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    // Apply pagination
    .slice(0, queryParams.limit);

  const total = totalPositions + npcTrades.length + balanceTransactions.length;
  const hasMore = queryParams.offset + queryParams.limit < total;

  const result = {
    trades,
    total,
    hasMore,
    ticker: organization.id,
    organization: {
      name: organization.name,
      type: organization.type,
      currentPrice: Number(organization.currentPrice),
    },
  };

  // Cache for 30 seconds
  await setCache(cacheKey, result, { ttl: 30, namespace: 'market-trades' });

  logger.info(`Returned ${trades.length} trades for perp market ${ticker}`, { total, hasMore }, 'PerpTrades');

  return successResponse(result);
});
