/**
 * Type definitions for Babylon Agent System
 */

import type { Character } from '@elizaos/core'

export interface AgentConfig {
  id: string
  userId: string
  name: string
  description?: string
  profileImageUrl?: string
  
  // Character configuration
  character: Character
  
  // Runtime config
  modelTier: 'free' | 'pro'
  autonomousEnabled: boolean
  isActive: boolean
  
  // Wallet
  pointsBalance: number
  walletAddress?: string
  privyWalletId?: string
  
  // Performance
  lifetimePnL: number
  totalTrades: number
  winRate: number
}

export interface AgentMessage {
  id: string
  agentId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  modelUsed?: string
  pointsCost: number
  metadata?: unknown
  createdAt: Date
}

export interface AgentLog {
  id: string
  agentId: string
  type: 'chat' | 'tick' | 'trade' | 'error' | 'system'
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  prompt?: string
  completion?: string
  thinking?: string
  metadata?: unknown
  createdAt: Date
}

export interface AgentPointsTransaction {
  id: string
  agentId: string
  userId: string
  type: 'deposit' | 'withdraw' | 'spend_chat' | 'spend_tick' | 'earn_trade'
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  relatedId?: string
  createdAt: Date
}

export interface AgentTrade {
  id: string
  agentId: string
  userId: string
  marketType: 'prediction' | 'perp'
  marketId?: string
  ticker?: string
  action: 'open' | 'close'
  side?: 'long' | 'short' | 'yes' | 'no'
  amount: number
  price: number
  pnl?: number
  reasoning?: string
  executedAt: Date
}

export interface CreateAgentParams {
  userId: string
  name: string
  description?: string
  profileImageUrl?: string
  system: string
  bio?: string[]
  personality?: string
  tradingStrategy?: string
  initialDeposit?: number
  modelTier?: 'free' | 'pro'
}

export interface ChatRequest {
  agentId: string
  userId: string
  message: string
  usePro?: boolean
}

export interface ChatResponse {
  messageId: string
  response: string
  pointsCost: number
  modelUsed: string
  balanceAfter: number
}

export interface AgentPerformance {
  lifetimePnL: number
  totalTrades: number
  profitableTrades: number
  winRate: number
  avgTradeSize: number
  sharpeRatio?: number
  maxDrawdown?: number
}

