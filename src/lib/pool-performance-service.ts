/**
 * Pool Performance Service
 * 
 * Updates pool values, positions, and deposit values in real-time
 * Runs on every tick to keep P&L calculations accurate
 */

import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { logger } from './logger';

export class PoolPerformanceService {
  /**
   * Update all active pools' performance metrics
   */
  static async updateAllPools(): Promise<void> {
    const activePools = await prisma.pool.findMany({
      where: { isActive: true },
      include: {
        positions: { where: { closedAt: null } },
        deposits: { where: { withdrawnAt: null } },
      },
    });

    for (const pool of activePools) {
      await this.updatePoolPerformance(pool.id);
    }

    logger.info(`Updated ${activePools.length} pools`, {}, 'PoolPerformanceService');
  }

  /**
   * Update a specific pool's performance
   */
  static async updatePoolPerformance(poolId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const pool = await tx.pool.findUnique({
        where: { id: poolId },
        include: {
          positions: { where: { closedAt: null } },
          deposits: { where: { withdrawnAt: null } },
        },
      });

      if (!pool) throw new Error(`Pool not found: ${poolId}`);

      for (const position of pool.positions) {
        await this.updatePositionPnL(tx, position);
      }

      const updatedPositions = await tx.poolPosition.findMany({
        where: { poolId, closedAt: null },
      });

      const availableBalance = parseFloat(pool.availableBalance.toString());
      const totalDeposits = parseFloat(pool.totalDeposits.toString());
      const positionsValue = updatedPositions.reduce((sum, pos) => sum + pos.size + pos.unrealizedPnL, 0);
      const newTotalValue = availableBalance + positionsValue;
      const newLifetimePnL = newTotalValue - totalDeposits;

      await tx.pool.update({
        where: { id: poolId },
        data: {
          totalValue: new Prisma.Decimal(newTotalValue),
          lifetimePnL: new Prisma.Decimal(newLifetimePnL),
        },
      });

      if (pool.deposits.length > 0 && totalDeposits > 0) {
        const totalShares = pool.deposits.reduce((sum, d) => sum + parseFloat(d.shares.toString()), 0);
        const sharePrice = totalShares > 0 ? newTotalValue / totalShares : 1;

        for (const deposit of pool.deposits) {
          const shares = parseFloat(deposit.shares.toString());
          const originalAmount = parseFloat(deposit.amount.toString());
          const currentValue = shares * sharePrice;
          const unrealizedPnL = currentValue - originalAmount;

          await tx.poolDeposit.update({
            where: { id: deposit.id },
            data: {
              currentValue: new Prisma.Decimal(currentValue),
              unrealizedPnL: new Prisma.Decimal(unrealizedPnL),
            },
          });
        }
      }
    });
  }

  /**
   * Update a position's current price and P&L
   */
  private static async updatePositionPnL(
    tx: Prisma.TransactionClient,
    position: {
      id: string
      marketType: string
      ticker: string | null
      marketId: string | null
      side: string
      entryPrice: number
      currentPrice: number
      size: number
      shares: number | null
      unrealizedPnL: number
    }
  ): Promise<void> {
    let currentPrice = position.currentPrice;
    let unrealizedPnL = position.unrealizedPnL;

    if (position.marketType === 'perp' && position.ticker) {
      const org = await tx.organization.findFirst({
        where: { id: { contains: position.ticker.toLowerCase() } },
        select: { currentPrice: true },
      });

      if (org?.currentPrice) {
        currentPrice = org.currentPrice;
        const priceChange = currentPrice - position.entryPrice;
        const isLong = position.side === 'long';
        const pnlMultiplier = isLong ? 1 : -1;
        const percentChange = priceChange / position.entryPrice;
        unrealizedPnL = percentChange * position.size * pnlMultiplier;
      }
    } else if (position.marketType === 'prediction' && position.marketId) {
      const market = await tx.market.findFirst({
        where: { id: position.marketId, resolved: false },
        select: { yesShares: true, noShares: true },
      });

      if (market) {
        const totalShares = parseFloat(market.yesShares.toString()) + parseFloat(market.noShares.toString());
        if (totalShares > 0) {
          const yesPrice = parseFloat(market.yesShares.toString()) / totalShares * 100;
          const noPrice = parseFloat(market.noShares.toString()) / totalShares * 100;
          currentPrice = position.side === 'YES' ? yesPrice : noPrice;
          const priceChange = currentPrice - position.entryPrice;
          const shares = position.shares || 0;
          unrealizedPnL = (priceChange / 100) * shares;
        }
      }
    }

    await tx.poolPosition.update({
      where: { id: position.id },
      data: { currentPrice, unrealizedPnL },
    });
  }

  /**
   * Close a position (called when NPC sells or position is liquidated)
   */
  static async closePosition(positionId: string, closingPrice: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const position = await tx.poolPosition.findUnique({ where: { id: positionId } });
      if (!position) throw new Error(`Position not found: ${positionId}`);
      if (position.closedAt) throw new Error(`Position already closed: ${positionId}`);

      const priceChange = closingPrice - position.entryPrice;
      const isLong = position.side === 'long' || position.side === 'YES';
      const pnlMultiplier = isLong ? 1 : -1;
      
      let realizedPnL: number;
      if (position.marketType === 'perp') {
        const percentChange = priceChange / position.entryPrice;
        realizedPnL = percentChange * position.size * pnlMultiplier;
      } else {
        const shares = position.shares || 0;
        realizedPnL = (priceChange / 100) * shares;
      }

      await tx.poolPosition.update({
        where: { id: positionId },
        data: {
          closedAt: new Date(),
          currentPrice: closingPrice,
          unrealizedPnL: 0,
          realizedPnL,
        },
      });

      const returnAmount = position.size + realizedPnL;
      await tx.pool.update({
        where: { id: position.poolId },
        data: {
          availableBalance: { increment: returnAmount },
          lifetimePnL: { increment: realizedPnL },
        },
      });

      logger.info(`Position closed: ${positionId} with P&L: ${realizedPnL}`, {}, 'PoolPerformanceService');
    });
  }
}

