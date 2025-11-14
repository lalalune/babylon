/**
 * Fee Service
 * 
 * Manages trading fees and referral fee distribution
 */

import { FEE_CONFIG, type FeeType } from '@/lib/config/fees'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'
import { Prisma } from '@prisma/client'

// Force TypeScript server reload after Prisma regeneration

export interface FeeCalculation {
  feeAmount: number
  netAmount: number // Amount after fee deduction
  platformShare: number
  referrerShare: number
}

export interface FeeDistributionResult {
  feeCharged: number
  referrerPaid: number
  platformReceived: number
  referrerId: string | null
}

export interface ReferralEarnings {
  totalEarned: number
  totalReferrals: number
  topReferrals: Array<{
    userId: string
    username: string
    displayName: string
    profileImageUrl: string | null
    totalFees: number
    tradeCount: number
  }>
  recentFees: Array<{
    id: string
    tradeType: string
    feeAmount: number
    traderId: string
    traderUsername: string | null
    createdAt: Date
  }>
}

export class FeeService {
  /**
   * Calculate fee for a trade amount
   */
  static calculateFee(tradeAmount: number): FeeCalculation {
    const feeAmount = tradeAmount * FEE_CONFIG.TRADING_FEE_RATE
    const netAmount = tradeAmount - feeAmount
    const platformShare = feeAmount * FEE_CONFIG.PLATFORM_SHARE
    const referrerShare = feeAmount * FEE_CONFIG.REFERRER_SHARE
    
    return {
      feeAmount: Number(feeAmount.toFixed(2)),
      netAmount: Number(netAmount.toFixed(2)),
      platformShare: Number(platformShare.toFixed(2)),
      referrerShare: Number(referrerShare.toFixed(2)),
    }
  }
  
  /**
   * Calculate fee on proceeds (for selling)
   */
  static calculateFeeOnProceeds(proceeds: number): FeeCalculation {
    return this.calculateFee(proceeds)
  }
  
  /**
   * Process trading fee - charge user and distribute to platform/referrer
   */
  static async processTradingFee(
    userId: string,
    tradeType: FeeType,
    tradeAmount: number,
    tradeId?: string,
    marketId?: string
  ): Promise<FeeDistributionResult> {
    const feeCalc = this.calculateFee(tradeAmount)
    
    // Skip if fee is below minimum
    if (feeCalc.feeAmount < FEE_CONFIG.MIN_FEE_AMOUNT) {
      logger.debug(`Fee ${feeCalc.feeAmount} below minimum, skipping`, {
        userId,
        tradeType,
        tradeAmount,
      }, 'FeeService')
      
      return {
        feeCharged: 0,
        referrerPaid: 0,
        platformReceived: 0,
        referrerId: null,
      }
    }
    
    // Get user's referrer
    const referrerId = await this.getUserReferrer(userId)
    
    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create trading fee record
      await tx.tradingFee.create({
        data: {
          id: await generateSnowflakeId(),
          userId,
          tradeType,
          tradeId: tradeId || null,
          marketId: marketId || null,
          feeAmount: new Prisma.Decimal(feeCalc.feeAmount),
          platformFee: new Prisma.Decimal(feeCalc.platformShare),
          referrerFee: new Prisma.Decimal(feeCalc.referrerShare),
          referrerId: referrerId || null,
        },
      })
      
      // Update trader's total fees paid
      await tx.user.update({
        where: { id: userId },
        data: {
          totalFeesPaid: {
            increment: new Prisma.Decimal(feeCalc.feeAmount),
          },
        },
      })
      
      // Distribute referral fee if referrer exists
      if (referrerId) {
        await this.distributeReferralFee(referrerId, feeCalc.referrerShare, userId, tx)
      }
      
      return {
        feeCharged: feeCalc.feeAmount,
        referrerPaid: referrerId ? feeCalc.referrerShare : 0,
        platformReceived: referrerId ? feeCalc.platformShare : feeCalc.feeAmount,
        referrerId,
      }
    })
    
    logger.info(`Trading fee processed`, {
      userId,
      tradeType,
      feeCharged: result.feeCharged,
      referrerPaid: result.referrerPaid,
      referrerId: result.referrerId,
    }, 'FeeService')
    
    return result
  }
  
  /**
   * Get user's referrer
   */
  static async getUserReferrer(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredBy: true },
    })
    
    return user?.referredBy || null
  }
  
  /**
   * Distribute referral fee to referrer
   */
  static async distributeReferralFee(
    referrerId: string,
    feeAmount: number,
    traderId: string,
    tx: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
  ): Promise<void> {
    // Credit referrer's virtual balance
    const referrer = await tx.user.findUnique({
      where: { id: referrerId },
      select: { virtualBalance: true },
    })
    
    if (!referrer) {
      logger.warn(`Referrer not found: ${referrerId}`, { referrerId, traderId }, 'FeeService')
      return
    }
    
    const currentBalance = Number(referrer.virtualBalance)
    const newBalance = currentBalance + feeAmount
    
    // Update referrer balance
    await tx.user.update({
      where: { id: referrerId },
      data: {
        virtualBalance: new Prisma.Decimal(newBalance),
        totalFeesEarned: {
          increment: new Prisma.Decimal(feeAmount),
        },
      },
    })
    
    // Create balance transaction
    await tx.balanceTransaction.create({
      data: {
        id: await generateSnowflakeId(),
        userId: referrerId,
        type: FEE_CONFIG.TRANSACTION_TYPES.REFERRAL_FEE_EARNED,
        amount: new Prisma.Decimal(feeAmount),
        balanceBefore: new Prisma.Decimal(currentBalance),
        balanceAfter: new Prisma.Decimal(newBalance),
        relatedId: traderId,
        description: `Referral fee earned from trading activity`,
      },
    })
    
    logger.info(`Referral fee distributed`, {
      referrerId,
      traderId,
      feeAmount,
    }, 'FeeService')
  }
  
  /**
   * Get referral fee earnings for a user
   */
  static async getReferralEarnings(
    userId: string,
    options?: {
      startDate?: Date
      endDate?: Date
      limit?: number
    }
  ): Promise<ReferralEarnings> {
    const { startDate, endDate, limit = 10 } = options || {}
    
    // Build where clause for date filtering
    const whereClause: Prisma.TradingFeeWhereInput = {
      referrerId: userId,
      ...(startDate || endDate ? {
        createdAt: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        },
      } : {}),
    }
    
    // Get total earnings
    const totalResult = await prisma.tradingFee.aggregate({
      where: whereClause,
      _sum: {
        referrerFee: true,
      },
      _count: true,
    })
    
    const totalEarned = Number(totalResult._sum.referrerFee || 0)
    
    // Get unique traders (referrals)
    const uniqueTraders = await prisma.tradingFee.findMany({
      where: whereClause,
      select: {
        userId: true,
        User_TradingFee_userIdToUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
          },
        },
      },
      distinct: ['userId'],
    })
    
    // Get top referrals by fees generated
    const topReferralsData = await prisma.tradingFee.groupBy({
      by: ['userId'],
      where: whereClause,
      _sum: {
        referrerFee: true,
      },
      _count: true,
      orderBy: {
        _sum: {
          referrerFee: 'desc',
        },
      },
      take: limit,
    })
    
    // Enrich with user data
    const topReferrals = await Promise.all(
      topReferralsData.map(async (item) => {
        const user = await prisma.user.findUnique({
          where: { id: item.userId },
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
          },
        })
        
        return {
          userId: item.userId,
          username: user?.username || 'Unknown',
          displayName: user?.displayName || 'Unknown User',
          profileImageUrl: user?.profileImageUrl || null,
          totalFees: Number(item._sum.referrerFee || 0),
          tradeCount: item._count,
        }
      })
    )
    
    // Get recent fees
    const recentFees = await prisma.tradingFee.findMany({
      where: whereClause,
      select: {
        id: true,
        tradeType: true,
        referrerFee: true,
        userId: true,
        User_TradingFee_userIdToUser: {
          select: {
            username: true,
          },
        },
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })
    
    return {
      totalEarned,
      totalReferrals: uniqueTraders.length,
      topReferrals,
      recentFees: recentFees.map(fee => ({
        id: fee.id,
        tradeType: fee.tradeType,
        feeAmount: Number(fee.referrerFee),
        traderId: fee.userId,
        traderUsername: fee.User_TradingFee_userIdToUser.username,
        createdAt: fee.createdAt,
      })),
    }
  }
  
  /**
   * Get fee statistics for the platform
   */
  static async getPlatformFeeStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalFeesCollected: number
    totalReferrerFees: number
    totalPlatformFees: number
    totalTrades: number
  }> {
    const whereClause: Prisma.TradingFeeWhereInput = {
      ...(startDate || endDate ? {
        createdAt: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        },
      } : {}),
    }
    
    const result = await prisma.tradingFee.aggregate({
      where: whereClause,
      _sum: {
        feeAmount: true,
        platformFee: true,
        referrerFee: true,
      },
      _count: true,
    })
    
    return {
      totalFeesCollected: Number(result._sum.feeAmount || 0),
      totalReferrerFees: Number(result._sum.referrerFee || 0),
      totalPlatformFees: Number(result._sum.platformFee || 0),
      totalTrades: result._count,
    }
  }
}

