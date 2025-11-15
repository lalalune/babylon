'use client'

import { useEffect, useState, useTransition } from 'react'
import { Activity, RefreshCw, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/shared/Avatar'
import { Skeleton } from '@/components/shared/Skeleton'
import { z } from 'zod'

const TradeTypeSchema = z.enum(['balance', 'npc', 'position']);
type TradeType = z.infer<typeof TradeTypeSchema>;

const UserSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  profileImageUrl: z.string().nullable(),
  isActor: z.boolean(),
});

const BaseTradeSchema = z.object({
  type: TradeTypeSchema,
  id: z.string(),
  timestamp: z.coerce.date(),
  user: UserSchema.nullable(),
});

const BalanceTradeSchema = BaseTradeSchema.extend({
  type: z.literal('balance'),
  amount: z.string(),
  balanceBefore: z.string(),
  balanceAfter: z.string(),
  transactionType: z.string(),
  description: z.string().nullable(),
  relatedId: z.string().nullable(),
});
type BalanceTrade = z.infer<typeof BalanceTradeSchema>;

const NPCTradeSchema = BaseTradeSchema.extend({
  type: z.literal('npc'),
  marketType: z.string(),
  ticker: z.string().nullable(),
  marketId: z.string().nullable(),
  action: z.string(),
  side: z.string().nullable(),
  amount: z.number(),
  price: z.number(),
  sentiment: z.number().nullable(),
  reason: z.string().nullable(),
});
type NPCTrade = z.infer<typeof NPCTradeSchema>;

const PositionTradeSchema = BaseTradeSchema.extend({
  type: z.literal('position'),
  market: z.object({
    id: z.string(),
    question: z.string(),
    resolved: z.boolean(),
    resolution: z.boolean().nullable(),
  }),
  side: z.string(),
  shares: z.string(),
  avgPrice: z.string(),
  createdAt: z.coerce.date(),
});
type PositionTrade = z.infer<typeof PositionTradeSchema>;

const TradeSchema = z.discriminatedUnion('type', [
  BalanceTradeSchema,
  NPCTradeSchema,
  PositionTradeSchema,
]);
type Trade = z.infer<typeof TradeSchema>;

export function TradingFeedTab() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | TradeType>('all')
  const [isRefreshing, startRefresh] = useTransition();
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    fetchTrades()
    const interval = setInterval(() => fetchTrades(), 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [filter])

  // Show/hide form fields based on trade type
  useEffect(() => {
    const tradeTypeSelect = document.querySelector<HTMLSelectElement>('select[name="tradeType"]')
    const balanceFields = document.getElementById('balanceFields')
    const npcFields = document.getElementById('npcFields')

    const handleTradeTypeChange = () => {
      if (!tradeTypeSelect || !balanceFields || !npcFields) return
      
      if (tradeTypeSelect.value === 'balance') {
        balanceFields.classList.remove('hidden')
        npcFields.classList.add('hidden')
        // Make balance fields required
        balanceFields.querySelectorAll('input[required], select[required]').forEach(el => {
          el.setAttribute('required', '')
        })
        // Remove required from NPC fields
        npcFields.querySelectorAll('input[required]').forEach(el => {
          el.removeAttribute('required')
        })
      } else {
        balanceFields.classList.add('hidden')
        npcFields.classList.remove('hidden')
        // Remove required from balance fields
        balanceFields.querySelectorAll('input[required], select[required]').forEach(el => {
          el.removeAttribute('required')
        })
        // Make NPC fields required
        npcFields.querySelectorAll('input[required]').forEach(el => {
          el.setAttribute('required', '')
        })
      }
    }

    tradeTypeSelect?.addEventListener('change', handleTradeTypeChange)
    // Set initial state
    handleTradeTypeChange()

    return () => {
      tradeTypeSelect?.removeEventListener('change', handleTradeTypeChange)
    }
  }, [showCreateForm])

  const fetchTrades = (showRefreshing = false) => {
    if (showRefreshing) {
      startRefresh(async () => {
        await fetchAndSetTrades();
      });
    } else {
      fetchAndSetTrades();
    }
  };

  const fetchAndSetTrades = async () => {
    const url = filter === 'all' 
      ? '/api/admin/trades?limit=50'
      : `/api/admin/trades?limit=50&type=${filter}`
    
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch trades')
    const data = await response.json()
    const validation = z.array(TradeSchema).safeParse(data.trades);
    if (!validation.success) {
      throw new Error('Invalid trade data structure');
    }
    setTrades(validation.data || [])
    setLoading(false)
  }

  const handleCreateTrade = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    const formData = new FormData(e.currentTarget)
    const tradeType = formData.get('tradeType') as string
    const payload: Record<string, unknown> = { type: tradeType }

    try {
      if (tradeType === 'balance') {
        payload.userId = formData.get('userId') as string
        payload.transactionType = formData.get('transactionType') as string
        payload.amount = parseFloat(formData.get('amount') as string)
        payload.description = formData.get('description') as string || undefined
        payload.relatedId = formData.get('relatedId') as string || undefined
        payload.updateBalance = formData.get('updateBalance') === 'true'
      } else if (tradeType === 'npc') {
        payload.npcActorId = formData.get('npcActorId') as string
        payload.marketType = formData.get('marketType') as string
        payload.ticker = formData.get('ticker') as string || undefined
        payload.marketId = formData.get('marketId') as string || undefined
        payload.action = formData.get('action') as string
        payload.side = formData.get('side') as string || undefined
        payload.amount = parseFloat(formData.get('amount') as string)
        payload.price = parseFloat(formData.get('price') as string)
        payload.sentiment = formData.get('sentiment') ? parseFloat(formData.get('sentiment') as string) : undefined
        payload.reason = formData.get('reason') as string || undefined
      }

      const response = await fetch('/api/admin/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create trade')
      }

      // Refresh trades and close form
      await fetchAndSetTrades()
      setShowCreateForm(false)
      e.currentTarget.reset()
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create trade')
    } finally {
      setCreating(false)
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
    // Handle null user (should not happen, but be safe)
    if (!trade.user) return null
    
    const displayName = trade.user.displayName || trade.user.username || 'Anonymous'
    
    return (
      <div className="bg-card border border-border rounded-2xl p-4 hover:border-primary/50 transition-colors">
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
        <div className="space-y-3 w-full">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
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
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Trade
          </button>
          <button
            onClick={() => fetchTrades(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Create Trade Form */}
      {showCreateForm && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Create Trade</h3>
            <button
              onClick={() => {
                setShowCreateForm(false)
                setCreateError(null)
              }}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreateTrade} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Trade Type</label>
              <select
                name="tradeType"
                required
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
              >
                <option value="balance">Balance Transaction</option>
                <option value="npc">NPC Trade</option>
              </select>
            </div>

            {/* Balance Transaction Fields */}
            <div id="balanceFields" className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">User ID</label>
                <input
                  type="text"
                  name="userId"
                  required
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                  placeholder="User ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Transaction Type</label>
                <select
                  name="transactionType"
                  required
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                >
                  <option value="pred_buy">Prediction Buy</option>
                  <option value="pred_sell">Prediction Sell</option>
                  <option value="perp_open">Perp Open</option>
                  <option value="perp_close">Perp Close</option>
                  <option value="perp_liquidation">Perp Liquidation</option>
                  <option value="deposit">Deposit</option>
                  <option value="withdrawal">Withdrawal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input
                  type="number"
                  name="amount"
                  required
                  step="0.01"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description (optional)</label>
                <input
                  type="text"
                  name="description"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                  placeholder="Trade description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Related ID (optional)</label>
                <input
                  type="text"
                  name="relatedId"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                  placeholder="Related entity ID"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="updateBalance"
                  value="true"
                  defaultChecked
                  className="w-4 h-4"
                />
                <label className="text-sm">Update user balance</label>
              </div>
            </div>

            {/* NPC Trade Fields */}
            <div id="npcFields" className="space-y-3 hidden">
              <div>
                <label className="block text-sm font-medium mb-1">NPC Actor ID</label>
                <input
                  type="text"
                  name="npcActorId"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                  placeholder="Actor ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Market Type</label>
                <select
                  name="marketType"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                >
                  <option value="prediction">Prediction</option>
                  <option value="perp">Perpetual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ticker (for perp)</label>
                <input
                  type="text"
                  name="ticker"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                  placeholder="Ticker symbol"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Market ID (for prediction)</label>
                <input
                  type="text"
                  name="marketId"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                  placeholder="Market ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Action</label>
                <input
                  type="text"
                  name="action"
                  required
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                  placeholder="e.g., BUY, SELL"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Side (optional)</label>
                <input
                  type="text"
                  name="side"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                  placeholder="e.g., long, short, YES, NO"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input
                  type="number"
                  name="amount"
                  required
                  step="0.01"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price</label>
                <input
                  type="number"
                  name="price"
                  required
                  step="0.01"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sentiment (optional)</label>
                <input
                  type="number"
                  name="sentiment"
                  step="0.01"
                  min="-1"
                  max="1"
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                  placeholder="-1 to 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                <textarea
                  name="reason"
                  rows={3}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                  placeholder="Trade reasoning"
                />
              </div>
            </div>

            {createError && (
              <div className="text-sm text-red-500 bg-red-500/10 p-2 rounded">
                {createError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Trade'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setCreateError(null)
                }}
                className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

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

