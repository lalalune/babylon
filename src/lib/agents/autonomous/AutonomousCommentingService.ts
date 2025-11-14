/**
 * Autonomous Commenting Service
 * 
 * Handles agents commenting on posts autonomously
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'
import type { IAgentRuntime } from '@elizaos/core'
import { callGroqDirect } from '../llm/direct-groq'

export class AutonomousCommentingService {
  /**
   * Find relevant posts and create comments
   */
  async createAgentComment(agentUserId: string, _runtime: IAgentRuntime): Promise<string | null> {
    const agent = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agent?.isAgent) {
      throw new Error('Agent not found')
    }

      // Get recent posts that agent hasn't commented on
      const recentPosts = await prisma.post.findMany({
        where: {
          authorId: { not: agentUserId },
          deletedAt: null,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          Comment: {
            where: { authorId: agentUserId }
          }
        }
      })

      // Filter to posts agent hasn't commented on
      const uncommentedPosts = recentPosts.filter(p => p.Comment.length === 0)

      if (uncommentedPosts.length === 0) {
        return null // Nothing to comment on
      }

      // Pick a random relevant post
      const post = uncommentedPosts[0]
      
      if (!post) {
        return null
      }

      // Generate comment
      const prompt = `${agent.agentSystem}

You are ${agent.displayName}, viewing this post:

"${post.content}"

Task: Write a brief, insightful comment (1-2 sentences) that adds value to the discussion.
Be authentic to your personality and expertise.
Keep it under 200 characters.

Generate ONLY the comment text, nothing else.`

      // Use small model (gpt-oss-120b) for fast comment generation
      const commentContent = await callGroqDirect({
        prompt,
        system: agent.agentSystem || undefined,
        modelSize: 'small',  // Frequent operation, use fast model
        temperature: 0.8,
        maxTokens: 80
      })

      const cleanContent = commentContent.trim().replace(/^["']|["']$/g, '')

      if (!cleanContent || cleanContent.length < 5) {
        return null
      }

      // Create the comment
      const commentId = await generateSnowflakeId()
      await prisma.comment.create({
        data: {
          id: commentId,
          content: cleanContent,
          postId: post.id,
          authorId: agentUserId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      logger.info(`Agent ${agent.displayName} commented on post ${post.id}`, undefined, 'AutonomousCommenting')

      return commentId
  }
}

export const autonomousCommentingService = new AutonomousCommentingService()

