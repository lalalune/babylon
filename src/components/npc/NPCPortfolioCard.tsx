/**
 * NPCPortfolioCard Component
 *
 * Displays NPC actor portfolio data including total value, positions, and metrics
 * Shows portfolio performance, utilization, and risk assessment
 *
 */

'use client'

import { useEffect, useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, Activity, AlertCircle, BarChart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Position {
  id: string
  marketType: string
  ticker: string | null
  marketId: string | null
  side: string
  size: number
  entryPrice: number
  currentPrice: number
  unrealizedPnL: number
  leverage: number | null
  createdAt: string
}

interface Portfolio {
  totalValue: number
  availableBalance: number
  unrealizedPnL: number
  realizedPnL: number
  positionCount: number
  utilization: number
  riskScore: number
}

interface PortfolioData {
  success: boolean
  actorId: string
  actorName: string
  poolId?: string
  portfolio: Portfolio
  positions: Position[]
}

interface NPCPortfolioCardProps {
  actorId: string
  className?: string
  showPositions?: boolean
}

export function NPCPortfolioCard({
  actorId,
  className = '',
  showPositions = true,
}: NPCPortfolioCardProps) {
  const [data, setData] = useState<PortfolioData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPortfolio = async () => {
      setLoading(true)
      const response = await fetch(`/api/npc/${encodeURIComponent(actorId)}/portfolio`)
      const result = await response.json()

      if (result.success) {
        setData(result)
      }
      setLoading(false)
    }

    fetchPortfolio()

    // Refresh every 10 seconds
    const interval = setInterval(fetchPortfolio, 10000)
    return () => clearInterval(interval)
  }, [actorId])

  if (loading) {
    return (
      <div className={cn('bg-sidebar rounded-2xl px-4 py-3', className)}>
        <div className="text-sm text-muted-foreground">Loading portfolio...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={cn('bg-sidebar rounded-2xl px-4 py-3', className)}>
        <div className="text-sm text-muted-foreground">Portfolio data unavailable</div>
      </div>
    )
  }

  const { portfolio, positions } = data

  const getRiskColor = (riskScore: number) => {
    if (riskScore >= 0.7) return 'text-red-500'
    if (riskScore >= 0.4) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getRiskLabel = (riskScore: number) => {
    if (riskScore >= 0.7) return 'High Risk'
    if (riskScore >= 0.4) return 'Moderate'
    return 'Low Risk'
  }

  return (
    <div className={cn('bg-sidebar rounded-2xl px-4 py-3 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-3">
          <Wallet className="w-5 h-5 text-blue-500" />
          {data.actorName} Portfolio
        </h3>
        <div className={cn('text-sm font-medium', getRiskColor(portfolio.riskScore))}>
          {getRiskLabel(portfolio.riskScore)}
        </div>
      </div>

      {/* Portfolio Value */}
      <div className="bg-muted/30 rounded-lg px-4 py-3">
        <div className="text-xs text-muted-foreground mb-1">Total Portfolio Value</div>
        <div className="text-3xl font-bold text-foreground">
          ${portfolio.totalValue.toLocaleString()}
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1 text-sm">
            {portfolio.unrealizedPnL >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className={portfolio.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}>
              ${Math.abs(portfolio.unrealizedPnL).toLocaleString()}
            </span>
            <span className="text-muted-foreground text-xs">unrealized</span>
          </div>
          {portfolio.realizedPnL !== 0 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span className={portfolio.realizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}>
                ${Math.abs(portfolio.realizedPnL).toLocaleString()}
              </span>
              <span className="text-xs">realized</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Available Balance */}
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Available</div>
          <div className="text-lg font-bold text-foreground">
            ${portfolio.availableBalance.toLocaleString()}
          </div>
        </div>

        {/* Utilization */}
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Utilization</div>
          <div className="text-lg font-bold text-foreground">
            {portfolio.utilization.toFixed(1)}%
          </div>
          <div className="w-full bg-muted/30 rounded-full h-1 mt-1">
            <div
              className="bg-blue-500 h-1 rounded-full"
              style={{ width: `${Math.min(100, portfolio.utilization)}%` }}
            />
          </div>
        </div>

        {/* Open Positions */}
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Positions</div>
          <div className="text-lg font-bold text-foreground flex items-center gap-1">
            <Activity className="w-4 h-4" />
            {portfolio.positionCount}
          </div>
        </div>
      </div>

      {/* Positions List */}
      {showPositions && positions.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground flex items-center gap-3">
            <BarChart className="w-4 h-4" />
            Open Positions
          </div>
          <div className="space-y-1">
            {positions.map((position) => (
              <div
                key={position.id}
                className="bg-muted/30 rounded p-2 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  {position.side === 'long' || position.side === 'buy' ? (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span className="font-medium text-foreground">
                    {position.ticker || position.marketId}
                  </span>
                  <span className="text-muted-foreground uppercase">
                    {position.side}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">
                    ${position.size.toLocaleString()}
                  </span>
                  {position.leverage && position.leverage > 1 && (
                    <span className="text-yellow-500">
                      {position.leverage}x
                    </span>
                  )}
                  <span className={position.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {position.unrealizedPnL >= 0 ? '+' : ''}
                    ${position.unrealizedPnL.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Warning */}
      {portfolio.riskScore >= 0.7 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-3 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="text-xs text-red-500">
            High risk score detected. Portfolio may be overexposed or highly leveraged.
          </div>
        </div>
      )}
    </div>
  )
}
