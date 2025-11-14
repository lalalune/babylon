/**
 * Perpetual Futures Markets API
 * 
 * @route GET /api/markets/perps
 * @access Public (optional authentication for user positions)
 * 
 * @description
 * Returns all available perpetual futures markets with real-time pricing,
 * 24-hour statistics, open interest, funding rates, and user positions.
 * Perpetual futures allow leveraged trading on company valuations without
 * expiration dates.
 * 
 * **Market Data Includes:**
 * - **Current Price:** Real-time company valuation
 * - **24h Statistics:** Price change, volume, high/low
 * - **Open Interest:** Total notional value of all open positions
 * - **Funding Rate:** Periodic payment between long and short positions
 * - **Leverage Limits:** Maximum leverage available (up to 100x)
 * - **User Positions:** Active positions for authenticated users
 * 
 * **Funding Rate Calculation:**
 * Funding rates balance long/short position imbalance:
 * - Base rate: 1% annual
 * - Adjusted by position imbalance: ±5%
 * - Paid every 8 hours
 * - Longs pay shorts when more longs, vice versa
 * 
 * **24h Statistics:**
 * Calculated from minute-by-minute price history:
 * - Change: Current price vs 24h ago
 * - Change %: Percentage change
 * - High/Low: 24h price range
 * - Volume: Sum of notional values of positions opened
 * 
 * **Open Interest:**
 * Total size of all open positions (long + short) representing
 * market liquidity and trader commitment.
 * 
 * **Authentication:**
 * - Public access: Returns all markets without user positions
 * - Authenticated: Includes user's open positions for each market
 * 
 * @returns {object} Markets list response
 * @property {boolean} success - Operation success
 * @property {array} markets - Array of market objects
 * @property {number} count - Total markets available
 * 
 * **Market Object:**
 * @property {string} ticker - Trading symbol (e.g., 'AAPL', 'GOOGL')
 * @property {string} organizationId - Company/organization ID
 * @property {string} name - Company name
 * @property {number} currentPrice - Current market price
 * @property {number} change24h - 24h price change (absolute)
 * @property {number} changePercent24h - 24h price change (percentage)
 * @property {number} high24h - 24h high price
 * @property {number} low24h - 24h low price
 * @property {number} volume24h - 24h trading volume
 * @property {number} openInterest - Total open interest
 * @property {object} fundingRate - Funding rate information
 * @property {number} fundingRate.rate - Current rate (annual)
 * @property {string} fundingRate.nextFundingTime - Next funding timestamp
 * @property {number} fundingRate.predictedRate - Predicted next rate
 * @property {number} maxLeverage - Maximum leverage allowed (100x)
 * @property {number} minOrderSize - Minimum order size
 * 
 * @throws {500} Internal server error
 * 
 * @example
 * ```typescript
 * // Get all perp markets
 * const response = await fetch('/api/markets/perps');
 * const { markets } = await response.json();
 * 
 * // Display market data
 * markets.forEach(market => {
 *   console.log(`${market.ticker}: $${market.currentPrice}`);
 *   console.log(`24h: ${market.changePercent24h.toFixed(2)}%`);
 *   console.log(`Open Interest: $${market.openInterest.toLocaleString()}`);
 *   console.log(`Funding: ${(market.fundingRate.rate * 100).toFixed(3)}%`);
 * });
 * 
 * // Find most active market
 * const mostActive = markets.reduce((max, m) => 
 *   m.volume24h > max.volume24h ? m : max
 * );
 * ```
 * 
 * @see {@link /lib/database-service} Database service
 * @see {@link /lib/db/context} RLS context for user positions
 * @see {@link /src/app/markets/perps/page.tsx} Perps trading UI
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

      // Open Interest = total notional value of all open positions
      const openInterest = positions.reduce((sum, p) => sum + (p.size * p.currentPrice), 0);

      // Calculate 24h trading volume from positions opened in last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentPositions = (authUser && authUser.userId)
        ? await asUser(authUser, async (dbPrisma) => {
            return await dbPrisma.perpPosition.findMany({
              where: {
                organizationId: company.id,
                openedAt: { gte: twentyFourHoursAgo },
              },
              select: {
                size: true,
                entryPrice: true,
              },
            });
          })
        : await asPublic(async (dbPrisma) => {
            return await dbPrisma.perpPosition.findMany({
              where: {
                organizationId: company.id,
                openedAt: { gte: twentyFourHoursAgo },
              },
              select: {
                size: true,
                entryPrice: true,
              },
            });
          });

      // Volume = sum of notional values (size * entry price)
      const volume24h = recentPositions.reduce((sum, p) => {
        const size = Number(p.size);
        const entryPrice = Number(p.entryPrice);
        return sum + (size * entryPrice);
      }, 0);

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
        volume24h,
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
