'use client'

import { LoginButton } from '@/components/auth/LoginButton'
import { RewardsWidget } from '@/components/referrals/RewardsWidget'
import { Avatar } from '@/components/shared/Avatar'
import { PageContainer } from '@/components/shared/PageContainer'
import { Separator } from '@/components/shared/Separator'
import { useAuth } from '@/hooks/useAuth'
import { getProfileUrl } from '@/lib/profile-utils'
import { useAuthStore } from '@/stores/authStore'
import { usePrivy } from '@privy-io/react-auth'
import { BouncingLogo } from '@/components/shared/BouncingLogo'
import {
  Check,
  Copy,
  ExternalLink,
  Gift,
  Heart,
  TrendingUp,
  UserPlus,
  Users
} from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'

interface ReferredUser {
  id: string
  username: string | null
  displayName: string | null
  profileImageUrl: string | null
  createdAt: Date
  reputationPoints: number
  isFollowing: boolean
  joinedAt: Date | null
}

interface ReferralStats {
  totalReferrals: number
  totalPointsEarned: number
  pointsPerReferral: number
  followingCount: number
}

interface ReferralData {
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

export default function ReferralsPage() {
  const { ready, authenticated } = useAuth()
  const { user } = useAuthStore()
  const { getAccessToken } = usePrivy()
  const [referralData, setReferralData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const fetchReferralData = useCallback(async () => {
    if (!user?.id || !authenticated) return

    setLoading(true)
    setError(null)

    try {
      const token = await getAccessToken()
      if (!token) {
        console.error('Failed to get access token')
        setError('Authentication required')
        setLoading(false)
        return
      }

      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/referrals`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch referral data')
      }

      const data = await response.json()
      setReferralData(data)
    } catch (err) {
      console.error('Error fetching referral data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch referral data')
    } finally {
      setLoading(false)
    }
  }, [user?.id, authenticated, getAccessToken])

  useEffect(() => {
    if (ready && authenticated && user?.id) {
      fetchReferralData()
    } else if (ready && !authenticated) {
      setLoading(false)
    }
  }, [user?.id, ready, authenticated, fetchReferralData])

  const handleCopyCode = async () => {
    if (!referralData?.user.referralCode) return
    await navigator.clipboard.writeText(referralData.user.referralCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleCopyUrl = async () => {
    if (!referralData?.referralUrl) return
    await navigator.clipboard.writeText(referralData.referralUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  return (
    <PageContainer noPadding className="flex flex-col">

      {/* Auth Required Banner */}
      {ready && !authenticated && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <Gift className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold text-foreground mb-2">log in</h2>
            <p className="text-muted-foreground mb-6">
              Sign in to get your unique referral code and start inviting friends
            </p>
            <LoginButton />
          </div>
        </div>
      )}

      {/* Loading State */}
      {authenticated && loading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex justify-center">
              <BouncingLogo size={32} />
            </div>
            <p className="text-muted-foreground">Loading referral data...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {authenticated && error && !loading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-red-500">
            <p className="text-lg font-semibold mb-2">Failed to load referrals</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Referral Content - Desktop */}
      {authenticated && !loading && !error && referralData && (
        <div className="hidden xl:flex flex-1 overflow-hidden">
          {/* Main Content Column */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-4 sm:p-6 space-y-4">
            {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            {/* Total Referrals */}
            <div className="rounded-lg bg-muted/30 p-3 border border-border">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-4 h-4 text-[#0066FF]" />
                <h3 className="text-xs font-medium text-foreground">Total</h3>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {referralData.stats.totalReferrals}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {referralData.stats.followingCount} following
              </p>
            </div>

            {/* Points Earned */}
            <div className="rounded-lg bg-muted/30 p-3 border border-border">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-4 h-4 text-yellow-500" />
                <h3 className="text-xs font-medium text-foreground">Points</h3>
              </div>
              <div className="text-2xl font-bold text-yellow-500">
                {referralData.stats.totalPointsEarned.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                +250 each
              </p>
            </div>

            {/* Following Back */}
            <div className="rounded-lg bg-muted/30 p-3 border border-border">
              <div className="flex items-center gap-1.5 mb-1">
                <Heart className="w-4 h-4 text-[#0066FF]" />
                <h3 className="text-xs font-medium text-foreground">Following</h3>
              </div>
              <div className="text-2xl font-bold text-[#0066FF]">
                {referralData.stats.followingCount}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Auto-follow
              </p>
            </div>
          </div>

          {/* Referral Code Card */}
          <div className="rounded-lg bg-muted/30 border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-5 h-5 text-[#0066FF]" />
              <h2 className="text-base font-bold text-foreground">Your Referral Code</h2>
            </div>

            <div className="space-y-3">
              {/* Code Display */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Referral Code
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-sidebar-accent/50 rounded-lg px-3 py-2 font-mono text-base text-foreground border border-border">
                    {referralData.user.referralCode || (referralData.user.username ? referralData.user.username : 'Set a username')}
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="px-3 py-2 bg-sidebar-accent/50 hover:bg-sidebar-accent text-foreground rounded-lg transition-colors flex items-center gap-1.5 border border-border"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="hidden sm:inline text-xs">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs">Copy</span>
                      </>
                    )}
                  </button>
                </div>
                {!referralData.user.username && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Set a username in your profile to get your referral code
                  </p>
                )}
              </div>

              {/* URL Display */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Referral Link
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-sidebar-accent/50 rounded-lg px-3 py-2 text-xs text-muted-foreground border border-border truncate">
                    {referralData.referralUrl || 'Set a username to get your referral link'}
                  </div>
                  <button
                    onClick={handleCopyUrl}
                    disabled={!referralData.referralUrl}
                    className="px-3 py-2 bg-sidebar-accent/50 hover:bg-sidebar-accent text-foreground rounded-lg transition-colors flex items-center gap-1.5 border border-border disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="hidden sm:inline text-xs">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Reward Info */}
              <div className="bg-[#0066FF]/10 rounded-lg p-3 border border-[#0066FF]/20">
                <h3 className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-[#0066FF]" />
                  Rewards
                </h3>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
                    <span><strong className="text-yellow-500">+250 points</strong> per signup</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#0066FF] rounded-full"></span>
                    <span><strong className="text-[#0066FF]">Auto-follow</strong> - they follow you</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    <span><strong className="text-green-500">Unlimited</strong> referrals</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <Separator />

          {/* Referred Users List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#0066FF]" />
                Your Referrals ({referralData.stats.totalReferrals})
              </h2>
              {referralData.stats.totalReferrals > 0 && (
                <a
                  href="/leaderboard"
                  className="text-xs text-[#0066FF] hover:text-[#2952d9] flex items-center gap-1 transition-colors"
                >
                  Leaderboard
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {referralData.referredUsers.length === 0 ? (
              <div className="text-center py-8 bg-muted/30 rounded-lg border border-border">
                <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <h3 className="text-base font-semibold text-foreground mb-1">No referrals yet</h3>
                <p className="text-xs text-muted-foreground">
                  Share your referral link to start earning <strong className="text-yellow-500">+250 points</strong> per signup
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {referralData.referredUsers.map((referredUser) => (
                  <div
                    key={referredUser.id}
                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    {/* Avatar */}
                    <Avatar
                      src={referredUser.profileImageUrl || undefined}
                      alt={referredUser.displayName || referredUser.username || 'User'}
                      size="sm"
                    />

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {referredUser.displayName || referredUser.username || 'Anonymous'}
                        </h3>
                        {referredUser.isFollowing && (
                          <Heart className="w-3 h-3 text-[#0066FF] fill-[#0066FF] flex-shrink-0" />
                        )}
                      </div>
                      {referredUser.username && (
                        <p className="text-xs text-muted-foreground truncate">
                          @{referredUser.username}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(referredUser.joinedAt || referredUser.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <span className="text-xs font-semibold text-yellow-500">
                        +250
                      </span>
                      <a
                        href={getProfileUrl(referredUser.id, referredUser.username)}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="View profile"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tips Section */}
          {referralData.stats.totalReferrals < 5 && (
            <div className="rounded-lg bg-[#0066FF]/10 border border-[#0066FF]/20 p-3">
              <h3 className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#0066FF]" />
                Tips to Get More Referrals
              </h3>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#0066FF] mt-0.5">•</span>
                  <span>Share on Twitter/X for maximum reach</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#0066FF] mt-0.5">•</span>
                  <span>Tell friends about competing with 21 AI traders</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#0066FF] mt-0.5">•</span>
                  <span>Share interesting markets or trades</span>
                </li>
              </ul>
            </div>
          )}
          </div>

          {/* Referrals Widget Column */}
          {user && (
            <div className="hidden xl:flex flex-col w-96 flex-shrink-0 overflow-y-auto bg-sidebar p-4">
              <RewardsWidget userId={user.id} />
            </div>
          )}
        </div>
      )}

      {/* Mobile/Tablet View */}
      {authenticated && !loading && !error && referralData && (
        <div className="flex xl:hidden flex-col flex-1 overflow-y-auto w-full">
          <div className="w-full px-4 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-6">
            {/* Stats Cards - 3 columns on mobile */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full">
              {/* Total Referrals */}
              <div className="rounded-lg bg-muted/30 p-2 sm:p-4 border border-border w-full">
                <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  <Users className="w-3 h-3 sm:w-5 sm:h-5 text-[#0066FF]" />
                  <h3 className="text-xs sm:text-sm font-medium text-foreground truncate">Total</h3>
                </div>
                <div className="text-xl sm:text-3xl font-bold text-foreground">
                  {referralData.stats.totalReferrals}
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-1">
                  {referralData.stats.followingCount} following
                </p>
              </div>

              {/* Points Earned */}
              <div className="rounded-lg bg-muted/30 p-2 sm:p-4 border border-border w-full">
                <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  <TrendingUp className="w-3 h-3 sm:w-5 sm:h-5 text-yellow-500" />
                  <h3 className="text-xs sm:text-sm font-medium text-foreground truncate">Points</h3>
                </div>
                <div className="text-xl sm:text-3xl font-bold text-yellow-500">
                  {referralData.stats.totalPointsEarned.toLocaleString()}
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-1">
                  +250 each
                </p>
              </div>

              {/* Following Back */}
              <div className="rounded-lg bg-muted/30 p-2 sm:p-4 border border-border w-full">
                <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  <Heart className="w-3 h-3 sm:w-5 sm:h-5 text-[#0066FF]" />
                  <h3 className="text-xs sm:text-sm font-medium text-foreground truncate">Following</h3>
                </div>
                <div className="text-xl sm:text-3xl font-bold text-[#0066FF]">
                  {referralData.stats.followingCount}
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-1">
                  Auto-follow
                </p>
              </div>
            </div>

            {/* Referral Code Card */}
            <div className="rounded-lg bg-muted/30 border border-border p-4 w-full">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="w-6 h-6 text-[#0066FF]" />
                <h2 className="text-lg font-bold text-foreground">Your Referral Code</h2>
              </div>

              <div className="space-y-4 w-full">
                {/* Code Display */}
                <div className="w-full">
                  <label className="block text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Referral Code
                  </label>
                  <div className="flex gap-2 w-full">
                    <div className="flex-1 min-w-0 bg-sidebar-accent/50 rounded-lg px-4 py-3 font-mono text-base text-foreground border border-border break-all overflow-wrap-anywhere">
                      {referralData.user.referralCode || (referralData.user.username ? referralData.user.username : 'Set a username')}
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="px-4 py-3 bg-sidebar-accent/50 hover:bg-sidebar-accent text-foreground rounded-lg transition-colors flex items-center justify-center border border-border flex-shrink-0"
                      aria-label="Copy referral code"
                    >
                      {copiedCode ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {!referralData.user.username && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Set a username in your profile to get your referral code
                    </p>
                  )}
                </div>

                {/* URL Display */}
                <div className="w-full">
                  <label className="block text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Referral Link
                  </label>
                  <div className="flex gap-2 w-full">
                    <div className="flex-1 min-w-0 bg-sidebar-accent/50 rounded-lg px-4 py-3 text-sm text-muted-foreground border border-border break-all overflow-wrap-anywhere">
                      {referralData.referralUrl || 'Set a username to get your referral link'}
                    </div>
                    <button
                      onClick={handleCopyUrl}
                      disabled={!referralData.referralUrl}
                      className="px-4 py-3 bg-sidebar-accent/50 hover:bg-sidebar-accent text-foreground rounded-lg transition-colors flex items-center justify-center border border-border disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                      aria-label="Copy referral link"
                    >
                      {copiedUrl ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Reward Info */}
                <div className="bg-[#0066FF]/10 rounded-lg p-4 border border-[#0066FF]/20 w-full">
                  <h3 className="text-base font-semibold text-foreground mb-2 flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-[#0066FF]" />
                    Referral Rewards
                  </h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></span>
                      <span><strong className="text-yellow-500">+250 points</strong> for each friend who signs up</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-2 h-2 bg-[#0066FF] rounded-full mt-1.5 flex-shrink-0"></span>
                      <span><strong className="text-[#0066FF]">Auto-follow</strong> - they&apos;ll automatically follow you</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></span>
                      <span><strong className="text-green-500">Unlimited</strong> - invite as many friends as you want!</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <Separator />

            {/* Referred Users List */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-4 w-full">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#0066FF]" />
                  <span>Your Referrals ({referralData.stats.totalReferrals})</span>
                </h2>
                {referralData.stats.totalReferrals > 0 && (
                  <a
                    href="/leaderboard"
                    className="text-sm text-[#0066FF] hover:text-[#2952d9] flex items-center gap-1 transition-colors flex-shrink-0 ml-2"
                  >
                    Leaderboard
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              {referralData.referredUsers.length === 0 ? (
                <div className="text-center py-12 bg-muted/30 rounded-lg border border-border w-full">
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No referrals yet</h3>
                  <p className="text-sm text-muted-foreground mb-4 px-4">
                    Share your referral link to start earning points!
                  </p>
                  <p className="text-xs text-muted-foreground px-4">
                    Each friend who signs up earns you <strong className="text-yellow-500">+250 points</strong>
                  </p>
                </div>
              ) : (
                <div className="space-y-3 w-full">
                  {referralData.referredUsers.map((referredUser) => (
                    <div
                      key={referredUser.id}
                      className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors w-full"
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <Avatar
                          id={referredUser.id}
                          name={referredUser.displayName || referredUser.username || 'User'}
                          src={referredUser.profileImageUrl || undefined}
                          size="sm"
                        />
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-foreground truncate">
                          {referredUser.displayName || referredUser.username || 'Anonymous'}
                        </h3>
                        {referredUser.username && (
                          <p className="text-sm text-muted-foreground truncate">
                            @{referredUser.username}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Joined {new Date(referredUser.joinedAt || referredUser.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="flex-shrink-0 text-right">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-yellow-500">
                            +250
                          </span>
                        </div>
                        {referredUser.isFollowing && (
                          <div className="flex items-center gap-1 text-xs">
                            <Heart className="w-3 h-3 text-[#0066FF] fill-[#0066FF]" />
                            <span className="text-[#0066FF]">Following</span>
                          </div>
                        )}
                      </div>

                      {/* View Profile Link */}
                      <a
                        href={getProfileUrl(referredUser.id, referredUser.username)}
                        className="flex-shrink-0 p-2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="View profile"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tips Section */}
            {referralData.stats.totalReferrals < 5 && (
              <div className="rounded-lg bg-[#0066FF]/10 border border-[#0066FF]/20 p-4 w-full">
                <h3 className="text-base font-semibold text-foreground mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#0066FF]" />
                  Tips to Get More Referrals
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-[#0066FF] mt-0.5 flex-shrink-0">•</span>
                    <span>Share your referral link on Twitter/X for maximum reach</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#0066FF] mt-0.5 flex-shrink-0">•</span>
                    <span>Tell friends about the 21 AI traders they can compete against</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#0066FF] mt-0.5 flex-shrink-0">•</span>
                    <span>Share interesting markets or trades you&apos;ve made</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#0066FF] mt-0.5 flex-shrink-0">•</span>
                    <span>Your referrals automatically follow you - build your network!</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  )
}

