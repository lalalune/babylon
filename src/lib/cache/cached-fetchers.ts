/**
 * Cached Server-Side Data Fetchers
 * 
 * These functions use Next.js 16 'use cache' directives to enable
 * efficient caching at the component level.
 */

import { db } from '@/lib/database-service'
import { gameService } from '@/lib/game-service'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import { cacheTag, cacheLife } from './cache-polyfill'
import { cacheMonitoring } from './cache-monitoring'
import { ReputationService } from '@/lib/services/reputation-service'

/**
 * Calculate 24h trading volume for an organization
 */
async function calculateVolume24h(organizationId: string): Promise<number> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    const volumeTransactions = await prisma.balanceTransaction.findMany({
      where: {
        type: {
          in: ['PERP_OPEN', 'PERP_CLOSE'],
        },
        createdAt: {
          gte: twentyFourHoursAgo,
        },
        description: {
          contains: organizationId,
        },
      },
      select: {
        amount: true,
      },
    })
    
    return volumeTransactions.reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0)
  } catch (error) {
    logger.error(
      `Failed to calculate volume24h for ${organizationId}: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      'VolumeTracking'
    )
    return 0
  }
}

/**
 * Get perpetual markets data (shared across all users)
 * Uses 'use cache' for build-time prerendering and runtime caching
 * Cache tag: 'markets:perps' for granular invalidation
 * Cache life: 5 minutes (300 seconds)
 */
export async function getCachedPerpMarkets() {
  'use cache'
  
  const cacheKey = 'markets:perps'
  const startTime = Date.now()
  
  cacheTag(cacheKey)
  cacheLife({ expire: 300 })
  
  try {
    const companies = await db.getCompanies()
    
    const markets = await Promise.all(
      companies.map(async (company) => {
        const currentPrice = company.currentPrice || company.initialPrice || 100
        const priceHistory = await db.getPriceHistory(company.id, 1440)
        
        let change24h = 0
        let changePercent24h = 0
        let high24h = currentPrice
        let low24h = currentPrice
        
        if (priceHistory.length > 0) {
          const price24hAgo = priceHistory[priceHistory.length - 1]
          if (price24hAgo) {
            change24h = currentPrice - price24hAgo.price
            changePercent24h = (change24h / price24hAgo.price) * 100
          }
          
          high24h = Math.max(...priceHistory.map(p => p.price), currentPrice)
          low24h = Math.min(...priceHistory.map(p => p.price), currentPrice)
        }
        
        // Get open positions for open interest calculation
        const positions = await prisma.perpPosition.findMany({
          where: {
            organizationId: company.id,
            closedAt: null,
          },
          select: {
            side: true,
            size: true,
            leverage: true,
          },
        }).catch(() => [])
        
        const openInterest = positions.reduce(
          (sum, p) => sum + (Number(p.size) * Number(p.leverage)),
          0
        )
        
        const longs = positions.filter(p => p.side === 'long')
        const shorts = positions.filter(p => p.side === 'short')
        const longSize = longs.reduce((sum, p) => sum + Number(p.size), 0)
        const shortSize = shorts.reduce((sum, p) => sum + Number(p.size), 0)
        const totalSize = longSize + shortSize
        
        let fundingRate = 0.01
        if (totalSize > 0) {
          const imbalance = (longSize - shortSize) / totalSize
          fundingRate = 0.01 + (imbalance * 0.05)
        }
        
        return {
          ticker: company.id.toUpperCase().replace(/-/g, ''),
          organizationId: company.id,
          name: company.name,
          currentPrice,
          change24h,
          changePercent24h,
          high24h,
          low24h,
          volume24h: await calculateVolume24h(company.id),
          openInterest,
          fundingRate: {
            rate: fundingRate,
            nextFundingTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
            predictedRate: fundingRate,
          },
          maxLeverage: 100,
          minOrderSize: 10,
        }
      })
    )
    
    const responseTime = Date.now() - startTime
    cacheMonitoring.recordHit(cacheKey, responseTime)
    
    return {
      success: true,
      markets,
      count: markets.length,
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    cacheMonitoring.recordMiss(cacheKey, responseTime)
    
    logger.error('Error fetching cached perp markets:', error, 'getCachedPerpMarkets')
    return {
      success: false,
      markets: [],
      count: 0,
    }
  }
}

/**
 * Get prediction market stats (shared across all users)
 * Uses 'use cache' for build-time prerendering
 * Cache tag: 'stats' for granular invalidation
 * Cache life: 1 minute (60 seconds) - stats change frequently
 */
export async function getCachedStats() {
  'use cache'
  
  const cacheKey = 'stats'
  const startTime = Date.now()
  
  cacheTag(cacheKey)
  // Cache life: 1 minute - stats change frequently
  cacheLife({ expire: 60 })
  
  try {
    const stats = await gameService.getStats()
    const status = gameService.getStatus()
    
    const responseTime = Date.now() - startTime
    cacheMonitoring.recordHit(cacheKey, responseTime)
    
    return {
      success: true,
      stats,
      engineStatus: status,
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    cacheMonitoring.recordMiss(cacheKey, responseTime)
    
    logger.error('Error fetching cached stats:', error, 'getCachedStats')
    return {
      success: false,
      stats: null,
      engineStatus: null,
    }
  }
}

/**
 * Get active prediction questions (shared, but can include user positions)
 * Uses 'use cache: remote' for dynamic context caching
 * Cache tag: 'markets:predictions' for granular invalidation
 * Cache life: 2 minutes (120 seconds) - predictions update frequently
 */
export async function getCachedPredictions(userId?: string, timeframe?: string) {
  'use cache: remote'
  
  const cacheKey = `markets:predictions${userId ? `:${userId}` : ''}`
  const startTime = Date.now()
  
  cacheTag('markets:predictions')
  // Cache life: 2 minutes - predictions update frequently
  cacheLife({ expire: 120 })
  
  try {
    const questions = await db.getActiveQuestions(timeframe)
    const marketIds = questions.map(q => String(q.id)) // Convert to string array
    
    const markets = await prisma.market.findMany({
      where: {
        id: { in: marketIds },
      },
    })
    const marketMap = new Map(markets.map(m => [m.id, m]))
    
    // Get user positions if userId provided
    const userPositionsMap = new Map()
    if (userId) {
      const positions = await prisma.position.findMany({
        where: {
          userId: userId,
          marketId: { in: marketIds as string[] },
        },
        include: {
          market: true,
        },
      })
      
      for (const p of positions) {
        // Type assertion: Prisma include adds market property
        const positionWithMarket = p as typeof p & { market: { yesShares: number | string; noShares: number | string } | null }
        if (!positionWithMarket.market) continue; // Skip if market not loaded
        const market = positionWithMarket.market
        const totalShares = Number(market.yesShares) + Number(market.noShares)
        const currentYesPrice = totalShares > 0 ? Number(market.yesShares) / totalShares : 0.5
        const currentNoPrice = totalShares > 0 ? Number(market.noShares) / totalShares : 0.5
        
        userPositionsMap.set(p.marketId, {
          id: p.id,
          side: p.side ? 'YES' : 'NO',
          shares: Number(p.shares),
          avgPrice: Number(p.avgPrice),
          currentPrice: p.side ? currentYesPrice : currentNoPrice,
          currentValue: Number(p.shares) * (p.side ? currentYesPrice : currentNoPrice),
          costBasis: Number(p.shares) * Number(p.avgPrice),
          unrealizedPnL: (Number(p.shares) * (p.side ? currentYesPrice : currentNoPrice)) - (Number(p.shares) * Number(p.avgPrice)),
        })
      }
    }
    
    return {
      success: true,
      questions: questions.map(q => {
        const marketId = String(q.id)
        const market = marketMap.get(marketId)
        const userPosition = userPositionsMap.get(marketId)
        
        return {
          id: marketId, // Ensure id is string
          questionNumber: q.questionNumber,
          text: q.text,
          status: q.status,
          timeframe: q.timeframe,
          createdDate: q.createdDate,
          resolutionDate: q.resolutionDate,
          resolvedOutcome: q.resolvedOutcome,
          scenario: q.scenarioId,
          yesShares: market ? Number(market.yesShares) : 0,
          noShares: market ? Number(market.noShares) : 0,
          userPosition: userPosition || null,
        }
      }),
      count: questions.length,
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    cacheMonitoring.recordMiss(cacheKey, responseTime)
    
    logger.error('Error fetching cached predictions:', error, 'getCachedPredictions')
    return {
      success: false,
      questions: [],
      count: 0,
    }
  }
}

/**
 * Get latest posts (shared feed)
 * Uses 'use cache: remote' for dynamic context caching
 * Cache tag: 'posts:latest' for granular invalidation
 * Cache life: 30 seconds - posts are very dynamic
 */
export async function getCachedLatestPosts(limit: number = 100, offset: number = 0, actorId?: string) {
  'use cache: remote'
  
  const cacheKey = `posts:latest:${limit}:${offset}:${actorId || 'all'}`
  const startTime = Date.now()
  
  cacheTag('posts:latest')
  // Cache life: 30 seconds - posts are very dynamic
  cacheLife({ expire: 30 })
  
  try {
    // Prefer realtime history when available
    const realtimeResult = await gameService.getRealtimePosts(limit, offset, actorId || undefined)
    if (realtimeResult && realtimeResult.posts.length > 0) {
      const result = {
        success: true,
        posts: realtimeResult.posts,
        total: realtimeResult.total,
        limit,
        offset,
        source: 'realtime',
      }
      
      const responseTime = Date.now() - startTime
      cacheMonitoring.recordHit(cacheKey, responseTime)
      
      return result
    }
    
    let posts
    if (actorId) {
      posts = await gameService.getPostsByActor(actorId, limit)
    } else {
      posts = await gameService.getRecentPosts(limit, offset)
    }
    
    const result = {
      success: true,
      posts,
      total: posts.length,
      limit,
      offset,
    }
    
    const responseTime = Date.now() - startTime
    cacheMonitoring.recordHit(cacheKey, responseTime)
    
    return result
  } catch (error) {
    const responseTime = Date.now() - startTime
    cacheMonitoring.recordMiss(cacheKey, responseTime)
    
    logger.error('Error fetching cached latest posts:', error, 'getCachedLatestPosts')
    return {
      success: false,
      posts: [],
      total: 0,
      limit,
      offset,
    }
  }
}

/**
 * Get registry users (shared, but can be filtered)
 * Uses 'use cache: remote' for dynamic filtering caching
 * Cache tag: 'registry' for granular invalidation
 * Cache life: 3 minutes (180 seconds) - registry changes less frequently
 */
export async function getCachedRegistry(filters: {
  onChainOnly?: boolean
  sortBy?: 'username' | 'createdAt' | 'nftTokenId'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}) {
  'use cache: remote'
  
  const cacheKey = `registry:${JSON.stringify(filters)}`
  const startTime = Date.now()
  
  cacheTag('registry')
  // Cache life: 3 minutes - registry changes less frequently
  cacheLife({ expire: 180 })
  
  try {
    const where = filters.onChainOnly ? { onChainRegistered: true } : {}
    const orderBy = filters.sortBy ? {
      [filters.sortBy]: filters.sortOrder || 'desc',
    } : { createdAt: 'desc' as const }
    
    const users = await prisma.user.findMany({
      where,
      orderBy,
      take: filters.limit || 100,
      skip: filters.offset || 0,
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        profileImageUrl: true,
        walletAddress: true,
        isActor: true,
        onChainRegistered: true,
        nftTokenId: true,
        registrationTxHash: true,
        createdAt: true,
        virtualBalance: true,
        lifetimePnL: true,
        _count: {
          select: {
            positions: true,
            comments: true,
            reactions: true,
          },
        },
      },
    })
    
    const totalCount = await prisma.user.count({ where })
    
    const usersWithReputation = await Promise.all(
      users.map(async (user) => {
        let reputation: number | null = null
        if (user.onChainRegistered && user.nftTokenId) {
          try {
            reputation = await ReputationService.getOnChainReputation(user.id)
          } catch (error) {
            logger.error(`Failed to fetch reputation for user ${user.id}:`, error, 'getCachedRegistry')
          }
        }
        
        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          profileImageUrl: user.profileImageUrl,
          walletAddress: user.walletAddress,
          isActor: user.isActor,
          onChainRegistered: user.onChainRegistered,
          nftTokenId: user.nftTokenId,
          registrationTxHash: user.registrationTxHash,
          createdAt: user.createdAt,
          virtualBalance: user.virtualBalance.toString(),
          lifetimePnL: user.lifetimePnL.toString(),
          reputation,
          stats: {
            positions: user._count.positions,
            comments: user._count.comments,
            reactions: user._count.reactions,
          },
        }
      })
    )
    
    const result = {
      success: true,
      users: usersWithReputation,
      pagination: {
        total: totalCount,
        limit: filters.limit || 100,
        offset: filters.offset || 0,
        hasMore: (filters.offset || 0) + users.length < totalCount,
      },
    }
    
    const responseTime = Date.now() - startTime
    cacheMonitoring.recordHit(cacheKey, responseTime)
    
    return result
  } catch (error) {
    const responseTime = Date.now() - startTime
    cacheMonitoring.recordMiss(cacheKey, responseTime)
    
    logger.error('Error fetching cached registry:', error, 'getCachedRegistry')
    return {
      success: false,
      users: [],
      pagination: {
        total: 0,
        limit: filters.limit || 100,
        offset: filters.offset || 0,
        hasMore: false,
      },
    }
  }
}

/**
 * Get all prediction markets (shared)
 * Uses 'use cache' for build-time prerendering
 * Cache tag: 'markets:list' for granular invalidation
 * Cache life: 5 minutes (300 seconds)
 */
export async function getCachedMarkets() {
  'use cache'
  
  const cacheKey = 'markets:list'
  const startTime = Date.now()
  
  cacheTag(cacheKey)
  // Cache life: 5 minutes
  cacheLife({ expire: 300 })
  
  try {
    const markets = await gameService.getAllGames()
    
    const result = {
      success: true,
      markets,
      count: markets.length,
    }
    
    const responseTime = Date.now() - startTime
    cacheMonitoring.recordHit(cacheKey, responseTime)
    
    return result
  } catch (error) {
    const responseTime = Date.now() - startTime
    cacheMonitoring.recordMiss(cacheKey, responseTime)
    
    logger.error('Error fetching cached markets:', error, 'getCachedMarkets')
    return {
      success: false,
      markets: [],
      count: 0,
    }
  }
}

/**
 * Get actor information (shared, but dynamic per actor)
 * Uses 'use cache: remote' for dynamic context caching
 * Cache tag: 'actors' for granular invalidation
 * Cache life: 5 minutes (300 seconds) - actor info changes infrequently
 */
export async function getCachedActor(actorId: string) {
  'use cache: remote'
  
  const cacheKey = `actors:${actorId}`
  const startTime = Date.now()
  
  cacheTag('actors', `actor:${actorId}`)
  // Cache life: 5 minutes - actor info changes infrequently
  cacheLife({ expire: 300 })
  
  try {
    const actor = await prisma.actor.findUnique({
      where: { id: actorId },
      select: {
        id: true,
        name: true,
        description: true,
        domain: true,
        personality: true,
        tier: true,
        role: true,
        initialMood: true,
        initialLuck: true,
        postStyle: true,
      },
    })
    
    if (!actor) {
      return {
        success: false,
        actor: null,
      }
    }
    
    const result = {
      success: true,
      actor: {
        id: actor.id,
        name: actor.name,
        description: actor.description,
        domain: actor.domain,
        personality: actor.personality,
        tier: actor.tier,
        role: actor.role,
        mood: actor.initialMood,
        luck: actor.initialLuck,
        postStyle: actor.postStyle,
      },
    }
    
    const responseTime = Date.now() - startTime
    cacheMonitoring.recordHit(cacheKey, responseTime)
    
    return result
  } catch (error) {
    const responseTime = Date.now() - startTime
    cacheMonitoring.recordMiss(cacheKey, responseTime)
    
    logger.error('Error fetching cached actor:', error, 'getCachedActor')
    return {
      success: false,
      actor: null,
    }
  }
}

/**
 * Get all prediction market chats (shared)
 * Uses 'use cache: remote' for dynamic context caching
 * Cache tag: 'chats:markets' for granular invalidation
 * Cache life: 1 minute (60 seconds) - chat lists change frequently
 */
export async function getCachedMarketChats() {
  'use cache: remote'
  
  const cacheKey = 'chats:markets'
  const startTime = Date.now()
  
  cacheTag(cacheKey)
  // Cache life: 1 minute - chat lists change frequently
  cacheLife({ expire: 60 })
  
  try {
    const marketChats = await prisma.chat.findMany({
      where: {
        isGroup: true,
        gameId: 'continuous',
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })
    
    const result = {
      success: true,
      chats: marketChats.map(chat => ({
        id: chat.id,
        name: chat.name,
        isGroup: chat.isGroup,
        messageCount: chat._count.messages,
        lastMessage: chat.messages[0] || null,
      })),
    }
    
    const responseTime = Date.now() - startTime
    cacheMonitoring.recordHit(cacheKey, responseTime)
    
    return result
  } catch (error) {
    const responseTime = Date.now() - startTime
    cacheMonitoring.recordMiss(cacheKey, responseTime)
    
    logger.error('Error fetching cached market chats:', error, 'getCachedMarketChats')
    return {
      success: false,
      chats: [],
    }
  }
}

