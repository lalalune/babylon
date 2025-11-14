'use client'

import { useEffect, useState } from 'react'
import { Users, Activity, TrendingUp, DollarSign, ShoppingCart, Award, UserCheck, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/shared/Avatar'
import { Skeleton } from '@/components/shared/Skeleton'
import { z } from 'zod'

const UserStatsSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
});

const SystemStatsSchema = z.object({
  users: z.object({
    total: z.number(),
    actors: z.number(),
    realUsers: z.number(),
    banned: z.number(),
    admins: z.number(),
    signups: z.object({
      today: z.number(),
      thisWeek: z.number(),
      thisMonth: z.number(),
    }),
  }),
  markets: z.object({
    total: z.number(),
    active: z.number(),
    resolved: z.number(),
    positions: z.number(),
  }),
  trading: z.object({
    balanceTransactions: z.number(),
    npcTrades: z.number(),
  }),
  social: z.object({
    posts: z.number(),
    postsToday: z.number(),
    comments: z.number(),
    reactions: z.number(),
  }),
  financial: z.object({
    totalVirtualBalance: z.string(),
    totalDeposited: z.string(),
    totalWithdrawn: z.string(),
    totalLifetimePnL: z.string(),
  }),
  pools: z.object({
    total: z.number(),
    active: z.number(),
    deposits: z.number(),
  }),
  engagement: z.object({
    referrals: z.number(),
    pointsTransactions: z.number(),
  }),
  topUsers: z.object({
    byBalance: z.array(UserStatsSchema.extend({
      virtualBalance: z.string(),
      lifetimePnL: z.string(),
    })),
    byReputation: z.array(UserStatsSchema.extend({
      reputationPoints: z.number(),
    })),
  }),
  recentSignups: z.array(UserStatsSchema.extend({
    walletAddress: z.string().nullable(),
    createdAt: z.string(),
    onChainRegistered: z.boolean(),
    hasFarcaster: z.boolean(),
    hasTwitter: z.boolean(),
  })),
});
type SystemStats = z.infer<typeof SystemStatsSchema>;

const FeeStatsSchema = z.object({
  totalFeesCollected: z.number(),
  totalUserFees: z.number(),
  totalNPCFees: z.number(),
  totalPlatformFees: z.number(),
  totalReferrerFees: z.number(),
  totalTrades: z.number(),
});
type FeeStats = z.infer<typeof FeeStatsSchema>;

export function StatsTab() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [feeStats, setFeeStats] = useState<FeeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
    fetchFeeStats()
    const interval = setInterval(() => {
      fetchStats()
      fetchFeeStats()
    }, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    const response = await fetch('/api/admin/stats')
    if (!response.ok) throw new Error('Failed to fetch stats')
    const data = await response.json()
    const validation = SystemStatsSchema.safeParse(data);
    if (!validation.success) {
      throw new Error('Invalid system stats data structure');
    }
    setStats(validation.data)
    setError(null)
    setLoading(false)
  }

  const fetchFeeStats = async () => {
    const response = await fetch('/api/admin/fees')
    if (!response.ok) return // Fail silently for fees
    const data = await response.json()
    const validation = FeeStatsSchema.safeParse(data.platformStats);
    if (validation.success) {
      setFeeStats(validation.data);
    }
  }

  const formatCurrency = (value: string) => {
    const num = parseFloat(value)
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`
    return value.toLocaleString()
  }

  const StatItem = ({ 
    icon: Icon, 
    label, 
    value,
    color = 'primary' 
  }: { 
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string | number
    color?: 'primary' | 'green' | 'blue' | 'orange' | 'red' | 'purple'
  }) => {
    const colorClasses = {
      primary: 'text-primary',
      green: 'text-green-500',
      blue: 'text-blue-500',
      orange: 'text-orange-500',
      red: 'text-red-500',
      purple: 'text-purple-500',
    }

    return (
      <div className="flex items-center gap-3">
        <Icon className={cn('w-4 h-4 flex-shrink-0', colorClasses[color])} />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-xl font-bold">{value}</div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="space-y-4 w-full">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="text-center text-red-500 p-8">
        {error || 'Failed to load statistics'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats - Cleaner, less boxy design */}
      <div className="bg-gradient-to-br from-card to-accent/20 border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-6 text-muted-foreground uppercase tracking-wide">Platform Overview</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Users Column */}
          <div className="space-y-4">
            <StatItem
              icon={Users}
              label="Total Users"
              value={formatNumber(stats.users.total)}
              color="blue"
            />
            <StatItem
              icon={Activity}
              label="NPCs/Actors"
              value={formatNumber(stats.users.actors)}
              color="purple"
            />
            <StatItem
              icon={UserCheck}
              label="Real Users"
              value={formatNumber(stats.users.realUsers)}
              color="green"
            />
          </div>

          {/* Activity Column */}
          <div className="space-y-4">
            <StatItem
              icon={TrendingUp}
              label="Total Markets"
              value={formatNumber(stats.markets.total)}
              color="green"
            />
            <StatItem
              icon={ShoppingCart}
              label="Active Markets"
              value={formatNumber(stats.markets.active)}
              color="blue"
            />
            <StatItem
              icon={Activity}
              label="Positions"
              value={formatNumber(stats.markets.positions)}
              color="primary"
            />
          </div>

          {/* Financial Column */}
          <div className="space-y-4">
            <StatItem
              icon={DollarSign}
              label="Total Balance"
              value={formatCurrency(stats.financial.totalVirtualBalance)}
              color="green"
            />
            <StatItem
              icon={DollarSign}
              label="Deposited"
              value={formatCurrency(stats.financial.totalDeposited)}
              color="blue"
            />
            <StatItem
              icon={TrendingUp}
              label="Lifetime P&L"
              value={formatCurrency(stats.financial.totalLifetimePnL)}
              color={parseFloat(stats.financial.totalLifetimePnL) >= 0 ? 'green' : 'red'}
            />
          </div>

          {/* Engagement Column */}
          <div className="space-y-4">
            <StatItem
              icon={Activity}
              label="Total Posts"
              value={formatNumber(stats.social.posts)}
              color="blue"
            />
            <StatItem
              icon={Activity}
              label="Comments"
              value={formatNumber(stats.social.comments)}
              color="green"
            />
            <StatItem
              icon={Award}
              label="Reactions"
              value={formatNumber(stats.social.reactions)}
              color="orange"
            />
          </div>
        </div>
      </div>

      {/* Fee Stats (if available) */}
      {feeStats && (
        <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-muted-foreground uppercase tracking-wide">Trading Fees (0.1%)</h2>
            <DollarSign className="w-6 h-6 text-green-500" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Collected</div>
              <div className="text-2xl font-bold text-green-500">{formatCurrency(feeStats.totalFeesCollected.toString())}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Platform Revenue</div>
              <div className="text-xl font-bold">{formatCurrency(feeStats.totalPlatformFees.toString())}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Referral Payouts</div>
              <div className="text-xl font-bold">{formatCurrency(feeStats.totalReferrerFees.toString())}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Trades with Fees</div>
              <div className="text-xl font-bold">{formatNumber(feeStats.totalTrades)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground">User Signups</h3>
            <UserCheck className="w-4 h-4 text-green-500" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Today</span>
              <span className="text-lg font-bold">{formatNumber(stats.users.signups.today)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">This Week</span>
              <span className="text-lg font-bold">{formatNumber(stats.users.signups.thisWeek)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">This Month</span>
              <span className="text-lg font-bold">{formatNumber(stats.users.signups.thisMonth)}</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground">Trading Activity</h3>
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">NPC Trades</span>
              <span className="text-lg font-bold">{formatNumber(stats.trading.npcTrades)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Balance Txns</span>
              <span className="text-lg font-bold">{formatNumber(stats.trading.balanceTransactions)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Pool Deposits</span>
              <span className="text-lg font-bold">{formatNumber(stats.pools.deposits)}</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground">Moderation</h3>
            <Shield className="w-4 h-4 text-orange-500" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Admins</span>
              <span className="text-lg font-bold">{formatNumber(stats.users.admins)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Banned Users</span>
              <span className="text-lg font-bold text-red-500">{formatNumber(stats.users.banned)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Referrals</span>
              <span className="text-lg font-bold">{formatNumber(stats.engagement.referrals)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Users & Recent Signups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top by Balance */}
        <div>
          <h2 className="text-lg font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Top Users by Balance</h2>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {stats.topUsers.byBalance.map((user, index) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="text-sm font-bold text-muted-foreground w-6">
                  #{index + 1}
                </div>
                <Avatar
                  src={user.profileImageUrl ?? undefined}
                  alt={user.displayName || user.username || 'User'}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-sm">
                    {user.displayName || user.username || 'Anonymous'}
                  </div>
                  {user.username && user.displayName !== user.username && (
                    <div className="text-xs text-muted-foreground truncate">
                      @{user.username}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600 text-sm">
                    {formatCurrency(user.virtualBalance)}
                  </div>
                  <div className={cn(
                    "text-xs",
                    parseFloat(user.lifetimePnL) >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    P&L: {formatCurrency(user.lifetimePnL)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Signups */}
        <div>
          <h2 className="text-lg font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Recent Signups</h2>
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {stats.recentSignups.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors"
              >
                <Avatar
                  src={user.profileImageUrl ?? undefined}
                  alt={user.displayName || user.username || 'User'}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-sm">
                    {user.displayName || user.username || 'Anonymous'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-1">
                  {user.onChainRegistered && (
                    <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-500">
                      On-chain
                    </span>
                  )}
                  {user.hasFarcaster && (
                    <span className="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-500">
                      FC
                    </span>
                  )}
                  {user.hasTwitter && (
                    <span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-500">
                      X
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
