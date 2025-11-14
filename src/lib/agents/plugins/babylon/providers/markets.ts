/**
 * Markets Provider
 * Provides access to prediction markets and perpetual markets via A2A protocol
 * 
 * A2A IS REQUIRED - This provider will not work without an active A2A connection
 */

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '@elizaos/core'
import { logger } from '@/lib/logger'
import type { BabylonRuntime } from '../types'

/**
 * Provider: Current Markets
 * Fetches available prediction markets and perp markets via A2A protocol
 */
export const marketsProvider: Provider = {
  name: 'BABYLON_MARKETS',
  description: 'Get current available markets for trading (prediction markets and perpetual futures) via A2A protocol',
  
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State): Promise<ProviderResult> => {
    const babylonRuntime = runtime as BabylonRuntime
    
    // A2A is REQUIRED
    if (!babylonRuntime.a2aClient?.isConnected()) {
      logger.error('A2A client not connected - markets provider requires A2A protocol', { 
        agentId: runtime.agentId 
      })
      return { text: 'ERROR: A2A client not connected. Cannot fetch markets data. Please ensure A2A server is running.' }
    }
    
    // Fetch markets via A2A protocol
    const [predictions, perpetuals] = await Promise.all([
      babylonRuntime.a2aClient.sendRequest('a2a.getPredictions', { status: 'active' }),
      babylonRuntime.a2aClient.sendRequest('a2a.getPerpetuals', {})
    ])
    
    const predictionsData = predictions as { predictions?: unknown[] }
    const perpetualsData = perpetuals as { tickers?: unknown[] }
    
    return { text: `Available Markets:

Prediction Markets (${predictionsData.predictions?.length || 0}):
${predictionsData.predictions?.slice(0, 10).map((m: any, i: number) => `${i + 1}. ${m.question}
   YES: ${m.yesShares} | NO: ${m.noShares}
   Liquidity: ${m.liquidity}`).join('\n') || 'None'}

Perpetual Markets (${perpetualsData.tickers?.length || 0}):
${perpetualsData.tickers?.slice(0, 10).map((p: any, i: number) => `${i + 1}. ${p.name} (${p.ticker}) @ $${p.currentPrice}`).join('\n') || 'None'}` }
  }
}
