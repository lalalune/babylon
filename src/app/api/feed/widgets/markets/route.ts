/**
 * Markets Widget API
 *
 * GET /api/feed/widgets/markets - Get trending prediction markets for sidebar widget
 */

import type { NextRequest } from 'next/server'
import db from '@/lib/database-service'
import { optionalAuth, type AuthenticatedUser } from '@/lib/api/auth-middleware'
import { asUser, asPublic } from '@/lib/db/context'
import { NextResponse } from 'next/server'
import { getCacheOrFetch, CACHE_KEYS, DEFAULT_TTLS } from '@/lib/cache-service'
import { logger } from '@/lib/logger'

// Cache config (60 seconds)
export const revalidate = 60;

export async function GET(request: NextRequest) {
  try {
    // Optional auth - markets are public but RLS still applies
    const authUser: AuthenticatedUser | null = await optionalAuth(request).catch(() => null)

    // For unauthenticated users, use cached widget data
    if (!authUser || !authUser.userId) {
      const formattedMarkets = await getCacheOrFetch(
        'markets-widget-v2', // v2 to invalidate old cache without price changes
        async () => {
          const questions = await db().getActiveQuestions()

          if (questions.length === 0) {
            return []
          }

          const marketIds = questions.map(q => String(q.id))
          const markets = await asPublic(async (dbPrisma) => {
            return await dbPrisma.market.findMany({
              where: {
                id: { in: marketIds },
              },
              orderBy: {
                createdAt: 'desc',
              },
            })
          })

          const marketMap = new Map(markets.map(m => [m.id, m]))

          // Get recent positions to calculate price changes
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
          const recentPositions = await asPublic(async (dbPrisma) => {
            return await dbPrisma.position.findMany({
              where: {
                marketId: { in: marketIds },
                createdAt: {
                  gte: twentyFourHoursAgo,
                },
              },
              orderBy: {
                createdAt: 'asc',
              },
            })
          })

          // Calculate price changes based on position activity
          const priceChangeMap = new Map<string, number>()
          
          for (const marketId of marketIds) {
            const marketPositions = recentPositions.filter(p => p.marketId === marketId)
            if (marketPositions.length > 0) {
              // Calculate initial and final prices from positions
              const market = marketMap.get(marketId)
              if (market) {
                const currentYesShares = Number(market.yesShares)
                const currentNoShares = Number(market.noShares)
                const currentTotal = currentYesShares + currentNoShares
                
                if (currentTotal > 0) {
                  // Estimate 24h ago price by subtracting recent position changes
                  let pastYesShares = currentYesShares
                  let pastNoShares = currentNoShares
                  
                  marketPositions.forEach(pos => {
                    const shares = Number(pos.shares)
                    if (pos.side) {
                      pastYesShares -= shares
                    } else {
                      pastNoShares -= shares
                    }
                  })
                  
                  const pastTotal = pastYesShares + pastNoShares
                  if (pastTotal > 0) {
                    const pastYesPrice = pastYesShares / pastTotal
                    const currentYesPrice = currentYesShares / currentTotal
                    const priceChange = currentYesPrice - pastYesPrice
                    const changePercent = pastYesPrice > 0 ? (priceChange / pastYesPrice) * 100 : 0
                    
                    priceChangeMap.set(marketId, changePercent)
                  }
                }
              }
            }
          }

          return questions
            // Don't filter out questions without markets - show all active questions
            .filter(q => q.status === 'active')
            .map(q => {
              const market = marketMap.get(String(q.id))
              const yesShares = market ? Number(market.yesShares) : 0
              const noShares = market ? Number(market.noShares) : 0
              const totalShares = yesShares + noShares

              const yesPrice = totalShares > 0 ? yesShares / totalShares : 0.5
              const noPrice = totalShares > 0 ? noShares / totalShares : 0.5
              const changePercent24h = priceChangeMap.get(String(q.id))

              return {
                id: String(q.id),
                question: q.text,
                yesPrice,
                noPrice,
                volume: totalShares,
                endDate: q.resolutionDate,
                changePercent24h: changePercent24h !== undefined ? changePercent24h : undefined,
              }
            })
            .sort((a, b) => {
              const aTime = a.endDate ? new Date(a.endDate).getTime() : Date.now()
              const bTime = b.endDate ? new Date(b.endDate).getTime() : Date.now()
              const now = Date.now()

              const aRecency = Math.max(0, 1 - (aTime - now) / (30 * 24 * 60 * 60 * 1000))
              const bRecency = Math.max(0, 1 - (bTime - now) / (30 * 24 * 60 * 60 * 1000))

              const aScore = (a.volume * 0.7) + (aRecency * 1000 * 0.3)
              const bScore = (b.volume * 0.7) + (bRecency * 1000 * 0.3)

              return bScore - aScore
            })
            .slice(0, 10) // Get top 10 instead of 5 to have more for top movers
        },
        {
          namespace: CACHE_KEYS.WIDGET,
          ttl: DEFAULT_TTLS.WIDGET,
        }
      )

      return NextResponse.json({
        success: true,
        markets: formattedMarkets,
      })
    }

    // For authenticated users, bypass cache (user-specific data)
    const questions = await db().getActiveQuestions()

    if (questions.length === 0) {
      return NextResponse.json({
        success: true,
        markets: [],
      })
    }

    const marketIds = questions.map(q => String(q.id))
    const markets = await asUser(authUser, async (dbPrisma) => {
      return await dbPrisma.market.findMany({
        where: {
          id: { in: marketIds },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    })

    const marketMap = new Map(markets.map(m => [m.id, m]))

    // Get recent positions to calculate price changes
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentPositions = await asUser(authUser, async (dbPrisma) => {
      return await dbPrisma.position.findMany({
        where: {
          marketId: { in: marketIds },
          createdAt: {
            gte: twentyFourHoursAgo,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      })
    })

    // Calculate price changes based on position activity
    const priceChangeMap = new Map<string, number>()
    
    for (const marketId of marketIds) {
      const marketPositions = recentPositions.filter(p => p.marketId === marketId)
      if (marketPositions.length > 0) {
        // Calculate initial and final prices from positions
        const market = marketMap.get(marketId)
        if (market) {
          const currentYesShares = Number(market.yesShares)
          const currentNoShares = Number(market.noShares)
          const currentTotal = currentYesShares + currentNoShares
          
          if (currentTotal > 0) {
            // Estimate 24h ago price by subtracting recent position changes
            let pastYesShares = currentYesShares
            let pastNoShares = currentNoShares
            
            marketPositions.forEach(pos => {
              const shares = Number(pos.shares)
              if (pos.side) {
                pastYesShares -= shares
              } else {
                pastNoShares -= shares
              }
            })
            
            const pastTotal = pastYesShares + pastNoShares
            if (pastTotal > 0) {
              const pastYesPrice = pastYesShares / pastTotal
              const currentYesPrice = currentYesShares / currentTotal
              const priceChange = currentYesPrice - pastYesPrice
              const changePercent = pastYesPrice > 0 ? (priceChange / pastYesPrice) * 100 : 0
              
              priceChangeMap.set(marketId, changePercent)
            }
          }
        }
      }
    }

    const formattedMarkets = questions
      // Don't filter out questions without markets - show all active questions
      .filter(q => q.status === 'active')
      .map(q => {
        const market = marketMap.get(String(q.id))
        const yesShares = market ? Number(market.yesShares) : 0
        const noShares = market ? Number(market.noShares) : 0
        const totalShares = yesShares + noShares

        const yesPrice = totalShares > 0 ? yesShares / totalShares : 0.5
        const noPrice = totalShares > 0 ? noShares / totalShares : 0.5
        const changePercent24h = priceChangeMap.get(String(q.id))

        return {
          id: String(q.id),
          question: q.text,
          yesPrice,
          noPrice,
          volume: totalShares,
          endDate: q.resolutionDate,
          changePercent24h: changePercent24h !== undefined ? changePercent24h : undefined,
        }
      })
      .sort((a, b) => {
        const aTime = a.endDate ? new Date(a.endDate).getTime() : Date.now()
        const bTime = b.endDate ? new Date(b.endDate).getTime() : Date.now()
        const now = Date.now()

        const aRecency = Math.max(0, 1 - (aTime - now) / (30 * 24 * 60 * 60 * 1000))
        const bRecency = Math.max(0, 1 - (bTime - now) / (30 * 24 * 60 * 60 * 1000))

        const aScore = (a.volume * 0.7) + (aRecency * 1000 * 0.3)
        const bScore = (b.volume * 0.7) + (bRecency * 1000 * 0.3)

        return bScore - aScore
      })
      .slice(0, 10) // Get top 10 instead of 5 to have more for top movers

    return NextResponse.json({
      success: true,
      markets: formattedMarkets,
    })
  } catch (error) {
    logger.error(
      'Error fetching markets widget',
      { error: error instanceof Error ? error.message : String(error) },
      'GET /api/feed/widgets/markets'
    )
    
    // Always return a valid JSON response, even on error
    return NextResponse.json(
      {
        success: false,
        markets: [],
        error: 'Failed to fetch markets',
      },
      { status: 500 }
    )
  }
}
