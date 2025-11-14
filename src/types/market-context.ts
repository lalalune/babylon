/**
 * Market Context Types
 * 
 * Types for providing market information to NPCs for trading decisions
 */

import type { MarketType } from './market-decisions';

export interface PerpMarketSnapshot {
  ticker: string;
  organizationId: string;
  name: string;
  currentPrice: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  openInterest: number;
}

export interface PredictionMarketSnapshot {
  id: number;
  text: string;
  yesPrice: number;
  noPrice: number;
  totalVolume: number;
  resolutionDate: string;
  daysUntilResolution: number;
}

export interface NPCPosition {
  id: string;
  marketType: MarketType;
  ticker?: string;
  marketId?: number;
  side: string;
  entryPrice: number;
  currentPrice: number;
  size: number;
  shares?: number;
  unrealizedPnL: number;
  openedAt: string;
}

export interface FeedPostContext {
  author: string;
  authorName: string;
  content: string;
  timestamp: string;
  articleTitle?: string;
}

export interface GroupChatContext {
  chatId: string;
  chatName: string;
  from: string;
  fromName: string;
  message: string;
  timestamp: string;
}

export interface EventContext {
  type: string;
  description: string;
  timestamp: string;
  relatedQuestion?: number;
  pointsToward?: string;
  actors?: string[];
}

export interface NewsArticleContext {
  author: string;
  authorName: string;
  title: string;
  summary: string;
  timestamp: string;
}

export interface RelationshipContext {
  actorId: string;
  actorName: string;
  relationshipType: string;
  strength: number;
  sentiment: number;
  history?: string;
}

export interface NPCMarketContext {
  // NPC identity
  npcId: string;
  npcName: string;
  personality: string;
  tier: string;
  availableBalance: number;
  
  // Information sources
  recentPosts: FeedPostContext[];
  groupChatMessages: GroupChatContext[];
  recentEvents: EventContext[];
  
  // Relationships with other actors
  relationships?: RelationshipContext[];
  
  // Market data
  perpMarkets: PerpMarketSnapshot[];
  predictionMarkets: PredictionMarketSnapshot[];
  
  // Current positions
  currentPositions: NPCPosition[];
}

export interface MarketSnapshots {
  perps: PerpMarketSnapshot[];
  predictions: PredictionMarketSnapshot[];
  timestamp: string;
}

