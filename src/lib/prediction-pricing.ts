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
    const k = currentYesShares * currentNoShares;
    const currentTotal = currentYesShares + currentNoShares;
    const currentYesPrice = currentNoShares / currentTotal;
    const currentNoPrice = currentYesShares / currentTotal;

    let newYesShares: number;
    let newNoShares: number;

    if (side === 'yes') {
      newYesShares = currentYesShares + usdAmount;
      newNoShares = k / newYesShares;
    } else {
      newNoShares = currentNoShares + usdAmount;
      newYesShares = k / newNoShares;
    }

    const newTotal = newYesShares + newNoShares;
    const newYesPrice = newNoShares / newTotal;
    const newNoPrice = newYesShares / newTotal;

    const priceImpact =
      side === 'yes'
        ? ((newYesPrice - currentYesPrice) / currentYesPrice) * 100
        : ((newNoPrice - currentNoPrice) / currentNoPrice) * 100;

    return {
      sharesBought: usdAmount,
      avgPrice: 1, // ~$1 per share in CPMM
      newYesPrice,
      newNoPrice,
      priceImpact,
      totalCost: usdAmount,
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
    const k = currentYesShares * currentNoShares;
    const currentTotal = currentYesShares + currentNoShares;
    const currentYesPrice = currentNoShares / currentTotal;
    const currentNoPrice = currentYesShares / currentTotal;

    let newYesShares: number;
    let newNoShares: number;

    // When selling, we remove shares from the pool (opposite of buying)
    if (side === 'yes') {
      newYesShares = currentYesShares - sharesToSell;
      newNoShares = k / newYesShares;
    } else {
      newNoShares = currentNoShares - sharesToSell;
      newYesShares = k / newNoShares;
    }

    const newTotal = newYesShares + newNoShares;
    const newYesPrice = newNoShares / newTotal;
    const newNoPrice = newYesShares / newTotal;

    // Calculate proceeds (how much USD user gets back)
    const proceeds = side === 'yes'
      ? (currentNoShares - newNoShares)
      : (currentYesShares - newYesShares);

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
      fee: Number(fee.toFixed(2)),
      netAmount: Number(netAmount.toFixed(2)),
      totalWithFee: totalAmount,
      totalCost: netAmount, // Cost to market is net amount
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
      fee: Number(fee.toFixed(2)),
      netAmount: Number(netProceeds.toFixed(2)),
      netProceeds: Number(netProceeds.toFixed(2)),
      totalCost: grossProceeds, // Gross proceeds
    }
  }
}

/**
 * Standalone helper function for expected payout calculation
 */
export function calculateExpectedPayout(shares: number): number {
  return PredictionPricing.calculateExpectedPayout(shares);
}

