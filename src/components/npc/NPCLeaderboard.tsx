/**
 * NPCLeaderboard Component
 *
 * Displays ranked list of top-performing NPC actors by portfolio performance
 * Shows rank, portfolio value, ROI, unrealized PnL, and position metrics
 *
 * Pattern based on: ReputationLeaderboard.tsx
 */

'use client'

import { useEffect, useState } from 'react'
import { Trophy, TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PerformanceMetrics {
  totalValue: number
  roi: number
  unrealizedPnL: number
  positionCount: number
  utilization: number
}

interface LeaderboardEntry {
  rank: number
  actorId: string
  actorName: string
  personality: string | null
  profileImageUrl: string | null
  poolId: string
  performance: PerformanceMetrics
}

interface LeaderboardData {
  success: boolean
  leaderboard: LeaderboardEntry[]
  metadata: {
    count: number
    limit: number
    minValue: number
  }
}

interface NPCLeaderboardProps {
  limit?: number
  minValue?: number
  className?: string
}

export function NPCLeaderboard({
  limit = 50,
  minValue = 0,
  className = '',
}: NPCLeaderboardProps) {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true)
      try {
        const response = await fetch(
          `/api/npc/performance/leaderboard?limit=${limit}&minValue=${minValue}`
        )
        const result = await response.json()

        if (result.success) {
          setData(result)
        }
      } catch (error) {
        console.error('Failed to fetch NPC leaderboard:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()

    // Refresh every 30 seconds
    const interval = setInterval(fetchLeaderboard, 30000)
    return () => clearInterval(interval)
  }, [limit, minValue])

  if (loading) {
    return (
      <div className={cn('bg-sidebar rounded-lg p-4', className)}>
        <div className="text-sm text-muted-foreground">Loading leaderboard...</div>
      </div>
    )
  }

  if (!data || data.leaderboard.length === 0) {
    return (
      <div className={cn('bg-sidebar rounded-lg p-4', className)}>
        <div className="text-sm text-muted-foreground">No leaderboard data available</div>
      </div>
    )
  }

  const getRankMedalColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-500'
    if (rank === 2) return 'text-gray-400'
    if (rank === 3) return 'text-orange-600'
    return 'text-muted-foreground'
  }

  return (
    <div className={cn('bg-sidebar rounded-lg p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          NPC Performance Leaderboard
        </h3>
        <div className="text-xs text-muted-foreground">
          Top {data.metadata.count} NPCs
        </div>
      </div>

      {/* Leaderboard Entries */}
      <div className="space-y-2">
        {data.leaderboard.map((entry) => (
          <div
            key={entry.actorId}
            className={cn(
              'bg-muted/30 rounded-lg p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors',
              entry.rank <= 3 && 'border border-border/50'
            )}
          >
            {/* Rank */}
            <div className="flex-shrink-0 w-8 text-center">
              {entry.rank <= 3 ? (
                <Trophy className={cn('w-6 h-6', getRankMedalColor(entry.rank))} />
              ) : (
                <span className="text-sm font-bold text-muted-foreground">#{entry.rank}</span>
              )}
            </div>

            {/* Profile Image */}
            <div className="flex-shrink-0">
              {entry.profileImageUrl ? (
                <img
                  src={entry.profileImageUrl}
                  alt={entry.actorName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xs font-bold text-muted-foreground">
                    {entry.actorName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Actor Info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-foreground truncate">
                {entry.actorName}
              </div>
              {entry.personality && (
                <div className="text-xs text-muted-foreground truncate">
                  {entry.personality}
                </div>
              )}
            </div>

            {/* Performance Stats */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Portfolio Value */}
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm font-bold text-foreground">
                  <DollarSign className="w-3 h-3" />
                  {entry.performance.totalValue.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Value</div>
              </div>

              {/* ROI */}
              <div className="text-right hidden sm:block">
                <div className={cn(
                  'flex items-center gap-1 text-sm font-medium',
                  entry.performance.roi >= 0 ? 'text-green-500' : 'text-red-500'
                )}>
                  {entry.performance.roi >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {entry.performance.roi >= 0 ? '+' : ''}
                  {entry.performance.roi.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">ROI</div>
              </div>

              {/* Unrealized PnL */}
              <div className="text-right hidden md:block">
                <div className={cn(
                  'text-sm font-medium',
                  entry.performance.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
                )}>
                  {entry.performance.unrealizedPnL >= 0 ? '+' : ''}
                  ${Math.abs(entry.performance.unrealizedPnL).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Unrealized</div>
              </div>

              {/* Positions */}
              <div className="text-right hidden lg:block">
                <div className="flex items-center gap-1 text-sm font-medium text-blue-500">
                  <Activity className="w-3 h-3" />
                  {entry.performance.positionCount}
                </div>
                <div className="text-xs text-muted-foreground">Positions</div>
              </div>

              {/* Utilization */}
              <div className="text-right hidden xl:block">
                <div className="text-sm font-medium text-foreground">
                  {entry.performance.utilization.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Utilization</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {data.leaderboard.length === data.metadata.limit && (
        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
          Showing top {data.metadata.limit} NPCs. Minimum portfolio value: ${data.metadata.minValue.toLocaleString()}
        </div>
      )}
    </div>
  )
}
