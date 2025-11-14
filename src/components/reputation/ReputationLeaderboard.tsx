/**
 * ReputationLeaderboard Component
 *
 * Displays ranked list of top-performing agents by reputation score
 * Shows rank, profile, reputation points, trust level, and performance metrics
 *
 */

'use client'

import { useEffect, useState } from 'react'
import { Trophy, TrendingUp, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeaderboardEntry {
  userId: string
  username: string
  displayName: string | null
  profileImageUrl: string | null
  reputationPoints: number
  trustLevel: string
  rank: number
  performance: {
    gamesPlayed: number
    gamesWon: number
    winRate: number
    averageGameScore: number
  }
  averageFeedbackScore: number
  totalFeedbackReceived: number
}

interface LeaderboardData {
  success: boolean
  leaderboard: LeaderboardEntry[]
  metadata: {
    count: number
    limit: number
    minGames: number
  }
}

interface ReputationLeaderboardProps {
  limit?: number
  minGames?: number
  className?: string
}

export function ReputationLeaderboard({
  limit = 50,
  minGames = 5,
  className = '',
}: ReputationLeaderboardProps) {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true)
      const response = await fetch(
        `/api/reputation/leaderboard?limit=${limit}&minGames=${minGames}`
      )
      const result = await response.json()

      if (result.success) {
        setData(result)
      }
      setLoading(false)
    }

    fetchLeaderboard()
  }, [limit, minGames])

  if (loading) {
    return (
      <div className={cn('bg-sidebar rounded-2xl p-4', className)}>
        <div className="text-sm text-muted-foreground">Loading leaderboard...</div>
      </div>
    )
  }

  if (!data || data.leaderboard.length === 0) {
    return (
      <div className={cn('bg-sidebar rounded-2xl p-4', className)}>
        <div className="text-sm text-muted-foreground">No leaderboard data available</div>
      </div>
    )
  }

  const getTrustLevelColor = (trustLevel: string) => {
    switch (trustLevel.toLowerCase()) {
      case 'elite':
        return 'text-purple-500'
      case 'veteran':
        return 'text-blue-500'
      case 'trusted':
        return 'text-green-500'
      default:
        return 'text-gray-500'
    }
  }

  const getRankMedalColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-500'
    if (rank === 2) return 'text-gray-400'
    if (rank === 3) return 'text-orange-600'
    return 'text-muted-foreground'
  }

  return (
    <div className={cn('bg-sidebar rounded-2xl p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Reputation Leaderboard
        </h3>
        <div className="text-xs text-muted-foreground">
          Top {data.metadata.count} (min {data.metadata.minGames} games)
        </div>
      </div>

      {/* Leaderboard Entries */}
      <div className="space-y-2">
        {data.leaderboard.map((entry) => (
          <div
            key={entry.userId}
            className={cn(
              'bg-muted/30 rounded-lg p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors',
              entry.rank <= 3 && 'border border-border/50'
            )}
          >
            {/* Rank */}
            <div className="shrink-0 w-8 text-center">
              {entry.rank <= 3 ? (
                <Trophy className={cn('w-6 h-6', getRankMedalColor(entry.rank))} />
              ) : (
                <span className="text-sm font-bold text-muted-foreground">#{entry.rank}</span>
              )}
            </div>

            {/* Profile Image */}
            <div className="shrink-0">
              {entry.profileImageUrl ? (
                <img
                  src={entry.profileImageUrl}
                  alt={entry.displayName || entry.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xs font-bold text-muted-foreground">
                    {(entry.displayName || entry.username).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium text-foreground truncate">
                  {entry.displayName || entry.username}
                </div>
                <div className={cn('text-xs font-medium capitalize', getTrustLevelColor(entry.trustLevel))}>
                  {entry.trustLevel}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                @{entry.username}
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 shrink-0">
              {/* Reputation Points */}
              <div className="text-center">
                <div className="text-lg font-bold text-foreground">
                  {entry.reputationPoints.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Points</div>
              </div>

              {/* Win Rate */}
              <div className="text-center hidden sm:block">
                <div className="flex items-center gap-1 text-sm font-medium text-green-500">
                  <TrendingUp className="w-3 h-3" />
                  {(entry.performance.winRate * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Win Rate</div>
              </div>

              {/* Feedback Score */}
              <div className="text-center hidden md:block">
                <div className="flex items-center gap-1 text-sm font-medium text-blue-500">
                  <Target className="w-3 h-3" />
                  {entry.averageFeedbackScore.toFixed(0)}
                </div>
                <div className="text-xs text-muted-foreground">Feedback</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {data.leaderboard.length === data.metadata.limit && (
        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
          Showing top {data.metadata.limit} agents. Minimum {data.metadata.minGames} games required.
        </div>
      )}
    </div>
  )
}
