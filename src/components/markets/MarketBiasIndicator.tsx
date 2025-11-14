/**
 * MarketBiasIndicator Component
 *
 * Displays active market biases and sentiment adjustments
 * Shows which markets are being influenced and by how much
 *
 */

'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Activity, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BiasAdjustment {
  entityId: string
  entityName: string
  direction: 'up' | 'down'
  strength: number
  priceAdjustment: number
  sentimentAdjustment: number
  expiresAt: string | null
  decayRate: number
}

interface BiasData {
  success: boolean
  biases: BiasAdjustment[]
  count: number
}

interface MarketBiasIndicatorProps {
  className?: string
  maxDisplay?: number
}

export function MarketBiasIndicator({
  className = '',
  maxDisplay = 10,
}: MarketBiasIndicatorProps) {
  const [data, setData] = useState<BiasData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBiases = async () => {
      setLoading(true)
      const response = await fetch('/api/markets/bias/active')
      const result = await response.json()

      if (result.success) {
        setData(result)
      }
      setLoading(false)
    }

    fetchBiases()

    // Refresh every 30 seconds
    const interval = setInterval(fetchBiases, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className={cn('bg-sidebar rounded-lg p-4', className)}>
        <div className="text-sm text-muted-foreground">Loading market biases...</div>
      </div>
    )
  }

  if (!data || data.biases.length === 0) {
    return (
      <div className={cn('bg-sidebar rounded-lg p-4', className)}>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">No active market biases</span>
        </div>
      </div>
    )
  }

  const displayBiases = data.biases.slice(0, maxDisplay)

  const getTimeRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return 'Permanent'

    const now = new Date()
    const expiry = new Date(expiresAt)
    const diff = expiry.getTime() - now.getTime()

    if (diff <= 0) return 'Expired'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  return (
    <div className={cn('bg-sidebar rounded-lg p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          Active Market Biases
        </h3>
        <div className="text-xs text-muted-foreground">
          {data.count} active
        </div>
      </div>

      {/* Bias List */}
      <div className="space-y-2">
        {displayBiases.map((bias) => (
          <div
            key={bias.entityId}
            className="bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              {/* Entity Info */}
              <div className="flex items-center gap-2 flex-1">
                {bias.direction === 'up' ? (
                  <TrendingUp className="w-5 h-5 text-green-500 shrink-0" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {bias.entityName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {bias.entityId}
                  </div>
                </div>
              </div>

              {/* Strength & Adjustments */}
              <div className="flex items-center gap-3 shrink-0">
                {/* Strength Bar */}
                <div className="hidden sm:block">
                  <div className="text-xs text-muted-foreground mb-1">Strength</div>
                  <div className="w-20 bg-muted/30 rounded-full h-2">
                    <div
                      className={cn(
                        'h-2 rounded-full',
                        bias.direction === 'up' ? 'bg-green-500' : 'bg-red-500'
                      )}
                      style={{ width: `${bias.strength * 100}%` }}
                    />
                  </div>
                </div>

                {/* Price Adjustment */}
                <div className="text-right">
                  <div className="text-sm font-bold" style={{
                    color: bias.priceAdjustment >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
                  }}>
                    {bias.priceAdjustment >= 0 ? '+' : ''}
                    {(bias.priceAdjustment * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Price</div>
                </div>

                {/* Sentiment */}
                <div className="text-right hidden md:block">
                  <div className="text-sm font-medium" style={{
                    color: bias.sentimentAdjustment >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
                  }}>
                    {bias.sentimentAdjustment >= 0 ? '+' : ''}
                    {(bias.sentimentAdjustment * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Sentiment</div>
                </div>
              </div>
            </div>

            {/* Duration & Decay */}
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/50">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {getTimeRemaining(bias.expiresAt)}
              </div>
              {bias.decayRate > 0 && (
                <div className="text-xs text-muted-foreground">
                  Decay: {(bias.decayRate * 100).toFixed(0)}%/hr
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {data.count > maxDisplay && (
        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
          Showing {maxDisplay} of {data.count} active biases
        </div>
      )}
    </div>
  )
}
