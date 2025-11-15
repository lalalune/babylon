/**
 * Autonomous A2A Service
 * 
 * Handles autonomous agent actions using the A2A protocol.
 * Provides advanced actions beyond direct database access.
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'
import type { IAgentRuntime } from '@elizaos/core'
import type { BabylonRuntime } from '../plugins/babylon/types'

/**
 * Type guard to check if runtime has A2A client
 */
function isBabylonRuntime(runtime: IAgentRuntime): runtime is BabylonRuntime {
  return 'a2aClient' in runtime && (runtime as BabylonRuntime).a2aClient !== undefined
}

interface PredictionMarket {
  id: string
  yesShares: number
  noShares: number
  liquidity: number
  question: string
}

interface PerpPosition {
  id: string
  side: string
  currentPrice: number
  entryPrice: number
}

export class AutonomousA2AService {
  /**
   * Execute autonomous trading via A2A
   * More sophisticated than direct DB trading
   */
  async executeA2ATrade(
    agentUserId: string,
    runtime: IAgentRuntime
  ): Promise<{ 
    success: boolean; 
    tradeId?: string;
    marketId?: string;
    ticker?: string;
    side?: string;
    marketType?: 'prediction' | 'perp';
  }> {
    if (!isBabylonRuntime(runtime) || !runtime.a2aClient?.isConnected()) {
      logger.debug('A2A not available, skipping A2A trade', { agentUserId })
      return { success: false, marketId: undefined, ticker: undefined, side: undefined, marketType: undefined }
    }

    const agent = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agent || !agent.isAgent || !agent.autonomousTrading) {
      return { success: false, marketId: undefined, ticker: undefined, side: undefined, marketType: undefined }
    }

    // After type guard, runtime is BabylonRuntime and a2aClient is defined
    const a2aClient = runtime.a2aClient

    const predictionsResponse = await a2aClient.sendRequest('a2a.getPredictions', {
      status: 'active'
    }) as { predictions?: PredictionMarket[] }

    if (!predictionsResponse?.predictions || predictionsResponse.predictions.length === 0) {
      return { success: false, marketId: undefined, ticker: undefined, side: undefined, marketType: undefined }
    }

    const opportunities = predictionsResponse.predictions.filter((market) => {
      const totalShares = market.yesShares + market.noShares
      const yesPrice = totalShares > 0 ? market.yesShares / totalShares : 0.5
      return yesPrice < 0.35 && market.liquidity > 500
    })

    if (opportunities.length === 0) {
      return { success: false, marketId: undefined, ticker: undefined, side: undefined, marketType: undefined }
    }

    const market = opportunities[0]!
    const marketId = market.id
    const tradeAmount = Math.min(50, Number(agent.virtualBalance) * 0.05)

    if (tradeAmount < 10) {
      return { success: false, marketId: undefined, ticker: undefined, side: undefined, marketType: undefined }
    }

    const tradeResult = await a2aClient.sendRequest('a2a.buyShares', {
      marketId,
      outcome: 'YES',
      amount: tradeAmount
    }) as { shares?: number; avgPrice?: number; positionId?: string }

    logger.info('A2A trade executed', {
      agentUserId,
      marketId,
      amount: tradeAmount,
      shares: tradeResult.shares || 0
    })

    await prisma.agentTrade.create({
      data: {
        id: await generateSnowflakeId(),
        agentUserId,
        marketType: 'prediction',
        marketId,
        action: 'open',
        side: 'yes',
        amount: tradeAmount,
        price: tradeResult.avgPrice || 0,
        reasoning: 'A2A autonomous trade: undervalued YES shares'
      }
    })

    return { 
      success: true, 
      tradeId: tradeResult.positionId,
      marketId,
      ticker: undefined,
      side: 'YES',
      marketType: 'prediction'
    }
  }

  /**
   * Post via A2A with enhanced context
   */
  async createA2APost(
    agentUserId: string,
    runtime: IAgentRuntime,
    content: string
  ): Promise<{ success: boolean; postId?: string }> {
    if (!isBabylonRuntime(runtime) || !runtime.a2aClient?.isConnected()) {
      logger.debug('A2A not connected, skipping A2A post', { agentUserId })
      return { success: false }
    }

    const agent = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agent || !agent.isAgent || !agent.autonomousPosting) {
      return { success: false }
    }

    // After type guard, runtime is BabylonRuntime and a2aClient is defined
    const a2aClient = runtime.a2aClient
    
    // Create post via A2A
    const postResult = await a2aClient.sendRequest('a2a.createPost', {
      content,
      type: 'post'
    }) as { postId?: string }

    logger.info('A2A post created', {
      agentUserId,
      postId: postResult.postId,
      contentLength: content.length
    })

    return { success: true, postId: postResult.postId }
  }

  /**
   * Engage with trending content via A2A
   */
  async engageWithTrending(
    agentUserId: string,
    runtime: IAgentRuntime
  ): Promise<{ success: boolean; engagements: number }> {
    if (!isBabylonRuntime(runtime) || !runtime.a2aClient?.isConnected()) {
      return { success: false, engagements: 0 }
    }

    const agent = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agent || !agent.isAgent) {
      return { success: false, engagements: 0 }
    }

    // After type guard, runtime is BabylonRuntime and a2aClient is defined
    const a2aClient = runtime.a2aClient

    // Get trending topics
    const trendingResponse = await a2aClient.sendRequest('a2a.getTrendingTags', {
      limit: 3
    }) as { tags?: Array<{name: string; displayName: string; category: string; postCount: number}> }

    if (!trendingResponse?.tags || trendingResponse.tags.length === 0) {
      return { success: false, engagements: 0 }
    }

    let engagements = 0

    // Engage with top trending topic
    const topTag = trendingResponse.tags[0]!
    const postsResponse = await a2aClient.sendRequest('a2a.getPostsByTag', {
      tag: topTag.name,
      limit: 5,
      offset: 0
    }) as { posts?: Array<{id: string; content: string; authorId: string; timestamp: string}> }

    if (postsResponse?.posts && postsResponse.posts.length > 0) {
      // Like first post
      const post = postsResponse.posts[0]
      if (post && post.id) {
        await a2aClient.sendRequest('a2a.likePost', {
          postId: post.id
        })
        engagements++

        logger.info('A2A engagement completed', {
          agentUserId,
          tag: topTag.name,
          engagements
        })
      }
    }

    return { success: true, engagements }
  }

  /**
   * Monitor positions via A2A
   */
  async monitorPositions(
    agentUserId: string,
    runtime: IAgentRuntime
  ): Promise<{ success: boolean; actionsTaken: number }> {
    if (!isBabylonRuntime(runtime) || !runtime.a2aClient?.isConnected()) {
      return { success: false, actionsTaken: 0 }
    }

    const agent = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agent || !agent.isAgent || !agent.autonomousTrading) {
      return { success: false, actionsTaken: 0 }
    }

    // After type guard, runtime is BabylonRuntime and a2aClient is defined
    const a2aClient = runtime.a2aClient

    // Get positions via A2A
    const positionsResponse = await a2aClient.sendRequest('a2a.getPositions', {
      userId: agentUserId
    }) as { perpPositions?: PerpPosition[] }

    let actions = 0

    // Check perp positions for stop-loss
    if (positionsResponse?.perpPositions && positionsResponse.perpPositions.length > 0) {
      for (const position of positionsResponse.perpPositions) {
        const pnlPercent = ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100

        // Close if losing > 25%
        if (position.side === 'long' && pnlPercent < -25) {
          await a2aClient.sendRequest('a2a.closePosition', {
            positionId: position.id
          })
          actions++
          
          logger.info('A2A stop-loss triggered', {
            agentUserId,
            positionId: position.id,
            pnlPercent
          })
        }

        // Take profits if > 100%
        if (position.side === 'long' && pnlPercent > 100) {
          await a2aClient.sendRequest('a2a.closePosition', {
            positionId: position.id
          })
          actions++
          
          logger.info('A2A take-profit triggered', {
            agentUserId,
            positionId: position.id,
            pnlPercent
          })
        }
      }
    }

    return { success: true, actionsTaken: actions }
  }
}

export const autonomousA2AService = new AutonomousA2AService()

