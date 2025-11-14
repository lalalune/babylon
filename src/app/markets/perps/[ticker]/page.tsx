'use client'

import { PerpPositionsList } from '@/components/markets/PerpPositionsList'
import { PageContainer } from '@/components/shared/PageContainer'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import type { PerpPosition } from '@/shared/perps-types'
import { AlertTriangle, ArrowLeft, Info, TrendingDown, TrendingUp } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BouncingLogo } from '@/components/shared/BouncingLogo'
import { useMarketTracking } from '@/hooks/usePostHog'

interface PerpMarket {
  ticker: string
  organizationId: string
  name: string
  currentPrice: number
  change24h: number
  changePercent24h: number
  high24h: number
  low24h: number
  volume24h: number
  openInterest: number
  fundingRate: {
    rate: number
    nextFundingTime: string
    predictedRate: number
  }
  maxLeverage: number
  minOrderSize: number
}

interface PricePoint {
  time: number
  price: number
}

export default function PerpDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, authenticated, login } = useAuth()
  const ticker = params.ticker as string
  const { trackMarketView } = useMarketTracking()

  const [market, setMarket] = useState<PerpMarket | null>(null)
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [side, setSide] = useState<'long' | 'short'>('long')
  const [size, setSize] = useState('100')
  const [leverage, setLeverage] = useState(10)
  const [submitting, setSubmitting] = useState(false)
  const [userPositions, setUserPositions] = useState<PerpPosition[]>([])

  // Track market view
  useEffect(() => {
    if (ticker && market) {
      trackMarketView(ticker, 'perp')
    }
  }, [ticker, market, trackMarketView])

  const fetchMarketData = useCallback(async () => {
    const response = await fetch('/api/markets/perps')
    const data = await response.json()
    const foundMarket = data.markets?.find((m: PerpMarket) => m.ticker === ticker)
    
    if (!foundMarket) {
      toast.error('Market not found')
      router.push('/markets')
      return
    }

    setMarket(foundMarket)

    // Generate mock price history (you'll want to replace this with real data)
    const now = Date.now()
    const history: PricePoint[] = []
    const basePrice = foundMarket.currentPrice
    const volatility = basePrice * 0.02 // 2% volatility
    
    for (let i = 100; i >= 0; i--) {
      const time = now - (i * 15 * 60 * 1000) // 15 min intervals for last ~25 hours
      const randomChange = (Math.random() - 0.5) * volatility
      const price = basePrice + randomChange + (foundMarket.change24h / 100) * (100 - i) / 100
      history.push({ time, price })
    }
    
    setPriceHistory(history)

    // Fetch user positions if authenticated
    if (authenticated && user?.id) {
      const positionsRes = await fetch(`/api/markets/positions/${encodeURIComponent(user.id)}`)
      const positionsData = await positionsRes.json()
      const perpPos = positionsData.perpetuals?.positions || []
      const tickerPositions = perpPos.filter((p: PerpPosition) => p.ticker === ticker)
      setUserPositions(tickerPositions)
    }
    setLoading(false)
  }, [ticker, router, authenticated, user?.id])

  useEffect(() => {
    fetchMarketData()
  }, [fetchMarketData])

  const handleSubmit = async () => {
    if (!authenticated) {
      login()
      return
    }

    if (!market || !user) return

    const sizeNum = parseFloat(size) || 0
    if (sizeNum < market.minOrderSize) {
      toast.error(`Minimum order size is $${market.minOrderSize}`)
      return
    }

    setSubmitting(true)

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
      setSubmitting(false)
      return
    }

    toast.success('Position opened!', {
      description: `Opened ${leverage}x ${side} on ${market.ticker} at $${market.currentPrice.toFixed(2)}`,
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

  const formatVolume = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
    return `$${(v / 1e3).toFixed(2)}K`
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

  const isHighRisk = leverage > 50 || marginRequired > 1000

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

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">${market.ticker}</h1>
            <p className="text-muted-foreground">{market.name}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{formatPrice(market.currentPrice)}</div>
            <div className={cn(
              "text-lg font-bold flex items-center gap-2 justify-end",
              market.change24h >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {market.change24h >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              {market.change24h >= 0 ? '+' : ''}{formatPrice(market.change24h)} ({market.changePercent24h.toFixed(2)}%)
            </div>
          </div>
        </div>

        {/* Market Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">24h High</div>
            <div className="text-lg font-bold">{formatPrice(market.high24h)}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">24h Low</div>
            <div className="text-lg font-bold">{formatPrice(market.low24h)}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">24h Volume</div>
            <div className="text-lg font-bold">{formatVolume(market.volume24h)}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">Open Interest</div>
            <div className="text-lg font-bold">{formatVolume(market.openInterest)}</div>
          </div>
        </div>
      </div>

      {/* User Positions */}
      {userPositions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">Your Positions</h2>
          <PerpPositionsList positions={userPositions} onPositionClosed={fetchMarketData} />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2">
          <div className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border">
            <h2 className="text-lg font-bold mb-4">Price Chart</h2>
            <PriceChart data={priceHistory} currentPrice={market.currentPrice} />
          </div>

          {/* Funding Rate Info */}
          <div className="bg-muted/30 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Funding Rate</span>
                  <span className={cn(
                    "font-bold",
                    market.fundingRate.rate >= 0 ? "text-orange-500" : "text-blue-500"
                  )}>
                    {(market.fundingRate.rate * 100).toFixed(4)}% / 8h
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {market.fundingRate.rate >= 0 
                    ? "Long positions pay shorts every 8 hours"
                    : "Short positions pay longs every 8 hours"
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Trading Panel */}
        <div className="lg:col-span-1">
          <div className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border sticky top-4">
            <h2 className="text-lg font-bold mb-4">Trade</h2>

            {/* Long/Short Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSide('long')}
                className={cn(
                  'flex-1 py-3 rounded font-bold transition-all flex items-center justify-center gap-2 cursor-pointer',
                  side === 'long'
                    ? 'bg-green-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <TrendingUp size={18} />
                LONG
              </button>
              <button
                onClick={() => setSide('short')}
                className={cn(
                  'flex-1 py-3 rounded font-bold transition-all flex items-center justify-center gap-2 cursor-pointer',
                  side === 'short'
                    ? 'bg-red-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <TrendingDown size={18} />
                SHORT
              </button>
            </div>

            {/* Size & Leverage */}
            <div className="bg-muted/30 rounded-lg p-4 mb-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Position Size (USD)
                </label>
                <input
                  type="number"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  min={market.minOrderSize}
                  step="10"
                  className="w-full px-4 py-3 rounded bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-[#0066FF]/30"
                  placeholder={`Min: $${market.minOrderSize}`}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-muted-foreground">Leverage</label>
                  <span className="text-xl font-bold">{leverage}x</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={market.maxLeverage}
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value))}
                  className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${side === 'long' ? '#16a34a' : '#dc2626'} 0%, ${side === 'long' ? '#16a34a' : '#dc2626'} ${(leverage / market.maxLeverage) * 100}%, hsl(var(--muted)) ${(leverage / market.maxLeverage) * 100}%, hsl(var(--muted)) 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1x</span>
                  <span>{market.maxLeverage}x</span>
                </div>
              </div>
            </div>

            {/* Position Preview */}
            <div className="bg-muted/20 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-bold mb-3 text-muted-foreground">Position Preview</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margin Required</span>
                  <span className="font-bold">{formatPrice(marginRequired)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Position Value</span>
                  <span className="font-bold">{formatPrice(positionValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entry Price</span>
                  <span className="font-medium">{formatPrice(market.currentPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Liquidation Price</span>
                  <span className="font-bold text-red-600">{formatPrice(liquidationPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Distance to Liq</span>
                  <span className={cn(
                    "font-medium",
                    liquidationDistance > 5 ? "text-green-600" : liquidationDistance > 2 ? "text-yellow-600" : "text-red-600"
                  )}>
                    {liquidationDistance.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* High Risk Warning */}
            {isHighRisk && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/15 rounded-lg mb-4">
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
              disabled={submitting || sizeNum < market.minOrderSize}
              className={cn(
                'w-full py-4 rounded-lg font-bold text-white text-lg transition-all cursor-pointer',
                side === 'long'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700',
                (submitting || sizeNum < market.minOrderSize) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <BouncingLogo size={20} />
                  Opening Position...
                </span>
              ) : authenticated ? (
                `${side === 'long' ? 'LONG' : 'SHORT'} ${market.ticker} ${leverage}x`
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

// Simple Price Chart Component
function PriceChart({ data, currentPrice }: { data: PricePoint[], currentPrice: number }) {
  if (data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
        Loading chart...
      </div>
    )
  }

  const minPrice = Math.min(...data.map(d => d.price))
  const maxPrice = Math.max(...data.map(d => d.price))
  const priceRange = maxPrice - minPrice
  const padding = priceRange * 0.1

  const width = 800
  const height = 400
  const chartHeight = height - 60
  const chartWidth = width - 80

  const scaleY = (price: number) => {
    return chartHeight - ((price - (minPrice - padding)) / (priceRange + 2 * padding)) * chartHeight + 30
  }

  const scaleX = (index: number) => {
    return (index / (data.length - 1)) * chartWidth + 40
  }

  const pathData = data.map((point, i) => {
    const x = scaleX(i)
    const y = scaleY(point.price)
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
  }).join(' ')

  const isPositive = (data[data.length - 1]?.price ?? 0) >= (data[0]?.price ?? 0)

  return (
    <div className="relative w-full h-[400px] bg-muted/20 rounded-lg overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = 30 + chartHeight * ratio
          const price = maxPrice + padding - (priceRange + 2 * padding) * ratio
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
                ${price.toFixed(2)}
              </text>
            </g>
          )
        })}

        {/* Price line */}
        <path
          d={pathData}
          fill="none"
          stroke={isPositive ? '#16a34a' : '#dc2626'}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />

        {/* Area fill */}
        <path
          d={`${pathData} L ${scaleX(data.length - 1)} ${height - 30} L ${scaleX(0)} ${height - 30} Z`}
          fill={isPositive ? '#16a34a' : '#dc2626'}
          fillOpacity={0.1}
        />

        {/* Current price indicator */}
        <g>
          <line
            x1={40}
            y1={scaleY(currentPrice)}
            x2={width - 40}
            y2={scaleY(currentPrice)}
            stroke="#0066FF"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <text
            x={45}
            y={scaleY(currentPrice) - 5}
            fill="#0066FF"
            fontSize="12"
            fontWeight="bold"
          >
            ${currentPrice.toFixed(2)}
          </text>
        </g>

        {/* Time labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const index = Math.floor(ratio * (data.length - 1))
          const point = data[index]
          if (!point) return null
          const x = scaleX(index)
          const time = new Date(point.time)
          const label = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
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

