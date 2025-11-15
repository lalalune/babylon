/**
 * Messaging Actions
 * Actions for sending messages and managing chats
 */

import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core'
// // import { logger } from '@/lib/logger' // Commented out - not needed // Unused - needed when A2A methods are implemented
import type { BabylonRuntime } from '../types'

/**
 * Action: Send Message
 * Allows agent to send a message in a chat
 */
export const sendMessageAction: Action = {
  name: 'SEND_MESSAGE',
  description: 'Send a message in a chat',
  similes: ['send message', 'message', 'dm', 'send dm', 'chat'],
  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'Send message to chat chat-123: "Hello there!"' }
      },
      {
        name: '{{agent}}',
        content: { text: 'Sending message...', action: 'SEND_MESSAGE' }
      }
    ]
  ],
  
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const content = message.content.text?.toLowerCase() || ''
    return content.includes('send') && (content.includes('message') || content.includes('dm'))
  },
  
  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback
  ): Promise<void> => {
    const babylonRuntime = runtime as BabylonRuntime
    
    if (!babylonRuntime.a2aClient?.isConnected()) {
      if (callback) {
        callback({
          text: 'A2A client not connected. Cannot send message.',
          action: 'SEND_MESSAGE'
        })
      }
      return
    }
    
    // Parse message
    const content = _message.content.text || ''
    const chatIdMatch = content.match(/chat[:\s-]+([a-zA-Z0-9-]+)/)
    const messageMatch = content.match(/(?::|with)\s*["'](.+?)["']/) || content.match(/message\s+(.+)$/i)
    
    if (!chatIdMatch || !messageMatch) {
      if (callback) {
        callback({
          text: 'Could not parse message parameters. Please specify chat ID and message content.',
          action: 'SEND_MESSAGE'
        })
      }
      return
    }
    
    const chatId = chatIdMatch[1]!
    const messageContent = messageMatch[1]!
    
    try {
      const result = await babylonRuntime.a2aClient.sendMessage(
        chatId,
        messageContent
      ) as { success?: boolean; messageId?: string; message?: string }
      
      if (callback) {
        if (result.success === false) {
          callback({
            text: `Failed to send message: ${result.message || 'Unknown error'}`,
            action: 'SEND_MESSAGE'
          })
        } else {
          callback({
            text: `Successfully sent message! Message ID: ${result.messageId || 'unknown'}`,
            action: 'SEND_MESSAGE'
          })
        }
      }
    } catch (error) {
      if (callback) {
        callback({
          text: `Error sending message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          action: 'SEND_MESSAGE'
        })
      }
    }
  }
}

/**
 * Action: Create Group Chat
 * Allows agent to create a new group chat
 */
export const createGroupAction: Action = {
  name: 'CREATE_GROUP',
  description: 'Create a new group chat',
  similes: ['create group', 'new group', 'start group chat'],
  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'Create group "Market Analysts" with members user1, user2' }
      },
      {
        name: '{{agent}}',
        content: { text: 'Creating group chat...', action: 'CREATE_GROUP' }
      }
    ]
  ],
  
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const content = message.content.text?.toLowerCase() || ''
    return content.includes('create') && content.includes('group')
  },
  
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback
  ): Promise<void> => {
    const babylonRuntime = runtime as BabylonRuntime
    
    if (!babylonRuntime.a2aClient?.isConnected()) {
      if (callback) {
        callback({
          text: 'A2A client not connected. Cannot create group.',
          action: 'CREATE_GROUP'
        })
      }
      return
    }
    
    const content = message.content.text || ''
    const nameMatch = content.match(/(?:group|named?)\s+["'](.+?)["']/) || content.match(/group\s+([A-Za-z0-9\s]+)(?:\s+with)?/)
    const membersMatch = content.match(/(?:with|members?)\s+(.+)$/)
    
    if (!nameMatch) {
      if (callback) {
        callback({
          text: 'Could not parse group name. Please specify a name for the group.',
          action: 'CREATE_GROUP'
        })
      }
      return
    }
    
    const groupName = nameMatch[1]?.trim() || 'Unnamed Group'
    const memberIds: string[] = []
    if (membersMatch) {
      const memberStr = membersMatch[1]
      if (memberStr) {
        const matches = memberStr.match(/[a-zA-Z0-9-]+/g)
        if (matches) memberIds.push(...matches)
      }
    }
    
    try {
      const result = await babylonRuntime.a2aClient.createGroup(groupName, memberIds) as { success?: boolean; chatId?: string; message?: string }
      
      if (callback) {
        if (result.success === false) {
          callback({
            text: `Failed to create group: ${result.message || 'Unknown error'}`,
            action: 'CREATE_GROUP'
          })
        } else {
          callback({
            text: `Successfully created group "${groupName}"! Chat ID: ${result.chatId || 'unknown'}`,
            action: 'CREATE_GROUP'
          })
        }
      }
    } catch (error) {
      if (callback) {
        callback({
          text: `Error creating group: ${error instanceof Error ? error.message : 'Unknown error'}`,
          action: 'CREATE_GROUP'
        })
      }
    }
  }
}

