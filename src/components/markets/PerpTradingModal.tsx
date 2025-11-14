'use client'

import { useState, useEffect } from 'react'
import { X, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { BouncingLogo } from '@/components/shared/BouncingLogo'

interface PerpMarket {
  ticker: string
  organizationId: string
  name: string
  currentPrice: number
  fundingRate: {
    rate: number
    nextFundingTime: string
  }
  maxLeverage: number
  minOrderSize: number
}

interface PerpTradingModalProps {
  market: PerpMarket
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function PerpTradingModal({ market, isOpen, onClose, onSuccess }: PerpTradingModalProps) {
  const { user } = useAuth()
  const [side, setSide] = useState<'long' | 'short'>('long')
  const [size, setSize] = useState('100')
  const [leverage, setLeverage] = useState(10)
  const [loading, setLoading] = useState(false)

  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = ''
      return
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose, loading])

  // Cleanup on unmount (for HMR)
  useEffect(() => {
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  if (!isOpen) return null

  const sizeNum = parseFloat(size) || 0
  const marginRequired = sizeNum / leverage
  const liquidationPrice =
    side === 'long'
      ? market.currentPrice * (1 - 0.9 / leverage)
      : market.currentPrice * (1 + 0.9 / leverage)
  
  const positionValue = sizeNum * leverage
  const liquidationDistance = side === 'long'
    ? ((market.currentPrice - liquidationPrice) / market.currentPrice) * 100
    : ((liquidationPrice - market.currentPrice) / market.currentPrice) * 100

  const handleSubmit = async () => {
    if (!user) return

    if (sizeNum < market.minOrderSize) {
      toast.error(`Minimum order size is $${market.minOrderSize}`)
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
        ticker: market.ticker,
        side,
        size: sizeNum,
        leverage,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      toast.error(data.error || 'Failed to open position')
      setLoading(false)
      return
    }

    toast.success('Position opened!', {
      description: `Opened ${leverage}x ${side} on ${market.ticker} at $${market.currentPrice.toFixed(2)}`,
    })

    onClose()
    if (onSuccess) onSuccess()
    setLoading(false)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const isHighRisk = leverage > 50 || marginRequired > 1000

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg">
        <div className="bg-popover rounded shadow-xl p-4 sm:p-6 m-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">${market.ticker}</h2>
              <p className="text-sm text-muted-foreground">{market.name}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-2"
            >
              <X size={20} />
            </button>
          </div>

          {/* Current Price */}
          <div className="mb-6 p-4 bg-muted rounded">
            <div className="text-sm text-muted-foreground mb-1">Current Price</div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground">
              {formatPrice(market.currentPrice)}
            </div>
          </div>

          {/* Long/Short Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setSide('long')}
              className={cn(
                'flex-1 py-3 rounded font-bold transition-all flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer',
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
                'flex-1 py-3 rounded font-bold transition-all flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer',
                side === 'short'
                  ? 'bg-red-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted'
              )}
            >
              <TrendingDown size={18} />
              SHORT
            </button>
          </div>

          {/* Size & Leverage */}
          <div className="bg-muted rounded p-4 mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">Position Size (USD)</label>
              <input
                type="number"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                min={market.minOrderSize}
                step="10"
                className="w-32 px-3 py-1.5 rounded bg-background/50 text-foreground text-right font-medium focus:outline-none focus:bg-background focus:ring-2 focus:ring-[#0066FF]/30"
                placeholder={`Min: $${market.minOrderSize}`}
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
                max={market.maxLeverage}
                value={leverage}
                onChange={(e) => setLeverage(parseInt(e.target.value))}
                className="w-full h-2 mt-2 bg-background rounded appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1x</span>
                <span>{market.maxLeverage}x</span>
              </div>
            </div>
          </div>

          {/* Position Preview */}
          <div className="bg-muted/20 p-4 rounded mb-6">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-muted-foreground">Margin Required</span>
              <span className="font-bold text-foreground text-right">{formatPrice(marginRequired)}</span>

              <span className="text-muted-foreground">Position Value</span>
              <span className="font-bold text-foreground text-right">{formatPrice(positionValue)}</span>
              
              <span className="text-muted-foreground">Entry Price</span>
              <span className="font-medium text-foreground text-right">{formatPrice(market.currentPrice)}</span>

              <span className="text-muted-foreground">Liquidation Price</span>
              <span className="font-bold text-red-600 text-right">{formatPrice(liquidationPrice)}</span>

              <span className="text-muted-foreground">Distance to Liq</span>
              <span className={cn(
                "font-medium text-right",
                liquidationDistance > 5 ? "text-green-600" : liquidationDistance > 2 ? "text-yellow-600" : "text-red-600"
              )}>
                {liquidationDistance.toFixed(2)}%
              </span>

              <span className="text-muted-foreground">Funding Rate</span>
              <span className={cn(
                "font-medium text-right",
                market.fundingRate.rate >= 0 ? "text-orange-500" : "text-blue-500"
              )}>
                {(market.fundingRate.rate * 100).toFixed(4)}% / 8h
              </span>
            </div>
          </div>

          {/* High Risk Warning */}
          {isHighRisk && (
            <div className="flex items-start gap-3 p-3 bg-yellow-500/15 rounded mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-bold text-yellow-600 mb-1">High Risk Position</div>
                <p className="text-muted-foreground">
                  {leverage > 50 && `Leverage above 50x is extremely risky. `}
                  {marginRequired > 1000 && `This position requires significant margin. `}
                  Small price movements can lead to liquidation.
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={loading || sizeNum < market.minOrderSize}
            className={cn(
              'w-full py-3 sm:py-4 rounded font-bold text-white transition-all text-base sm:text-lg cursor-pointer',
              side === 'long'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700',
              (loading || sizeNum < market.minOrderSize) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <BouncingLogo size={20} />
                Opening Position...
              </span>
            ) : (
              `${side === 'long' ? 'LONG' : 'SHORT'} ${market.ticker} ${leverage}x`
            )}
          </button>

          {/* Cancel */}
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full mt-3 py-2.5 sm:py-3 rounded font-medium text-muted-foreground hover:bg-muted transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

