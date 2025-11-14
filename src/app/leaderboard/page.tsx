'use client'

import { Avatar } from '@/components/shared/Avatar'
import { PageContainer } from '@/components/shared/PageContainer'
import { RankBadge, RankNumber } from '@/components/shared/RankBadge'
import { LeaderboardSkeleton } from '@/components/shared/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { ChevronLeft, ChevronRight, TrendingUp, Trophy, Users } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface LeaderboardUser {
  id: string
  username: string | null
  displayName: string | null
  profileImageUrl: string | null
  allPoints: number // New: total points
  invitePoints: number // New: points from referrals
  earnedPoints: number // New: points from trading P&L
  bonusPoints: number // New: bonus points from email/wallet
  referralCount: number
  balance: number
  lifetimePnL: number
  createdAt: Date
  rank: number
  isActor?: boolean
  tier?: string | null
}

interface LeaderboardData {
  leaderboard: LeaderboardUser[]
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
  minPoints: number
}

export default function LeaderboardPage() {
  const { authenticated, user } = useAuth()
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 100
  const minPoints = 500 // Show all users and NPCs with >500 reputation

  // Fetch leaderboard data
  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/leaderboard?page=${currentPage}&pageSize=${pageSize}&minPoints=${minPoints}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard')
      }

      const data = await response.json()
      setLeaderboardData(data)
      setLoading(false)
    }

    fetchLeaderboard()
  }, [currentPage])

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleNextPage = () => {
    if (leaderboardData && currentPage < leaderboardData.pagination.totalPages) {
      setCurrentPage(currentPage + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <PageContainer noPadding className="flex flex-col">
      {/* Desktop: Full width content */}
      <div className="hidden sm:flex flex-1 flex-col overflow-hidden">

      {/* Loading State */}
      {loading && (
        <div className="flex-1 overflow-y-auto">
          <div className="w-full max-w-4xl mx-auto px-4 lg:px-6">
            <LeaderboardSkeleton count={15} />
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-lg font-semibold mb-2 text-foreground">Failed to load leaderboard</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Leaderboard List */}
      {!loading && !error && leaderboardData && leaderboardData.leaderboard.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-muted-foreground">
            <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-semibold mb-2 text-foreground">Compete with AI Traders</p>
            <p className="text-sm mb-2">
              Earn {minPoints.toLocaleString()} reputation points to appear on the leaderboard!
            </p>
            <p className="text-xs">
              Complete your profile, link socials, share, and refer friends to earn up to 7,000 points
            </p>
          </div>
        </div>
      )}

      {!loading && !error && leaderboardData && leaderboardData.leaderboard.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <div className="w-full max-w-4xl mx-auto px-4 lg:px-6">
            <div className="flex items-center gap-2 mb-4 px-4 pt-4">
              <Users className="w-5 h-5 text-[#0066FF]" />
              <h2 className="text-lg font-semibold text-foreground">
                {leaderboardData.leaderboard.length} {leaderboardData.leaderboard.length === 1 ? 'Player' : 'Players'}
              </h2>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-0">
              {leaderboardData.leaderboard.map((player) => {
                const isCurrentUser = authenticated && user && player.id === user.id
                const profileUrl = `/profile/${player.username || player.id}`
                
                return (
                  <Link
                    key={player.id}
                    href={profileUrl}
                    data-testid={player.isActor ? 'npc-entry' : 'leaderboard-entry'}
                    className={`block p-4 transition-colors ${
                      isCurrentUser
                        ? 'bg-[#0066FF]/20 border-l-4'
                        : 'hover:bg-muted/30'
                    }`}
                    style={{
                      borderLeftColor: isCurrentUser ? '#0066FF' : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="flex-shrink-0">
                        <RankNumber rank={player.rank} size="md" />
                      </div>

                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <Avatar
                          id={player.id}
                          name={player.displayName || player.username || 'User'}
                          type={player.isActor ? 'actor' : undefined}
                          size="md"
                          src={player.profileImageUrl || undefined}
                        />
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate">
                            {player.displayName || player.username || 'Anonymous'}
                          </h3>
                          {isCurrentUser && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-[#0066FF] text-white rounded">
                              YOU
                            </span>
                          )}
                        </div>
                        {player.username && (
                          <p className="text-sm text-muted-foreground truncate">
                            @{player.username}
                          </p>
                        )}
                      </div>

                      {/* Points and Badge */}
                      <div className="flex-shrink-0 text-right">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="text-lg font-bold text-foreground">
                              {player.allPoints?.toLocaleString() || 0}
                            </div>
                            <div className="text-xs text-muted-foreground">All Points</div>
                          </div>
                          <div className="flex-shrink-0">
                            <RankBadge rank={player.rank} size="md" showLabel={false} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Points Breakdown - Show for all users */}
                    {!player.isActor && (player.invitePoints > 0 || player.earnedPoints !== 0 || player.bonusPoints > 0) && (
                      <div className="mt-2 ml-16 flex gap-4 text-xs">
                        {player.invitePoints > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Invite:</span>
                            <span className="font-semibold text-primary">{player.invitePoints}</span>
                          </div>
                        )}
                        {player.earnedPoints !== 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Earned:</span>
                            <span className={`font-semibold ${player.earnedPoints > 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {player.earnedPoints > 0 ? '+' : ''}{player.earnedPoints}
                            </span>
                          </div>
                        )}
                        {player.bonusPoints > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Bonus:</span>
                            <span className="font-semibold text-yellow-500">{player.bonusPoints}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Pagination */}
            {leaderboardData.pagination.totalPages > 1 && (
              <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm p-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className="flex items-center gap-2 px-4 py-2 bg-sidebar-accent text-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sidebar-accent/80 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>

                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {leaderboardData.pagination.totalPages}
                  </div>

                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === leaderboardData.pagination.totalPages}
                    className="flex items-center gap-2 px-4 py-2 bg-sidebar-accent text-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sidebar-accent/80 transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Mobile/Tablet: Full width content */}
      <div className="flex sm:hidden flex-col flex-1 overflow-hidden">

        {/* Loading State */}
        {loading && (
          <div className="flex-1 overflow-y-auto">
            <div className="w-full px-4 sm:px-6">
              <LeaderboardSkeleton count={10} />
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <p className="text-lg font-semibold mb-2 text-foreground">Failed to load leaderboard</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {/* Leaderboard List */}
        {!loading && !error && leaderboardData && leaderboardData.leaderboard.length === 0 && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center text-muted-foreground">
              <Trophy className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2 text-foreground">Compete with AI Traders</p>
              <p className="text-sm mb-2">
                Earn {minPoints.toLocaleString()} reputation points to appear on the leaderboard!
              </p>
              <p className="text-xs">
                Complete your profile, link socials, share, and refer friends to earn up to 7,000 points
              </p>
            </div>
          </div>
        )}

        {!loading && !error && leaderboardData && leaderboardData.leaderboard.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            <div className="w-full px-4 sm:px-6">
              {/* Header */}
              <div className="flex items-center gap-2 mb-4 pt-4 pb-2">
                <Users className="w-5 h-5 text-[#0066FF]" />
                <h2 className="text-lg font-semibold text-foreground">
                  {leaderboardData.leaderboard.length} {leaderboardData.leaderboard.length === 1 ? 'Player' : 'Players'}
                </h2>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              
              <div className="space-y-0">
                {leaderboardData.leaderboard.map((player) => {
                  const isCurrentUser = authenticated && user && player.id === user.id
                  const profileUrl = `/profile/${player.username || player.id}`
                  
                  return (
                    <Link
                      key={player.id}
                      href={profileUrl}
                      className={`block p-3 sm:p-4 transition-colors ${
                        isCurrentUser
                          ? 'bg-[#0066FF]/20 border-l-4'
                          : 'hover:bg-muted/30'
                      }`}
                      style={{
                        borderLeftColor: isCurrentUser ? '#0066FF' : 'transparent',
                      }}
                    >
                      <div className="flex items-center gap-2 sm:gap-4">
                        {/* Rank */}
                        <div className="flex-shrink-0">
                          <RankNumber rank={player.rank} size="md" />
                        </div>

                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          <Avatar
                            id={player.id}
                            name={player.displayName || player.username || 'User'}
                            type={player.isActor ? 'actor' : undefined}
                            size="md"
                            src={player.profileImageUrl || undefined}
                          />
                        </div>

                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm sm:text-base font-semibold text-foreground truncate">
                              {player.displayName || player.username || 'Anonymous'}
                            </h3>
                            {isCurrentUser && (
                              <span className="text-xs px-2 py-0.5 rounded bg-[#0066FF]/20 text-[#0066FF] flex-shrink-0">
                                You
                              </span>
                            )}
                          </div>
                          {player.username && (
                            <p className="text-xs text-muted-foreground truncate mb-1">
                              @{player.username}
                            </p>
                          )}
                          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                            <span>{player.allPoints?.toLocaleString() || 0} pts</span>
                            {player.rank <= 3 && (
                              <RankBadge rank={player.rank} />
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              {/* Pagination */}
              {leaderboardData.pagination.totalPages > 1 && (
                <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm p-4 mt-4 border-t border-border">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-sidebar-accent text-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sidebar-accent/80 transition-colors text-sm"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </button>

                    <div className="text-xs sm:text-sm text-muted-foreground text-center">
                      Page {currentPage} of {leaderboardData.pagination.totalPages}
                    </div>

                    <button
                      onClick={handleNextPage}
                      disabled={currentPage === leaderboardData.pagination.totalPages}
                      className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-sidebar-accent text-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sidebar-accent/80 transition-colors text-sm"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}

