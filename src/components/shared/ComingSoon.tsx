'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { usePrivy } from '@privy-io/react-auth'
import { Copy, Check, Mail, Wallet, X, Users, TrendingUp, Gift } from 'lucide-react'
import { logger } from '@/lib/logger'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

interface WaitlistData {
  position: number          // Leaderboard rank (dynamic)
  leaderboardRank: number   // Same as position
  waitlistPosition: number  // Historical signup order
  totalAhead: number
  totalCount: number
  percentile: number        // Top X%
  inviteCode: string
  points: number
  pointsBreakdown: {
    total: number
    invite: number
    earned: number
    bonus: number
  }
  referralCount: number
}

interface TopUser {
  id: string
  username: string | null
  displayName: string | null
  profileImageUrl: string | null
  invitePoints: number
  reputationPoints: number
  referralCount: number
  rank: number
}

export function ComingSoon() {
  const { login, authenticated, user: privyUser, logout } = usePrivy()
  const { user: dbUser } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [waitlistData, setWaitlistData] = useState<WaitlistData | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [previousRank, setPreviousRank] = useState<number | null>(null)
  const [showRankImprovement, setShowRankImprovement] = useState(false)
  const [topUsers, setTopUsers] = useState<TopUser[]>([])

  // If user completes onboarding, mark as waitlisted and fetch position
  useEffect(() => {
    if (!authenticated || !dbUser || !dbUser.id) return

    const setupWaitlist = async (userId: string) => {
      // Check if already on waitlist
      const existingPosition = await fetchWaitlistPosition(userId)
      if (existingPosition) {
        // Already setup, just refresh data
        return
      }

      // Mark user as waitlisted (they completed onboarding)
      const referralCode = searchParams.get('ref') || undefined
      
      logger.info('Marking user as waitlisted', { 
        userId, 
        hasReferralCode: !!referralCode,
        referralCode 
      }, 'ComingSoon')

      const response = await fetch('/api/waitlist/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          referralCode,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('Failed to mark as waitlisted', { errorText }, 'ComingSoon')
        throw new Error('Failed to mark as waitlisted')
      }

      const result = await response.json()
      logger.info('User marked as waitlisted', { 
        position: result.waitlistPosition,
        inviteCode: result.inviteCode 
      }, 'ComingSoon')

      // Fetch position data to get complete info
      await fetchWaitlistPosition(userId)

      // Award bonuses if available
      const googleEmail = privyUser && 'google' in privyUser ? (privyUser as { google?: { email?: string } }).google?.email : undefined
      const emailFromOAuth = privyUser?.email?.address || googleEmail
      if (emailFromOAuth) {
        await awardEmailBonus(userId, emailFromOAuth)
      }

      const walletAddress = privyUser?.wallet?.address
      if (walletAddress) {
        await awardWalletBonus(userId, walletAddress)
      }
    }

    void setupWaitlist(dbUser.id)
  }, [authenticated, dbUser?.id, privyUser, searchParams])

  const fetchWaitlistPosition = async (userId: string): Promise<boolean> => {
    const [positionResponse, leaderboardResponse] = await Promise.all([
      fetch(`/api/waitlist/position?userId=${userId}`),
      fetch('/api/waitlist/leaderboard?limit=10'),
    ])

    if (!positionResponse.ok) {
      // User might not be on waitlist yet
      return false
    }

    const data = await positionResponse.json()
    
    // Log if invite code is missing for debugging
    if (!data.inviteCode) {
      logger.warn('Invite code missing in waitlist data', { userId }, 'ComingSoon')
    }
    
    // Check if rank improved
    if (previousRank !== null && data.leaderboardRank < previousRank) {
      setShowRankImprovement(true)
      setTimeout(() => setShowRankImprovement(false), 5000)
    }
    setPreviousRank(data.leaderboardRank)
    
    setWaitlistData(data)

    // Fetch leaderboard
    if (leaderboardResponse.ok) {
      const leaderboardData = await leaderboardResponse.json()
      setTopUsers(leaderboardData.leaderboard || [])
    }

    return true
  }

  const awardEmailBonus = async (userId: string, email: string) => {
    const response = await fetch('/api/waitlist/bonus/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email }),
    })
    if (response.ok) {
      await fetchWaitlistPosition(userId)
    }
  }

  const awardWalletBonus = async (userId: string, walletAddress: string) => {
    const response = await fetch('/api/waitlist/bonus/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, walletAddress }),
    })
    if (response.ok) {
      await fetchWaitlistPosition(userId)
    }
  }

  const handleCopyInviteCode = useCallback(() => {
    if (waitlistData?.inviteCode) {
      const inviteUrl = `${window.location.origin}/?ref=${waitlistData.inviteCode}`
      navigator.clipboard.writeText(inviteUrl)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }, [waitlistData])

  const handleAddEmail = async () => {
    if (!emailInput || !dbUser?.id) return
    setIsLoading(true)
    await awardEmailBonus(dbUser.id, emailInput)
    setShowEmailModal(false)
    setEmailInput('')
    setIsLoading(false)
  }

  const handleJoinWaitlist = () => {
    // Trigger Privy login with waitlist context
    // After login, OnboardingProvider will handle profile setup
    // Then we'll mark as waitlisted in the useEffect above
    const currentUrl = new URL(window.location.href)
    currentUrl.searchParams.set('waitlist', 'true')
    router.push(currentUrl.pathname + currentUrl.search)
    login()
  }

  // Unauthenticated state - Show landing page
  if (!authenticated || !dbUser) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-sidebar to-background relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden opacity-30">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="max-w-2xl mx-auto px-6 text-center relative z-10">
          {/* Logo */}
          <div className="mb-8 flex justify-center animate-fadeIn">
            <div className="w-32 h-32 relative hover:scale-110 transition-transform duration-300">
              <Image
                src="/assets/logos/logo.svg"
                alt="Babylon Logo"
                width={128}
                height={128}
                className="w-full h-full drop-shadow-2xl"
                priority
              />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-6xl md:text-7xl font-bold mb-6 text-foreground animate-fadeIn">
            Babylon
          </h1>

          {/* Description */}
          <div className="space-y-4 text-lg md:text-xl text-muted-foreground mb-10 animate-fadeIn">
            <p className="leading-relaxed">
              A satirical prediction market game where you trade with autonomous AI agents 
              in a Twitter-style social network.
            </p>
            <p className="leading-relaxed">
              Create markets, debate with NPCs, build relationships, and earn rewards 
              in this experimental social prediction platform.
            </p>
          </div>

          {/* Join Waitlist Button */}
          <div className="mb-12 animate-fadeIn">
            <button
              onClick={handleJoinWaitlist}
              disabled={isLoading}
              className="px-12 py-5 bg-primary hover:bg-primary/90 text-foreground text-xl font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Join Waitlist'}
            </button>
            <p className="mt-4 text-sm text-muted-foreground">
              Sign in with X, Farcaster, Gmail, or Wallet
            </p>
          </div>

          {/* Features Preview */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
            <div className="p-4 bg-card/50 rounded-2xl border border-border/50 backdrop-blur-sm">
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="font-semibold mb-1 text-foreground">Prediction Markets</h3>
              <p className="text-sm text-muted-foreground">Trade on real-world events</p>
            </div>
            <div className="p-4 bg-card/50 rounded-2xl border border-border/50 backdrop-blur-sm">
              <div className="text-3xl mb-2">🤖</div>
              <h3 className="font-semibold mb-1 text-foreground">AI Agents</h3>
              <p className="text-sm text-muted-foreground">Interact with autonomous NPCs</p>
            </div>
            <div className="p-4 bg-card/50 rounded-2xl border border-border/50 backdrop-blur-sm">
              <div className="text-3xl mb-2">🎮</div>
              <h3 className="font-semibold mb-1 text-foreground">Gamified Trading</h3>
              <p className="text-sm text-muted-foreground">Earn rewards and build influence</p>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fadeIn {
            animation: fadeIn 0.8s ease-out forwards;
          }
        `}</style>
      </div>
    )
  }

  // Loading waitlist data
  if (!waitlistData) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-sidebar to-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your waitlist position...</p>
        </div>
      </div>
    )
  }

  // Authenticated & waitlisted - Show position and leaderboard
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-sidebar to-background relative overflow-hidden p-4">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden opacity-30">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="max-w-3xl mx-auto w-full relative z-10">
        {/* Logo */}
        <div className="mb-6 flex justify-center animate-fadeIn">
          <div className="w-24 h-24 relative">
            <Image
              src="/assets/logos/logo.svg"
              alt="Babylon Logo"
              width={96}
              height={96}
              className="w-full h-full drop-shadow-2xl"
              priority
            />
          </div>
        </div>

        {/* Welcome Message */}
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center text-foreground animate-fadeIn">
          {"You're on the List!"}
        </h1>

        {/* Rank Improvement Banner */}
        {showRankImprovement && previousRank && (
          <div className="bg-green-500/20 border-2 border-green-500 rounded-2xl p-6 mb-6 animate-fadeIn">
            <div className="text-center">
              <div className="text-4xl mb-2">🎉</div>
              <h3 className="text-xl font-bold text-green-500 mb-2">
                You Moved Up!
              </h3>
              <p className="text-foreground">
                From #{previousRank} → #{waitlistData.position}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Keep inviting to move even higher!
              </p>
            </div>
          </div>
        )}

        {/* Waitlist Position Card */}
        <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-8 mb-6 animate-fadeIn">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Users className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Your Waitlist Position</h2>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-sidebar/50 rounded-xl p-6">
              <div className="text-5xl font-bold text-primary mb-2">
                #{waitlistData.position}
              </div>
              <div className="text-sm text-muted-foreground">Your Position in Line</div>
              <div className="text-xs text-muted-foreground mt-1">
                Top {waitlistData.percentile}% of waitlist
              </div>
            </div>
            <div className="bg-sidebar/50 rounded-xl p-6">
              <div className="text-5xl font-bold text-foreground mb-2">
                {waitlistData.totalAhead}
              </div>
              <div className="text-sm text-muted-foreground">People Ahead</div>
              <div className="text-xs text-muted-foreground mt-1">
                Out of {waitlistData.totalCount} total
              </div>
            </div>
          </div>

          {/* Points Breakdown */}
          <div className="bg-sidebar/50 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Your Points</h3>
            </div>
            <div className="text-4xl font-bold text-primary mb-4">
              {waitlistData.points}
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="font-semibold text-foreground">{waitlistData.pointsBreakdown.invite}</div>
                <div className="text-muted-foreground">Invite Points</div>
              </div>
              <div>
                <div className="font-semibold text-foreground">{waitlistData.pointsBreakdown.earned}</div>
                <div className="text-muted-foreground">Earned Points</div>
              </div>
              <div>
                <div className="font-semibold text-foreground">{waitlistData.pointsBreakdown.bonus}</div>
                <div className="text-muted-foreground">Bonus Points</div>
              </div>
            </div>
          </div>

          {/* Referral Stats */}
          {waitlistData.referralCount > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2">
                <Gift className="w-5 h-5 text-primary" />
                <span className="font-semibold">
                  {"You've invited"} {waitlistData.referralCount} {waitlistData.referralCount === 1 ? 'person' : 'people'}!
                </span>
              </div>
            </div>
          )}

          {/* Invite Code Section */}
          <div className="border-t border-border pt-6">
            <h3 className="text-lg font-semibold mb-3">Invite Friends & Move Up in Line!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get <span className="font-bold text-primary">+50 points</span> for each friend who joins
              <br />
              <span className="font-bold text-green-500">More invites = Better position in line!</span>
            </p>
            {waitlistData.inviteCode ? (
              <div className="flex items-center gap-3 bg-sidebar/50 rounded-lg p-4">
                <div className="flex-1 text-left font-mono text-sm break-all">
                  {window.location.origin}/?ref={waitlistData.inviteCode}
                </div>
                <button
                  onClick={handleCopyInviteCode}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-foreground rounded-lg transition-colors flex items-center gap-2 shrink-0"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
                <div className="text-sm text-yellow-600">
                  Generating your invite code...
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bonus Actions */}
        <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6 mb-6 animate-fadeIn">
          <h3 className="text-lg font-semibold mb-4">Earn More Points</h3>
          <div className="space-y-3">
            {waitlistData.pointsBreakdown.bonus < 50 && (
              <>
                {!dbUser.email && (
                  <button
                    onClick={() => setShowEmailModal(true)}
                    className="w-full flex items-center justify-between bg-sidebar/50 hover:bg-sidebar rounded-lg p-4 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-primary" />
                      <span>Add Email Address</span>
                    </div>
                    <span className="text-primary font-semibold">+25 points</span>
                  </button>
                )}
                {privyUser?.wallet?.address ? (
                  <div className="w-full flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-500" />
                      <span>Wallet Connected</span>
                    </div>
                    <span className="text-green-500 font-semibold">+25 points</span>
                  </div>
                ) : (
                  <button
                    onClick={login}
                    className="w-full flex items-center justify-between bg-sidebar/50 hover:bg-sidebar rounded-lg p-4 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Wallet className="w-5 h-5 text-primary" />
                      <span>Connect Wallet</span>
                    </div>
                    <span className="text-primary font-semibold">+25 points</span>
                  </button>
                )}
              </>
            )}
            {waitlistData.pointsBreakdown.bonus >= 50 && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                <Check className="w-6 h-6 text-primary mx-auto mb-2" />
                <div className="font-semibold">All Bonuses Claimed!</div>
              </div>
            )}
          </div>
        </div>

        {/* Waitlist Leaderboard */}
        {topUsers.length > 0 && (
          <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6 mb-6 animate-fadeIn">
            <div className="flex items-center justify-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Top Inviters</h3>
            </div>
            <div className="space-y-2">
              {topUsers.slice(0, 10).map((topUser) => {
                const isCurrentUser = topUser.id === dbUser.id
                return (
                  <div
                    key={topUser.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isCurrentUser 
                        ? 'bg-primary/20 border-2 border-primary' 
                        : topUser.rank <= 3
                          ? 'bg-yellow-500/10 border border-yellow-500/20'
                          : 'bg-sidebar/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`text-lg font-bold ${
                        topUser.rank === 1 ? 'text-yellow-500' :
                        topUser.rank === 2 ? 'text-gray-400' :
                        topUser.rank === 3 ? 'text-orange-500' :
                        'text-muted-foreground'
                      }`}>
                        #{topUser.rank}
                      </div>
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {topUser.displayName || topUser.username || 'Anonymous'}
                          {isCurrentUser && (
                            <span className="px-2 py-0.5 text-xs bg-primary text-foreground rounded">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {topUser.referralCount} {topUser.referralCount === 1 ? 'invite' : 'invites'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary">
                        {topUser.invitePoints}
                      </div>
                      <div className="text-xs text-muted-foreground">points</div>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Show current user if not in top 10 */}
            {waitlistData.position > 10 && (
              <div className="mt-4 pt-4 border-t-2 border-border">
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/20 border-2 border-primary">
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-bold text-primary">
                      #{waitlistData.position}
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        You
                        <span className="px-2 py-0.5 text-xs bg-primary text-foreground rounded">
                          YOU
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {waitlistData.referralCount} {waitlistData.referralCount === 1 ? 'invite' : 'invites'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary">
                      {waitlistData.pointsBreakdown.invite}
                    </div>
                    <div className="text-xs text-muted-foreground">points</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Logout Button */}
        <div className="text-center">
          <button
            onClick={logout}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Add Email Address</h3>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Get notified when Babylon launches and earn +25 points
            </p>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="your.email@example.com"
              className="w-full px-4 py-3 bg-sidebar border border-border rounded-lg mb-4 focus:outline-none focus:border-border"
            />
            <button
              onClick={handleAddEmail}
              disabled={!emailInput || isLoading}
              className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-foreground font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Adding...' : 'Add Email & Earn Points'}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

