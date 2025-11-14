'use client'

import { LoginButton } from '@/components/auth/LoginButton'
import { Avatar } from '@/components/shared/Avatar'
import { ExternalShareButton } from '@/components/shared/ExternalShareButton'
import { PageContainer } from '@/components/shared/PageContainer'
import { Separator } from '@/components/shared/Separator'
import { ShareButton } from '@/components/shared/ShareButton'
import { ShareEarnModal } from '@/components/shared/ShareEarnModal'
import { LinkSocialAccountsModal } from '@/components/profile/LinkSocialAccountsModal'
import { RewardsSkeleton } from '@/components/rewards/RewardsSkeleton'
import { useAuth } from '@/hooks/useAuth'
import { getProfileUrl } from '@/lib/profile-utils'
import { POINTS } from '@/lib/services/points-service'
import { useAuthStore } from '@/stores/authStore'
import {
  Award,
  Check,
  Copy,
  ExternalLink,
  Gift,
  Link as LinkIcon,
  Share2,
  TrendingUp,
  Twitter,
  UserPlus,
  Users,
  Wallet
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
  totalPointsEarned?: number
  totalFeesEarned?: number
  pointsPerReferral?: number
  feeShareRate?: number
  followingCount: number
}

interface ReferralData {
  user: {
    id: string
    username: string | null
    displayName: string | null
    bio: string | null
    profileImageUrl: string | null
    referralCode: string | null
    reputationPoints: number
    pointsAwardedForProfile: boolean
    pointsAwardedForFarcaster: boolean
    pointsAwardedForTwitter: boolean
    pointsAwardedForWallet: boolean
    farcasterUsername: string | null
    twitterUsername: string | null
    walletAddress: string | null
  }
  stats: ReferralStats
  referredUsers: ReferredUser[]
  referralUrl: string | null
}

export default function RewardsPage() {
  const { ready, authenticated } = useAuth()
  const { user } = useAuthStore()
  const [referralData, setReferralData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [showLinkSocialModal, setShowLinkSocialModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)

  const fetchReferralData = useCallback(async () => {
    if (!user?.id || !authenticated) return

    setLoading(true)
    setError(null)

    try {
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      if (!token) {
        console.error('Failed to get access token from window.__privyAccessToken')
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
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch referral data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load referral data')
      setLoading(false)
    }
  }, [user?.id, authenticated])

  useEffect(() => {
    if (ready && authenticated && user?.id) {
      fetchReferralData()
    } else if (ready && !authenticated) {
      setLoading(false)
    }
  }, [user?.id, ready, authenticated, fetchReferralData])

  const handleCopyUrl = async () => {
    if (!referralData?.referralUrl) return
    await navigator.clipboard.writeText(referralData.referralUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  // Calculate total points earned from all sources
  const calculateTotalEarned = () => {
    if (!referralData) return 0
    let total = 0
    
    // Add referral fees earned (new system)
    if (referralData.stats.totalFeesEarned) {
      total += referralData.stats.totalFeesEarned
    }
    
    // Add profile completion points
    if (referralData.user.pointsAwardedForProfile) total += POINTS.PROFILE_COMPLETION
    if (referralData.user.pointsAwardedForFarcaster) total += POINTS.FARCASTER_LINK
    if (referralData.user.pointsAwardedForTwitter) total += POINTS.TWITTER_LINK
    if (referralData.user.pointsAwardedForWallet) total += POINTS.WALLET_CONNECT
    
    return total
  }

  const rewardTasks = referralData ? [
    {
      id: 'profile',
      title: 'Complete Profile',
      description: (() => {
        if (referralData.user.pointsAwardedForProfile) {
          return 'Username, image, and bio complete! ✓'
        }
        const missing = []
        if (!referralData.user.username) missing.push('username')
        if (!referralData.user.profileImageUrl) missing.push('image')
        if (!referralData.user.bio || referralData.user.bio.length < 50) missing.push('bio (50+ chars)')
        return `Set ${missing.join(', ')}`
      })(),
      points: POINTS.PROFILE_COMPLETION,
      completed: referralData.user.pointsAwardedForProfile,
      action: 'profile-settings',
      icon: UserPlus,
      color: 'text-purple-500',
    },
    {
      id: 'twitter',
      title: 'Link X Account',
      description: referralData.user.twitterUsername ? `@${referralData.user.twitterUsername}` : 'Connect your X account',
      points: POINTS.TWITTER_LINK,
      completed: referralData.user.pointsAwardedForTwitter,
      action: 'link-social',
      icon: Twitter,
      color: 'text-blue-400',
    },
    {
      id: 'farcaster',
      title: 'Link Farcaster',
      description: referralData.user.farcasterUsername ? `@${referralData.user.farcasterUsername}` : 'Connect Farcaster account',
      points: POINTS.FARCASTER_LINK,
      completed: referralData.user.pointsAwardedForFarcaster,
      action: 'link-social',
      icon: LinkIcon,
      color: 'text-purple-400',
    },
    {
      id: 'wallet',
      title: 'Connect Wallet',
      description: referralData.user.walletAddress ? `${referralData.user.walletAddress.slice(0, 6)}...${referralData.user.walletAddress.slice(-4)}` : 'Link your wallet',
      points: POINTS.WALLET_CONNECT,
      completed: referralData.user.pointsAwardedForWallet,
      action: 'wallet-connect',
      icon: Wallet,
      color: 'text-orange-500',
    },
  ] : []

  const handleTaskClick = (_taskId: string, action: string) => {
    if (action === 'link-social') {
      setShowLinkSocialModal(true)
    } else if (action === 'profile-settings') {
      window.location.href = '/settings'
    } else if (action === 'wallet-connect') {
      // TODO: Implement wallet connect modal/action
      window.location.href = '/settings'
    }
  }

  return (
    <PageContainer noPadding className="flex flex-col">

      {/* Auth Required Banner */}
      {ready && !authenticated && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <Award className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold text-foreground mb-2">log in</h2>
            <p className="text-muted-foreground mb-6">
              Sign in to earn rewards and track your progress
            </p>
            <LoginButton />
          </div>
        </div>
      )}

      {/* Loading State */}
      {authenticated && loading && <RewardsSkeleton />}

      {/* Error State */}
      {authenticated && error && !loading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-red-500">
            <p className="text-lg font-semibold mb-2">Failed to load rewards</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Rewards Content - Desktop */}
      {authenticated && !loading && !error && referralData && (
        <div className="hidden xl:flex flex-1 overflow-hidden">
          {/* Main Content Column */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-4 sm:p-6 space-y-4">
            
            {/* Header */}
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-foreground mb-2">Rewards</h1>
              <p className="text-muted-foreground">Complete tasks and invite friends to earn points</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              {/* Total Earned */}
              <div className="rounded-lg bg-gradient-to-r from-[#0066FF]/20 to-purple-500/20 p-4 border border-[#0066FF]/30">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  <h2 className="text-sm font-medium text-muted-foreground">Total Earned</h2>
                </div>
                <div className="text-3xl font-bold text-yellow-500">
                  {calculateTotalEarned().toLocaleString()}
                </div>
              </div>

              {/* Current Balance */}
              <div className="rounded-lg bg-muted/30 border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-[#0066FF]" />
                  <h2 className="text-sm font-medium text-muted-foreground">Current Balance</h2>
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {referralData.user.reputationPoints.toLocaleString()}
                </div>
              </div>

              {/* Total Referrals */}
              <div className="rounded-lg bg-muted/30 border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-[#0066FF]" />
                  <h2 className="text-sm font-medium text-muted-foreground">Total Referrals</h2>
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {referralData.stats.totalReferrals}
                </div>
              </div>
            </div>

            {/* Reward Tasks */}
            <div className="rounded-lg bg-muted/30 border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-[#0066FF]" />
                <h2 className="text-base font-bold text-foreground">Earn Points</h2>
              </div>

              <div className="grid gap-3">
                {rewardTasks.map((task) => {
                  const Icon = task.icon
                  return (
                    <button
                      key={task.id}
                      onClick={() => handleTaskClick(task.id, task.action)}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-all text-left w-full ${
                        task.completed
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-sidebar-accent/50 border-border hover:bg-sidebar-accent cursor-pointer'
                      }`}
                    >
                      <div className={`flex-shrink-0 ${task.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{task.title}</h3>
                          {task.completed && (
                            <Check className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className={`text-sm font-bold ${task.completed ? 'text-green-500' : 'text-yellow-500'}`}>
                          {task.completed ? '✓ ' : '+'}
                          {task.points}
                        </div>
                        <div className="text-xs text-muted-foreground">points</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Share Actions */}
            <div className="rounded-lg bg-muted/30 border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-[#0066FF]" />
                  <div>
                    <h2 className="text-base font-bold text-foreground">Share & Earn</h2>
                    <p className="text-sm text-muted-foreground">
                      Share content to earn +{POINTS.SHARE_ACTION} points per share
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowShareModal(true)}
                  className="px-4 py-2 bg-[#0066FF] hover:bg-[#0066FF]/80 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Share
                </button>
              </div>
            </div>

            <Separator />

            {/* Referral Link */}
            <div className="rounded-lg bg-muted/30 border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="w-5 h-5 text-[#0066FF]" />
                <h2 className="text-base font-bold text-foreground">Referral Link</h2>
                <span className="text-xs text-muted-foreground">+{POINTS.REFERRAL_SIGNUP} points per signup</span>
              </div>

              <div className="space-y-3">
                {/* URL Display */}
                <div className="flex gap-2">
                  <div className="flex-1 bg-sidebar-accent/50 rounded-lg px-3 py-2 text-sm text-foreground border border-border truncate">
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

                {/* Share Button */}
                {referralData.referralUrl && (
                  <ExternalShareButton
                    contentType="referral"
                    text="Join me on Babylon! 🎮"
                    url={referralData.referralUrl}
                    className="w-full"
                  />
                )}

                {!referralData.referralUrl && (
                  <p className="text-xs text-muted-foreground">
                    Set a username in your profile to get your referral link
                  </p>
                )}
              </div>
            </div>

            {/* Referred Users List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-foreground flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#0066FF]" />
                  Your Referrals
                </h2>
              </div>

              {referralData.referredUsers.length === 0 ? (
                <div className="text-center py-8 bg-muted/30 rounded-lg border border-border">
                  <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <h3 className="text-base font-semibold text-foreground mb-1">No referrals yet</h3>
                  <p className="text-xs text-muted-foreground">
                    Share your referral link to start earning points
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
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {referredUser.displayName || referredUser.username || 'Anonymous'}
                        </h3>
                        {referredUser.username && (
                          <p className="text-xs text-muted-foreground truncate">
                            @{referredUser.username}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(referredUser.joinedAt || referredUser.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      {/* View Profile */}
                      <a
                        href={getProfileUrl(referredUser.id, referredUser.username)}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="View profile"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rewards Widget Column */}
          {/* <div className="hidden xl:flex flex-col w-96 flex-shrink-0 overflow-y-auto bg-sidebar p-4">
            {user && <RewardsWidget userId={user.id} />}
          </div> */}
        </div>
      )}

      {/* Mobile/Tablet View */}
      {authenticated && !loading && !error && referralData && (
        <div className="flex xl:hidden flex-col flex-1 overflow-y-auto w-full">
          <div className="w-full px-4 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-6">
            
            {/* Header */}
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Rewards</h1>
              <p className="text-muted-foreground">Complete tasks and invite friends to earn points</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Total Earned */}
              <div className="rounded-lg bg-gradient-to-r from-[#0066FF]/20 to-purple-500/20 p-3 border border-[#0066FF]/30">
                <div className="flex items-center gap-1 mb-1">
                  <Award className="w-4 h-4 text-yellow-500" />
                  <h2 className="text-xs font-medium text-muted-foreground">Earned</h2>
                </div>
                <div className="text-2xl font-bold text-yellow-500">
                  {calculateTotalEarned().toLocaleString()}
                </div>
              </div>

              {/* Current Balance */}
              <div className="rounded-lg bg-muted/30 border border-border p-3">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="w-4 h-4 text-[#0066FF]" />
                  <h2 className="text-xs font-medium text-muted-foreground">Balance</h2>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {referralData.user.reputationPoints.toLocaleString()}
                </div>
              </div>

              {/* Total Referrals */}
              <div className="rounded-lg bg-muted/30 border border-border p-3">
                <div className="flex items-center gap-1 mb-1">
                  <Users className="w-4 h-4 text-[#0066FF]" />
                  <h2 className="text-xs font-medium text-muted-foreground">Referrals</h2>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {referralData.stats.totalReferrals}
                </div>
              </div>
            </div>

            {/* Reward Tasks */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#0066FF]" />
                Earn Points
              </h2>

              <div className="space-y-2">
                {rewardTasks.map((task) => {
                  const Icon = task.icon
                  return (
                    <button
                      key={task.id}
                      onClick={() => handleTaskClick(task.id, task.action)}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left w-full ${
                        task.completed
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-muted/30 border-border cursor-pointer'
                      }`}
                    >
                      <div className={`flex-shrink-0 ${task.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{task.title}</h3>
                          {task.completed && (
                            <Check className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                      </div>
                      <div className="flex-shrink-0 text-sm font-bold">
                        <span className={task.completed ? 'text-green-500' : 'text-yellow-500'}>
                          {task.completed ? '✓' : '+'}{task.points}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Share Actions */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Share2 className="w-5 h-5 text-[#0066FF]" />
                Share & Earn
              </h2>
              <p className="text-sm text-muted-foreground">
                Share content to earn +{POINTS.SHARE_ACTION} points per share
              </p>
              <ShareButton
                contentType="profile"
                contentId={user?.id || ''}
                text="Check out my Babylon profile! 🎮"
                className="w-full"
              />
            </div>

            <Separator />

            {/* Referral Link */}
            <div className="rounded-lg bg-muted/30 border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="w-5 h-5 text-[#0066FF]" />
                <h2 className="text-base font-bold text-foreground">Referral Link</h2>
                <span className="text-xs text-muted-foreground">+{POINTS.REFERRAL_SIGNUP} points</span>
              </div>

              <div className="space-y-3">
                {/* URL Display */}
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0 bg-sidebar-accent/50 rounded-lg px-3 py-2 text-sm text-foreground border border-border break-all">
                    {referralData.referralUrl || 'Set a username to get your referral link'}
                  </div>
                  <button
                    onClick={handleCopyUrl}
                    disabled={!referralData.referralUrl}
                    className="px-3 py-2 bg-sidebar-accent/50 hover:bg-sidebar-accent text-foreground rounded-lg transition-colors flex items-center justify-center border border-border disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    aria-label="Copy referral link"
                  >
                    {copiedUrl ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Share Button */}
                {referralData.referralUrl && (
                  <ExternalShareButton
                    contentType="referral"
                    text="Join me on Babylon! 🎮"
                    url={referralData.referralUrl}
                    className="w-full"
                  />
                )}

                {!referralData.referralUrl && (
                  <p className="text-xs text-muted-foreground">
                    Set a username in your profile to get your referral link
                  </p>
                )}
              </div>
            </div>

            {/* Referred Users List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#0066FF]" />
                  Your Referrals
                </h2>
              </div>

              {referralData.referredUsers.length === 0 ? (
                <div className="text-center py-12 bg-muted/30 rounded-lg border border-border">
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No referrals yet</h3>
                  <p className="text-sm text-muted-foreground px-4">
                    Share your referral link to start earning points
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {referralData.referredUsers.map((referredUser) => (
                    <div
                      key={referredUser.id}
                      className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      {/* Avatar */}
                      <Avatar
                        id={referredUser.id}
                        name={referredUser.displayName || referredUser.username || 'User'}
                        src={referredUser.profileImageUrl || undefined}
                        size="sm"
                      />

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {referredUser.displayName || referredUser.username || 'Anonymous'}
                        </h3>
                        {referredUser.username && (
                          <p className="text-xs text-muted-foreground truncate">
                            @{referredUser.username}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(referredUser.joinedAt || referredUser.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      {/* View Profile */}
                      <a
                        href={getProfileUrl(referredUser.id, referredUser.username)}
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="View profile"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Link Social Accounts Modal */}
      <LinkSocialAccountsModal
        isOpen={showLinkSocialModal}
        onClose={() => {
          setShowLinkSocialModal(false)
          // Refresh data to update the UI
          if (user?.id && authenticated) {
            fetchReferralData()
          }
        }}
      />
      
      {/* Share & Earn Modal */}
      <ShareEarnModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        contentType="profile"
        contentId={user?.id || ''}
        text="Check out my Babylon profile! 🎮"
      />
    </PageContainer>
  )
}


