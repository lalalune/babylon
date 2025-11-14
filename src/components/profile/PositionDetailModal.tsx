'use client'

import { useState, useEffect } from 'react'
import { X, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertTriangle, BarChart3, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { FollowButton } from '@/components/interactions'
import { PredictionPricing, calculateExpectedPayout } from '@/lib/prediction-pricing'
import type { PredictionPosition, PerpPositionFromAPI, ProfileWidgetPoolDeposit } from '@/types/profile'

interface PositionDetailModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'prediction' | 'perp' | 'pool'
  data: PredictionPosition | PerpPositionFromAPI | ProfileWidgetPoolDeposit | null
  userId?: string // User ID of the profile being viewed
  onSuccess?: () => void // Callback after successful trade
}

interface PerpMarket {
  ticker: string
  name: string
  currentPrice: number
  fundingRate: {
    rate: number
    nextFundingTime: string
  }
  maxLeverage: number
  minOrderSize: number
}

interface PredictionMarket {
  id: number | string
  text: string
  yesShares?: number
  noShares?: number
  resolutionDate?: string
}

export function PositionDetailModal({ isOpen, onClose, type, data, userId, onSuccess }: PositionDetailModalProps) {
  const { user, authenticated, login } = useAuth()
  const [activeTab, setActiveTab] = useState<'details' | 'trade'>('details')
  
  // Trading state
  const [side, setSide] = useState<'long' | 'short' | 'yes' | 'no'>('long')
  const [size, setSize] = useState('100')
  const [leverage, setLeverage] = useState(10)
  const [amount, setAmount] = useState('10')
  const [loading, setLoading] = useState(false)
  
  // Market data
  const [perpMarket, setPerpMarket] = useState<PerpMarket | null>(null)
  const [predictionMarket, setPredictionMarket] = useState<PredictionMarket | null>(null)

  useEffect(() => {
    if (isOpen && data) {
      setActiveTab('details')
      // Fetch market data if needed for trading
      if (type === 'perp' && 'ticker' in data) {
        fetchPerpMarket((data as PerpPositionFromAPI).ticker)
      } else if (type === 'prediction' && 'marketId' in data) {
        fetchPredictionMarket((data as PredictionPosition).marketId)
      }
    }
  }, [isOpen, type, data])

  const fetchPerpMarket = async (ticker: string) => {
    const response = await fetch('/api/markets/perps')
    if (response.ok) {
      const data = await response.json()
      const market = data.markets?.find((m: PerpMarket) => m.ticker === ticker)
      if (market) {
        setPerpMarket(market)
        setSide(market.ticker ? 'long' : 'long')
      }
    }
  }

  const fetchPredictionMarket = async (marketId: string) => {
    const response = await fetch(`/api/markets/predictions/${marketId}`)
    if (response.ok) {
      const data = await response.json()
      setPredictionMarket(data)
      setSide('yes')
    }
  }

  const handlePerpTrade = async () => {
    if (!user || !perpMarket) return

    const sizeNum = parseFloat(size) || 0
    if (sizeNum < perpMarket.minOrderSize) {
      toast.error(`Minimum order size is $${perpMarket.minOrderSize}`)
      return
    }

    setLoading(true)
    const response = await fetch('/api/markets/perps/open', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${window.__privyAccessToken || ''}`,
      },
      body: JSON.stringify({
        ticker: perpMarket.ticker,
        side,
        size: sizeNum,
        leverage,
      }),
    })

    const responseData = await response.json()
    if (!response.ok) {
      toast.error(responseData.error || 'Failed to open position')
      setLoading(false)
      return
    }

    toast.success('Position opened!')
    onClose()
    if (onSuccess) onSuccess()
    setLoading(false)
  }

  const handlePredictionTrade = async () => {
    if (!user || !predictionMarket) return

    const amountNum = parseFloat(amount) || 0
    if (amountNum < 1) {
      toast.error('Minimum bet is $1')
      return
    }

    setLoading(true)
    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
    if (!token) {
      toast.error('Authentication required')
      setLoading(false)
      return
    }

    const response = await fetch(`/api/markets/predictions/${predictionMarket.id}/buy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        side,
        amount: amountNum,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to buy shares' }))
      toast.error(errorData.error || 'Failed to buy shares')
      setLoading(false)
      return
    }

    toast.success(`Bought ${side.toUpperCase()} shares!`)
    onClose()
    if (onSuccess) onSuccess()
    setLoading(false)
  }

  if (!isOpen || !data) return null

  const formatPoints = (points: number) => {
    return points.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })
  }

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`
  }

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Calculate prediction trade preview
  const getPredictionCalculation = () => {
    if (!predictionMarket || type !== 'prediction') return null
    const yesShares = predictionMarket.yesShares || 500
    const noShares = predictionMarket.noShares || 500
    const amountNum = parseFloat(amount) || 0
    if (amountNum <= 0) return null
    return PredictionPricing.calculateBuy(yesShares, noShares, side as 'yes' | 'no', amountNum)
  }

  const predictionCalc = getPredictionCalculation()
  const expectedPayout = predictionCalc ? calculateExpectedPayout(predictionCalc.sharesBought) : 0
  const expectedProfit = expectedPayout - (parseFloat(amount) || 0)

  // Calculate perp trade preview
  const sizeNum = parseFloat(size) || 0
  const marginRequired = perpMarket ? sizeNum / leverage : 0
  const positionValue = sizeNum * leverage
  const liquidationPrice = perpMarket && type === 'perp' && 'currentPrice' in data
    ? side === 'long'
      ? perpMarket.currentPrice * (1 - 0.9 / leverage)
      : perpMarket.currentPrice * (1 + 0.9 / leverage)
    : 0
  const liquidationDistance = perpMarket && liquidationPrice > 0
    ? side === 'long'
      ? ((perpMarket.currentPrice - liquidationPrice) / perpMarket.currentPrice) * 100
      : ((liquidationPrice - perpMarket.currentPrice) / perpMarket.currentPrice) * 100
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">
              {type === 'prediction' && 'Prediction'}
              {type === 'perp' && 'Stock'}
              {type === 'pool' && 'Agent Stake'}
            </h2>
            {userId && authenticated && user && user.id !== userId && (
              <FollowButton userId={userId} size="sm" variant="button" className="ml-2" />
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('details')}
            className={cn(
              "flex-1 px-4 py-3 font-medium transition-colors",
              activeTab === 'details'
                ? "text-[#0066FF] border-b-2 border-[#0066FF]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Details
          </button>
          {(type === 'prediction' || type === 'perp') && (
            <button
              onClick={() => {
                if (!authenticated) {
                  login()
                  return
                }
                setActiveTab('trade')
              }}
              className={cn(
                "flex-1 px-4 py-3 font-medium transition-colors",
                activeTab === 'trade'
                  ? "text-[#0066FF] border-b-2 border-[#0066FF]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Zap className="w-4 h-4 inline mr-2" />
              Trade
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {activeTab === 'details' && (
            <>
              {/* Prediction Position Details */}
              {type === 'prediction' && 'question' in data && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {(data as PredictionPosition).question}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-1 rounded text-sm font-medium",
                        (data as PredictionPosition).side === 'YES'
                          ? "bg-green-600/20 text-green-600"
                          : "bg-red-600/20 text-red-600"
                      )}>
                        {(data as PredictionPosition).side}
                      </span>
                      {(data as PredictionPosition).resolved !== undefined && (
                        <span className={cn(
                          "text-xs px-2 py-1 rounded",
                          (data as PredictionPosition).resolved
                            ? "bg-muted text-muted-foreground"
                            : "bg-blue-600/20 text-blue-600"
                        )}>
                          {(data as PredictionPosition).resolved ? 'Resolved' : 'Active'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Shares</div>
                      <div className="text-lg font-bold text-foreground">
                        {(data as PredictionPosition).shares.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Avg Entry Price</div>
                      <div className="text-lg font-bold text-foreground">
                        {formatPrice((data as PredictionPosition).avgPrice)}
                      </div>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Current Price</div>
                      <div className="text-lg font-bold text-foreground">
                        {formatPrice((data as PredictionPosition).currentPrice)}
                      </div>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">P&L</div>
                      <div className={cn(
                        "text-lg font-bold",
                        ((data as PredictionPosition).currentPrice - (data as PredictionPosition).avgPrice) >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      )}>
                        {formatPercent(
                          ((data as PredictionPosition).currentPrice - (data as PredictionPosition).avgPrice) /
                          (data as PredictionPosition).avgPrice * 100
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Perp Position Details */}
              {type === 'perp' && 'ticker' in data && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                      {(data as PerpPositionFromAPI).ticker}
                      {(data as PerpPositionFromAPI).unrealizedPnLPercent >= 0 ? (
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-1 rounded text-sm font-medium",
                        (data as PerpPositionFromAPI).side === 'LONG'
                          ? "bg-green-600/20 text-green-600"
                          : "bg-red-600/20 text-red-600"
                      )}>
                        {(data as PerpPositionFromAPI).side}
                      </span>
                      {(data as PerpPositionFromAPI).leverage && (
                        <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                          {(data as PerpPositionFromAPI).leverage}x Leverage
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Position Size</div>
                      <div className="text-lg font-bold text-foreground">
                        {formatPoints((data as PerpPositionFromAPI).size)} pts
                      </div>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Entry Price</div>
                      <div className="text-lg font-bold text-foreground">
                        {formatPrice((data as PerpPositionFromAPI).entryPrice)}
                      </div>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Current Price</div>
                      <div className="text-lg font-bold text-foreground">
                        {formatPrice((data as PerpPositionFromAPI).currentPrice)}
                      </div>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Unrealized P&L</div>
                      <div className={cn(
                        "text-lg font-bold",
                        (data as PerpPositionFromAPI).unrealizedPnL >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      )}>
                        {formatPoints((data as PerpPositionFromAPI).unrealizedPnL)} pts
                      </div>
                    </div>
                    {(data as PerpPositionFromAPI).liquidationPrice && (
                      <div className="bg-muted/30 p-3 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">Liquidation Price</div>
                        <div className="text-lg font-bold text-red-600">
                          {formatPrice((data as PerpPositionFromAPI).liquidationPrice)}
                        </div>
                      </div>
                    )}
                    {(data as PerpPositionFromAPI).fundingPaid !== undefined && (
                      <div className="bg-muted/30 p-3 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">Funding Paid</div>
                        <div className="text-lg font-bold text-foreground">
                          {formatPoints((data as PerpPositionFromAPI).fundingPaid)} pts
                        </div>
                      </div>
                    )}
                    {(data as PerpPositionFromAPI).openedAt && (
                      <div className="bg-muted/30 p-3 rounded-lg col-span-2">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Opened
                        </div>
                        <div className="text-sm font-medium text-foreground">
                          {formatDate((data as PerpPositionFromAPI).openedAt)}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Pool Position Details */}
              {type === 'pool' && 'poolName' in data && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {(data as ProfileWidgetPoolDeposit).poolName}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Staked Amount</div>
                      <div className="text-lg font-bold text-foreground">
                        {formatPoints((data as ProfileWidgetPoolDeposit).amount)} pts
                      </div>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Return</div>
                      <div className={cn(
                        "text-lg font-bold",
                        (data as ProfileWidgetPoolDeposit).returnPercent >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      )}>
                        {formatPercent((data as ProfileWidgetPoolDeposit).returnPercent)}
                      </div>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Unrealized P&L</div>
                      <div className={cn(
                        "text-lg font-bold",
                        (data as ProfileWidgetPoolDeposit).unrealizedPnL >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      )}>
                        {formatPoints((data as ProfileWidgetPoolDeposit).unrealizedPnL)} pts
                      </div>
                    </div>
                    {(data as ProfileWidgetPoolDeposit).depositedAt && (
                      <div className="bg-muted/30 p-3 rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Deposited
                        </div>
                        <div className="text-sm font-medium text-foreground">
                          {formatDate((data as ProfileWidgetPoolDeposit).depositedAt)}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'trade' && (
            <>
              {/* Prediction Trading */}
              {type === 'prediction' && predictionMarket && (
                <>
                  <div className="p-4 bg-muted rounded">
                    <p className="text-foreground font-medium">{predictionMarket.text}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-green-600/15 rounded">
                      <div className="text-xs text-green-600 mb-1">YES</div>
                      <div className="text-2xl font-bold text-green-600">
                        {(() => {
                          const totalShares = (predictionMarket.yesShares || 0) + (predictionMarket.noShares || 0)
                          return totalShares === 0 
                            ? '50.0' 
                            : (((predictionMarket.yesShares || 0) / totalShares) * 100).toFixed(1)
                        })()}%
                      </div>
                    </div>
                    <div className="p-3 bg-red-600/15 rounded">
                      <div className="text-xs text-red-600 mb-1">NO</div>
                      <div className="text-2xl font-bold text-red-600">
                        {(() => {
                          const totalShares = (predictionMarket.yesShares || 0) + (predictionMarket.noShares || 0)
                          return totalShares === 0 
                            ? '50.0' 
                            : (((predictionMarket.noShares || 0) / totalShares) * 100).toFixed(1)
                        })()}%
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSide('yes')}
                      className={cn(
                        'flex-1 py-3 rounded font-bold transition-all flex items-center justify-center gap-2',
                        side === 'yes'
                          ? 'bg-green-600 text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <CheckCircle size={18} />
                      BUY YES
                    </button>
                    <button
                      onClick={() => setSide('no')}
                      className={cn(
                        'flex-1 py-3 rounded font-bold transition-all flex items-center justify-center gap-2',
                        side === 'no'
                          ? 'bg-red-600 text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <XCircle size={18} />
                      BUY NO
                    </button>
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Amount (USD)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min="1"
                      step="1"
                      className="w-full px-4 py-3 rounded bg-muted/50 text-foreground text-base font-medium focus:outline-none focus:bg-muted focus:ring-2 focus:ring-[#0066FF]/30"
                      placeholder="Min: $1"
                    />
                  </div>

                  {predictionCalc && (
                    <div className="bg-muted/20 p-4 rounded space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Shares Received</span>
                        <span className="font-bold text-foreground">{predictionCalc.sharesBought.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">If {side.toUpperCase()} Wins</span>
                        <span className="font-bold text-green-600">{formatPrice(expectedPayout)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Expected Profit</span>
                        <span className={cn(
                          "font-bold",
                          expectedProfit >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {formatPrice(expectedProfit)}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handlePredictionTrade}
                    disabled={loading || parseFloat(amount) < 1}
                    className={cn(
                      'w-full py-3 rounded font-bold text-white transition-all',
                      side === 'yes' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700',
                      (loading || parseFloat(amount) < 1) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {loading ? 'Placing Bet...' : `BUY ${side.toUpperCase()}`}
                  </button>
                </>
              )}

              {/* Perp Trading */}
              {type === 'perp' && perpMarket && (
                <>
                  <div className="p-4 bg-muted rounded">
                    <div className="text-sm text-muted-foreground mb-1">Current Price</div>
                    <div className="text-2xl font-bold text-foreground">
                      {formatPrice(perpMarket.currentPrice)}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSide('long')}
                      className={cn(
                        'flex-1 py-3 rounded font-bold transition-all flex items-center justify-center gap-2',
                        side === 'long'
                          ? 'bg-green-600 text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <TrendingUp size={18} />
                      LONG
                    </button>
                    <button
                      onClick={() => setSide('short')}
                      className={cn(
                        'flex-1 py-3 rounded font-bold transition-all flex items-center justify-center gap-2',
                        side === 'short'
                          ? 'bg-red-600 text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <TrendingDown size={18} />
                      SHORT
                    </button>
                  </div>

                  <div className="bg-muted rounded p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-muted-foreground">Position Size (USD)</label>
                      <input
                        type="number"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        min={perpMarket.minOrderSize}
                        step="10"
                        className="w-32 px-3 py-1.5 rounded bg-background/50 text-foreground text-right font-medium focus:outline-none focus:bg-background focus:ring-2 focus:ring-[#0066FF]/30"
                        placeholder={`Min: $${perpMarket.minOrderSize}`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-muted-foreground">Leverage</label>
                        <span className="text-base font-bold text-foreground">{leverage}x</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max={perpMarket.maxLeverage}
                        value={leverage}
                        onChange={(e) => setLeverage(parseInt(e.target.value))}
                        className="w-full h-2 mt-2 bg-background rounded appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>1x</span>
                        <span>{perpMarket.maxLeverage}x</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/20 p-4 rounded">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <span className="text-muted-foreground">Margin Required</span>
                      <span className="font-bold text-foreground text-right">{formatPrice(marginRequired)}</span>
                      <span className="text-muted-foreground">Position Value</span>
                      <span className="font-bold text-foreground text-right">{formatPrice(positionValue)}</span>
                      <span className="text-muted-foreground">Liquidation Price</span>
                      <span className="font-bold text-red-600 text-right">{formatPrice(liquidationPrice)}</span>
                      <span className="text-muted-foreground">Distance to Liq</span>
                      <span className={cn(
                        "font-medium text-right",
                        liquidationDistance > 5 ? "text-green-600" : liquidationDistance > 2 ? "text-yellow-600" : "text-red-600"
                      )}>
                        {liquidationDistance.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {leverage > 50 && (
                    <div className="flex items-start gap-3 p-3 bg-yellow-500/15 rounded">
                      <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <div className="font-bold text-yellow-600 mb-1">High Risk Position</div>
                        <p className="text-muted-foreground">
                          Leverage above 50x is extremely risky. Small price movements can lead to liquidation.
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handlePerpTrade}
                    disabled={loading || sizeNum < perpMarket.minOrderSize}
                    className={cn(
                      'w-full py-3 rounded font-bold text-white transition-all',
                      side === 'long' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700',
                      (loading || sizeNum < perpMarket.minOrderSize) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {loading ? 'Opening Position...' : `${side === 'long' ? 'LONG' : 'SHORT'} ${perpMarket.ticker} ${leverage}x`}
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t border-border p-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
