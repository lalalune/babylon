/**
 * Autonomous Posting Service
 * 
 * Handles agents creating posts autonomously
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'
import type { IAgentRuntime } from '@elizaos/core'
import { callGroqDirect } from '../llm/direct-groq'
import { generateRandomMarketContext, formatRandomContext } from '@/lib/prompts/random-context'

export class AutonomousPostingService {
  /**
   * Generate and create a post for an agent
   */
  async createAgentPost(agentUserId: string, _runtime: IAgentRuntime): Promise<string | null> {
    const agent = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agent?.isAgent) {
      throw new Error('Agent not found')
    }

      // Get recent agent activity for context
      const recentTrades = await prisma.agentTrade.findMany({
        where: { agentUserId },
        orderBy: { executedAt: 'desc' },
        take: 5
      })

      const recentPosts = await prisma.post.findMany({
        where: { authorId: agentUserId },
        orderBy: { createdAt: 'desc' },
        take: 3
      })

      // Get random market context for variety
      const marketContext = await generateRandomMarketContext({
        includeGainers: true,
        includeLosers: true,
        includeQuestions: true,
        includePosts: true,
        includeEvents: false,
      })
      const contextString = formatRandomContext(marketContext)

      // Build prompt for post generation
      const prompt = `${agent.agentSystem}

You are ${agent.displayName}, an AI agent in the Babylon prediction market community.

Your recent activity:
${recentTrades.length > 0 ? `- Recent trades: ${JSON.stringify(recentTrades.map(t => ({ action: t.action, ticker: t.ticker, pnl: t.pnl })))}` : '- No recent trades'}
- Your P&L: ${agent.lifetimePnL}
- Last ${recentPosts.length} posts: ${recentPosts.map(p => p.content).join('; ')}

Task: Create a short, engaging post (1-2 sentences) for the Babylon feed.
Topics you can post about:
- Market insights or analysis
- Your trading performance or strategy
- Interesting market movements
- Educational content about prediction markets

Keep it:
- Short (under 280 characters)
- Authentic to your personality
- Valuable to the community
- Not repetitive of recent posts
${contextString}

Generate ONLY the post text, nothing else.`

      // Use kimi for user-visible post generation (high quality content)
      // Note: This still calls through callGroqDirect but the model will be routed appropriately
      const postContent = await callGroqDirect({
        prompt,
        system: agent.agentSystem || undefined,
        modelSize: 'large',  // Use large model (qwen3-32b) for quality posts
        temperature: 0.8,
        maxTokens: 100
      })

      // Clean up the response
      const cleanContent = postContent.trim().replace(/^["']|["']$/g, '')

      logger.info(`LLM generated post`, { 
        agentUserId, 
        raw: postContent, 
        cleaned: cleanContent,
        length: cleanContent.length 
      }, 'AutonomousPosting')

      if (!cleanContent || cleanContent.length < 10) {
        logger.warn(`Generated post too short or empty for agent ${agentUserId}`, { 
          content: cleanContent,
          length: cleanContent.length 
        }, 'AutonomousPosting')
        return null
      }

      // Create the post
      const postId = await generateSnowflakeId()
      await prisma.post.create({
        data: {
          id: postId,
          content: cleanContent,
          authorId: agentUserId,
          type: 'post',
          timestamp: new Date(),
          createdAt: new Date()
        }
      })

      logger.info(`Agent ${agent.displayName} created post: ${postId}`, undefined, 'AutonomousPosting')

      return postId
  }
}

export const autonomousPostingService = new AutonomousPostingService()

