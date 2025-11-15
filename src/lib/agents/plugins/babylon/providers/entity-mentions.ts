/**
 * Entity Mentions Provider
 * Detects and enriches mentions of users, companies, and stocks in messages
 * Uses regex to find mentions and provides context via A2A protocol
 */

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '@elizaos/core'
import { logger } from '@/lib/logger'
import type { BabylonRuntime } from '../types'
import type { EntityMention } from '@/types/entities'
import { isCompanyEntity, isUserEntity, isActorEntity } from '@/types/entities'
import type { JsonValue } from '@/types/common'

/**
 * Provider: Entity Mentions
 * Detects mentions of stocks, companies, and users in messages and provides their context
 */
export const entityMentionsProvider: Provider = {
  name: 'BABYLON_ENTITY_MENTIONS',
  description: 'Detects and provides context for mentioned users, companies, and stocks in messages',
  
  get: async (runtime: IAgentRuntime, message: Memory, _state: State): Promise<ProviderResult> => {
    const babylonRuntime = runtime as BabylonRuntime
    
    // A2A is REQUIRED
    if (!babylonRuntime.a2aClient?.isConnected()) {
      logger.error('A2A client not connected - entity mentions provider requires A2A protocol', undefined, runtime.agentId)
      return { text: '' } // Return empty - don't break the flow, just skip entity enrichment
    }
    
    try {
      const messageText = message.content.text || ''
      
      if (!messageText || messageText.length < 3) {
        return { text: '' }
      }
      
      // Find potential entity mentions using regex and look up via A2A
      const entities = await findEntityMentions(messageText, babylonRuntime)
      
      if (entities.length === 0) {
        return { text: '' }
      }
      
      // Build context for each entity
      const entityContexts: string[] = []
      const entityData: Array<{ type: string; id: string; [key: string]: JsonValue }> = []
      
      for (const entity of entities) {
        if (entity.type === 'company' && isCompanyEntity(entity.data)) {
          const company = entity.data
          
          const context = `📈 ${company.ticker || company.name}:
• Name: ${company.name}
• Type: Company
• Current Price: $${parseFloat(company.currentPrice?.toString() || '0').toFixed(2)}
• Price Change: ${company.priceChangePercentage ? (company.priceChangePercentage >= 0 ? '+' : '') + company.priceChangePercentage.toFixed(2) + '%' : 'N/A'}
• Volume (24h): $${parseFloat(company.volume24h?.toString() || '0').toFixed(2)}${company.bio ? `\n• About: ${company.bio.substring(0, 150)}...` : ''}`
          
          entityContexts.push(context)
          entityData.push({
            type: 'company',
            id: company.id,
            name: company.name,
            ticker: company.ticker ?? null,
            currentPrice: parseFloat(company.currentPrice?.toString() || '0'),
            priceChangePercentage: company.priceChangePercentage ?? null,
            volume24h: parseFloat(company.volume24h?.toString() || '0')
          })
        } else if (entity.type === 'user' && isUserEntity(entity.data)) {
          const user = entity.data
          
          const context = `👤 ${user.displayName || user.username}:
• Username: @${user.username}
• Type: ${user.isAgent ? 'AI Agent' : 'User'}${user.reputationPoints ? `\n• Points: ${user.reputationPoints}` : ''}${user.bio ? `\n• Bio: ${user.bio.substring(0, 150)}...` : ''}`
          
          entityContexts.push(context)
          entityData.push({
            type: 'user',
            id: user.id,
            username: user.username,
            displayName: user.displayName ?? null,
            isAgent: user.isAgent ?? false,
            reputationPoints: user.reputationPoints ?? null
          })
        } else if (entity.type === 'actor' && isActorEntity(entity.data)) {
          const actor = entity.data
          
          const context = `🎭 ${actor.name}:
• Type: Actor/Character
• Category: ${actor.category || 'N/A'}${actor.bio ? `\n• Bio: ${actor.bio.substring(0, 150)}...` : ''}`
          
          entityContexts.push(context)
          entityData.push({
            type: 'actor',
            id: actor.id,
            name: actor.name,
            category: actor.category ?? null
          })
        }
      }
      
      if (entityContexts.length === 0) {
        return { text: '' }
      }
      
      return { 
        text: `[MENTIONED ENTITIES]\n${entityContexts.join('\n\n')}\n[/MENTIONED ENTITIES]`,
        data: {
          entities: entityData,
          count: entityData.length
        }
      }
    } catch (error) {
      logger.error('Failed to process entity mentions', error, 'EntityMentionsProvider')
      return { text: '' }
    }
  }
}

/**
 * Find entity mentions in text and look them up via A2A protocol
 */
async function findEntityMentions(text: string, runtime: BabylonRuntime): Promise<EntityMention[]> {
  const results: EntityMention[] = []
  
  // Extract potential entity names
  // 1. @username mentions
  const usernameMentions = text.match(/@(\w+)/g) || []
  
  // 2. $TICKER mentions (stock tickers)
  const tickerMentions = text.match(/\$([A-Z]{1,5})\b/g) || []
  
  // 3. Quoted names or capitalized multi-word names
  const quotedNames = text.match(/"([^"]{2,50})"/g) || []
  const capitalizedNames = text.match(/\b([A-Z][a-z]+(?: [A-Z][a-z]+)+)\b/g) || []
  
  // Look up usernames via A2A
  if (usernameMentions.length > 0 && runtime.a2aClient) {
    const usernames = usernameMentions.map(m => m.substring(1).toLowerCase())
    
    // Search for each username via A2A
    for (const username of usernames.slice(0, 10)) {
      try {
        const searchResult = await runtime.a2aClient.searchUsers(username, 5)
        const users = (searchResult as { users?: Array<{
          id: string
          username: string
          displayName?: string
          bio?: string
          isAgent?: boolean
          reputationPoints?: number
        }> })?.users || []
        
        // Find exact username match
        const matchedUser = users.find(u => u.username?.toLowerCase() === username)
        if (matchedUser) {
          results.push({
      type: 'user' as const, 
      data: { 
              id: matchedUser.id,
              username: matchedUser.username,
              displayName: matchedUser.displayName || null,
              bio: matchedUser.bio || null,
              isAgent: matchedUser.isAgent || false,
              reputationPoints: matchedUser.reputationPoints || null
      } 
          })
        }
      } catch (error) {
        logger.debug(`Failed to search user ${username} via A2A`, { error }, 'EntityMentionsProvider')
      }
    }
  }
  
  // Look up organizations via A2A
  if ((tickerMentions.length > 0 || quotedNames.length > 0 || capitalizedNames.length > 0) && runtime.a2aClient) {
    try {
      const orgsResult = await runtime.a2aClient.getOrganizations(100)
      const organizations = (orgsResult as { organizations?: Array<{
        id: string
        name: string
        ticker?: string
        description?: string
        currentPrice?: number
        imageUrl?: string
      }> })?.organizations || []
      
      // Match tickers
  if (tickerMentions.length > 0) {
    const tickers = tickerMentions.map(m => m.substring(1))
        const matchedOrgs = organizations.filter(org => 
          tickers.some(t => 
            org.ticker?.toUpperCase() === t.toUpperCase() || 
            org.name.toUpperCase().includes(t.toUpperCase())
          )
        )
        results.push(...matchedOrgs.map(c => ({ type: 'company' as const, data: c })))
  }
  
      // Match names
  const allNames = [...quotedNames.map(n => n.replace(/"/g, '')), ...capitalizedNames]
  if (allNames.length > 0) {
        const matchedOrgs = organizations.filter(org =>
          allNames.some(name => 
            org.name.toLowerCase().includes(name.toLowerCase())
          )
        )
        results.push(...matchedOrgs.map(c => ({ type: 'company' as const, data: c })))
      }
    } catch (error) {
      logger.debug('Failed to fetch organizations via A2A', { error }, 'EntityMentionsProvider')
    }
  }
  
  // Note: Actors are not available via A2A, so we skip them
  // This is acceptable as actors are internal game entities
  
  // Deduplicate by ID
  const seen = new Set<string>()
  return results.filter(r => {
    const key = `${r.type}:${r.data.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

