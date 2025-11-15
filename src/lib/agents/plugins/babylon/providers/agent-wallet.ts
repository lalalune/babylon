/**
 * Agent Wallet Provider
 * Provides complete view of agent's own wallet, investments, and positions via A2A protocol
 */

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '@elizaos/core'
import { logger } from '@/lib/logger'
import type { BabylonRuntime } from '../types'
import type { A2ABalanceResponse, A2APositionsResponse } from '@/types/a2a-responses'

/**
 * Provider: Agent's Own Wallet & Investments
 * Comprehensive view of the agent's portfolio, positions, and assets via A2A protocol
 */
export const agentWalletProvider: Provider = {
  name: 'BABYLON_AGENT_WALLET',
  description: "Get the agent's own complete wallet state including balance, reputation points, all investments, and positions via A2A protocol",
  
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State): Promise<ProviderResult> => {
    const babylonRuntime = runtime as BabylonRuntime
    const agentUserId = runtime.agentId
    
    // A2A is REQUIRED
    if (!babylonRuntime.a2aClient?.isConnected()) {
      logger.error('A2A client not connected - agent wallet provider requires A2A protocol', undefined, runtime.agentId)
      return { text: 'ERROR: A2A client not connected. Cannot fetch wallet data. Please ensure A2A server is running.' }
    }
    
    try {
      // Get balance and positions via A2A
      const [balanceData, positionsData] = await Promise.all([
        babylonRuntime.a2aClient.getBalance(),
        babylonRuntime.a2aClient.getPositions(agentUserId)
      ])
      
      const balance = balanceData as unknown as A2ABalanceResponse
      const positions = positionsData as unknown as A2APositionsResponse
      
      const totalUnrealizedPnL = (positions.marketPositions?.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0) || 0) +
                                  (positions.perpPositions?.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0) || 0)
      
      let output = `🤖 Your Wallet & Investments:

💰 BALANCES:
• Virtual Balance: $${(balance.balance || 0).toFixed(2)}
• Reputation Points: ${(balance.reputationPoints || 0).toFixed(0)} pts
• Lifetime P&L: ${(balance.lifetimePnL || 0) >= 0 ? '+' : ''}$${(balance.lifetimePnL || 0).toFixed(2)}

`
      
      // Prediction Market Positions
      if (positions.marketPositions && positions.marketPositions.length > 0) {
        output += `📊 PREDICTION MARKET POSITIONS (${positions.marketPositions.length}):
${positions.marketPositions.map(p => {
  return `• ${p.question.substring(0, 60)}...
  Side: ${p.side.toUpperCase()} | Shares: ${p.shares.toFixed(2)} @ avg $${p.avgPrice.toFixed(2)}
  Current: $${p.currentPrice.toFixed(2)} | Value: $${(p.shares * p.currentPrice).toFixed(2)}
  P&L: ${(p.unrealizedPnL || 0) >= 0 ? '+' : ''}$${(p.unrealizedPnL || 0).toFixed(2)}`
}).join('\n\n')}

`
      } else {
        output += `📊 PREDICTION MARKET POSITIONS: None

`
      }
      
      // Perpetual Positions
      if (positions.perpPositions && positions.perpPositions.length > 0) {
        output += `🔮 PERPETUAL POSITIONS (${positions.perpPositions.length}):
${positions.perpPositions.map(p => {
  const amount = p.amount || p.size || 0
  return `• ${p.ticker}: ${p.side.toUpperCase()} $${amount} @ $${p.entryPrice} (${p.leverage}x)
  Current: $${p.currentPrice} | P&L: ${(p.unrealizedPnL || 0) >= 0 ? '+' : ''}$${(p.unrealizedPnL || 0).toFixed(2)}`
}).join('\n\n')}

`
      }
      
      if (totalUnrealizedPnL !== 0) {
        output += `Total Unrealized P&L: ${totalUnrealizedPnL >= 0 ? '+' : ''}$${totalUnrealizedPnL.toFixed(2)}`
      }
      
      return { 
        text: output,
        data: {
          balances: {
            virtualBalance: balance.balance || 0,
            reputationPoints: balance.reputationPoints || 0,
            lifetimePnL: balance.lifetimePnL || 0
          },
          marketPositions: positions.marketPositions || [],
          perpPositions: positions.perpPositions || [],
          totalUnrealizedPnL
        }
      }
    } catch (error) {
      logger.error('Failed to fetch agent wallet via A2A', error, 'AgentWalletProvider')
      return { text: `Error fetching wallet: ${error instanceof Error ? error.message : 'Unknown error'}` }
    }
  }
}

