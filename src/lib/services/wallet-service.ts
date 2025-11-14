/**
 * Virtual Wallet Service
 *
 * Manages user's virtual USD balance for trading:
 * - Starting balance: $1,000
 * - Tracks all transactions
 * - Validates sufficient funds
 * - Calculates PnL
 */
import type { PrismaClient } from '@prisma/client';

import { cachedDb } from '@/lib/cached-database-service';
// import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { EarnedPointsService } from '@/lib/services/earned-points-service';
import { generateSnowflakeId } from '@/lib/snowflake';

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
      throw new Error(`User not found: ${userId}`);
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

    if (!user) {
      return false;
    }

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
      throw new Error(`User not found: ${userId}`);
    }

    const currentBalance = Number(user.virtualBalance);
    const newBalance = currentBalance - amount;

    await prisma.$transaction(async (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          virtualBalance: newBalance,
        },
      });

      await tx.balanceTransaction.create({
        data: {
          id: await generateSnowflakeId(),
          userId,
          type,
          amount: -amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          relatedId,
          description,
        },
      });
    });

    await cachedDb.invalidateUserCache(userId);
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
      throw new Error(`User not found: ${userId}`);
    }

    const currentBalance = Number(user.virtualBalance);
    const newBalance = currentBalance + amount;

    await prisma.$transaction(async (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          virtualBalance: newBalance,
        },
      });

      await tx.balanceTransaction.create({
        data: {
          id: await generateSnowflakeId(),
          userId,
          type,
          amount: amount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          relatedId,
          description,
        },
      });
    });

    await cachedDb.invalidateUserCache(userId);
  }

  /**
   * Record PnL (update lifetime PnL and earned points)
   */
  static async recordPnL(
    userId: string,
    pnl: number,
    tradeType: string,
    relatedId?: string
  ): Promise<{
    previousLifetimePnL: number;
    newLifetimePnL: number;
    earnedPointsDelta: number;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const previousLifetimePnL = Number(user.lifetimePnL);
    const newLifetimePnL = previousLifetimePnL + pnl;

    await prisma.user.update({
      where: { id: userId },
      data: {
        lifetimePnL: newLifetimePnL,
      },
    });

    const earnedPointsDelta = await EarnedPointsService.awardEarnedPointsForPnL(
      userId,
      previousLifetimePnL,
      newLifetimePnL,
      tradeType,
      relatedId
    );

    return {
      previousLifetimePnL,
      newLifetimePnL,
      earnedPointsDelta,
    };
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

    type TransactionType = typeof transactions[0];
    return transactions.map((tx: TransactionType) => ({
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
      throw new Error(`User not found: ${userId}`);
    }

    if (Number(user.virtualBalance) === 0) {
      await prisma.$transaction(async (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            virtualBalance: this.STARTING_BALANCE,
            totalDeposited: this.STARTING_BALANCE,
          },
        });

        await tx.balanceTransaction.create({
          data: {
            id: await generateSnowflakeId(),
            userId,
            type: 'deposit',
            amount: this.STARTING_BALANCE,
            balanceBefore: 0,
            balanceAfter: this.STARTING_BALANCE,
            description: 'Initial deposit - Welcome to Babylon!',
          },
        });
      });
    }
  }
}
