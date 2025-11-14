'use client'

import { useEffect, useState, useRef } from 'react'
import { Award, Users, TrendingUp, UserPlus, ArrowRight } from 'lucide-react'
import { Avatar } from '@/components/shared/Avatar'
import Link from 'next/link'
import { getProfileUrl } from '@/lib/profile-utils'
import { Skeleton } from '@/components/shared/Skeleton'

interface ReferredUser {
  id: string
  username: string | null
  displayName: string | null
  profileImageUrl: string | null
  createdAt: Date | string
  reputationPoints: number
  isFollowing: boolean
  joinedAt: Date | string | null
}

interface ReferralStats {
  totalReferrals: number
  totalPointsEarned: number
  pointsPerReferral: number
  followingCount: number
}

interface ReferralWidgetData {
  user: {
    id: string
    username: string | null
    displayName: string | null
    profileImageUrl: string | null
    referralCode: string | null
    reputationPoints: number
  }
  stats: ReferralStats
  referredUsers: ReferredUser[]
  referralUrl: string | null
}

interface RewardsWidgetProps {
  userId: string
}

// Global fetch tracking to prevent duplicate calls
let rewardsWidgetFetchInFlight = false
let rewardsWidgetIntervalId: ReturnType<typeof setInterval> | null = null

export function RewardsWidget({ userId }: RewardsWidgetProps) {
  const [data, setData] = useState<ReferralWidgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const lastFetchedUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) return

    // Don't refetch if userId hasn't changed
    if (lastFetchedUserIdRef.current === userId) {
      return
    }

    const fetchData = async () => {
      if (!userId) return

      // Prevent duplicate fetches globally
      if (rewardsWidgetFetchInFlight) return
      rewardsWidgetFetchInFlight = true

      setLoading(true)

      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      if (!token) {
        setLoading(false)
        rewardsWidgetFetchInFlight = false
        return
      }

      const response = await fetch(`/api/users/${encodeURIComponent(userId)}/referrals`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        setLoading(false)
        rewardsWidgetFetchInFlight = false
        throw new Error('Failed to fetch referral data')
      }

      const result = await response.json()
      setData(result)
      setLoading(false)
      lastFetchedUserIdRef.current = userId
      rewardsWidgetFetchInFlight = false
    }

    // Clear any existing interval
    if (rewardsWidgetIntervalId) {
      clearInterval(rewardsWidgetIntervalId)
      rewardsWidgetIntervalId = null
    }

    fetchData()

    // Refresh every 30 seconds
    rewardsWidgetIntervalId = setInterval(fetchData, 30000)
    
    return () => {
      if (rewardsWidgetIntervalId) {
        clearInterval(rewardsWidgetIntervalId)
        rewardsWidgetIntervalId = null
      }
    }
  }, [userId])

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4 bg-sidebar-accent/30 rounded-2xl border border-border">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-[#0066FF]" />
          <h3 className="font-semibold text-foreground">Rewards</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="space-y-3 w-full">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4 p-4 bg-sidebar-accent/30 rounded-2xl border border-border">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-[#0066FF]" />
          <h3 className="font-semibold text-foreground">Rewards</h3>
        </div>
        <p className="text-sm text-muted-foreground">Unable to load rewards data</p>
      </div>
    )
  }

  // Get recent referrals (last 5)
  const recentReferrals = data.referredUsers.slice(0, 5)

  return (
    <div className="flex flex-col gap-4">
      {/* Stats Summary */}
      <div className="flex flex-col gap-3 p-4 bg-sidebar-accent/30 rounded-2xl border border-border">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-[#0066FF]" />
          <h3 className="font-semibold text-foreground">Rewards</h3>
        </div>

        {/* Total Referrals */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total</span>
          </div>
          <span className="text-lg font-bold text-foreground">{data.stats.totalReferrals}</span>
        </div>

        {/* Points Earned */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-muted-foreground">Points Earned</span>
          </div>
          <span className="text-lg font-bold text-yellow-500">
            {data.stats.totalPointsEarned.toLocaleString()}
          </span>
        </div>

        {/* Following */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#0066FF]" />
            <span className="text-sm text-muted-foreground">Following</span>
          </div>
          <span className="text-lg font-bold text-[#0066FF]">{data.stats.followingCount}</span>
        </div>
      </div>

      {/* Recent Referrals */}
      <div className="flex flex-col gap-3 p-4 bg-sidebar-accent/30 rounded-2xl border border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">Recent Referrals</h3>
          {data.stats.totalReferrals > 5 && (
            <Link
              href="/rewards"
              className="text-xs text-[#0066FF] hover:text-[#2952d9] transition-colors flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {recentReferrals.length === 0 ? (
          <div className="text-center py-6">
            <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-xs text-muted-foreground">No referrals yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Share your referral link to start earning!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentReferrals.map((referredUser) => (
              <Link
                key={referredUser.id}
                href={getProfileUrl(referredUser.id, referredUser.username)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors group"
              >
                <Avatar
                  src={referredUser.profileImageUrl || undefined}
                  alt={referredUser.displayName || referredUser.username || 'User'}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-[#0066FF] transition-colors">
                    {referredUser.displayName || referredUser.username || 'Anonymous'}
                  </p>
                  {referredUser.username && (
                    <p className="text-xs text-muted-foreground truncate">
                      @{referredUser.username}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <span className="text-xs font-semibold text-yellow-500">+250</span>
                  {referredUser.isFollowing && (
                    <UserPlus className="w-3 h-3 text-[#0066FF]" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


