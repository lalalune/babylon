/**
 * User Profile Provider
 * Allows agents to view any user's profile information via A2A protocol
 * This is useful for understanding other users, checking their reputation, etc.
 */

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '@elizaos/core'
import { logger } from '@/lib/logger'
import type { BabylonRuntime } from '../types'

/**
 * Provider: View User Profile
 * Gets any user's profile information via A2A protocol
 * 
 * Usage in prompts: "Show me user X's profile" or "What is user Y's reputation?"
 */
export const userProfileProvider: Provider = {
  name: 'BABYLON_USER_PROFILE',
  description: 'View any user\'s profile including username, display name, bio, reputation points, and other public information via A2A protocol. Useful for understanding other users and their activity.',
  
  get: async (runtime: IAgentRuntime, message: Memory, _state: State): Promise<ProviderResult> => {
    const babylonRuntime = runtime as BabylonRuntime
    
    // A2A is REQUIRED
    if (!babylonRuntime.a2aClient?.isConnected()) {
      logger.error('A2A client not connected - user profile provider requires A2A protocol', undefined, runtime.agentId)
      return { text: 'ERROR: A2A client not connected. Cannot view user profiles. Please ensure A2A server is running.' }
    }
    
    // Extract userId from message content
    // Look for patterns like "user_123", "@username", or explicit userId mentions
    const content = message.content?.text || ''
    let userId: string | null = null
    
    // Try to extract user ID from common patterns
    const userIdMatch = content.match(/user[_\s]?(\w+)/i) || 
                        content.match(/@(\w+)/) ||
                        content.match(/userId[:\s]+(\w+)/i) ||
                        content.match(/profile[:\s]+(\w+)/i) ||
                        content.match(/view[:\s]+(\w+)/i)
    
    if (userIdMatch) {
      userId = userIdMatch[1] || null
    }
    
    // If no userId found in message, return error guidance
    if (!userId) {
      return { text: `To view a user's profile, please specify the user ID or username in your message.
Example: "Show me user_abc123's profile" or "What is @trader's reputation?"` }
    }
    
    try {
      // Fetch profile data via A2A protocol
      const profileData = await babylonRuntime.a2aClient.getUserProfile(userId)
      
      const profile = profileData as unknown as {
        id: string
        username: string | null
        displayName: string | null
        bio: string | null
        profileImageUrl: string | null
        reputationPoints: number
        virtualBalance: number
      }
      
      return { text: `User Profile: ${profile.displayName || profile.username || profile.id}

👤 Username: ${profile.username || 'Not set'}
📝 Display Name: ${profile.displayName || 'Not set'}
${profile.bio ? `📄 Bio: ${profile.bio}` : ''}
⭐ Reputation Points: ${profile.reputationPoints || 0} pts
💰 Balance: $${profile.virtualBalance || 0}
${profile.profileImageUrl ? `🖼️  Profile Image: ${profile.profileImageUrl}` : ''}

User ID: ${profile.id}` }
    } catch (error) {
      logger.error('Error fetching user profile via A2A', { error, agentId: runtime.agentId, userId }, 'UserProfileProvider')
      return { 
        text: `Error fetching user profile: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }
}

