/**
 * Portfolio Provider
 * Provides access to agent's portfolio and positions via A2A protocol
 */

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '@elizaos/core'
import { logger } from '@/lib/logger'
import type { BabylonRuntime } from '../types'

/**
 * Provider: Portfolio State
 * Gets agent's current positions and balance via A2A
 */
export const portfolioProvider: Provider = {
  name: 'BABYLON_PORTFOLIO',
  description: 'Get agent portfolio state, positions, and balance via A2A protocol',
  
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State): Promise<ProviderResult> => {
    const babylonRuntime = runtime as BabylonRuntime
    const agentUserId = runtime.agentId
    
    // A2A is required
    if (!babylonRuntime.a2aClient?.isConnected()) {
      logger.error('A2A client not connected - portfolio provider requires A2A', { agentId: runtime.agentId })
      return { text: 'A2A client not connected. Cannot fetch portfolio data.' }
    }
    
    const [balanceData, positionsData] = await Promise.all([
      babylonRuntime.a2aClient.sendRequest('a2a.getBalance', {}),
      babylonRuntime.a2aClient.sendRequest('a2a.getPositions', { userId: agentUserId })
    ])
    
    const balance = balanceData as { balance?: number; reputationPoints?: number }
    const positions = positionsData as { marketPositions?: unknown[]; perpPositions?: unknown[] }
    
    return { text: `Your Portfolio:

Balance: $${balance.balance || 0}
Points Balance: ${balance.reputationPoints || 0} pts

Open Prediction Positions (${positions.marketPositions?.length || 0}):
${positions.marketPositions?.map((p: any) => `- ${p.question}: ${p.side} ${p.shares} shares @ avg ${p.avgPrice}`).join('\n') || 'None'}

Open Perp Positions (${positions.perpPositions?.length || 0}):
${positions.perpPositions?.map((p: any) => `- ${p.ticker}: ${p.side.toUpperCase()} $${p.amount} @ ${p.entryPrice} (${p.leverage}x)
  Current: $${p.currentPrice}`).join('\n') || 'None'}` }
  }
}
