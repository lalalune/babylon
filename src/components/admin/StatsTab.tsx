'use client'

import { useEffect, useState } from 'react'
import { Users, Activity, TrendingUp, DollarSign, ShoppingCart, Award, UserCheck, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/shared/Avatar'
import { BouncingLogo } from '@/components/shared/BouncingLogo'

interface SystemStats {
  users: {
    total: number
    actors: number
    realUsers: number
    banned: number
    admins: number
    signups: {
      today: number
      thisWeek: number
      thisMonth: number
    }
  }
  markets: {
    total: number
    active: number
    resolved: number
    positions: number
  }
  trading: {
    balanceTransactions: number
    npcTrades: number
  }
  social: {
    posts: number
    postsToday: number
    comments: number
    reactions: number
  }
  financial: {
    totalVirtualBalance: string
    totalDeposited: string
    totalWithdrawn: string
    totalLifetimePnL: string
  }
  pools: {
    total: number
    active: number
    deposits: number
  }
  engagement: {
    referrals: number
    pointsTransactions: number
  }
  topUsers: {
    byBalance: Array<{
      id: string
      username: string | null
      displayName: string | null
      profileImageUrl: string | null
      virtualBalance: string
      lifetimePnL: string
    }>
    byReputation: Array<{
      id: string
      username: string | null
      displayName: string | null
      profileImageUrl: string | null
      reputationPoints: number
    }>
  }
  recentSignups: Array<{
    id: string
    username: string | null
    displayName: string | null
    profileImageUrl: string | null
    walletAddress: string | null
    createdAt: string
    onChainRegistered: boolean
    hasFarcaster: boolean
    hasTwitter: boolean
  }>
}

export function StatsTab() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats')
      if (!response.ok) throw new Error('Failed to fetch stats')
      const data = await response.json()
      setStats(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
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

  const StatCard = ({ 
    icon: Icon, 
    label, 
    value, 
    sublabel, 
    subvalue, 
    color = 'primary' 
  }: { 
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string | number
    sublabel?: string
    subvalue?: string | number
    color?: 'primary' | 'green' | 'blue' | 'orange' | 'red' | 'purple'
  }) => {
    const colorClasses = {
      primary: 'bg-primary/10 text-primary',
      green: 'bg-green-500/10 text-green-500',
      blue: 'bg-blue-500/10 text-blue-500',
      orange: 'bg-orange-500/10 text-orange-500',
      red: 'bg-red-500/10 text-red-500',
      purple: 'bg-purple-500/10 text-purple-500',
    }

    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-start justify-between mb-2">
          <div className={cn('p-2 rounded-lg', colorClasses[color])}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div className="text-2xl font-bold mb-1">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {sublabel && subvalue !== undefined && (
          <div className="text-xs text-muted-foreground mt-1">
            {sublabel}: <span className="font-medium text-foreground">{subvalue}</span>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <BouncingLogo size={48} />
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
      {/* Users Section */}
      <div>
        <h2 className="text-xl font-bold mb-3">Users</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Total Users"
            value={formatNumber(stats.users.total)}
            sublabel="Real Users"
            subvalue={formatNumber(stats.users.realUsers)}
            color="blue"
          />
          <StatCard
            icon={Activity}
            label="NPCs/Actors"
            value={formatNumber(stats.users.actors)}
            color="purple"
          />
          <StatCard
            icon={UserCheck}
            label="Signups This Week"
            value={formatNumber(stats.users.signups.thisWeek)}
            sublabel="Today"
            subvalue={formatNumber(stats.users.signups.today)}
            color="green"
          />
          <StatCard
            icon={Shield}
            label="Admins"
            value={formatNumber(stats.users.admins)}
            sublabel="Banned"
            subvalue={formatNumber(stats.users.banned)}
            color="orange"
          />
        </div>
      </div>

      {/* Markets & Trading */}
      <div>
        <h2 className="text-xl font-bold mb-3">Markets & Trading</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={TrendingUp}
            label="Total Markets"
            value={formatNumber(stats.markets.total)}
            sublabel="Active"
            subvalue={formatNumber(stats.markets.active)}
            color="green"
          />
          <StatCard
            icon={ShoppingCart}
            label="Total Positions"
            value={formatNumber(stats.markets.positions)}
            color="blue"
          />
          <StatCard
            icon={Activity}
            label="Balance Transactions"
            value={formatNumber(stats.trading.balanceTransactions)}
            color="primary"
          />
          <StatCard
            icon={Activity}
            label="NPC Trades"
            value={formatNumber(stats.trading.npcTrades)}
            color="purple"
          />
        </div>
      </div>

      {/* Financial Metrics */}
      <div>
        <h2 className="text-xl font-bold mb-3">Financial Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={DollarSign}
            label="Total Virtual Balance"
            value={formatCurrency(stats.financial.totalVirtualBalance)}
            color="green"
          />
          <StatCard
            icon={DollarSign}
            label="Total Deposited"
            value={formatCurrency(stats.financial.totalDeposited)}
            color="blue"
          />
          <StatCard
            icon={DollarSign}
            label="Total Withdrawn"
            value={formatCurrency(stats.financial.totalWithdrawn)}
            color="orange"
          />
          <StatCard
            icon={TrendingUp}
            label="Total Lifetime P&L"
            value={formatCurrency(stats.financial.totalLifetimePnL)}
            color={parseFloat(stats.financial.totalLifetimePnL) >= 0 ? 'green' : 'red'}
          />
        </div>
      </div>

      {/* Social Engagement */}
      <div>
        <h2 className="text-xl font-bold mb-3">Social Engagement</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Activity}
            label="Total Posts"
            value={formatNumber(stats.social.posts)}
            sublabel="Today"
            subvalue={formatNumber(stats.social.postsToday)}
            color="blue"
          />
          <StatCard
            icon={Activity}
            label="Comments"
            value={formatNumber(stats.social.comments)}
            color="green"
          />
          <StatCard
            icon={Award}
            label="Reactions"
            value={formatNumber(stats.social.reactions)}
            color="orange"
          />
          <StatCard
            icon={Users}
            label="Referrals"
            value={formatNumber(stats.engagement.referrals)}
            color="purple"
          />
        </div>
      </div>

      {/* Top Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top by Balance */}
        <div>
          <h2 className="text-xl font-bold mb-3">Top Users by Balance</h2>
          <div className="bg-card border border-border rounded-lg">
            {stats.topUsers.byBalance.map((user, index) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 border-b border-border last:border-b-0 hover:bg-accent transition-colors"
              >
                <div className="text-lg font-bold text-muted-foreground w-6">
                  #{index + 1}
                </div>
                <Avatar
                  src={user.profileImageUrl ?? undefined}
                  alt={user.displayName || user.username || 'User'}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {user.displayName || user.username || 'Anonymous'}
                  </div>
                  {user.username && user.displayName !== user.username && (
                    <div className="text-xs text-muted-foreground truncate">
                      @{user.username}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600">
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
          <h2 className="text-xl font-bold mb-3">Recent Signups</h2>
          <div className="bg-card border border-border rounded-lg">
            {stats.recentSignups.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 p-3 border-b border-border last:border-b-0 hover:bg-accent transition-colors"
              >
                <Avatar
                  src={user.profileImageUrl ?? undefined}
                  alt={user.displayName || user.username || 'User'}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {user.displayName || user.username || 'Anonymous'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-1">
                  {user.onChainRegistered && (
                    <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-500">
                      On-chain
                    </span>
                  )}
                  {user.hasFarcaster && (
                    <span className="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-500">
                      FC
                    </span>
                  )}
                  {user.hasTwitter && (
                    <span className="px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-500">
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

