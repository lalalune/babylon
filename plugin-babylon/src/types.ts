/**
 * Babylon Game Plugin Types
 *
 * Type definitions for Eliza agents interacting with Babylon prediction markets
 */

export interface BabylonMarket {
  id: string;
  questionId: number;
  question: string;
  yesPrice: number;
  noPrice: number;
  yesShares: number;
  noShares: number;
  totalVolume: number;
  status: "active" | "resolved" | "cancelled";
  closeDate: string;
  metadata?: {
    category?: string;
    tags?: string[];
  };
}

export interface BabylonPosition {
  id: string;
  marketId: string;
  side: boolean; // true = YES, false = NO
  shares: number;
  avgPrice: number;
  currentValue: number;
  pnl: number;
}

export interface BabylonWallet {
  userId: string;
  balance: number;
  lockedBalance: number;
  availableBalance: number;
}

export interface TradeRequest {
  marketId: string;
  side: "yes" | "no";
  amount: number;
}

export interface TradeResult {
  success: boolean;
  shares?: number;
  avgPrice?: number;
  newPosition?: BabylonPosition;
  error?: string;
}

export interface MarketAnalysis {
  marketId: string;
  recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
  confidence: number;
  reasoning: string;
  targetSide: "yes" | "no";
  suggestedAmount?: number;
  riskLevel: "low" | "medium" | "high";
}

export interface BabylonMarketHistory {
  marketId: string;
  priceHistory: Array<{
    timestamp: string;
    yesPrice: number;
    noPrice: number;
    volume: number;
  }>;
  trades: Array<{
    timestamp: string;
    side: "yes" | "no";
    shares: number;
    price: number;
  }>;
}

export interface AgentConfig {
  characterId: string;
  apiBaseUrl: string;
  authToken?: string;
  walletAddress?: string;
  privateKey?: string;
  tradingLimits: {
    maxTradeSize: number;
    maxPositionSize: number;
    minConfidence: number;
  };
}

export interface Chat {
  id: string;
  name: string;
  theme: string;
}
