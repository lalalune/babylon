'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Users, DollarSign, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { BouncingLogo } from '@/components/shared/BouncingLogo'

interface Pool {
  id: string
  name: string
  description: string | null
  npcActor: {
    id: string
    name: string
    description: string | null
    tier: string | null
    personality: string | null
  }
  totalValue: number
  totalDeposits: number
  availableBalance: number
  lifetimePnL: number
  totalReturn: number
  performanceFeeRate: number
  totalFeesCollected: number
  activeInvestors: number
  totalTrades: number
  openPositions: number
  totalUnrealizedPnL: number
  activeDepositsValue: number
  openedAt: string
  updatedAt: string
}

interface PoolsListProps {
  onPoolClick: (pool: Pool) => void
}

export function PoolsList({ onPoolClick }: PoolsListProps) {
  const { authenticated } = useAuth()
  const [pools, setPools] = useState<Pool[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'performance' | 'volume' | 'tvl' | 'newest' | 'oldest'>('performance')

  useEffect(() => {
    fetchPools()
    const interval = setInterval(fetchPools, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const fetchPools = async () => {
    const res = await fetch('/api/pools')
    const data = await res.json()
    setPools(data.pools || [])
    setLoading(false)
  }

  const sortedPools = [...pools].sort((a, b) => {
    switch (sortBy) {
      case 'performance':
        return b.totalReturn - a.totalReturn
      case 'tvl':
        return b.totalValue - a.totalValue
      case 'volume':
        return b.totalTrades - a.totalTrades
      case 'newest':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case 'oldest':
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      default:
        return 0
    }
  })

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`
    }
    return `$${value.toFixed(2)}`
  }

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  const getTierBadgeColor = (tier: string | null) => {
    const colors: Record<string, string> = {
      'S_TIER': 'bg-purple-500/20 text-purple-400',
      'A_TIER': 'bg-blue-500/20 text-blue-400',
      'B_TIER': 'bg-green-500/20 text-green-400',
      'C_TIER': 'bg-gray-500/20 text-gray-400',
    }
    return colors[tier || 'B_TIER'] || colors['B_TIER']
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <BouncingLogo size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sort Options */}
      <div className="flex gap-2 pb-2 border-b border-border overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setSortBy('performance')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
            sortBy === 'performance'
              ? 'bg-[#0066FF] text-white'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          <TrendingUp className="w-3 h-3 inline mr-1" />
          Performance
        </button>
        <button
          onClick={() => setSortBy('tvl')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
            sortBy === 'tvl'
              ? 'bg-[#0066FF] text-white'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          <DollarSign className="w-3 h-3 inline mr-1" />
          TVL
        </button>
        <button
          onClick={() => setSortBy('volume')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
            sortBy === 'volume'
              ? 'bg-[#0066FF] text-white'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          <Activity className="w-3 h-3 inline mr-1" />
          Volume
        </button>
        <button
          onClick={() => setSortBy('newest')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
            sortBy === 'newest'
              ? 'bg-[#0066FF] text-white'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          Newest
        </button>
        <button
          onClick={() => setSortBy('oldest')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
            sortBy === 'oldest'
              ? 'bg-[#0066FF] text-white'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}
        >
          Oldest
        </button>
      </div>

      {/* Pools Grid */}
      <div className="grid gap-3">
        {sortedPools.map((pool) => (
          <button
            key={pool.id}
            onClick={() => onPoolClick(pool)}
            className="w-full p-4 rounded-lg text-left bg-card border border-border hover:border-primary/50 hover:bg-accent transition-all"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-lg">{pool.name}</h3>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    getTierBadgeColor(pool.npcActor.tier)
                  )}>
                    {pool.npcActor.tier?.replace('_TIER', '')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {pool.description}
                </p>
              </div>
              <div className="text-right ml-4">
                <div className={cn(
                  "text-2xl font-bold",
                  pool.totalReturn >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatPercent(pool.totalReturn)}
                </div>
                <div className="text-xs text-muted-foreground">Return</div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  <DollarSign className="w-3 h-3" />
                  <span>Total Value</span>
                </div>
                <div className="font-semibold">{formatCurrency(pool.totalValue)}</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  <Users className="w-3 h-3" />
                  <span>Investors</span>
                </div>
                <div className="font-semibold">{pool.activeInvestors}</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  <Activity className="w-3 h-3" />
                  <span>Open Positions</span>
                </div>
                <div className="font-semibold">{pool.openPositions}</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                  {pool.lifetimePnL >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-600" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-600" />
                  )}
                  <span>Lifetime P&L</span>
                </div>
                <div className={cn(
                  "font-semibold",
                  pool.lifetimePnL >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatCurrency(pool.lifetimePnL)}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground">
                {pool.totalTrades} trades • {pool.performanceFeeRate * 100}% fee on profits
              </div>
              {!authenticated && (
                <div className="text-xs text-primary font-medium">
                  Connect to invest →
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {pools.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No pools available yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Pools will be created by trader NPCs
          </p>
        </div>
      )}
    </div>
  )
}

