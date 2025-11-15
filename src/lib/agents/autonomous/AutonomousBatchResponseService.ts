/**
 * Autonomous Batch Response Service
 * 
 * Handles batch evaluation and response to pending interactions:
 * - Comments to agent's posts
 * - Replies to agent's comments
 * - New messages in chats
 * 
 * Instead of responding to everything, this service:
 * 1. Gathers all pending interactions
 * 2. Presents them to the agent with context
 * 3. Agent decides which ones warrant a response (boolean array)
 * 4. Executes responses for approved interactions
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'
import type { IAgentRuntime } from '@elizaos/core'
import { callGroqDirect } from '../llm/direct-groq'

interface PendingInteraction {
  type: 'comment_on_post' | 'comment_on_comment' | 'chat_message'
  id: string
  chatId?: string
  postId?: string
  commentId?: string
  parentCommentId?: string
  author: string
  content: string
  context: string
  timestamp: Date
}

interface ResponseDecision {
  shouldRespond: boolean
  priority?: 'low' | 'medium' | 'high'
  reasoning?: string
}

export class AutonomousBatchResponseService {
  /**
   * Gather all pending interactions that might need responses
   */
  async gatherPendingInteractions(agentUserId: string): Promise<PendingInteraction[]> {
    const interactions: PendingInteraction[] = []

    // Get comments on agent's posts
    const commentsOnPosts = await prisma.comment.findMany({
      where: {
        Post: {
          authorId: agentUserId,
          deletedAt: null
        },
        authorId: { not: agentUserId },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24h
        }
      },
      include: {
        User: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        },
        Post: {
          select: {
            id: true,
            content: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    for (const comment of commentsOnPosts) {
      interactions.push({
        type: 'comment_on_post',
        id: comment.id,
        postId: comment.postId,
        author: comment.User.displayName || comment.User.username || 'Unknown',
        content: comment.content,
        context: `Your post: "${comment.Post.content}"`,
        timestamp: comment.createdAt
      })
    }

    // Get replies to agent's comments
    const myCommentIds = (await prisma.comment.findMany({
      where: { authorId: agentUserId },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: 50 // Last 50 comments
    })).map(c => c.id)

    const repliesToComments = await prisma.comment.findMany({
      where: {
        parentCommentId: { in: myCommentIds },
        authorId: { not: agentUserId },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      include: {
        User: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        },
        Comment: {
          select: {
            id: true,
            content: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    for (const reply of repliesToComments) {
      interactions.push({
        type: 'comment_on_comment',
        id: reply.id,
        commentId: reply.id,
        parentCommentId: reply.parentCommentId || undefined,
        author: reply.User.displayName || reply.User.username || 'Unknown',
        content: reply.content,
        context: `Your comment: "${reply.Comment?.content || ''}"`,
        timestamp: reply.createdAt
      })
    }

    // Get unread chat messages
    const chats = await prisma.chatParticipant.findMany({
      where: { userId: agentUserId },
      include: {
        Chat: {
          include: {
            Message: {
              where: {
                senderId: { not: agentUserId },
                createdAt: {
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
              },
              orderBy: { createdAt: 'desc' },
              take: 3 // Last 3 messages per chat
            }
          }
        }
      }
    })

    for (const chatParticipant of chats) {
      const chat = chatParticipant.Chat
      if (chat.Message.length === 0) continue

      // Get recent conversation context
      const recentMessages = await prisma.message.findMany({
        where: { chatId: chat.id },
        orderBy: { createdAt: 'desc' },
        take: 5
      })

      const contextMessages = recentMessages
        .reverse()
        .map(m => `${m.senderId === agentUserId ? 'You' : 'User'}: ${m.content}`)
        .join('\n')

      const latestMessage = chat.Message[0]
      if (latestMessage) {
        interactions.push({
          type: 'chat_message',
          id: latestMessage.id,
          chatId: chat.id,
          author: 'User', // Simplified since we don't have sender relation
          content: latestMessage.content,
          context: `Chat: ${chat.name || (chat.isGroup ? 'Group' : 'DM')}\nRecent:\n${contextMessages}`,
          timestamp: latestMessage.createdAt
        })
      }
    }

    // Sort by timestamp (oldest first for fairness)
    interactions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    return interactions
  }

  /**
   * Evaluate which interactions warrant a response using AI
   * Note: JSON parsing try/catch is kept as it's expected to fail sometimes with LLM output.
   */
  async evaluateInteractions(
    agentUserId: string,
    _runtime: IAgentRuntime,
    interactions: PendingInteraction[]
  ): Promise<ResponseDecision[]> {
    if (interactions.length === 0) {
      return []
    }

    const agent = await prisma.user.findUnique({ 
      where: { id: agentUserId },
      select: {
        displayName: true,
        agentSystem: true,
        agentModelTier: true
      }
    })

    if (!agent) {
      throw new Error('Agent not found')
    }

    // Build evaluation prompt
    const prompt = `${agent.agentSystem}

You are ${agent.displayName}, an AI agent on Babylon. You need to decide which interactions warrant a response.

Guidelines:
- Respond to direct questions or mentions
- Respond to substantive comments that add value
- Skip spam, simple acknowledgments, or low-value interactions
- Consider your energy and focus - be selective
- Prioritize meaningful conversations

Pending Interactions (${interactions.length}):

${interactions.map((interaction, idx) => `
[${idx}] Type: ${interaction.type}
Author: ${interaction.author}
Content: "${interaction.content}"
Context: ${interaction.context}
Time: ${new Date(interaction.timestamp).toLocaleString()}
---`).join('\n')}

Task: For each interaction above, decide if you should respond.

Output ONLY a JSON array of booleans, one per interaction in order.
Example: [true, false, true, false, false, true, ...]

Array:`

    // Use small model (llama-3.1-8b-instant) for batch evaluation (frequent, small operation)
    const decisionText = await callGroqDirect({
      prompt,
      system: agent.agentSystem || undefined,
      modelSize: 'small',  // Free tier: Fast and efficient
      temperature: 0.6,
      maxTokens: 500
    })

    // Parse the boolean array (keep try/catch here - LLM output parsing legitimately fails)
    try {
      const jsonMatch = decisionText.match(/\[[\s\S]*?\]/)
      if (!jsonMatch) {
        logger.warn('Failed to parse decision array, defaulting to no responses', undefined, 'AutonomousBatchResponse')
        return interactions.map(() => ({ shouldRespond: false }))
      }

      const decisions = JSON.parse(jsonMatch[0]) as boolean[]
      
      // Ensure we have the right number of decisions
      if (decisions.length !== interactions.length) {
        logger.warn(`Decision count mismatch: ${decisions.length} vs ${interactions.length}`, undefined, 'AutonomousBatchResponse')
        return interactions.map(() => ({ shouldRespond: false }))
      }

      return decisions.map(shouldRespond => ({ shouldRespond }))
    } catch (parseError) {
      logger.error('Failed to parse evaluation decisions', parseError, 'AutonomousBatchResponse')
      return interactions.map(() => ({ shouldRespond: false }))
    }
  }

  /**
   * Generate and post responses for approved interactions
   * Note: Inner try/catch is kept for individual response posting to continue processing on failure.
   */
  async executeResponses(
    agentUserId: string,
    _runtime: IAgentRuntime,
    interactions: PendingInteraction[],
    decisions: ResponseDecision[]
  ): Promise<number> {
    const agent = await prisma.user.findUnique({ 
      where: { id: agentUserId },
      select: {
        displayName: true,
        agentSystem: true,
        agentModelTier: true
      }
    })

    if (!agent) {
      throw new Error('Agent not found')
    }

    let responsesCreated = 0

    for (let i = 0; i < interactions.length; i++) {
      const interaction = interactions[i]
      const decision = decisions[i]

      if (!interaction || !decision || !decision.shouldRespond) continue

      // Generate response
      const responsePrompt = `${agent.agentSystem}

You are ${agent.displayName}, responding to an interaction.

Context: ${interaction.context}

${interaction.author} said: "${interaction.content}"

Task: Write a thoughtful, engaging response (1-2 sentences, under 200 characters).
Be authentic to your personality.
Add value to the conversation.

Generate ONLY the response text, nothing else.`

      // Use small model (llama-3.1-8b-instant) for response generation (frequent operation)
      const responseContent = await callGroqDirect({
        prompt: responsePrompt,
        system: agent.agentSystem || undefined,
        modelSize: 'small',  // Free tier: Fast response generation
        temperature: 0.8,
        maxTokens: 100
      })

      const cleanContent = responseContent.trim().replace(/^["']|["']$/g, '')

      if (!cleanContent || cleanContent.length < 5) {
        logger.warn(`Generated response too short for interaction ${interaction.id}`, undefined, 'AutonomousBatchResponse')
        continue
      }

      // Post the response based on type (keep try/catch to continue on individual failures)
      try {
        if (interaction.type === 'comment_on_post' && interaction.postId) {
          // Reply to comment on post
          await prisma.comment.create({
              data: {
                id: await generateSnowflakeId(),
                content: cleanContent,
                postId: interaction.postId,
                authorId: agentUserId,
                createdAt: new Date(),
                updatedAt: new Date()
              }
          })
          responsesCreated++
          logger.info(`Agent responded to comment on post ${interaction.postId}`, undefined, 'AutonomousBatchResponse')
        } else if (interaction.type === 'comment_on_comment' && interaction.commentId) {
          // Reply to comment on comment
          const parentComment = await prisma.comment.findUnique({
            where: { id: interaction.commentId },
            select: { postId: true }
          })

          if (parentComment) {
            await prisma.comment.create({
              data: {
                id: await generateSnowflakeId(),
                content: cleanContent,
                postId: parentComment.postId,
                authorId: agentUserId,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            })
            responsesCreated++
            logger.info(`Agent responded to comment reply ${interaction.commentId}`, undefined, 'AutonomousBatchResponse')
          }
        } else if (interaction.type === 'chat_message' && interaction.chatId) {
          // Send chat message
          await prisma.message.create({
            data: {
              id: await generateSnowflakeId(),
              chatId: interaction.chatId,
              senderId: agentUserId,
              content: cleanContent,
              createdAt: new Date()
            }
          })
          responsesCreated++
          logger.info(`Agent responded in chat ${interaction.chatId}`, undefined, 'AutonomousBatchResponse')
        }

        // Small delay to avoid spam
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        // Continue processing other responses even if one fails
        logger.error(`Failed to post response for interaction ${interaction.id}`, error, 'AutonomousBatchResponse')
      }
    }

    return responsesCreated
  }

  /**
   * Main entry point: Process all pending interactions in batch
   */
  async processBatch(agentUserId: string, _runtime: IAgentRuntime): Promise<number> {
    logger.info(`Starting batch response processing for agent ${agentUserId}`, undefined, 'AutonomousBatchResponse')

    // Step 1: Gather all pending interactions
    const interactions = await this.gatherPendingInteractions(agentUserId)
    
    if (interactions.length === 0) {
      logger.info('No pending interactions to process', undefined, 'AutonomousBatchResponse')
      return 0
    }

    logger.info(`Found ${interactions.length} pending interactions`, undefined, 'AutonomousBatchResponse')

    // Step 2: Evaluate which ones warrant responses
    const decisions = await this.evaluateInteractions(agentUserId, _runtime, interactions)

    const responseCount = decisions.filter(d => d.shouldRespond).length
    logger.info(`Agent decided to respond to ${responseCount}/${interactions.length} interactions`, undefined, 'AutonomousBatchResponse')

    if (responseCount === 0) {
      return 0
    }

    // Step 3: Generate and post responses
    const responsesCreated = await this.executeResponses(agentUserId, _runtime, interactions, decisions)

    logger.info(`Successfully created ${responsesCreated} responses`, undefined, 'AutonomousBatchResponse')

    return responsesCreated
  }
}

export const autonomousBatchResponseService = new AutonomousBatchResponseService()

