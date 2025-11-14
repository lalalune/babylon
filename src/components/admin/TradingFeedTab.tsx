'use client'

import { useEffect, useState } from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/shared/Avatar'
import { BouncingLogo } from '@/components/shared/BouncingLogo'

type TradeType = 'balance' | 'npc' | 'position'

interface BaseTrade {
  type: TradeType
  id: string
  timestamp: Date | string
  user: {
    id: string
    username: string | null
    displayName: string | null
    profileImageUrl: string | null
    isActor: boolean
  }
}

interface BalanceTrade extends BaseTrade {
  type: 'balance'
  amount: string
  balanceBefore: string
  balanceAfter: string
  transactionType: string
  description: string | null
  relatedId: string | null
}

interface NPCTrade extends BaseTrade {
  type: 'npc'
  marketType: string
  ticker: string | null
  marketId: string | null
  action: string
  side: string | null
  amount: number
  price: number
  sentiment: number | null
  reason: string | null
  pool: {
    id: string
    name: string
  } | null
}

interface PositionTrade extends BaseTrade {
  type: 'position'
  market: {
    id: string
    question: string
    resolved: boolean
    resolution: boolean | null
  }
  side: string
  shares: string
  avgPrice: string
  createdAt: Date | string
}

type Trade = BalanceTrade | NPCTrade | PositionTrade

export function TradingFeedTab() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | TradeType>('all')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchTrades()
    const interval = setInterval(fetchTrades, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [filter])

  const fetchTrades = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const url = filter === 'all' 
        ? '/api/admin/trades?limit=50'
        : `/api/admin/trades?limit=50&type=${filter}`
      
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch trades')
      const data = await response.json()
      setTrades(data.trades || [])
    } catch (error) {
      console.error('Failed to fetch trades:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  const formatTime = (timestamp: Date | string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  const TradeCard = ({ trade }: { trade: Trade }) => {
    const displayName = trade.user.displayName || trade.user.username || 'Anonymous'
    
    return (
      <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
        <div className="flex items-start gap-3">
          <Avatar
            src={trade.user.profileImageUrl || undefined}
            alt={displayName}
            size="sm"
          />
          
          <div className="flex-1 min-w-0">
            {/* User Info */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium truncate">{displayName}</span>
              {trade.user.isActor && (
                <span className="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-500">
                  NPC
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {formatTime(trade.timestamp)}
              </span>
            </div>

            {/* Trade Details */}
            {trade.type === 'balance' && (
              <BalanceTradeDetails trade={trade} />
            )}
            {trade.type === 'npc' && (
              <NPCTradeDetails trade={trade} />
            )}
            {trade.type === 'position' && (
              <PositionTradeDetails trade={trade} />
            )}
          </div>
        </div>
      </div>
    )
  }

  const BalanceTradeDetails = ({ trade }: { trade: BalanceTrade }) => {
    const amount = parseFloat(trade.amount)
    const isPositive = amount >= 0

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={cn(
            'px-2 py-1 text-xs font-medium rounded',
            isPositive ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
          )}>
            {trade.transactionType}
          </span>
          <span className={cn(
            'text-lg font-bold',
            isPositive ? 'text-green-600' : 'text-red-600'
          )}>
            {isPositive ? '+' : ''}{formatCurrency(amount)}
          </span>
        </div>
        {trade.description && (
          <p className="text-sm text-muted-foreground">{trade.description}</p>
        )}
        <div className="text-xs text-muted-foreground">
          Balance: {formatCurrency(trade.balanceBefore)} → {formatCurrency(trade.balanceAfter)}
        </div>
      </div>
    )
  }

  const NPCTradeDetails = ({ trade }: { trade: NPCTrade }) => {
    const isLong = trade.side === 'long' || trade.side === 'YES'

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={cn(
            'px-2 py-1 text-xs font-medium rounded',
            isLong ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
          )}>
            {trade.action.toUpperCase()}
          </span>
          {trade.ticker && (
            <span className="font-bold">{trade.ticker}</span>
          )}
          {trade.side && (
            <span className={cn(
              'text-xs font-medium',
              isLong ? 'text-green-600' : 'text-red-600'
            )}>
              {trade.side}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span>Amount: {formatCurrency(trade.amount)}</span>
          <span>Price: {formatCurrency(trade.price)}</span>
          {trade.sentiment !== null && (
            <span className={cn(
              'text-xs',
              trade.sentiment > 0 ? 'text-green-600' : trade.sentiment < 0 ? 'text-red-600' : 'text-gray-600'
            )}>
              Sentiment: {trade.sentiment > 0 ? '+' : ''}{(trade.sentiment * 100).toFixed(0)}%
            </span>
          )}
        </div>
        {trade.reason && (
          <p className="text-xs text-muted-foreground italic">&quot;{trade.reason}&quot;</p>
        )}
        {trade.pool && (
          <div className="text-xs text-muted-foreground">
            Pool: {trade.pool.name}
          </div>
        )}
      </div>
    )
  }

  const PositionTradeDetails = ({ trade }: { trade: PositionTrade }) => {
    const isYes = trade.side === 'YES'

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className={cn(
            'px-2 py-1 text-xs font-medium rounded',
            isYes ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
          )}>
            {trade.side}
          </span>
        </div>
        <p className="text-sm font-medium line-clamp-2">{trade.market.question}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Shares: {parseFloat(trade.shares).toFixed(2)}</span>
          <span>Avg Price: {formatCurrency(trade.avgPrice)}</span>
        </div>
        {trade.market.resolved && (
          <div className="text-xs">
            <span className="text-muted-foreground">Resolved: </span>
            <span className={cn(
              'font-medium',
              trade.market.resolution ? 'text-green-600' : 'text-red-600'
            )}>
              {trade.market.resolution ? 'YES' : 'NO'}
            </span>
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'balance', 'npc', 'position'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {f === 'all' ? 'All' : f === 'balance' ? 'Balance' : f === 'npc' ? 'NPC' : 'Position'}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => fetchTrades(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Trades List */}
      {trades.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No trades found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trades.map((trade) => (
            <TradeCard key={trade.id} trade={trade} />
          ))}
        </div>
      )}
    </div>
  )
}

