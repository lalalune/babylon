/**
 * Virtual Wallet Service
 *
 * Manages user's virtual USD balance for trading:
 * - Starting balance: $1,000
 * - Tracks all transactions
 * - Validates sufficient funds
 * - Calculates PnL
 */
import { Prisma } from '@prisma/client';

import { cachedDb } from '@/lib/cached-database-service';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { EarnedPointsService } from '@/lib/services/earned-points-service';

export interface BalanceInfo {
  balance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  lifetimePnL: number;
}

export interface TransactionHistoryItem {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  relatedId: string | null;
  createdAt: Date;
}

export class WalletService {
  private static readonly STARTING_BALANCE = 1000; // $1,000 USD

  /**
   * Get user's current balance
   */
  static async getBalance(userId: string): Promise<BalanceInfo> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        virtualBalance: true,
        totalDeposited: true,
        totalWithdrawn: true,
        lifetimePnL: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      balance: Number(user.virtualBalance),
      totalDeposited: Number(user.totalDeposited),
      totalWithdrawn: Number(user.totalWithdrawn),
      lifetimePnL: Number(user.lifetimePnL),
    };
  }

  /**
   * Check if user has sufficient balance
   */
  static async hasSufficientBalance(
    userId: string,
    requiredAmount: number
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { virtualBalance: true },
    });

    if (!user) return false;

    return Number(user.virtualBalance) >= requiredAmount;
  }

  /**
   * Debit from user's balance (opening position, buying shares)
   */
  static async debit(
    userId: string,
    amount: number,
    type: string,
    description: string,
    relatedId?: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const currentBalance = Number(user.virtualBalance);

    if (currentBalance < amount) {
      throw new Error(
        `Insufficient balance. Need ${amount}, have ${currentBalance}`
      );
    }

    const newBalance = currentBalance - amount;

    // Update balance and record transaction in a single transaction
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          virtualBalance: new Prisma.Decimal(newBalance),
        },
      });

      await tx.balanceTransaction.create({
        data: {
          userId,
          type,
          amount: new Prisma.Decimal(-amount), // Negative for debit
          balanceBefore: new Prisma.Decimal(currentBalance),
          balanceAfter: new Prisma.Decimal(newBalance),
          relatedId,
          description,
        },
      });
    });

    // Invalidate user cache after balance change
    await cachedDb.invalidateUserCache(userId).catch((err) => {
      logger.error(
        'Failed to invalidate user cache after debit',
        { userId, error: err },
        'WalletService'
      );
    });
  }

  /**
   * Credit to user's balance (closing position with profit, payouts)
   */
  static async credit(
    userId: string,
    amount: number,
    type: string,
    description: string,
    relatedId?: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const currentBalance = Number(user.virtualBalance);
    const newBalance = currentBalance + amount;

    // Update balance and record transaction
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          virtualBalance: new Prisma.Decimal(newBalance),
        },
      });

      await tx.balanceTransaction.create({
        data: {
          userId,
          type,
          amount: new Prisma.Decimal(amount), // Positive for credit
          balanceBefore: new Prisma.Decimal(currentBalance),
          balanceAfter: new Prisma.Decimal(newBalance),
          relatedId,
          description,
        },
      });
    });

    // Invalidate user cache after balance change
    await cachedDb.invalidateUserCache(userId).catch((err) => {
      logger.error(
        'Failed to invalidate user cache after credit',
        { userId, error: err },
        'WalletService'
      );
    });
  }

  /**
   * Record PnL (update lifetime PnL and earned points)
   */
  static async recordPnL(userId: string, pnl: number, tradeType?: string, relatedId?: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const newLifetimePnL = Number(user.lifetimePnL) + pnl;

    await prisma.user.update({
      where: { id: userId },
      data: {
        lifetimePnL: new Prisma.Decimal(newLifetimePnL),
      },
    });

    // Award earned points based on P&L (async, non-blocking)
    EarnedPointsService.awardEarnedPointsForPnL(
      userId, 
      pnl, 
      tradeType || 'unknown',
      relatedId
    ).catch((error) => {
      logger.error('Failed to award earned points for P&L', { userId, pnl, error }, 'WalletService');
    });
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(
    userId: string,
    limit: number = 50
  ): Promise<TransactionHistoryItem[]> {
    const transactions = await prisma.balanceTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: Number(tx.amount),
      balanceBefore: Number(tx.balanceBefore),
      balanceAfter: Number(tx.balanceAfter),
      description: tx.description,
      relatedId: tx.relatedId,
      createdAt: tx.createdAt,
    }));
  }

  /**
   * Initialize user balance (for new users)
   */
  static async initializeBalance(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Only initialize if balance is 0 (new user)
    if (Number(user.virtualBalance) === 0) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            virtualBalance: new Prisma.Decimal(this.STARTING_BALANCE),
            totalDeposited: new Prisma.Decimal(this.STARTING_BALANCE),
          },
        });

        await tx.balanceTransaction.create({
          data: {
            userId,
            type: 'deposit',
            amount: new Prisma.Decimal(this.STARTING_BALANCE),
            balanceBefore: new Prisma.Decimal(0),
            balanceAfter: new Prisma.Decimal(this.STARTING_BALANCE),
            description: 'Initial deposit - Welcome to Babylon!',
          },
        });
      });
    }
  }
}
