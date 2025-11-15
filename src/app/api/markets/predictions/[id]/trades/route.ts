/**
 * Prediction Market Trades API
 * 
 * @route GET /api/markets/predictions/[id]/trades
 * @access Public
 * 
 * @description
 * Get all trades for a specific prediction market with pagination and Redis caching.
 * Returns trades from positions (user buys/sells) and balance transactions related to this market.
 * 
 * **Features:**
 * - Redis caching with 30s TTL for fast access
 * - Pagination support (limit/offset)
 * - Automatic cache invalidation on new trades
 * - Includes user profiles and market metadata
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
 * @property {string} marketId - Market identifier
 * @property {string} question - Market question text
 * 
 * **Trade Object:**
 * @property {string} id - Trade ID
 * @property {string} type - 'position' | 'balance'
 * @property {object} user - Trader profile
 * @property {string} side - 'YES' | 'NO'
 * @property {number} shares - Number of shares
 * @property {number} amount - USD amount
 * @property {number} price - Price per share
 * @property {Date} timestamp - When trade occurred
 * 
 * @example
 * ```typescript
 * // Get recent trades for market
 * const response = await fetch('/api/markets/predictions/123/trades?limit=20');
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
  context: { params: Promise<{ id: string }> }
) => {
  // Optional auth - trades are public
  await optionalAuth(request).catch(() => null);

  const { id: marketId } = await context.params;
  
  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const queryParams = QuerySchema.parse({
    limit: searchParams.get('limit') || '50',
    offset: searchParams.get('offset') || '0',
  });

  logger.info(`Prediction market trades requested`, { marketId, queryParams }, 'GET /api/markets/predictions/[id]/trades');

  // Check Redis cache first
  const cacheKey = `prediction-trades:${marketId}:${queryParams.limit}:${queryParams.offset}`;
  const cached = await getCache<Record<string, JsonValue>>(cacheKey);
  
  if (cached) {
    logger.debug('Cache hit for prediction trades', { marketId }, 'PredictionTrades');
    return successResponse(cached);
  }

  // Verify market exists
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: {
      id: true,
      question: true,
      resolved: true,
      resolution: true,
    },
  });

  if (!market) {
    return NextResponse.json(
      { error: 'Market not found' },
      { status: 404 }
    );
  }

  // Get positions for this market (user trades)
  const positions = await prisma.position.findMany({
    where: {
      marketId: marketId,
      shares: { gt: 0 }, // Only positions with shares
    },
    orderBy: { updatedAt: 'desc' },
    take: queryParams.limit,
    skip: queryParams.offset,
    include: {
      User: {
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
          isActor: true,
        },
      },
    },
  });

  // Get total count for pagination
  const totalPositions = await prisma.position.count({
    where: {
      marketId: marketId,
      shares: { gt: 0 },
    },
  });

  // Get balance transactions for these positions
  const positionIds = positions.map(p => p.id);
  const balanceTransactions = positionIds.length > 0 ? await prisma.balanceTransaction.findMany({
    where: {
      type: { in: ['pred_buy', 'pred_sell'] },
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
    // Position trades
    ...positions.map(pos => ({
      id: pos.id,
      type: 'position' as const,
      user: pos.User,
      side: pos.side,
      shares: Number(pos.shares),
      avgPrice: Number(pos.avgPrice),
      amount: Number(pos.shares) * Number(pos.avgPrice),
      timestamp: pos.updatedAt,
      marketId: pos.marketId,
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
      timestamp: tx.createdAt,
      marketId,
    })),
  ]
    // Sort by timestamp descending
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    // Apply pagination
    .slice(0, queryParams.limit);

  const total = totalPositions + balanceTransactions.length;
  const hasMore = queryParams.offset + queryParams.limit < total;

  const result = {
    trades,
    total,
    hasMore,
    marketId: market.id,
    question: market.question,
  };

  // Cache for 30 seconds
  await setCache(cacheKey, result, { ttl: 30, namespace: 'market-trades' });

  logger.info(`Returned ${trades.length} trades for prediction market ${marketId}`, { total, hasMore }, 'PredictionTrades');

  return successResponse(result);
});

