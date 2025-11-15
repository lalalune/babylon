'use client'

import { Avatar } from '@/components/shared/Avatar'
import { cn } from '@/lib/utils'
import { ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp, Send, Coins } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

type TradeType = 'balance' | 'npc' | 'position' | 'perp' | 'transfer'

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
  } | null
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
}

interface PositionTrade extends BaseTrade {
  type: 'position'
  market: {
    id: string
    question: string
    resolved: boolean
    resolution: boolean | null
  } | null
  side: string
  shares: string
  avgPrice: string
  createdAt: Date | string
}

interface PerpTrade extends BaseTrade {
  type: 'perp'
  ticker: string
  organization: {
    id: string
    name: string
    ticker: string
  } | null
  side: 'long' | 'short'
  entryPrice: string
  currentPrice: string
  size: string
  leverage: number
  unrealizedPnL: string
  liquidationPrice: string
  closedAt: Date | string | null
}

interface TransferTrade extends BaseTrade {
  type: 'transfer'
  otherParty: {
    id: string
    username: string | null
    displayName: string | null
    profileImageUrl: string | null
    isActor: boolean
  } | null
  amount: number
  pointsBefore: number
  pointsAfter: number
  direction: 'sent' | 'received'
  message?: string
}

export type Trade = BalanceTrade | NPCTrade | PositionTrade | PerpTrade | TransferTrade

interface TradeCardProps {
  trade: Trade
}

export function TradeCard({ trade }: TradeCardProps) {
  const router = useRouter()
  
  // Handle null user (should not happen, but be safe)
  if (!trade.user) return null
  
  const displayName = trade.user.displayName || trade.user.username || 'Anonymous'
  
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

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num)) return '$0.00'
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/profile/${trade.user!.id}`)
  }

  const handleAssetClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (trade.type === 'npc') {
      if (trade.marketType === 'perp' && trade.ticker) {
        router.push(`/markets/perps/${trade.ticker}`)
      } else if (trade.marketType === 'prediction' && trade.marketId) {
        router.push(`/markets/predictions/${trade.marketId}`)
      }
    } else if (trade.type === 'position' && trade.market) {
      router.push(`/markets/predictions/${trade.market.id}`)
    } else if (trade.type === 'perp') {
      router.push(`/markets/perps/${trade.ticker}`)
    }
  }

  return (
    <div className="bg-card border-b border-border p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div 
          className="cursor-pointer flex-shrink-0"
          onClick={handleProfileClick}
        >
          <Avatar
            src={trade.user.profileImageUrl || undefined}
            alt={displayName}
            size="sm"
          />
        </div>
        
        {/* Trade Content */}
        <div className="flex-1 min-w-0">
          {/* User Info */}
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="font-medium truncate hover:underline cursor-pointer"
              onClick={handleProfileClick}
            >
              {displayName}
            </span>
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
            <BalanceTradeContent trade={trade} onAssetClick={handleAssetClick} formatCurrency={formatCurrency} />
          )}
          {trade.type === 'npc' && (
            <NPCTradeContent trade={trade} onAssetClick={handleAssetClick} formatCurrency={formatCurrency} />
          )}
          {trade.type === 'position' && (
            <PositionTradeContent trade={trade} onAssetClick={handleAssetClick} formatCurrency={formatCurrency} />
          )}
          {trade.type === 'perp' && (
            <PerpTradeContent trade={trade} onAssetClick={handleAssetClick} formatCurrency={formatCurrency} />
          )}
          {trade.type === 'transfer' && (
            <TransferTradeContent trade={trade} router={router} />
          )}
        </div>
      </div>
    </div>
  )
}

function BalanceTradeContent({ 
  trade, 
  onAssetClick, 
  formatCurrency 
}: { 
  trade: BalanceTrade
  onAssetClick: (e: React.MouseEvent) => void
  formatCurrency: (value: string | number) => string
}) {
  const amount = parseFloat(trade.amount)
  const isPositive = amount >= 0
  const actionText = trade.transactionType.replace('_', ' ').toUpperCase()

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {isPositive ? (
          <ArrowUpRight className="w-4 h-4 text-green-500" />
        ) : (
          <ArrowDownRight className="w-4 h-4 text-red-500" />
        )}
        <span className="text-sm text-muted-foreground">{actionText}</span>
        <span className={cn(
          'text-base font-semibold',
          isPositive ? 'text-green-600' : 'text-red-600'
        )}>
          {isPositive ? '+' : ''}{formatCurrency(amount)}
        </span>
      </div>
      {trade.description && (
        <p 
          className="text-sm text-foreground hover:underline cursor-pointer line-clamp-2"
          onClick={onAssetClick}
        >
          {trade.description}
        </p>
      )}
    </div>
  )
}

function NPCTradeContent({ 
  trade, 
  onAssetClick, 
  formatCurrency 
}: { 
  trade: NPCTrade
  onAssetClick: (e: React.MouseEvent) => void
  formatCurrency: (value: string | number) => string
}) {
  const isLong = trade.side === 'long' || trade.side === 'YES'
  const action = trade.action.toUpperCase()

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn(
          'px-2 py-1 text-xs font-medium rounded',
          isLong ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
        )}>
          {action}
        </span>
        {trade.ticker && (
          <span 
            className="font-bold hover:underline cursor-pointer"
            onClick={onAssetClick}
          >
            {trade.ticker}
          </span>
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
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>Amount: {formatCurrency(trade.amount)}</span>
        <span>Price: {formatCurrency(trade.price)}</span>
      </div>
      {trade.reason && (
        <p className="text-xs text-muted-foreground italic line-clamp-2">
          &quot;{trade.reason}&quot;
        </p>
      )}
    </div>
  )
}

function PositionTradeContent({ 
  trade, 
  onAssetClick, 
  formatCurrency 
}: { 
  trade: PositionTrade
  onAssetClick: (e: React.MouseEvent) => void
  formatCurrency: (value: string | number) => string
}) {
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
        <span className="text-sm text-muted-foreground">Position</span>
      </div>
      {trade.market && (
        <p 
          className="text-sm font-medium line-clamp-2 hover:underline cursor-pointer"
          onClick={onAssetClick}
        >
          {trade.market.question}
        </p>
      )}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Shares: {parseFloat(trade.shares).toFixed(2)}</span>
        <span>Avg Price: {formatCurrency(trade.avgPrice)}</span>
      </div>
    </div>
  )
}

function PerpTradeContent({ 
  trade, 
  onAssetClick, 
  formatCurrency 
}: { 
  trade: PerpTrade
  onAssetClick: (e: React.MouseEvent) => void
  formatCurrency: (value: string | number) => string
}) {
  const isLong = trade.side === 'long'
  const pnl = parseFloat(trade.unrealizedPnL)
  const isPnLPositive = pnl >= 0
  const isClosed = trade.closedAt !== null

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        {isLong ? (
          <TrendingUp className="w-4 h-4 text-green-500" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-500" />
        )}
        <span className={cn(
          'px-2 py-1 text-xs font-medium rounded',
          isLong ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
        )}>
          {trade.side.toUpperCase()}
        </span>
        <span 
          className="font-bold hover:underline cursor-pointer"
          onClick={onAssetClick}
        >
          {trade.ticker}
        </span>
        <span className="text-xs text-muted-foreground">
          {trade.leverage}x
        </span>
        {isClosed && (
          <span className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground">
            CLOSED
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>Size: {formatCurrency(trade.size)}</span>
        <span>Entry: {formatCurrency(trade.entryPrice)}</span>
      </div>
      {!isClosed && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">PnL:</span>
          <span className={cn(
            'font-semibold',
            isPnLPositive ? 'text-green-600' : 'text-red-600'
          )}>
            {isPnLPositive ? '+' : ''}{formatCurrency(pnl)}
          </span>
        </div>
      )}
    </div>
  )
}

function TransferTradeContent({ 
  trade,
  router
}: { 
  trade: TransferTrade
  router: AppRouterInstance
}) {
  const isSent = trade.direction === 'sent'
  const otherPartyName = trade.otherParty?.displayName || trade.otherParty?.username || 'Unknown'
  
  const handleOtherPartyClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (trade.otherParty) {
      router.push(`/profile/${trade.otherParty.id}`)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {isSent ? (
          <Send className="w-4 h-4 text-blue-500" />
        ) : (
          <Coins className="w-4 h-4 text-green-500" />
        )}
        <span className="text-sm text-muted-foreground">
          {isSent ? 'Sent points to' : 'Received points from'}
        </span>
        <span 
          className="font-medium hover:underline cursor-pointer"
          onClick={handleOtherPartyClick}
        >
          {otherPartyName}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn(
          'text-base font-semibold',
          isSent ? 'text-red-600' : 'text-green-600'
        )}>
          {isSent ? '-' : '+'}{Math.abs(trade.amount)} pts
        </span>
        <span className="text-xs text-muted-foreground">
          Balance: {trade.pointsAfter} pts
        </span>
      </div>
      {trade.message && (
        <p className="text-sm text-muted-foreground italic">
          &quot;{trade.message}&quot;
        </p>
      )}
    </div>
  )
}

