'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp,
  TrendingDown,
  Trophy,
  Activity,
  DollarSign,
  BarChart3,
  Clock,
  Target,
  AlertCircle
} from 'lucide-react'
import { Skeleton } from '@/components/shared/Skeleton'
import { cn } from '@/lib/utils'
import { TradesFeed } from '@/components/trades/TradesFeed'
import { useAuth } from '@/hooks/useAuth'

interface TradingProfileProps {
  userId: string
  isOwner?: boolean
}

interface UserStats {
  rank: number
  totalPlayers: number
  balance: number
  reputationPoints: number
  lifetimePnL: number
}

interface PortfolioPnL {
  totalPnL: number
  perpPnL: number
  predictionPnL: number
  totalPositions: number
  perpPositions: number
  predictionPositions: number
  roi: number
}

interface PerpPosition {
  id: string
  ticker: string
  side: 'long' | 'short'
  entryPrice: number
  currentPrice: number
  size: number
  leverage: number
  unrealizedPnL: number
  liquidationPrice: number
  fundingPaid: number
  openedAt: string
}

interface PredictionPosition {
  id: string
  side: string
  shares: number
  avgPrice: number
  unrealizedPnL: number
  Market: {
    id: string
    question: string
    yesShares: number
    noShares: number
    resolved: boolean
    resolution: boolean | null
  }
}

interface ApiPositionsResponse {
  perpetuals: {
    positions: PerpPosition[]
    stats: {
      totalPositions: number
      totalPnL: number
      totalFunding: number
    }
  }
  predictions: {
    positions: PredictionPosition[]
    stats: {
      totalPositions: number
    }
  }
}

// Validate number - returns 0 if invalid
function toNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export function TradingProfile({ userId, isOwner = false }: TradingProfileProps) {
  const router = useRouter()
  const { getAccessToken } = useAuth()
  const abortControllerRef = useRef<AbortController | null>(null)
  
  const [stats, setStats] = useState<UserStats | null>(null)
  const [portfolioPnL, setPortfolioPnL] = useState<PortfolioPnL | null>(null)
  const [perpPositions, setPerpPositions] = useState<PerpPosition[]>([])
  const [predictionPositions, setPredictionPositions] = useState<PredictionPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'positions' | 'history'>('positions')

  const fetchTradingData = useCallback(async () => {
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    
    setLoading(true)
    setError(null)

    const token = await getAccessToken()
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Fetch all data in parallel - let errors bubble up
    const [profileRes, leaderboardRes, positionsRes] = await Promise.all([
      fetch(`/api/users/${encodeURIComponent(userId)}/profile`, { 
        headers,
        signal: abortController.signal
      }),
      fetch(`/api/leaderboard?page=1&pageSize=100`, { 
        headers,
        signal: abortController.signal
      }),
      fetch(`/api/markets/positions/${encodeURIComponent(userId)}?status=open`, { 
        headers,
        signal: abortController.signal
      })
    ]).catch((err: Error) => {
      // Only set error if not aborted
      if (err.name === 'AbortError') {
        throw err
      }
      setError(err.message)
      setLoading(false)
      throw err
    })

    // Check responses
    if (!profileRes.ok) {
      throw new Error(`Failed to load profile: ${profileRes.status} ${profileRes.statusText}`)
    }
    if (!leaderboardRes.ok) {
      throw new Error(`Failed to load leaderboard: ${leaderboardRes.status}`)
    }
    if (!positionsRes.ok) {
      throw new Error(`Failed to load positions: ${positionsRes.status}`)
    }

    const [profileData, leaderboardData, positionsData] = await Promise.all([
      profileRes.json(),
      leaderboardRes.json(),
      positionsRes.json() as Promise<ApiPositionsResponse>
    ])

    // Validate profile data
    const userProfile = profileData.user
    if (!userProfile) {
      throw new Error('User profile not found')
    }

    // Find user rank
    const totalPlayers = leaderboardData.pagination?.totalCount || 0
    const userInLeaderboard = leaderboardData.leaderboard?.find(
      (u: { id: string }) => u.id === userId
    )
    const rank = userInLeaderboard?.rank || 0

    // Set stats
    setStats({
      rank,
      totalPlayers,
      balance: toNumber(userProfile.virtualBalance),
      reputationPoints: toNumber(userProfile.reputationPoints),
      lifetimePnL: toNumber(userProfile.lifetimePnL),
    })

    // Validate and set positions
    const perpPos = positionsData.perpetuals?.positions || []
    const predPos = positionsData.predictions?.positions || []
    
    setPerpPositions(perpPos)
    setPredictionPositions(predPos)

    // Calculate portfolio P&L for owner
    if (isOwner) {
      const perpPnL = perpPos.reduce((sum, p) => sum + toNumber(p.unrealizedPnL), 0)
      const predictionPnL = predPos.reduce((sum, p) => sum + toNumber(p.unrealizedPnL), 0)
      const totalUnrealizedPnL = perpPnL + predictionPnL
      
      const lifetimePnL = toNumber(userProfile.lifetimePnL)
      const totalPnL = lifetimePnL + totalUnrealizedPnL
      
      // ROI calculation - use actual balance as initial investment proxy
      const balance = toNumber(userProfile.virtualBalance)
      const initialInvestment = balance > 0 ? balance - totalPnL : 1000 // Fallback to 1000
      const roi = initialInvestment > 0 ? (totalPnL / initialInvestment) * 100 : 0
      
      setPortfolioPnL({
        totalPnL,
        perpPnL,
        predictionPnL,
        totalPositions: perpPos.length + predPos.length,
        perpPositions: perpPos.length,
        predictionPositions: predPos.length,
        roi,
      })
    }

    setLoading(false)
  }, [userId, isOwner, getAccessToken])

  useEffect(() => {
    fetchTradingData()
    
    // Cleanup: abort on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchTradingData])

  const formatCurrency = (value: number) => {
    if (!Number.isFinite(value)) return '$0.00'
    const abs = Math.abs(value)
    if (abs >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
    if (abs >= 1000) return `$${(value / 1000).toFixed(2)}K`
    return `$${value.toFixed(2)}`
  }

  const calculateCurrentPrice = (market: PredictionPosition['Market']) => {
    const yesShares = toNumber(market.yesShares)
    const noShares = toNumber(market.noShares)
    const totalShares = yesShares + noShares
    return totalShares === 0 ? 0.5 : yesShares / totalShares
  }

  if (loading) {
    return (
      <div className="w-full space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to Load Trading Data</h3>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <button
          onClick={() => fetchTradingData()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    )
  }

  const lifetimePnL = stats?.lifetimePnL || 0
  const isProfitable = lifetimePnL >= 0

  return (
    <div className="w-full space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="text-xs text-muted-foreground font-medium">Balance</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(stats?.balance || 0)}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            {isProfitable ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className="text-xs text-muted-foreground font-medium">Lifetime P&L</span>
          </div>
          <p className={cn(
            'text-2xl font-bold',
            isProfitable ? 'text-green-600' : 'text-red-600'
          )}>
            {isProfitable ? '+' : ''}{formatCurrency(lifetimePnL)}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-muted-foreground font-medium">Points</span>
          </div>
          <p className="text-2xl font-bold">{(stats?.reputationPoints || 0).toLocaleString()}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-muted-foreground font-medium">Rank</span>
          </div>
          <p className="text-2xl font-bold">
            {(stats?.rank && stats.rank > 0) ? `#${stats.rank}` : '-'}
            {(stats?.totalPlayers && stats.totalPlayers > 0) && (
              <span className="text-sm text-muted-foreground font-normal ml-1">
                / {stats.totalPlayers.toLocaleString()}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Portfolio P&L Card (only for owner) */}
      {isOwner && portfolioPnL && (
        <div className="px-4">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold">Portfolio Performance</h3>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total P&L</p>
                <p className={cn(
                  'text-xl font-bold',
                  portfolioPnL.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {portfolioPnL.totalPnL >= 0 ? '+' : ''}{formatCurrency(portfolioPnL.totalPnL)}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">ROI</p>
                <p className={cn(
                  'text-xl font-bold',
                  portfolioPnL.roi >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {portfolioPnL.roi >= 0 ? '+' : ''}{portfolioPnL.roi.toFixed(2)}%
                </p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Open Positions</p>
                <p className="text-xl font-bold">{portfolioPnL.totalPositions}</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Perps P&L</p>
                <p className={cn(
                  'text-lg font-semibold',
                  portfolioPnL.perpPnL >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {portfolioPnL.perpPnL >= 0 ? '+' : ''}{formatCurrency(portfolioPnL.perpPnL)}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Predictions P&L</p>
                <p className={cn(
                  'text-lg font-semibold',
                  portfolioPnL.predictionPnL >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {portfolioPnL.predictionPnL >= 0 ? '+' : ''}{formatCurrency(portfolioPnL.predictionPnL)}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Position Count</p>
                <p className="text-lg font-semibold">
                  {portfolioPnL.perpPositions} perps / {portfolioPnL.predictionPositions} predictions
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section Toggle */}
      <div className="border-b border-border sticky top-0 bg-background z-10">
        <div className="flex px-4">
          <button
            onClick={() => setActiveSection('positions')}
            className={cn(
              'flex-1 py-4 font-semibold transition-colors relative hover:bg-muted/30',
              activeSection === 'positions' ? 'text-foreground opacity-100' : 'text-foreground opacity-50'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Activity className="w-4 h-4" />
              <span>Open Positions</span>
            </div>
            {activeSection === 'positions' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveSection('history')}
            className={cn(
              'flex-1 py-4 font-semibold transition-colors relative hover:bg-muted/30',
              activeSection === 'history' ? 'text-foreground opacity-100' : 'text-foreground opacity-50'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Trade History</span>
            </div>
            {activeSection === 'history' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
        {activeSection === 'positions' ? (
          <div className="space-y-6">
            {/* Perpetual Positions */}
            <div>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Perpetual Futures ({perpPositions.length})
              </h3>
              {perpPositions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-card border border-border rounded-lg">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No open perpetual positions</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {perpPositions.map((position) => {
                    const isLong = position.side === 'long'
                    const pnl = toNumber(position.unrealizedPnL)
                    const isPnLPositive = pnl >= 0

                    return (
                      <div
                        key={position.id}
                        onClick={() => router.push(`/markets/perps/${position.ticker}`)}
                        className="bg-card border border-border hover:border-primary/50 rounded-lg p-4 cursor-pointer transition-all"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {isLong ? (
                              <TrendingUp className="w-5 h-5 text-green-500" />
                            ) : (
                              <TrendingDown className="w-5 h-5 text-red-500" />
                            )}
                            <span className="font-bold text-lg">{position.ticker}</span>
                            <span className={cn(
                              'px-2 py-0.5 text-xs font-medium rounded',
                              isLong ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                            )}>
                              {position.side.toUpperCase()}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {position.leverage}x
                            </span>
                          </div>
                          <span className={cn(
                            'text-lg font-bold',
                            isPnLPositive ? 'text-green-600' : 'text-red-600'
                          )}>
                            {isPnLPositive ? '+' : ''}{formatCurrency(pnl)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Size</p>
                            <p className="font-medium">{formatCurrency(toNumber(position.size))}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Entry</p>
                            <p className="font-medium">{formatCurrency(toNumber(position.entryPrice))}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Current</p>
                            <p className="font-medium">{formatCurrency(toNumber(position.currentPrice))}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Prediction Positions */}
            <div>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" />
                Prediction Markets ({predictionPositions.length})
              </h3>
              {predictionPositions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-card border border-border rounded-lg">
                  <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No open prediction positions</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {predictionPositions.map((position) => {
                    const isYes = position.side === 'YES'
                    const currentPrice = calculateCurrentPrice(position.Market)
                    const avgPrice = toNumber(position.avgPrice)
                    const shares = toNumber(position.shares)
                    const unrealizedPnL = toNumber(position.unrealizedPnL)
                    const isPnLPositive = unrealizedPnL >= 0

                    return (
                      <div
                        key={position.id}
                        onClick={() => router.push(`/markets/predictions/${position.Market.id}`)}
                        className="bg-card border border-border hover:border-primary/50 rounded-lg p-4 cursor-pointer transition-all"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'px-2 py-1 text-xs font-medium rounded',
                              isYes ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                            )}>
                              {position.side}
                            </span>
                          </div>
                          <span className={cn(
                            'text-lg font-bold',
                            isPnLPositive ? 'text-green-600' : 'text-red-600'
                          )}>
                            {isPnLPositive ? '+' : ''}{formatCurrency(unrealizedPnL)}
                          </span>
                        </div>
                        <p className="text-sm font-medium mb-3 line-clamp-2">
                          {position.Market.question}
                        </p>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Shares</p>
                            <p className="font-medium">{shares.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Avg Price</p>
                            <p className="font-medium">${avgPrice.toFixed(3)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Current</p>
                            <p className="font-medium">${currentPrice.toFixed(3)}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Recent Trades
            </h3>
            <TradesFeed userId={userId} />
          </div>
        )}
      </div>
    </div>
  )
}
