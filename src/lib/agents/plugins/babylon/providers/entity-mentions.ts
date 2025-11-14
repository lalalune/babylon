/**
 * Entity Mentions Provider
 * Detects and enriches mentions of users, companies, and stocks in messages
 * Uses regex to find mentions and provides context from database
 */

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '@elizaos/core'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

/**
 * Provider: Entity Mentions
 * Detects mentions of stocks, companies, and users in messages and provides their context
 */
export const entityMentionsProvider: Provider = {
  name: 'BABYLON_ENTITY_MENTIONS',
  description: 'Detects and provides context for mentioned users, companies, and stocks in messages',
  
  get: async (_runtime: IAgentRuntime, message: Memory, _state: State): Promise<ProviderResult> => {
    try {
      const messageText = message.content.text || ''
      
      if (!messageText || messageText.length < 3) {
        return { text: '' }
      }
      
      // Find potential entity mentions using regex
      const entities = await findEntityMentions(messageText)
      
      if (entities.length === 0) {
        return { text: '' }
      }
      
      // Build context for each entity
      const entityContexts: string[] = []
      const entityData: any[] = []
      
      for (const entity of entities) {
        if (entity.type === 'company') {
          const company = entity.data as any
          
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
            ticker: company.ticker,
            currentPrice: parseFloat(company.currentPrice?.toString() || '0'),
            priceChangePercentage: company.priceChangePercentage,
            volume24h: parseFloat(company.volume24h?.toString() || '0')
          })
        } else if (entity.type === 'user') {
          const user = entity.data as any
          
          const context = `👤 ${user.displayName || user.username}:
• Username: @${user.username}
• Type: ${user.isAgent ? 'AI Agent' : 'User'}${user.reputationPoints ? `\n• Points: ${user.reputationPoints}` : ''}${user.bio ? `\n• Bio: ${user.bio.substring(0, 150)}...` : ''}`
          
          entityContexts.push(context)
          entityData.push({
            type: 'user',
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            isAgent: user.isAgent,
            reputationPoints: user.reputationPoints
          })
        } else if (entity.type === 'actor') {
          const actor = entity.data as any
          
          const context = `🎭 ${actor.name}:
• Type: Actor/Character
• Category: ${actor.category || 'N/A'}${actor.bio ? `\n• Bio: ${actor.bio.substring(0, 150)}...` : ''}`
          
          entityContexts.push(context)
          entityData.push({
            type: 'actor',
            id: actor.id,
            name: actor.name,
            category: actor.category
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
 * Find entity mentions in text and look them up in database
 */
async function findEntityMentions(text: string): Promise<Array<{ type: string; data: any }>> {
  const results: Array<{ type: string; data: any }> = []
  
  // Extract potential entity names
  // 1. @username mentions
  const usernameMentions = text.match(/@(\w+)/g) || []
  
  // 2. $TICKER mentions (stock tickers)
  const tickerMentions = text.match(/\$([A-Z]{1,5})\b/g) || []
  
  // 3. Quoted names or capitalized multi-word names
  const quotedNames = text.match(/"([^"]{2,50})"/g) || []
  const capitalizedNames = text.match(/\b([A-Z][a-z]+(?: [A-Z][a-z]+)+)\b/g) || []
  
  // Look up usernames
  if (usernameMentions.length > 0) {
    const usernames = usernameMentions.map(m => m.substring(1).toLowerCase())
    const users = await prisma.user.findMany({
      where: {
        username: {
          in: usernames
        }
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        isAgent: true,
        reputationPoints: true
      },
      take: 10
    })
    
    results.push(...users.map(u => ({ type: 'user', data: u })))
  }
  
  // Look up tickers
  if (tickerMentions.length > 0) {
    const tickers = tickerMentions.map(m => m.substring(1))
    const companies = await prisma.organization.findMany({
      where: {
        OR: [
          { name: { in: tickers, mode: 'insensitive' } },
          { name: { in: tickers.map(t => t.toLowerCase()) } }
        ],
        type: 'company'
      },
      select: {
        id: true,
        name: true,
        description: true,
        currentPrice: true,
        imageUrl: true
      },
      take: 10
    })
    
    results.push(...companies.map(c => ({ type: 'company', data: c })))
  }
  
  // Look up company names
  const allNames = [...quotedNames.map(n => n.replace(/"/g, '')), ...capitalizedNames]
  if (allNames.length > 0) {
    const companies = await prisma.organization.findMany({
      where: {
        OR: [
          { name: { in: allNames, mode: 'insensitive' } }
        ],
        type: 'company'
      },
      select: {
        id: true,
        name: true,
        description: true,
        currentPrice: true,
        imageUrl: true
      },
      take: 10
    })
    
    results.push(...companies.map(c => ({ type: 'company', data: c })))
    
    // Also check actors (people)
    const actors = await prisma.actor.findMany({
      where: {
        name: { in: allNames, mode: 'insensitive' }
      },
      select: {
        id: true,
        name: true,
        description: true,
        role: true,
        profileImageUrl: true
      },
      take: 10
    })
    
    results.push(...actors.map(a => ({ type: 'actor', data: a })))
  }
  
  // Deduplicate by ID
  const seen = new Set<string>()
  return results.filter(r => {
    const key = `${r.type}:${r.data.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

