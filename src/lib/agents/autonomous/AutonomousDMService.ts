/**
 * Autonomous DM Service
 * 
 * Handles agents responding to direct messages autonomously
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'
import type { IAgentRuntime } from '@elizaos/core'
import { callGroqDirect } from '../llm/direct-groq'

export class AutonomousDMService {
  /**
   * Check for unread DMs and respond
   */
  async respondToDMs(agentUserId: string, _runtime: IAgentRuntime): Promise<number> {
    const agent = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agent?.isAgent) {
      throw new Error('Agent not found')
    }

      // Get agent's DM chats (non-group chats)
      const dmChats = await prisma.chatParticipant.findMany({
        where: { userId: agentUserId },
        include: {
          Chat: true
        }
      })

      let responsesCreated = 0

      for (const chatParticipant of dmChats) {
        const chat = chatParticipant.Chat
        
        if (chat.isGroup) continue // Skip group chats
        
        // Get recent messages in this chat
        const unreadMessages = await prisma.message.findMany({
          where: {
            chatId: chat.id,
            senderId: { not: agentUserId },
            createdAt: {
              gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        })

        if (unreadMessages.length === 0) continue

        // Get conversation context
        const allMessages = await prisma.message.findMany({
          where: { chatId: chat.id },
          orderBy: { createdAt: 'asc' },
          take: 10
        })

        const latestMessage = unreadMessages[0]
        if (!latestMessage) continue

        // Generate response
        const prompt = `${agent.agentSystem}

You are ${agent.displayName} in a direct message conversation.

Recent conversation:
${allMessages.slice(-5).map(m => `${m.senderId === agentUserId ? 'You' : 'Them'}: ${m.content}`).join('\n')}

Latest message from them:
"${latestMessage.content}"

Task: Generate a helpful, friendly response (1-2 sentences).
Be authentic to your personality.
Keep it under 200 characters.

Generate ONLY the response text, nothing else.`

        // Use small model (gpt-oss-120b) for fast DM responses
        const responseContent = await callGroqDirect({
          prompt,
          system: agent.agentSystem || undefined,
          modelSize: 'small',  // Frequent operation, use fast model
          temperature: 0.8,
          maxTokens: 80
        })

        const cleanContent = responseContent.trim().replace(/^["']|["']$/g, '')

        if (!cleanContent || cleanContent.length < 5) {
          continue
        }

        // Create response message
        await prisma.message.create({
          data: {
            id: await generateSnowflakeId(),
            chatId: chat.id,
            senderId: agentUserId,
            content: cleanContent,
            createdAt: new Date()
          }
        })

        responsesCreated++
        logger.info(`Agent ${agent.displayName} responded to DM in chat ${chat.id}`, undefined, 'AutonomousDM')

        // Only respond to one DM per tick to avoid spam
        break
      }

      return responsesCreated
  }
}

export const autonomousDMService = new AutonomousDMService()

