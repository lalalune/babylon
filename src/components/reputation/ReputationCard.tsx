/**
 * ReputationCard Component
 *
 * Displays comprehensive reputation information for a user
 * - Overall reputation score and trust level
 * - Feedback statistics
 * - Performance metrics
 * - Trade and game statistics
 *
 * Pattern based on: ProfileWidget.tsx
 */

'use client'

import { useEffect, useState } from 'react'
import { Trophy, TrendingUp, TrendingDown, Star, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWidgetCacheStore } from '@/stores/widgetCacheStore'
import { ReputationBadge, ReputationScore } from './ReputationBadge'
import { TrustLevelBadge } from './TrustLevelBadge'

interface ReputationData {
  reputationPoints: number
  averageFeedbackScore: number // 0-100
  totalFeedbackReceived: number
  gamesPlayed: number
  gamesWon: number
  averageGameScore: number // 0-100
  winRate: number // 0-100
  recentTrend: number // percentage change
  trustLevel: 'newcomer' | 'trusted' | 'veteran' | 'elite'
  rank: number | null
  totalUsers: number
}

interface ReputationCardProps {
  userId: string
  className?: string
}

export function ReputationCard({ userId, className = '' }: ReputationCardProps) {
  const [reputation, setReputation] = useState<ReputationData | null>(null)
  const [loading, setLoading] = useState(true)
  const widgetCache = useWidgetCacheStore()

  useEffect(() => {
    if (!userId) return

    const fetchReputationData = async (skipCache = false) => {
      // Check cache first
      if (!skipCache) {
        const cached = widgetCache.getReputationWidget(userId) as ReputationData | null
        if (cached) {
          setReputation(cached)
          setLoading(false)
          return
        }
      }

      setLoading(true)

      try {
        // Fetch reputation data from API
        const response = await fetch(`/api/reputation/${encodeURIComponent(userId)}`)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        if (data.success) {
          const reputationData: ReputationData = {
            reputationPoints: data.reputationPoints || 1000,
            averageFeedbackScore: data.averageFeedbackScore || 0,
            totalFeedbackReceived: data.totalFeedbackReceived || 0,
            gamesPlayed: data.performance?.gamesPlayed || 0,
            gamesWon: data.performance?.gamesWon || 0,
            averageGameScore: data.performance?.averageGameScore || 0,
            winRate: data.performance?.winRate || 0,
            recentTrend: data.recentTrend || 0,
            trustLevel: data.trustLevel || 'newcomer',
            rank: data.rank || null,
            totalUsers: data.totalUsers || 0,
          }

          setReputation(reputationData)

          // Cache the result
          widgetCache.setReputationWidget(userId, reputationData)
        }
      } catch (error) {
        console.error('Failed to fetch reputation data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReputationData()

    // Refresh every 60 seconds
    const interval = setInterval(() => fetchReputationData(true), 60000)
    return () => clearInterval(interval)
  }, [userId, widgetCache])

  if (loading) {
    return (
      <div className={cn('bg-sidebar rounded-lg p-4', className)}>
        <div className="text-sm text-muted-foreground">Loading reputation...</div>
      </div>
    )
  }

  if (!reputation) {
    return (
      <div className={cn('bg-sidebar rounded-lg p-4', className)}>
        <div className="text-sm text-muted-foreground">
          Reputation data unavailable
        </div>
      </div>
    )
  }

  const starRating = Math.round((reputation.averageFeedbackScore / 100) * 5 * 10) / 10

  return (
    <div data-testid="reputation-card" className={cn('bg-sidebar rounded-lg p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#0066FF]" />
          Reputation
        </h2>
        {reputation.rank && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Trophy className="w-3 h-3" />
            <span>
              #{reputation.rank} of {reputation.totalUsers.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Trust Level Badge with Progress */}
      <TrustLevelBadge
        reputationPoints={reputation.reputationPoints}
        size="md"
        showProgress={true}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Reputation Points */}
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Reputation</div>
          <ReputationScore
            reputationPoints={reputation.reputationPoints}
            size="sm"
            showChange={true}
            change={Math.round((reputation.reputationPoints * reputation.recentTrend) / 100)}
          />
        </div>

        {/* Average Feedback */}
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Avg Rating</div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
            <span className="text-lg font-bold text-foreground">
              {starRating.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">/5</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {reputation.totalFeedbackReceived} review{reputation.totalFeedbackReceived !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Games Won */}
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Games Won</div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">
              {reputation.gamesWon}
            </span>
            <span className="text-xs text-muted-foreground">
              / {reputation.gamesPlayed}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {reputation.winRate.toFixed(0)}% win rate
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Avg Score</div>
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-foreground">
              {reputation.averageGameScore.toFixed(0)}
            </span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
          {reputation.averageGameScore >= 70 ? (
            <div className="flex items-center gap-1 text-xs text-green-500 mt-0.5">
              <TrendingUp className="w-3 h-3" />
              <span>Excellent</span>
            </div>
          ) : reputation.averageGameScore >= 50 ? (
            <div className="text-xs text-blue-500 mt-0.5">Good</div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-yellow-500 mt-0.5">
              <TrendingDown className="w-3 h-3" />
              <span>Keep trying!</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent Trend Indicator */}
      {reputation.recentTrend !== 0 && (
        <div
          className={cn(
            'flex items-center gap-2 text-sm font-medium p-2 rounded-lg',
            reputation.recentTrend > 0
              ? 'bg-green-500/10 text-green-500'
              : 'bg-red-500/10 text-red-500'
          )}
        >
          {reputation.recentTrend > 0 ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          <span>
            {reputation.recentTrend > 0 ? '+' : ''}
            {reputation.recentTrend.toFixed(1)}% this week
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * ReputationCardMini Component
 *
 * Compact version for inline display
 */
interface ReputationCardMiniProps {
  userId: string
  className?: string
}

export function ReputationCardMini({ userId, className = '' }: ReputationCardMiniProps) {
  const [reputationPoints, setReputationPoints] = useState<number>(1000)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchReputation = async () => {
      try {
        const response = await fetch(`/api/reputation/${encodeURIComponent(userId)}`)
        const data = await response.json()

        if (data.success) {
          setReputationPoints(data.reputationPoints || 1000)
        }
      } catch (error) {
        console.error('Failed to fetch reputation:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReputation()
  }, [userId])

  if (loading) return null

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <ReputationBadge
        reputationPoints={reputationPoints}
        size="sm"
        showLabel={false}
      />
      <span className="text-sm font-medium text-foreground">
        {reputationPoints.toLocaleString()}
      </span>
    </div>
  )
}
