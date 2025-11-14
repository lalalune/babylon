/**
 * Autonomous Posting Service with Trajectory Recording
 * 
 * Integrated version that records all post generation decisions for RL training.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateSnowflakeId } from '@/lib/snowflake';
import type { IAgentRuntime } from '@elizaos/core';
import { callGroqDirect } from '../llm/direct-groq';
import { generateRandomMarketContext, formatRandomContext } from '@/lib/prompts/random-context';
import { trajectoryRecorder } from '@/lib/training/TrajectoryRecorder';

export class AutonomousPostingServiceWithRecording {
  /**
   * Generate and create a post for an agent - WITH FULL RECORDING
   */
  async createAgentPost(
    agentUserId: string,
    _runtime: IAgentRuntime,
    trajectoryId?: string
  ): Promise<string | null> {
    const agent = await prisma.user.findUnique({ where: { id: agentUserId } });
    if (!agent?.isAgent) {
      throw new Error('Agent not found');
    }

    // Get recent agent activity for context
    const recentTrades = await prisma.agentTrade.findMany({
      where: { agentUserId },
      orderBy: { executedAt: 'desc' },
      take: 5
    });

    const recentPosts = await prisma.post.findMany({
      where: { authorId: agentUserId },
      orderBy: { createdAt: 'desc' },
      take: 3
    });

    // Get random market context
    const marketContext = await generateRandomMarketContext({
      includeGainers: true,
      includeLosers: true,
      includeQuestions: true,
      includePosts: true,
      includeEvents: false
    });
    const contextString = formatRandomContext(marketContext);

    // LOG PROVIDER ACCESS: Recent activity
    if (trajectoryId) {
      trajectoryRecorder.logProviderAccess(trajectoryId, {
        providerName: 'AGENT_ACTIVITY',
        data: {
          recentTrades: recentTrades.map(t => ({
            action: t.action,
            ticker: t.ticker,
            pnl: t.pnl
          })),
          recentPosts: recentPosts.map(p => p.content),
          lifetimePnL: agent.lifetimePnL
        },
        purpose: 'Get agent recent activity for post context and avoiding repetition'
      });
    }

    // LOG PROVIDER ACCESS: Market context
    if (trajectoryId) {
      trajectoryRecorder.logProviderAccess(trajectoryId, {
        providerName: 'MARKET_CONTEXT',
        data: marketContext as unknown as Record<string, unknown>,
        purpose: 'Get current market conditions and trending topics for relevant post'
      });
    }

    // Build prompt for post generation
    const systemPrompt = agent.agentSystem || '';
    const userPrompt = `You are ${agent.displayName}, an AI agent in the Babylon prediction market community.

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

Generate ONLY the post text, nothing else.`;

    const startTime = Date.now();

    // Call Groq directly
    const postContent = await callGroqDirect({
      prompt: userPrompt,
      system: systemPrompt,
      modelSize: agent.agentModelTier === 'pro' ? 'large' : 'small',
      temperature: 0.8,
      maxTokens: 100
    });

    const latencyMs = Date.now() - startTime;

    // LOG LLM CALL
    if (trajectoryId) {
      trajectoryRecorder.logLLMCall(trajectoryId, {
        model: agent.agentModelTier === 'pro' ? 'llama-3.1-70b' : 'llama-3.1-8b',
        systemPrompt,
        userPrompt,
        response: postContent,
        reasoning: undefined,
        temperature: 0.8,
        maxTokens: 100,
        latencyMs,
        purpose: 'action',
        actionType: 'CREATE_POST'
      });
    }

    // Clean up the response
    const cleanContent = postContent.trim().replace(/^["']|["']$/g, '');

    logger.info(`LLM generated post`, {
      agentUserId,
      raw: postContent,
      cleaned: cleanContent,
      length: cleanContent.length
    }, 'AutonomousPosting');

    if (!cleanContent || cleanContent.length < 10) {
      logger.warn(`Generated post too short or empty for agent ${agentUserId}`, {
        content: cleanContent,
        length: cleanContent.length
      }, 'AutonomousPosting');
      return null;
    }

    // Create the post
    const postId = await generateSnowflakeId();
    await prisma.post.create({
      data: {
        id: postId,
        content: cleanContent,
        authorId: agentUserId,
        type: 'post',
        timestamp: new Date(),
        createdAt: new Date()
      }
    });

    logger.info(`Agent ${agent.displayName} created post: ${postId}`, undefined, 'AutonomousPosting');

    return postId;
  }
}

export const autonomousPostingServiceWithRecording = new AutonomousPostingServiceWithRecording();


