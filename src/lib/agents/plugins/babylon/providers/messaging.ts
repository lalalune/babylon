/**
 * Messaging Provider
 * Provides access to chats and messages via A2A protocol
 * 
 * A2A IS REQUIRED - These providers will not work without an active A2A connection
 */

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '@elizaos/core'
import { logger } from '@/lib/logger'
import type { BabylonRuntime } from '../types'

/**
 * Provider: Unread Messages
 * Gets agent's unread DMs and group chats via A2A
 */
export const messagesProvider: Provider = {
  name: 'BABYLON_MESSAGES',
  description: 'Get unread messages and recent chats via A2A protocol',
  
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State): Promise<ProviderResult> => {
    const babylonRuntime = runtime as BabylonRuntime
    
    // A2A is REQUIRED
    if (!babylonRuntime.a2aClient?.isConnected()) {
      logger.error('A2A client not connected - messages provider requires A2A protocol', { 
        agentId: runtime.agentId 
      })
      return { text: 'ERROR: A2A client not connected. Cannot fetch messages. Please ensure A2A server is running.' }
    }
    
    // Fetch messages via A2A protocol
    const [chats, unreadCount] = await Promise.all([
      babylonRuntime.a2aClient.sendRequest('a2a.getChats', { filter: 'all' }),
      babylonRuntime.a2aClient.sendRequest('a2a.getUnreadCount', {})
    ])
    
    const chatsData = chats as { chats?: unknown[] }
    const unreadData = unreadCount as { unreadCount?: number }
    
    return { text: `Your Messages:

Unread Count: ${unreadData.unreadCount || 0}

Recent Chats (${chatsData.chats?.length || 0}):
${chatsData.chats?.slice(0, 10).map((c: any) => `- ${c.name || (c.isGroup ? 'Group Chat' : 'Direct Message')} (${c.participants} participants)
  Last: ${c.lastMessage?.content?.substring(0, 50) || 'No messages'}...
  ${c.updatedAt}`).join('\n') || 'No chats'}` }
  }
}

/**
 * Provider: Notifications
 * Gets agent's recent notifications via A2A
 */
export const notificationsProvider: Provider = {
  name: 'BABYLON_NOTIFICATIONS',
  description: 'Get recent notifications via A2A protocol',
  
  get: async (runtime: IAgentRuntime, _message: Memory, _state: State): Promise<ProviderResult> => {
    const babylonRuntime = runtime as BabylonRuntime
    
    // A2A is REQUIRED
    if (!babylonRuntime.a2aClient?.isConnected()) {
      logger.error('A2A client not connected - notifications provider requires A2A protocol', { 
        agentId: runtime.agentId 
      })
      return { text: 'ERROR: A2A client not connected. Cannot fetch notifications. Please ensure A2A server is running.' }
    }
    
    // Fetch notifications via A2A protocol
    const notifications = await babylonRuntime.a2aClient.sendRequest('a2a.getNotifications', {
      limit: 10
    })
    
    const notifData = notifications as { notifications?: unknown[]; unreadCount?: number }
    
    return { text: `Your Notifications:

Unread: ${notifData.unreadCount || 0}

Recent Notifications (${notifData.notifications?.length || 0}):
${notifData.notifications?.map((n: any) => `${n.read ? '✓' : '•'} ${n.type}: ${n.message}
  ${n.createdAt}`).join('\n') || 'No notifications'}` }
  }
}
