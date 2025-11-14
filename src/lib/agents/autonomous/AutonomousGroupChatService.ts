/**
 * Autonomous Group Chat Service
 * 
 * Handles agents participating in group chats autonomously
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'
import type { IAgentRuntime } from '@elizaos/core'
import { callGroqDirect } from '../llm/direct-groq'

export class AutonomousGroupChatService {
  /**
   * Participate in group chats agent is member of
   */
  async participateInGroupChats(agentUserId: string, _runtime: IAgentRuntime): Promise<number> {
    const agent = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agent?.isAgent) {
      throw new Error('Agent not found')
    }

      // Get agent's group chats
      const groupChats = await prisma.chatParticipant.findMany({
        where: { userId: agentUserId },
        include: {
          Chat: true
        }
      })

      let messagesCreated = 0

      for (const chatParticipant of groupChats) {
        const chat = chatParticipant.Chat
        
        if (!chat.isGroup) continue // Skip DMs
        
        // Get recent messages in this group
        const recentMessages = await prisma.message.findMany({
          where: {
            chatId: chat.id,
            createdAt: {
              gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        })

        if (recentMessages.length === 0) continue

        // Check if agent was mentioned or should respond
        const agentMentioned = recentMessages.some((m: { content: string; senderId: string }) => 
          m.content.toLowerCase().includes(agent.username?.toLowerCase() || 'agent') ||
          m.content.toLowerCase().includes(agent.displayName?.toLowerCase() || 'agent')
        )

        // Don't spam - only respond if mentioned or if it's been a while
        const agentLastMessage = recentMessages.find((m: { content: string; senderId: string }) => m.senderId === agentUserId)
        if (!agentMentioned && agentLastMessage) {
          continue
        }

        // Generate contextual response
        const prompt = `${agent.agentSystem}

You are ${agent.displayName} in a group chat.

Recent conversation:
${recentMessages.reverse().map((m: { content: string; senderId: string }) => `${m.senderId === agentUserId ? 'You' : 'User'}: ${m.content}`).join('\n')}

Task: Generate a helpful, engaging message (1-2 sentences) that contributes to the conversation.
Be authentic to your personality and expertise.
Keep it under 200 characters.
Only respond if you have something valuable to add.

Generate ONLY the message text, or "SKIP" if you shouldn't respond.`

        // Use large model (qwen3-32b) for quality group chat content
        const responseContent = await callGroqDirect({
          prompt,
          system: agent.agentSystem || undefined,
          modelSize: 'large',  // Important social content
          temperature: 0.8,
          maxTokens: 80
        })

        const cleanContent = responseContent.trim().replace(/^["']|["']$/g, '')

        if (!cleanContent || cleanContent.length < 5 || cleanContent === 'SKIP') {
          continue
        }

        // Create group message
        await prisma.message.create({
          data: {
            id: await generateSnowflakeId(),
            chatId: chat.id,
            senderId: agentUserId,
            content: cleanContent,
            createdAt: new Date()
          }
        })

        messagesCreated++
        logger.info(`Agent ${agent.displayName} participated in group chat ${chat.id}`, undefined, 'AutonomousGroupChat')

        // Only respond to one group per tick to avoid spam
        break
      }

      return messagesCreated
  }
}

export const autonomousGroupChatService = new AutonomousGroupChatService()

