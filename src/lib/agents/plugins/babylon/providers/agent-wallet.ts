/**
 * Agent Wallet Provider
 * Provides complete view of agent's own wallet, investments, and positions
 */

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '@elizaos/core'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

/**
 * Provider: Agent's Own Wallet & Investments
 * Comprehensive view of the agent's portfolio, positions, and assets
 */
export const agentWalletProvider: Provider = {
  name: 'BABYLON_AGENT_WALLET',
  description: "Get the agent's own complete wallet state including balance, reputation points, all investments, and positions",
  
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State): Promise<ProviderResult> => {
    try {
      const agentUserId = runtime.agentId
      
      // Get agent user with all financial data
      const agent = await prisma.user.findUnique({
        where: { id: agentUserId },
        select: {
          id: true,
          username: true,
          displayName: true,
          virtualBalance: true,
          reputationPoints: true,
          agentPointsBalance: true,
          lifetimePnL: true,
          walletAddress: true,
          // Get agent's prediction market positions
          Position: {
            where: {
              shares: {
                gt: 0
              },
              status: 'active'
            },
            include: {
              Market: {
                select: {
                  id: true,
                  question: true,
                  yesShares: true,
                  noShares: true,
                  liquidity: true,
                  resolved: true,
                  resolution: true
                }
              },
              Question: {
                select: {
                  questionNumber: true,
                  text: true,
                  outcome: true,
                  resolvedOutcome: true
                }
              }
            }
          }
        }
      })
      
      if (!agent) {
        return { text: 'Agent wallet data not found.' }
      }
      
      // Calculate market positions value
      const marketPositionsWithValue = agent.Position.map(pos => {
        const shares = parseFloat(pos.shares.toString())
        const avgPrice = parseFloat(pos.avgPrice?.toString() || '50')
        const side = pos.side ? 'yes' : 'no' // Boolean: true = yes, false = no
        
        // Calculate current price from Market's constant product AMM (k = y * n)
        let currentPrice = avgPrice
        if (pos.Market) {
          const yesShares = parseFloat(pos.Market.yesShares.toString())
          const noShares = parseFloat(pos.Market.noShares.toString())
          const liquidity = parseFloat(pos.Market.liquidity.toString())
          if (yesShares > 0 && noShares > 0) {
            currentPrice = pos.side 
              ? (liquidity / (yesShares + noShares)) * (noShares / yesShares) * 100
              : (liquidity / (yesShares + noShares)) * (yesShares / noShares) * 100
          }
        }
        
        const currentValue = shares * currentPrice
        const costBasis = shares * avgPrice
        const unrealizedPnL = currentValue - costBasis
        
        return {
          ...pos,
          side,
          currentPrice,
          currentValue,
          costBasis,
          unrealizedPnL
        }
      })
      
      const totalUnrealizedMarketPnL = marketPositionsWithValue.reduce((sum, p) => sum + p.unrealizedPnL, 0)
      
      // Format output
      const virtualBalance = parseFloat(agent.virtualBalance.toString())
      const lifetimePnL = parseFloat(agent.lifetimePnL.toString())
      
      let output = `🤖 Your Wallet & Investments:

💰 BALANCES:
• Virtual Balance: $${virtualBalance.toFixed(2)}
• Reputation Points: ${agent.reputationPoints.toFixed(0)} pts
• Agent Points: ${agent.agentPointsBalance.toFixed(0)} pts
• Lifetime P&L: ${lifetimePnL >= 0 ? '+' : ''}$${lifetimePnL.toFixed(2)}
• Wallet Address: ${agent.walletAddress || 'Not connected'}

`
      
      // Prediction Market Positions
      if (marketPositionsWithValue.length > 0) {
        output += `📊 PREDICTION MARKET POSITIONS (${marketPositionsWithValue.length}):
${marketPositionsWithValue.map(p => {
  const question = p.Market?.question || p.Question?.text || 'Unknown market'
  return `• ${question.substring(0, 60)}...
  Side: ${p.side.toUpperCase()} | Shares: ${parseFloat(p.shares.toString()).toFixed(2)} @ avg $${parseFloat(p.avgPrice.toString()).toFixed(2)}
  Current: $${p.currentPrice.toFixed(2)} | Value: $${p.currentValue.toFixed(2)}
  P&L: ${p.unrealizedPnL >= 0 ? '+' : ''}$${p.unrealizedPnL.toFixed(2)} (${((p.unrealizedPnL / p.costBasis) * 100).toFixed(1)}%)`
}).join('\n\n')}

Total Unrealized P&L: ${totalUnrealizedMarketPnL >= 0 ? '+' : ''}$${totalUnrealizedMarketPnL.toFixed(2)}

`
      } else {
        output += `📊 PREDICTION MARKET POSITIONS: None

`
      }
      
      return { 
        text: output,
        data: {
          balances: {
            virtualBalance: agent.virtualBalance,
            reputationPoints: agent.reputationPoints,
            agentPointsBalance: agent.agentPointsBalance,
            lifetimePnL: agent.lifetimePnL,
            walletAddress: agent.walletAddress
          },
          marketPositions: marketPositionsWithValue.map(p => ({
            id: p.id,
            marketId: p.questionId,
            question: p.Market?.question || p.Question?.text || 'Unknown market',
            side: p.side,
            shares: parseFloat(p.shares.toString()),
            averagePrice: parseFloat(p.avgPrice.toString()),
            currentPrice: p.currentPrice,
            currentValue: p.currentValue,
            unrealizedPnL: p.unrealizedPnL
          })),
          totalUnrealizedPnL: totalUnrealizedMarketPnL
        }
      }
    } catch (error) {
      logger.error('Failed to fetch agent wallet', error, 'AgentWalletProvider')
      return { text: 'Unable to fetch agent wallet data at this time.' }
    }
  }
}

