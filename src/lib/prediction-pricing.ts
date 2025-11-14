/**
 * Prediction Market AMM Pricing
 * Pure math - no dependencies, can be used client or server side
 * 
 * Uses Constant Product Market Maker (CPMM): k = yesShares * noShares
 */

import { FEE_CONFIG } from '@/lib/config/fees'

export interface ShareCalculation {
  sharesBought: number;
  avgPrice: number;
  newYesPrice: number;
  newNoPrice: number;
  priceImpact: number;
  totalCost: number;
  newYesShares: number;
  newNoShares: number;
}

export interface ShareCalculationWithFees extends ShareCalculation {
  fee: number;
  netAmount: number; // Amount after fee
  totalWithFee?: number; // Total including fee (for buying)
  netProceeds?: number; // Net proceeds after fee (for selling)
}

export class PredictionPricing {
  /**
   * Calculate shares when buying (CPMM: k = yesShares * noShares)
   */
  static calculateBuy(
    currentYesShares: number,
    currentNoShares: number,
    side: 'yes' | 'no',
    usdAmount: number
  ): ShareCalculation {
    if (usdAmount <= 0) {
      throw new Error('Trade amount must be positive');
    }

    const k = currentYesShares * currentNoShares;
    if (k <= 0) {
      throw new Error('Market has insufficient liquidity');
    }

    const currentTotal = currentYesShares + currentNoShares;
    const currentYesPrice = currentNoShares / currentTotal;
    const currentNoPrice = currentYesShares / currentTotal;

    let newYesShares: number;
    let newNoShares: number;
    let sharesBought: number;

    // CPMM: User pays USD, gets shares
    // USD goes to opposite side reserves, shares come from same side reserves
    if (side === 'yes') {
      // User pays USD → increases NO reserves
      // User gets YES shares → decreases YES reserves
      newNoShares = currentNoShares + usdAmount;
      newYesShares = k / newNoShares;
      sharesBought = currentYesShares - newYesShares;
    } else {
      // User pays USD → increases YES reserves  
      // User gets NO shares → decreases NO reserves
      newYesShares = currentYesShares + usdAmount;
      newNoShares = k / newYesShares;
      sharesBought = currentNoShares - newNoShares;
    }

    if (sharesBought <= 0) {
      throw new Error('Calculated shares purchased must be positive');
    }

    const newTotal = newYesShares + newNoShares;
    const newYesPrice = newNoShares / newTotal;
    const newNoPrice = newYesShares / newTotal;

    const priceImpact =
      side === 'yes'
        ? ((newYesPrice - currentYesPrice) / currentYesPrice) * 100
        : ((newNoPrice - currentNoPrice) / currentNoPrice) * 100;

    return {
      sharesBought,
      avgPrice: usdAmount / sharesBought,
      newYesPrice,
      newNoPrice,
      priceImpact,
      totalCost: usdAmount,
      newYesShares,
      newNoShares,
    };
  }

  /**
   * Calculate proceeds when selling shares (CPMM: k = yesShares * noShares)
   */
  static calculateSell(
    currentYesShares: number,
    currentNoShares: number,
    side: 'yes' | 'no',
    sharesToSell: number
  ): ShareCalculation {
    if (sharesToSell <= 0) {
      throw new Error('Shares to sell must be positive');
    }

    const k = currentYesShares * currentNoShares;
    if (k <= 0) {
      throw new Error('Market has insufficient liquidity');
    }

    const currentTotal = currentYesShares + currentNoShares;
    const currentYesPrice = currentNoShares / currentTotal;
    const currentNoPrice = currentYesShares / currentTotal;

    let newYesShares: number;
    let newNoShares: number;
    let proceeds: number;

    // CPMM: User returns shares, gets USD
    // Shares go back to same side reserves, USD comes from opposite side reserves
    if (side === 'yes') {
      // User returns YES shares → increases YES reserves
      // User gets USD → decreases NO reserves
      newYesShares = currentYesShares + sharesToSell;
      newNoShares = k / newYesShares;
      proceeds = currentNoShares - newNoShares;
    } else {
      // User returns NO shares → increases NO reserves
      // User gets USD → decreases YES reserves
      newNoShares = currentNoShares + sharesToSell;
      newYesShares = k / newNoShares;
      proceeds = currentYesShares - newYesShares;
    }

    if (!Number.isFinite(proceeds) || proceeds <= 0) {
      throw new Error('Calculated proceeds must be positive');
    }

    const newTotal = newYesShares + newNoShares;
    const newYesPrice = newNoShares / newTotal;
    const newNoPrice = newYesShares / newTotal;

    // Calculate proceeds (how much USD user gets back)
    const priceImpact =
      side === 'yes'
        ? ((currentYesPrice - newYesPrice) / currentYesPrice) * 100
        : ((currentNoPrice - newNoPrice) / currentNoPrice) * 100;

    return {
      sharesBought: -sharesToSell, // Negative because we're selling
      avgPrice: proceeds / sharesToSell,
      newYesPrice,
      newNoPrice,
      priceImpact,
      totalCost: proceeds, // Proceeds for selling
      newYesShares,
      newNoShares,
    };
  }

  static getCurrentPrice(yesShares: number, noShares: number, side: 'yes' | 'no'): number {
    const total = yesShares + noShares;
    return side === 'yes' ? noShares / total : yesShares / total;
  }

  /**
   * Calculate expected payout if position wins
   */
  static calculateExpectedPayout(shares: number): number {
    // Each share pays $1 if wins, $0 if loses
    return shares * 1.0;
  }

  static initializeMarket(initialLiquidity = 1000) {
    return {
      yesShares: initialLiquidity / 2,
      noShares: initialLiquidity / 2,
    };
  }

  /**
   * Calculate buy with trading fees
   * User provides total amount to spend, fees are deducted, then shares are calculated
   */
  static calculateBuyWithFees(
    currentYesShares: number,
    currentNoShares: number,
    side: 'yes' | 'no',
    totalAmount: number
  ): ShareCalculationWithFees {
    // Calculate fee
    const fee = totalAmount * FEE_CONFIG.TRADING_FEE_RATE
    const netAmount = totalAmount - fee
    
    // Calculate shares with net amount
    const baseCalc = this.calculateBuy(
      currentYesShares,
      currentNoShares,
      side,
      netAmount
    )
    
    return {
      ...baseCalc,
      fee,
      netAmount,
      totalWithFee: totalAmount,
      totalCost: netAmount,
    }
  }

  /**
   * Calculate sell with trading fees
   * Calculates proceeds, then deducts fee from proceeds
   */
  static calculateSellWithFees(
    currentYesShares: number,
    currentNoShares: number,
    side: 'yes' | 'no',
    sharesToSell: number
  ): ShareCalculationWithFees {
    // Calculate base proceeds
    const baseCalc = this.calculateSell(
      currentYesShares,
      currentNoShares,
      side,
      sharesToSell
    )
    
    const grossProceeds = baseCalc.totalCost
    const fee = grossProceeds * FEE_CONFIG.TRADING_FEE_RATE
    const netProceeds = grossProceeds - fee
    
    return {
      ...baseCalc,
      fee,
      netAmount: netProceeds,
      netProceeds,
      totalCost: grossProceeds,
    }
  }
}

/**
 * Standalone helper function for expected payout calculation
 */
export function calculateExpectedPayout(shares: number): number {
  return PredictionPricing.calculateExpectedPayout(shares);
}

