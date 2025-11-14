/**
 * Perpetual Futures Markets API
 *
 * GET /api/markets/perps - Get all tradeable companies
 */

import type { NextRequest } from 'next/server'
import { db } from '@/lib/database-service';
import { optionalAuth, type AuthenticatedUser } from '@/lib/api/auth-middleware';
import { asUser, asPublic } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { logger } from '@/lib/logger';

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Get ONLY companies (not media, government, think tanks)
  const companies = await db.getCompanies();

  // Optional auth - markets are public but RLS still applies
  const authUser: AuthenticatedUser | null = await optionalAuth(request).catch(() => null);

  // Build markets with REAL 24h stats
  const markets = await Promise.all(
    companies.map(async (company) => {
      const currentPrice = company.currentPrice || company.initialPrice || 100;

      // Get last 24 hours of price history (1440 minutes)
      const priceHistory = await db.getPriceHistory(company.id, 1440);

      let change24h = 0;
      let changePercent24h = 0;
      let high24h = currentPrice;
      let low24h = currentPrice;

      if (priceHistory.length > 0) {
        // Calculate 24h change
        const price24hAgo = priceHistory[priceHistory.length - 1];
        if (price24hAgo) {
          change24h = currentPrice - price24hAgo.price;
          changePercent24h = (change24h / price24hAgo.price) * 100;
        }

        // Calculate high/low
        high24h = Math.max(...priceHistory.map(p => p.price), currentPrice);
        low24h = Math.min(...priceHistory.map(p => p.price), currentPrice);
      }

      // Get positions with RLS (only if authenticated)
      const dbPositions = (authUser && authUser.userId)
        ? await asUser(authUser, async (dbPrisma) => {
            return await dbPrisma.perpPosition.findMany({
              where: {
                organizationId: company.id,
                closedAt: null,
              },
              select: {
                id: true,
                userId: true,
                side: true,
                size: true,
                leverage: true,
                entryPrice: true,
                currentPrice: true,
              },
            });
          })
        : await asPublic(async (dbPrisma) => {
            return await dbPrisma.perpPosition.findMany({
              where: {
                organizationId: company.id,
                closedAt: null,
              },
              select: {
                id: true,
                userId: true,
                side: true,
                size: true,
                leverage: true,
                entryPrice: true,
                currentPrice: true,
              },
            });
          });
      
      const positions = dbPositions.map(p => ({
        id: p.id,
        userId: p.userId,
        side: p.side as 'long' | 'short',
        size: Number(p.size),
        leverage: Number(p.leverage),
        entryPrice: Number(p.entryPrice),
        currentPrice: Number(p.currentPrice),
      }));

      const openInterest = positions.reduce((sum, p) => sum + (p.size * p.leverage), 0);

      // Calculate funding rate from position imbalance
      const longs = positions.filter(p => p.side === 'long');
      const shorts = positions.filter(p => p.side === 'short');
      const longSize = longs.reduce((sum, p) => sum + p.size, 0);
      const shortSize = shorts.reduce((sum, p) => sum + p.size, 0);
      const totalSize = longSize + shortSize;

      let fundingRate = 0.01; // Default 1% annual
      if (totalSize > 0) {
        const imbalance = (longSize - shortSize) / totalSize;
        fundingRate = 0.01 + (imbalance * 0.05); // ±5% based on imbalance
      }

      return {
        ticker: company.id.toUpperCase().replace(/-/g, ''),
        organizationId: company.id,
        name: company.name,
        currentPrice,
        change24h,
        changePercent24h,
        high24h,
        low24h,
        volume24h: 0, // TODO: Track from trades
        openInterest,
        fundingRate: {
          rate: fundingRate,
          nextFundingTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          predictedRate: fundingRate,
        },
        maxLeverage: 100,
        minOrderSize: 10,
      };
    })
  );

  logger.info('Perpetual markets fetched successfully', { count: markets.length }, 'GET /api/markets/perps');

  return successResponse({
    success: true,
    markets,
    count: markets.length,
  });
});
