/**
 * Markets Widget API
 *
 * GET /api/feed/widgets/markets - Get trending prediction markets for sidebar widget
 */

import type { NextRequest } from 'next/server'
import { db } from '@/lib/database-service'
import { optionalAuth, type AuthenticatedUser } from '@/lib/api/auth-middleware'
import { asUser, asPublic } from '@/lib/db/context'
import { NextResponse } from 'next/server'
import { getCacheOrFetch, CACHE_KEYS, DEFAULT_TTLS } from '@/lib/cache-service'

export async function GET(request: NextRequest) {
  // Optional auth - markets are public but RLS still applies
  const authUser: AuthenticatedUser | null = await optionalAuth(request).catch(() => null)

  // For unauthenticated users, use cached widget data
  if (!authUser || !authUser.userId) {
    const formattedMarkets = await getCacheOrFetch(
      'markets-widget',
      async () => {
        const questions = await db.getActiveQuestions()

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

            return {
              id: String(q.id),
              question: q.text,
              yesPrice,
              noPrice,
              volume: totalShares,
              endDate: q.resolutionDate,
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
          .slice(0, 5)
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
  const questions = await db.getActiveQuestions()

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

      return {
        id: String(q.id),
        question: q.text,
        yesPrice,
        noPrice,
        volume: totalShares,
        endDate: q.resolutionDate,
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
    .slice(0, 5)

  return NextResponse.json({
    success: true,
    markets: formattedMarkets,
  })
}
