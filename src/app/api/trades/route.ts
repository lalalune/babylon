/**
 * Trading Activity Feed API
 * 
 * @route GET /api/trades
 * @access Public
 * 
 * @description
 * Public trading feed showing recent trading activity across all market types:
 * - Prediction market positions (YES/NO binary predictions)
 * - Perpetual futures positions (long/short leveraged trades)
 * - NPC/agent trades with sentiment and reasoning
 * - Balance transactions (buys, sells, deposits, withdrawals)
 * 
 * **Trade Types:**
 * - **balance:** User balance transactions (pred_buy, pred_sell, perp operations)
 * - **npc:** Agent/NPC trades with AI reasoning and sentiment
 * - **position:** Prediction market positions with shares and pricing
 * - **perp:** Perpetual futures positions with leverage and PnL
 * 
 * **Features:**
 * - Combined feed across all market types
 * - User-specific filtering
 * - Pagination support
 * - Rich trader profiles (users, agents, actors)
 * - Market metadata (questions, tickers, organizations)
 * - Real-time pricing and PnL calculations
 * 
 * **Query Parameters:**
 * @query {number} limit - Trades per page (1-100, default: 50)
 * @query {number} offset - Pagination offset (default: 0)
 * @query {string} userId - Filter by specific user/agent/actor
 * 
 * **Trade Object Types:**
 * 
 * **Balance Transaction:**
 * @property {string} type - 'balance'
 * @property {object} user - Trader profile
 * @property {string} transactionType - Transaction type (pred_buy, pred_sell, etc.)
 * @property {string} amount - Transaction amount
 * @property {string} balanceBefore - Balance before transaction
 * @property {string} balanceAfter - Balance after transaction
 * 
 * **NPC/Agent Trade:**
 * @property {string} type - 'npc'
 * @property {object} user - Agent profile
 * @property {string} marketType - Market type
 * @property {string} ticker - Trading symbol
 * @property {string} action - Trade action
 * @property {string} side - Trade side (long/short, YES/NO)
 * @property {string} sentiment - AI sentiment analysis
 * @property {string} reason - AI reasoning for trade
 * 
 * **Position:**
 * @property {string} type - 'position'
 * @property {object} market - Market details
 * @property {string} side - Position side (YES/NO)
 * @property {string} shares - Number of shares
 * @property {string} avgPrice - Average entry price
 * 
 * **Perpetual Position:**
 * @property {string} type - 'perp'
 * @property {object} organization - Company being traded
 * @property {string} side - Position side (long/short)
 * @property {number} leverage - Leverage multiplier
 * @property {string} entryPrice - Entry price
 * @property {string} currentPrice - Current price
 * @property {string} unrealizedPnL - Unrealized profit/loss
 * @property {string} liquidationPrice - Liquidation price
 * 
 * @returns {object} Trading feed response
 * @property {array} trades - Array of trade objects (mixed types)
 * @property {number} total - Total trades before limit
 * @property {boolean} hasMore - Whether more trades available
 * 
 * @throws {500} Internal server error
 * 
 * @example
 * ```typescript
 * // Get recent trades
 * const feed = await fetch('/api/trades?limit=20');
 * const { trades } = await feed.json();
 * 
 * // Get user's trades
 * const userTrades = await fetch(`/api/trades?userId=${userId}&limit=50`);
 * 
 * // Process different trade types
 * trades.forEach(trade => {
 *   switch(trade.type) {
 *     case 'npc':
 *       console.log(`${trade.user.displayName}: ${trade.reason}`);
 *       break;
 *     case 'perp':
 *       console.log(`Perp ${trade.side} ${trade.ticker} @${trade.entryPrice}`);
 *       break;
 *     // ... handle other types
 *   }
 * });
 * ```
 * 
 * @see {@link /lib/database-service} Database queries
 * @see {@link /src/app/trades/page.tsx} Trading feed UI
 * @see {@link /src/components/trading} Trading components
 */

import type { NextRequest } from 'next/server';
import { optionalAuth } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  userId: z.string().optional(),
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Optional auth - trades are public
  await optionalAuth(request).catch(() => null);

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const params = QuerySchema.parse({
    limit: searchParams.get('limit') || '50',
    offset: searchParams.get('offset') || '0',
    userId: searchParams.get('userId') || undefined,
  });

  logger.info(`Public trading feed requested`, { params }, 'GET /api/trades');

  const userFilter = params.userId ? { userId: params.userId } : {};

  // Get recent balance transactions (deposits, withdrawals, trades)
  // Only include market-related transactions (buys/sells)
  const balanceTransactions = await prisma.balanceTransaction.findMany({
    take: params.limit,
    skip: params.offset,
    orderBy: { createdAt: 'desc' },
    where: {
      ...userFilter,
      type: {
        in: ['pred_buy', 'pred_sell', 'perp_open', 'perp_close', 'perp_liquidation']
      }
    },
  });

  // Get recent point transfers (sent and received)
  const pointTransfers = await prisma.pointsTransaction.findMany({
    take: params.limit,
    skip: params.offset,
    orderBy: { createdAt: 'desc' },
    where: {
      ...userFilter,
      reason: {
        in: ['transfer_sent', 'transfer_received']
      }
    },
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

  // Fetch users for point transfers (both sender and recipient)
  const transferUserIds = new Set<string>();
  for (const transfer of pointTransfers) {
    transferUserIds.add(transfer.userId);
    // Parse metadata to get the other party's ID
    if (transfer.metadata) {
      const metadata = JSON.parse(transfer.metadata) as { senderId?: string; recipientId?: string; senderName?: string; recipientName?: string; message?: string };
      if (metadata.senderId) transferUserIds.add(metadata.senderId);
      if (metadata.recipientId) transferUserIds.add(metadata.recipientId);
    }
  }
  const transferUsers = await prisma.user.findMany({
    where: { id: { in: Array.from(transferUserIds) } },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileImageUrl: true,
      isActor: true,
    },
  });
  const transferUsersMap = new Map(transferUsers.map(u => [u.id, u]));

  // Get recent NPC trades (if not filtering by specific user, or if user is an NPC)
  let npcTrades: Awaited<ReturnType<typeof prisma.nPCTrade.findMany>> = [];
  if (!params.userId) {
    npcTrades = await prisma.nPCTrade.findMany({
      take: params.limit,
      skip: params.offset,
      orderBy: { executedAt: 'desc' },
    });
  } else {
    // Check if the user is an NPC
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { isActor: true },
    });
    
    if (user?.isActor) {
      npcTrades = await prisma.nPCTrade.findMany({
        take: params.limit,
        skip: params.offset,
        orderBy: { executedAt: 'desc' },
        where: { npcActorId: params.userId },
      });
    }
  }

  // Fetch NPC actors for NPC trades
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

  // Get recent position updates (significant changes)
  const positions = await prisma.position.findMany({
    take: params.limit,
    skip: params.offset,
    orderBy: { updatedAt: 'desc' },
    where: {
      ...userFilter,
      shares: { gt: 0 }, // Only include positions with shares
    },
    include: {
      Market: {
        select: {
          id: true,
          question: true,
          resolved: true,
          resolution: true,
        },
      },
    },
  });

  // Fetch users for positions
  const positionUserIds = [...new Set(positions.map(p => p.userId))];
  const positionUsers = await prisma.user.findMany({
    where: { id: { in: positionUserIds } },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileImageUrl: true,
      isActor: true,
    },
  });
  const positionUsersMap = new Map(positionUsers.map(u => [u.id, u]));

  // Get perp positions for the user (if filtering)
  let perpPositions: Awaited<ReturnType<typeof prisma.perpPosition.findMany>> = [];
  if (params.userId) {
    perpPositions = await prisma.perpPosition.findMany({
      take: params.limit,
      skip: params.offset,
      orderBy: { openedAt: 'desc' },
      where: { userId: params.userId },
    });
  } else {
    // Get recent perp positions from all users
    perpPositions = await prisma.perpPosition.findMany({
      take: params.limit,
      skip: params.offset,
      orderBy: { openedAt: 'desc' },
    });
  }

  // Fetch organizations for perp positions
  const organizationIds = [...new Set(perpPositions.map(p => p.organizationId))];
  const organizations = await prisma.organization.findMany({
    where: { id: { in: organizationIds } },
    select: {
      id: true,
      name: true,
      type: true,
    },
  });
  const organizationsMap = new Map(organizations.map(o => [o.id, o]));

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
    ...pointTransfers.map(tx => {
      const metadata = tx.metadata ? JSON.parse(tx.metadata) as { senderId?: string; recipientId?: string; senderName?: string; recipientName?: string; message?: string } : {};
      const isSent = tx.reason === 'transfer_sent';
      const otherPartyId = isSent ? metadata.recipientId : metadata.senderId;
      const otherPartyName = isSent ? metadata.recipientName : metadata.senderName;
      
      return {
        type: 'transfer' as const,
        id: tx.id,
        timestamp: tx.createdAt,
        user: transferUsersMap.get(tx.userId) || null,
        otherParty: otherPartyId ? transferUsersMap.get(otherPartyId) || { id: otherPartyId, username: otherPartyName, displayName: otherPartyName, profileImageUrl: null, isActor: false } : null,
        amount: tx.amount,
        pointsBefore: tx.pointsBefore,
        pointsAfter: tx.pointsAfter,
        direction: isSent ? 'sent' as const : 'received' as const,
        message: metadata.message,
      };
    }),
    ...npcTrades.map(trade => {
      const actor = actorsMap.get(trade.npcActorId);
      return {
        type: 'npc' as const,
        id: trade.id,
        timestamp: trade.executedAt,
        user: actor ? {
          id: actor.id,
          username: actor.username,
          displayName: actor.displayName,
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
      market: pos.Market ? {
        id: pos.Market.id,
        question: pos.Market.question,
        resolved: pos.Market.resolved,
        resolution: pos.Market.resolution,
      } : null,
      side: pos.side ? 'YES' : 'NO',
      shares: pos.shares.toString(),
      avgPrice: pos.avgPrice.toString(),
      createdAt: pos.createdAt,
    })),
    ...perpPositions.map(pos => {
      const organization = organizationsMap.get(pos.organizationId);
      return {
        type: 'perp' as const,
        id: pos.id,
        timestamp: pos.openedAt,
        user: perpUsersMap.get(pos.userId) || null,
        ticker: pos.ticker,
        organization: organization ? {
          id: organization.id,
          name: organization.name,
          ticker: pos.ticker, // Use ticker from position since Organization doesn't have it
        } : null,
        side: pos.side,
        entryPrice: pos.entryPrice.toString(),
        currentPrice: pos.currentPrice.toString(),
        size: pos.size.toString(),
        leverage: pos.leverage,
        unrealizedPnL: pos.unrealizedPnL.toString(),
        liquidationPrice: pos.liquidationPrice.toString(),
        closedAt: pos.closedAt,
      };
    }),
  ].filter(trade => trade.user !== null); // Filter out trades with missing users

  // Sort by timestamp
  allTrades.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Limit to requested amount
  const limitedTrades = allTrades.slice(0, params.limit);

  return successResponse({
    trades: limitedTrades,
    total: allTrades.length,
    hasMore: allTrades.length > params.limit,
  });
});

