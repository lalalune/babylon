/**
 * Dashboard Provider
 * Provides comprehensive agent context and state via A2A protocol
 * 
 * A2A IS REQUIRED - This provider will not work without an active A2A connection
 */

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '@elizaos/core'
import { logger } from '@/lib/logger'
import type { BabylonRuntime } from '../types'

/**
 * Provider: Comprehensive Dashboard
 * Provides complete agent context including portfolio, markets, social, and pending items
 * ALL DATA FETCHED VIA A2A PROTOCOL
 */
export const dashboardProvider: Provider = {
  name: 'BABYLON_DASHBOARD',
  description: 'Get comprehensive agent dashboard with portfolio, markets, social feed, and pending interactions via A2A protocol',
  
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State): Promise<ProviderResult> => {
    const babylonRuntime = runtime as BabylonRuntime
    const agentUserId = runtime.agentId
    
    // A2A is REQUIRED
    if (!babylonRuntime.a2aClient?.isConnected()) {
      logger.error('A2A client not connected - dashboard provider requires A2A protocol', { 
        agentId: runtime.agentId 
      })
      return { text: 'ERROR: A2A client not connected. Cannot load dashboard. Please ensure A2A server is running.' }
    }
    
    // Fetch all dashboard data via A2A protocol
    const [balance, positions, predictions, feed, unreadCount] = await Promise.all([
      babylonRuntime.a2aClient.sendRequest('a2a.getBalance', {}),
      babylonRuntime.a2aClient.sendRequest('a2a.getPositions', { userId: agentUserId }),
      babylonRuntime.a2aClient.sendRequest('a2a.getPredictions', { status: 'active' }),
      babylonRuntime.a2aClient.sendRequest('a2a.getFeed', { limit: 5, offset: 0 }),
      babylonRuntime.a2aClient.sendRequest('a2a.getUnreadCount', {})
    ])
    
    const balanceData = balance as { balance?: number; reputationPoints?: number }
    const positionsData = positions as { marketPositions?: unknown[]; perpPositions?: unknown[] }
    const predictionsData = predictions as { predictions?: unknown[] }
    const feedData = feed as { posts?: unknown[] }
    const unreadData = unreadCount as { unreadCount?: number }
    
    const totalPositions = (positionsData.marketPositions?.length || 0) + (positionsData.perpPositions?.length || 0)
    
    const result = `📊 AGENT DASHBOARD

💰 PORTFOLIO
Balance: $${balanceData.balance || 0}
Points: ${balanceData.reputationPoints || 0} pts
Open Positions: ${totalPositions}

📈 ACTIVE MARKETS (Top 3)
${predictionsData.predictions?.slice(0, 3).map((m: any, i: number) => {
  const total = m.yesShares + m.noShares
  const yesPrice = total > 0 ? (m.yesShares / total * 100).toFixed(1) : '50.0'
  return `${i + 1}. ${m.question}
   YES: ${yesPrice}% | Liquidity: $${m.liquidity}`
}).join('\n') || 'No active markets'}

📱 SOCIAL FEED (Recent)
${feedData.posts?.slice(0, 3).map((p: any, i: number) => 
  `${i + 1}. @${p.author?.username || 'user'}: ${p.content?.substring(0, 60)}...`
).join('\n') || 'No recent posts'}

📬 PENDING
Unread Messages: ${unreadData.unreadCount || 0}

💡 OPPORTUNITIES
- ${totalPositions > 0 ? 'Monitor open positions' : 'Consider opening positions'}
- ${feedData.posts && feedData.posts.length > 0 ? 'Engage with recent posts' : 'Create new post'}
- ${unreadData.unreadCount && unreadData.unreadCount > 0 ? 'Respond to messages' : 'All messages read'}`

    return { text: result }
  }
}
