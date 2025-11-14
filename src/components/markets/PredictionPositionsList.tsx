'use client'

import { useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface PredictionPosition {
  id: string
  marketId: string
  question: string
  side: 'YES' | 'NO'
  shares: number
  avgPrice: number
  currentPrice: number
  resolved: boolean
  resolution?: boolean | null
}

interface PredictionPositionsListProps {
  positions: PredictionPosition[]
  onPositionSold?: () => void
}

export function PredictionPositionsList({ positions, onPositionSold }: PredictionPositionsListProps) {
  const [sellingId, setSellingId] = useState<string | null>(null)

  const handleSell = async (position: PredictionPosition) => {
    setSellingId(position.id)

    const response = await fetch(`/api/markets/predictions/${position.marketId}/sell`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${window.__privyAccessToken || ''}`,
      },
      body: JSON.stringify({
        shares: position.shares,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      toast.error(data.error || 'Failed to sell shares')
      setSellingId(null)
      return
    }

    const pnl = data.pnl || 0
    toast.success('Shares sold!', {
      description: `Sold ${position.shares.toFixed(2)} ${position.side} shares for ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} PnL`,
    })

    if (onPositionSold) onPositionSold()
    setSellingId(null)
  }

  const formatPrice = (price: number) => `$${price.toFixed(3)}`

  if (positions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No prediction positions</p>
        <p className="text-sm mt-1">Buy YES or NO shares to start betting</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {positions.map((position) => {
        const currentValue = position.shares * position.currentPrice
        const costBasis = position.shares * position.avgPrice
        const unrealizedPnL = currentValue - costBasis
        const pnlPercent = (unrealizedPnL / costBasis) * 100
        const isSelling = sellingId === position.id

        return (
          <div key={position.id} className="p-4 rounded bg-muted/40">
            <div className="flex items-center justify-between mb-3">
              <span className={cn(
                "text-xs font-bold px-2 py-1 rounded flex items-center gap-1",
                position.side === 'YES'
                  ? "bg-green-600/20 text-green-600"
                  : "bg-red-600/20 text-red-600"
              )}>
                {position.side === 'YES' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                {position.side}
              </span>

              <div className="text-right">
                <div className={cn(
                  "text-lg font-bold",
                  unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {unrealizedPnL >= 0 ? '+' : ''}{formatPrice(unrealizedPnL)}
                </div>
                <div className={cn(
                  "text-xs",
                  unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {unrealizedPnL >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                </div>
              </div>
            </div>

            <p className="text-sm font-medium text-foreground mb-3">{position.question}</p>

            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div>
                <div className="text-muted-foreground">Shares</div>
                <div className="font-medium text-foreground">{position.shares.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Avg Cost</div>
                <div className="font-medium text-foreground">{formatPrice(position.avgPrice)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Current Price</div>
                <div className="font-medium text-foreground">{formatPrice(position.currentPrice)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Value</div>
                <div className="font-medium text-foreground">{formatPrice(currentValue)}</div>
              </div>
            </div>

            {!position.resolved ? (
              <button
                onClick={() => handleSell(position)}
                disabled={isSelling}
                className="w-full py-2 bg-muted hover:bg-muted text-foreground rounded font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSelling ? 'Selling...' : 'Sell Shares'}
              </button>
            ) : (
              <div className="text-center py-2 text-sm font-medium">
                <span className="text-muted-foreground">Resolved: </span>
                <span className={position.resolution ? "text-green-600" : "text-red-600"}>
                  {position.resolution ? 'YES' : 'NO'}
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

