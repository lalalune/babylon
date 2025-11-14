'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { PredictionPricing, calculateExpectedPayout } from '@/lib/prediction-pricing'
import { BouncingLogo } from '@/components/shared/BouncingLogo'

interface PredictionMarket {
  id: number | string
  text: string
  status: 'active' | 'resolved' | 'cancelled'
  createdDate?: string
  resolutionDate?: string
  resolvedOutcome?: boolean
  scenario: number
  yesShares?: number
  noShares?: number
}

interface PredictionTradingModalProps {
  question: PredictionMarket
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function PredictionTradingModal({
  question,
  isOpen,
  onClose,
  onSuccess,
}: PredictionTradingModalProps) {
  const { user } = useAuth()
  const [side, setSide] = useState<'yes' | 'no'>('yes')
  const [amount, setAmount] = useState('10')
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

  const amountNum = parseFloat(amount) || 0
  
  // Use AMM to calculate current prices and shares
  const yesShares = question.yesShares || 500
  const noShares = question.noShares || 500
  
  const currentYesPrice = PredictionPricing.getCurrentPrice(yesShares, noShares, 'yes')
  const currentNoPrice = PredictionPricing.getCurrentPrice(yesShares, noShares, 'no')
  
  // Calculate what would happen if user buys
  const calculation = amountNum > 0
    ? PredictionPricing.calculateBuy(yesShares, noShares, side, amountNum)
    : null

  const expectedPayout = calculation
    ? calculateExpectedPayout(calculation.sharesBought)
    : 0
  const expectedProfit = expectedPayout - amountNum

  const getDaysUntilResolution = () => {
    if (!question.resolutionDate) return null
    const now = new Date()
    const resolution = new Date(question.resolutionDate)
    const diffDays = Math.ceil((resolution.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  const daysLeft = getDaysUntilResolution()

  const handleSubmit = async () => {
    if (!user) return

    if (amountNum < 1) {
      toast.error('Minimum bet is $1')
      return
    }

    setLoading(true)

    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
    if (!token) {
      toast.error('Authentication required. Please log in.')
      setLoading(false)
      return
    }

    const response = await fetch(`/api/markets/predictions/${question.id}/buy`, {
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

    await response.json()

    toast.success(`Bought ${side.toUpperCase()} shares!`, {
      description: `${calculation?.sharesBought.toFixed(2)} shares at ${(calculation?.avgPrice || 0).toFixed(3)} each`,
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
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">Prediction Market</h2>
              {daysLeft !== null && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                  <Clock size={14} />
                  {daysLeft}d left
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-2"
            >
              <X size={20} />
            </button>
          </div>

          {/* Question */}
          <div className="mb-6 p-4 bg-muted rounded">
            <p className="text-foreground font-medium text-sm sm:text-base">{question.text}</p>
          </div>

          {/* Current Odds */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="p-3 bg-green-600/15 rounded">
              <div className="text-xs text-green-600 mb-1">YES</div>
              <div className="text-2xl font-bold text-green-600">
                {(currentYesPrice * 100).toFixed(1)}%
              </div>
            </div>
            <div className="p-3 bg-red-600/15 rounded">
              <div className="text-xs text-red-600 mb-1">NO</div>
              <div className="text-2xl font-bold text-red-600">
                {(currentNoPrice * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* YES/NO Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setSide('yes')}
              className={cn(
                'flex-1 py-3 rounded font-bold transition-all flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer',
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
                'flex-1 py-3 rounded font-bold transition-all flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer',
                side === 'no'
                  ? 'bg-red-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted'
              )}
            >
              <XCircle size={18} />
              BUY NO
            </button>
          </div>

          {/* Amount Input */}
          <div className="mb-6">
            <label className="text-sm text-muted-foreground mb-2 block">Amount (USD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              step="1"
              className="w-full px-4 py-3 rounded bg-muted/50 text-foreground text-base sm:text-lg font-medium focus:outline-none focus:bg-muted focus:ring-2 focus:ring-[#0066FF]/30"
              placeholder="Min: $1"
            />
          </div>

          {/* Trade Preview */}
          {calculation && (
            <div className="bg-muted p-4 rounded mb-6 space-y-2">
              <div className="text-sm font-bold text-foreground mb-2">Trade Preview</div>
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shares Received</span>
                <span className="font-bold text-foreground">{calculation.sharesBought.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg Price/Share</span>
                <span className="font-medium text-foreground">{formatPrice(calculation.avgPrice)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">New {side.toUpperCase()} Price</span>
                <span className="font-medium text-foreground">
                  {(side === 'yes' ? calculation.newYesPrice : calculation.newNoPrice * 100).toFixed(1)}%
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price Impact</span>
                <span className="font-medium text-orange-500">
                  +{Math.abs(calculation.priceImpact).toFixed(2)}%
                </span>
              </div>

              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">If {side.toUpperCase()} Wins</span>
                  <span className="font-bold text-green-600">{formatPrice(expectedPayout)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Profit</span>
                  <span className={cn(
                    "font-bold",
                    expectedProfit >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {expectedProfit >= 0 ? '+' : ''}{formatPrice(expectedProfit)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={loading || amountNum < 1}
            className={cn(
              'w-full py-3 sm:py-4 rounded font-bold text-white transition-all text-base sm:text-lg cursor-pointer',
              side === 'yes'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700',
              (loading || amountNum < 1) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <BouncingLogo size={20} />
                Buying Shares...
              </span>
            ) : (
              `BUY ${side.toUpperCase()} - ${formatPrice(amountNum)}`
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

