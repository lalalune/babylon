'use client'

import { PageContainer } from '@/components/shared/PageContainer'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { ArrowLeft, Award, Calendar, DollarSign, Info, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BouncingLogo } from '@/components/shared/BouncingLogo'

interface Pool {
  id: string
  name: string
  description?: string
  totalValue: number
  totalDeposits: number
  returnPercent: number
  npcActor: {
    id: string
    name: string
    tier: string
    profilePicture?: string
  }
  userDeposit?: number
  userShares?: number
  createdAt: string
}

interface PerformancePoint {
  time: number
  value: number
  returnPercent: number
}

export default function PoolDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, authenticated, login } = useAuth()
  const poolId = params.id as string

  const [pool, setPool] = useState<Pool | null>(null)
  const [performanceHistory, setPerformanceHistory] = useState<PerformancePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [depositAmount, setDepositAmount] = useState('100')
  const [submitting, setSubmitting] = useState(false)

  const fetchPoolData = useCallback(async () => {
    const response = await fetch(`/api/pools/${poolId}`)
    
    if (!response.ok) {
      toast.error('Pool not found')
      router.push('/markets')
      return
    }

    const data = await response.json()
    setPool(data.pool)

    // Generate mock performance history (you'll want to replace this with real data)
    const now = Date.now()
    const history: PerformancePoint[] = []
    const baseReturn = data.pool.returnPercent
    
    for (let i = 30; i >= 0; i--) {
      const time = now - (i * 24 * 60 * 60 * 1000) // Daily for last 30 days
      const variation = Math.sin(i / 5) * 5 + (Math.random() - 0.5) * 2
      const returnPercent = Math.max(-10, Math.min(50, (baseReturn * (30 - i) / 30) + variation))
      const value = data.pool.totalDeposits * (1 + returnPercent / 100)
      history.push({ time, value, returnPercent })
    }
    
    setPerformanceHistory(history)
    setLoading(false)
  }, [poolId, router])

  useEffect(() => {
    fetchPoolData()
  }, [fetchPoolData])

  const handleDeposit = async () => {
    if (!authenticated) {
      login()
      return
    }

    if (!pool || !user) return

    const depositNum = parseFloat(depositAmount) || 0
    if (depositNum < 10) {
      toast.error('Minimum deposit is $10')
      return
    }

    setSubmitting(true)

    const response = await fetch(`/api/pools/${pool.id}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${window.__privyAccessToken || ''}`,
      },
      body: JSON.stringify({
        amount: depositNum,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      toast.error(data.error || 'Failed to deposit')
      setSubmitting(false)
      return
    }

    toast.success('Deposit successful!', {
      description: `Deposited ${formatPrice(depositNum)} into ${pool.name}`,
    })

    // Refresh data
    await fetchPoolData()
    setSubmitting(false)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'WHALE_TIER':
        return 'text-purple-600 bg-purple-600/20'
      case 'PRO_TIER':
        return 'text-blue-600 bg-blue-600/20'
      case 'DEGEN_TIER':
        return 'text-orange-600 bg-orange-600/20'
      default:
        return 'text-gray-600 bg-gray-600/20'
    }
  }

  const getTierName = (tier: string) => {
    return tier.replace('_TIER', '')
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="mx-auto mb-4 flex justify-center">
              <BouncingLogo size={48} />
            </div>
            <p className="text-muted-foreground">Loading pool...</p>
          </div>
        </div>
      </PageContainer>
    )
  }

  if (!pool) return null

  const depositNum = parseFloat(depositAmount) || 0
  const estimatedShares = depositNum / (pool.totalValue / (pool.totalDeposits || 1))

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
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {pool.npcActor.profilePicture && (
                  <img 
                    src={pool.npcActor.profilePicture} 
                    alt={pool.npcActor.name}
                    className="w-12 h-12 rounded-full"
                  />
                )}
                <div>
                  <h1 className="text-2xl font-bold">{pool.name}</h1>
                  <p className="text-sm text-muted-foreground">
                    Managed by {pool.npcActor.name}
                  </p>
                </div>
              </div>
              {pool.description && (
                <p className="text-muted-foreground">{pool.description}</p>
              )}
            </div>

            <div className={cn(
              "px-3 py-1.5 rounded-full text-sm font-bold",
              getTierColor(pool.npcActor.tier)
            )}>
              {getTierName(pool.npcActor.tier)}
            </div>
          </div>

          {/* Pool Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <DollarSign className="w-3 h-3" />
                Total Value
              </div>
              <div className="text-lg font-bold">{formatPrice(pool.totalValue)}</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Users className="w-3 h-3" />
                Total Deposits
              </div>
              <div className="text-lg font-bold">{formatPrice(pool.totalDeposits)}</div>
            </div>
            <div className={cn(
              "rounded-lg p-3",
              pool.returnPercent >= 0 ? "bg-green-600/15" : "bg-red-600/15"
            )}>
              <div className="flex items-center gap-2 text-xs mb-1" style={{
                color: pool.returnPercent >= 0 ? '#16a34a' : '#dc2626'
              }}>
                {pool.returnPercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                Return
              </div>
              <div className={cn(
                "text-2xl font-bold",
                pool.returnPercent >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {pool.returnPercent >= 0 ? '+' : ''}{pool.returnPercent.toFixed(1)}%
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Calendar className="w-3 h-3" />
                Created
              </div>
              <div className="text-sm font-bold">
                {new Date(pool.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </div>
            </div>
          </div>

          {/* User Position if exists */}
          {pool.userDeposit && pool.userDeposit > 0 && (
            <div className="mt-4 p-4 bg-[#0066FF]/10 rounded-lg border border-[#0066FF]/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Your Deposit</div>
                  <div className="text-xl font-bold">{formatPrice(pool.userDeposit)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Your Shares</div>
                  <div className="text-xl font-bold">{pool.userShares?.toFixed(2) || '0'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <div className="lg:col-span-2">
          <div className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border">
            <h2 className="text-lg font-bold mb-4">Performance History</h2>
            <PerformanceChart data={performanceHistory} />
          </div>

          {/* Strategy Info */}
          <div className="bg-muted/30 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium mb-2">About This Pool</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  This trading pool is managed by an AI trader who makes autonomous trading decisions.
                </p>
                <p className="text-sm text-muted-foreground">
                  When you deposit, you receive shares representing your portion of the pool. Your returns are based on the pool&apos;s overall performance.
                </p>
              </div>
            </div>
          </div>

          {/* Trader Stats */}
          <div className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border mt-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Award className="w-4 h-4" />
              Trader Performance
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
                <div className="text-lg font-bold">
                  {(55 + Math.random() * 20).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Avg Trade Size</div>
                <div className="text-lg font-bold">
                  {formatPrice(pool.totalDeposits * 0.1)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Total Trades</div>
                <div className="text-lg font-bold">
                  {Math.floor(Math.random() * 100) + 50}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Active Days</div>
                <div className="text-lg font-bold">
                  {Math.floor((Date.now() - new Date(pool.createdAt).getTime()) / (1000 * 60 * 60 * 24))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deposit Panel */}
        <div className="lg:col-span-1">
          <div className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border sticky top-4">
            <h2 className="text-lg font-bold mb-4">Deposit</h2>

            {/* Amount Input */}
            <div className="mb-4">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Amount (USD)
              </label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                min="10"
                step="10"
                className="w-full px-4 py-3 rounded bg-background text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-[#0066FF]/30"
                placeholder="Min: $10"
              />
            </div>

            {/* Deposit Preview */}
            {depositNum >= 10 && (
              <div className="bg-muted/20 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-bold mb-3 text-muted-foreground">Deposit Preview</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deposit Amount</span>
                    <span className="font-bold">{formatPrice(depositNum)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. Shares</span>
                    <span className="font-medium">{estimatedShares.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Return</span>
                    <span className={cn(
                      "font-bold",
                      pool.returnPercent >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {pool.returnPercent >= 0 ? '+' : ''}{pool.returnPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">If Return Continues</span>
                      <span className={cn(
                        "font-bold",
                        pool.returnPercent >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatPrice(depositNum * (1 + pool.returnPercent / 100))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleDeposit}
              disabled={submitting || depositNum < 10}
              className={cn(
                'w-full py-4 rounded-lg font-bold text-white text-lg transition-all cursor-pointer',
                'bg-[#0066FF] hover:bg-[#2952d9]',
                (submitting || depositNum < 10) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <BouncingLogo size={20} />
                  Depositing...
                </span>
              ) : authenticated ? (
                `Deposit ${formatPrice(depositNum)}`
              ) : (
                'Connect Wallet to Deposit'
              )}
            </button>

            <p className="text-xs text-muted-foreground text-center mt-3">
              Deposits are managed by the AI trader. Withdrawals available anytime.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

// Performance Chart Component
function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground">
        Loading chart...
      </div>
    )
  }

  const minValue = Math.min(...data.map(d => d.value))
  const maxValue = Math.max(...data.map(d => d.value))
  const valueRange = maxValue - minValue
  const padding = valueRange * 0.1

  const width = 800
  const height = 400
  const chartHeight = height - 60
  const chartWidth = width - 80

  const scaleY = (value: number) => {
    return chartHeight - ((value - (minValue - padding)) / (valueRange + 2 * padding)) * chartHeight + 30
  }

  const scaleX = (index: number) => {
    return (index / (data.length - 1)) * chartWidth + 40
  }

  const pathData = data.map((point, i) => {
    const x = scaleX(i)
    const y = scaleY(point.value)
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
  }).join(' ')

  const lastDataPoint = data[data.length - 1]
  const isPositive = (lastDataPoint?.returnPercent ?? 0) >= 0

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
          const value = maxValue + padding - (valueRange + 2 * padding) * ratio
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
                ${value.toFixed(0)}
              </text>
            </g>
          )
        })}

        {/* Value line */}
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

