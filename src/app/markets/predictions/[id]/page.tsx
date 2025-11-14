'use client'

import { PredictionPositionsList } from '@/components/markets/PredictionPositionsList'
import { PageContainer } from '@/components/shared/PageContainer'
import { useAuth } from '@/hooks/useAuth'
import { PredictionPricing, calculateExpectedPayout } from '@/lib/prediction-pricing'
import { cn } from '@/lib/utils'
import { ArrowLeft, CheckCircle, Clock, Info, TrendingUp, Users, XCircle } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BouncingLogo } from '@/components/shared/BouncingLogo'
import { useMarketTracking } from '@/hooks/usePostHog'

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
  userPosition?: {
    id: string
    side: 'YES' | 'NO'
    shares: number
    avgPrice: number
    currentPrice: number
    currentValue: number
    costBasis: number
    unrealizedPnL: number
  } | null
}

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

interface PricePoint {
  time: number
  yesPrice: number
  noPrice: number
  volume: number
}

export default function PredictionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, authenticated, login } = useAuth()
  const marketId = params.id as string
  const { trackMarketView } = useMarketTracking()

  const [market, setMarket] = useState<PredictionMarket | null>(null)
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [side, setSide] = useState<'yes' | 'no'>('yes')
  const [amount, setAmount] = useState('10')
  const [submitting, setSubmitting] = useState(false)
  const [userPosition, setUserPosition] = useState<PredictionPosition | null>(null)

  // Track market view
  useEffect(() => {
    if (marketId && market) {
      trackMarketView(marketId, 'prediction')
    }
  }, [marketId, market, trackMarketView])

  const fetchMarketData = useCallback(async () => {
    const userId = authenticated && user?.id ? `?userId=${user.id}` : ''
    const response = await fetch(`/api/markets/predictions${userId}`)
    const data = await response.json()
    const foundMarket = data.questions?.find((q: PredictionMarket) => 
      q.id.toString() === marketId
    )
    
    if (!foundMarket) {
      toast.error('Market not found')
      router.push('/markets')
      return
    }

    setMarket(foundMarket)
    setUserPosition(foundMarket.userPosition as PredictionPosition | null)

    // Generate mock price history (you'll want to replace this with real data)
    const now = Date.now()
    const history: PricePoint[] = []
    const yesShares = foundMarket.yesShares || 500
    const noShares = foundMarket.noShares || 500
    
    for (let i = 100; i >= 0; i--) {
      const time = now - (i * 60 * 60 * 1000) // 1 hour intervals
      // Simulate some price movement
      const variation = Math.sin(i / 10) * 0.1 + (Math.random() - 0.5) * 0.05
      const totalShares = yesShares + noShares
      const basePrice = totalShares === 0 ? 0.5 : yesShares / totalShares
      const yesPrice = Math.max(0.1, Math.min(0.9, basePrice + variation))
      const noPrice = 1 - yesPrice
      const volume = Math.random() * 100
      history.push({ time, yesPrice, noPrice, volume })
    }
    
    setPriceHistory(history)
    setLoading(false)
  }, [marketId, router, authenticated, user?.id])

  useEffect(() => {
    fetchMarketData()
  }, [fetchMarketData])

  const handleSubmit = async () => {
    if (!authenticated) {
      login()
      return
    }

    if (!market || !user) return

    const amountNum = parseFloat(amount) || 0
    if (amountNum < 1) {
      toast.error('Minimum bet is $1')
      return
    }

    setSubmitting(true)

    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
    if (!token) {
      toast.error('Authentication required. Please log in.')
      setSubmitting(false)
      return
    }

    const response = await fetch(`/api/markets/predictions/${market.id}/buy`, {
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

    const data = await response.json()
    
    if (!response.ok) {
      toast.error(data.error || data.message || 'Failed to buy shares')
      setSubmitting(false)
      return
    }
    const calculation = data.calculation

    toast.success(`Bought ${side.toUpperCase()} shares!`, {
      description: `${calculation?.sharesBought?.toFixed(2) || ''} shares at ${(calculation?.avgPrice || 0).toFixed(3)} each`,
    })

    // Refresh data
    await fetchMarketData()
    setSubmitting(false)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
  }

  const getDaysUntilResolution = () => {
    if (!market?.resolutionDate) return null
    const now = new Date()
    const resolution = new Date(market.resolutionDate)
    const diffDays = Math.ceil((resolution.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="mx-auto mb-4 flex justify-center">
              <BouncingLogo size={48} />
            </div>
            <p className="text-muted-foreground">Loading market...</p>
          </div>
        </div>
      </PageContainer>
    )
  }

  if (!market) return null

  const amountNum = parseFloat(amount) || 0
  const yesShares = market.yesShares || 500
  const noShares = market.noShares || 500
  
  const currentYesPrice = PredictionPricing.getCurrentPrice(yesShares, noShares, 'yes')
  const currentNoPrice = PredictionPricing.getCurrentPrice(yesShares, noShares, 'no')
  
  const calculation = amountNum > 0
    ? PredictionPricing.calculateBuy(yesShares, noShares, side, amountNum)
    : null

  const expectedPayout = calculation
    ? calculateExpectedPayout(calculation.sharesBought)
    : 0
  const expectedProfit = expectedPayout - amountNum

  const daysLeft = getDaysUntilResolution()
  const totalVolume = yesShares + noShares
  const totalTrades = Math.floor(totalVolume / 10) // Rough estimate

  return (
    <PageContainer className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/markets')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Markets
        </button>

        <div className="bg-card/50 backdrop-blur rounded-lg p-6 border border-border">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-2xl font-bold flex-1">{market.text}</h1>
            {daysLeft !== null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                <Clock className="w-4 h-4" />
                <span className="font-medium">{daysLeft} days left</span>
              </div>
            )}
          </div>

          {/* Market Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <TrendingUp className="w-3 h-3" />
                Volume
              </div>
              <div className="text-lg font-bold">{formatPrice(totalVolume)}</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Users className="w-3 h-3" />
                Trades
              </div>
              <div className="text-lg font-bold">{totalTrades}</div>
            </div>
            <div className="bg-green-600/15 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-green-600 mb-1">
                <CheckCircle className="w-3 h-3" />
                YES
              </div>
              <div className="text-2xl font-bold text-green-600">
                {(currentYesPrice * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-red-600/15 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-red-600 mb-1">
                <XCircle className="w-3 h-3" />
                NO
              </div>
              <div className="text-2xl font-bold text-red-600">
                {(currentNoPrice * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Position */}
      {userPosition && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">Your Position</h2>
          <PredictionPositionsList 
            positions={[userPosition]} 
            onPositionSold={fetchMarketData} 
          />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2">
          <div className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border">
            <h2 className="text-lg font-bold mb-4">Probability Over Time</h2>
            <ProbabilityChart data={priceHistory} />
          </div>

          {/* Market Info */}
          <div className="bg-muted/30 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium mb-2">How it works</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Buy YES shares if you think this will happen, NO shares if you think it won&apos;t.
                </p>
                <p className="text-sm text-muted-foreground">
                  If you&apos;re right, you&apos;ll receive $1 per share. The current price reflects the market&apos;s probability.
                </p>
              </div>
            </div>
          </div>

          {/* Resolution Info */}
          {market.resolutionDate && (
            <div className="bg-muted/30 rounded-lg p-4 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Resolution Date</span>
                <span className="text-sm font-medium">
                  {new Date(market.resolutionDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Trading Panel */}
        <div className="lg:col-span-1">
          <div className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border sticky top-4">
            <h2 className="text-lg font-bold mb-4">Trade</h2>

            {/* YES/NO Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSide('yes')}
                className={cn(
                  'flex-1 py-3 rounded font-bold transition-all flex items-center justify-center gap-2 cursor-pointer',
                  side === 'yes'
                    ? 'bg-green-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <CheckCircle size={18} />
                YES
              </button>
              <button
                onClick={() => setSide('no')}
                className={cn(
                  'flex-1 py-3 rounded font-bold transition-all flex items-center justify-center gap-2 cursor-pointer',
                  side === 'no'
                    ? 'bg-red-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <XCircle size={18} />
                NO
              </button>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Amount (USD)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                step="1"
                className="w-full px-4 py-3 rounded bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-[#0066FF]/30"
                placeholder="Min: $1"
              />
            </div>

            {/* Trade Preview */}
            {calculation && (
              <div className="bg-muted/20 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-bold mb-3 text-muted-foreground">Trade Preview</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shares Received</span>
                    <span className="font-bold">{calculation.sharesBought.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Price/Share</span>
                    <span className="font-medium">{formatPrice(calculation.avgPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New {side.toUpperCase()} Price</span>
                    <span className="font-medium">
                      {((side === 'yes' ? calculation.newYesPrice : calculation.newNoPrice) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price Impact</span>
                    <span className="font-medium text-orange-500">
                      +{Math.abs(calculation.priceImpact).toFixed(2)}%
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">If {side.toUpperCase()} Wins</span>
                      <span className="font-bold text-green-600">{formatPrice(expectedPayout)}</span>
                    </div>
                    <div className="flex justify-between">
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
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || amountNum < 1}
              className={cn(
                'w-full py-4 rounded-lg font-bold text-white text-lg transition-all cursor-pointer',
                side === 'yes'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700',
                (submitting || amountNum < 1) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <BouncingLogo size={20} />
                  Buying Shares...
                </span>
              ) : authenticated ? (
                `BUY ${side.toUpperCase()} - ${formatPrice(amountNum)}`
              ) : (
                'Connect Wallet to Trade'
              )}
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

// Probability Chart Component
function ProbabilityChart({ data }: { data: PricePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
        Loading chart...
      </div>
    )
  }

  const width = 800
  const height = 400
  const chartHeight = height - 60
  const chartWidth = width - 80

  const scaleY = (probability: number) => {
    return chartHeight - (probability * chartHeight) + 30
  }

  const scaleX = (index: number) => {
    return (index / (data.length - 1)) * chartWidth + 40
  }

  const yesPathData = data.map((point, i) => {
    const x = scaleX(i)
    const y = scaleY(point.yesPrice)
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
  }).join(' ')

  const noPathData = data.map((point, i) => {
    const x = scaleX(i)
    const y = scaleY(point.noPrice)
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
  }).join(' ')

  return (
    <div className="relative w-full h-[400px] bg-muted/20 rounded-lg overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = 30 + chartHeight * (1 - ratio)
          return (
            <g key={ratio}>
              <line
                x1={40}
                y1={y}
                x2={width - 40}
                y2={y}
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.1}
                strokeWidth={1}
              />
              <text
                x={width - 35}
                y={y + 4}
                fill="hsl(var(--muted-foreground))"
                fontSize="10"
                textAnchor="end"
              >
                {(ratio * 100).toFixed(0)}%
              </text>
            </g>
          )
        })}

        {/* YES line */}
        <path
          d={yesPathData}
          fill="none"
          stroke="#16a34a"
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />

        {/* NO line */}
        <path
          d={noPathData}
          fill="none"
          stroke="#dc2626"
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />

        {/* YES area fill */}
        <path
          d={`${yesPathData} L ${scaleX(data.length - 1)} ${height - 30} L ${scaleX(0)} ${height - 30} Z`}
          fill="#16a34a"
          fillOpacity={0.1}
        />

        {/* Legend */}
        <g transform="translate(50, 15)">
          <line x1={0} y1={0} x2={20} y2={0} stroke="#16a34a" strokeWidth={3} />
          <text x={25} y={4} fill="hsl(var(--foreground))" fontSize="12" fontWeight="bold">
            YES
          </text>
          
          <line x1={80} y1={0} x2={100} y2={0} stroke="#dc2626" strokeWidth={3} />
          <text x={105} y={4} fill="hsl(var(--foreground))" fontSize="12" fontWeight="bold">
            NO
          </text>
        </g>

        {/* Time labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const index = Math.floor(ratio * (data.length - 1))
          const point = data[index]
          if (!point) throw new Error('No point found')
          const x = scaleX(index)
          const time = new Date(point.time)
          const label = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return (
            <text
              key={ratio}
              x={x}
              y={height - 10}
              fill="hsl(var(--muted-foreground))"
              fontSize="10"
              textAnchor="middle"
            >
              {label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

