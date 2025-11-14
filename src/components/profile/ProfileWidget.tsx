'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWidgetCacheStore } from '@/stores/widgetCacheStore'
import { PositionDetailModal } from './PositionDetailModal'
import { BouncingLogo } from '@/components/shared/BouncingLogo'
import { ReputationCard } from '@/components/reputation/ReputationCard'
import type {
  UserBalanceData,
  PredictionPosition,
  UserProfileStats,
  ProfileWidgetPoolDeposit,
  PerpPositionFromAPI,
} from '@/types/profile'

interface ProfileWidgetProps {
  userId: string
}

export function ProfileWidget({ userId }: ProfileWidgetProps) {
  const router = useRouter()
  const [balance, setBalance] = useState<UserBalanceData | null>(null)
  const [predictions, setPredictions] = useState<PredictionPosition[]>([])
  const [perps, setPerps] = useState<PerpPositionFromAPI[]>([])
  const [pools, setPools] = useState<ProfileWidgetPoolDeposit[]>([])
  const [stats, setStats] = useState<UserProfileStats | null>(null)
  const [loading, setLoading] = useState(true)
  const widgetCache = useWidgetCacheStore()
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'prediction' | 'perp' | 'pool'>('prediction')
  const [selectedPosition, setSelectedPosition] = useState<PredictionPosition | PerpPositionFromAPI | ProfileWidgetPoolDeposit | null>(null)

  useEffect(() => {
    if (!userId) return
    
    const fetchData = async (skipCache = false) => {
      // Check cache first (unless explicitly skipping)
      if (!skipCache) {
        const cached = widgetCache.getProfileWidget(userId) as {
          balance: UserBalanceData | null
          predictions: PredictionPosition[]
          perps: PerpPositionFromAPI[]
          pools: ProfileWidgetPoolDeposit[]
          stats: UserProfileStats | null
        } | null
        if (cached) {
          setBalance(cached.balance)
          setPredictions(cached.predictions)
          setPerps(cached.perps)
          setPools(cached.pools)
          setStats(cached.stats)
          setLoading(false)
          return
        }
      }

      setLoading(true)
      
      // Fetch all data in parallel
      const [balanceRes, positionsRes, poolsRes, profileRes] = await Promise.all([
        fetch(`/api/users/${encodeURIComponent(userId)}/balance`),
        fetch(`/api/markets/positions/${encodeURIComponent(userId)}`),
        fetch(`/api/pools/deposits/${encodeURIComponent(userId)}`),
        fetch(`/api/users/${encodeURIComponent(userId)}/profile`),
      ])

      let balanceData: UserBalanceData | null = null
      let predictionsData: PredictionPosition[] = []
      let perpsData: PerpPositionFromAPI[] = []
      let poolsData: ProfileWidgetPoolDeposit[] = []
      let statsData: UserProfileStats | null = null

      // Process balance
      if (balanceRes.ok) {
        const balanceJson = await balanceRes.json()
        balanceData = {
          balance: Number(balanceJson.balance || 0),
          totalDeposited: Number(balanceJson.totalDeposited || 0),
          totalWithdrawn: Number(balanceJson.totalWithdrawn || 0),
          lifetimePnL: Number(balanceJson.lifetimePnL || 0),
        }
        setBalance(balanceData)
      }

      // Process positions
      if (positionsRes.ok) {
        const positionsJson = await positionsRes.json()
        predictionsData = positionsJson.predictions?.positions || []
        perpsData = positionsJson.perpetuals?.positions || []
        setPredictions(predictionsData)
        setPerps(perpsData)
      }

      // Process pools
      if (poolsRes.ok) {
        const poolsJson = await poolsRes.json()
        poolsData = poolsJson.activeDeposits || []
        setPools(poolsData)
      }

      // Process stats
      if (profileRes.ok) {
        const profileJson = await profileRes.json()
        const userStats = profileJson.user?.stats || {}
        statsData = {
          following: userStats.following || 0,
          followers: userStats.followers || 0,
          totalActivity: (userStats.comments || 0) + (userStats.reactions || 0) + (userStats.positions || 0),
        }
        setStats(statsData)
      }

      // Cache all the data
      widgetCache.setProfileWidget(userId, {
        balance: balanceData,
        predictions: predictionsData,
        perps: perpsData,
        pools: poolsData,
        stats: statsData,
      })
      setLoading(false)
    }

    fetchData()
    
    // Refresh every 30 seconds (skip cache to get fresh data)
    const interval = setInterval(() => fetchData(true), 30000)
    return () => clearInterval(interval)
  }, [userId])

  const formatPoints = (points: number) => {
    return points.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })
  }

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`
  }

  const calculateAPR = (returnPercent: number, depositedAt: string): number => {
    if (!depositedAt) return 0
    
    const depositDate = new Date(depositedAt)
    const now = new Date()
    const daysSinceDeposit = (now.getTime() - depositDate.getTime()) / (1000 * 60 * 60 * 24)
    
    if (daysSinceDeposit <= 0) return 0
    
    // Annualize the return: (returnPercent / daysSinceDeposit) * 365
    const annualizedReturn = (returnPercent / daysSinceDeposit) * 365
    
    return annualizedReturn
  }

  // Calculate points in positions (total deposited minus available balance)
  const pointsInPositions = Math.max(0, (balance?.totalDeposited || 0) - (balance?.balance || 0))
  const totalPortfolio = balance?.totalDeposited || 0
  const pnlPercent = totalPortfolio > 0 ? ((balance?.lifetimePnL || 0) / totalPortfolio) * 100 : 0

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-y-auto w-full">
        <div className="flex items-center justify-center py-8">
          <BouncingLogo size={24} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full">
      {/* Reputation Card */}
      <div className="mb-6">
        <ReputationCard userId={userId} />
      </div>

      {/* Points Section */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-foreground mb-3">Points</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Available</span>
            <span className="text-sm font-semibold text-foreground">{formatPoints(balance?.balance || 0)} pts</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">In Positions</span>
            <span className="text-sm font-semibold text-foreground">{formatPoints(pointsInPositions)} pts</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Portfolio</span>
            <span className="text-sm font-semibold text-foreground">{formatPoints(totalPortfolio)} pts</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-sm text-muted-foreground">P&L</span>
            <span className={cn(
              "text-sm font-semibold",
              (balance?.lifetimePnL || 0) >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {formatPoints(balance?.lifetimePnL || 0)} pts ({formatPercent(pnlPercent)})
            </span>
          </div>
        </div>
      </div>

      {/* Holdings Section */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/markets')}
          className="text-lg font-bold text-foreground mb-3 hover:text-[#0066FF] transition-colors cursor-pointer text-left"
        >
          Holdings
        </button>
        
        {/* Predictions */}
        {predictions.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => router.push('/markets')}
              className="text-xs font-semibold text-muted-foreground mb-2 uppercase hover:text-[#0066FF] transition-colors cursor-pointer block"
            >
              PREDICTIONS
            </button>
            <div className="space-y-2">
              {predictions.slice(0, 3).map((pred) => {
                const pnlPercent = pred.avgPrice > 0 ? ((pred.currentPrice - pred.avgPrice) / pred.avgPrice) * 100 : 0
                return (
                  <button
                    key={pred.id}
                    onClick={() => {
                      setSelectedPosition(pred)
                      setModalType('prediction')
                      setModalOpen(true)
                    }}
                    className="text-sm w-full text-left hover:bg-muted/30 rounded p-2 -ml-2 transition-colors cursor-pointer"
                  >
                    <div className="font-medium text-foreground truncate">{pred.question}</div>
                    <div className="text-xs text-muted-foreground">
                      {pred.shares} shares {pred.side} @ {formatPrice(pred.avgPrice)}
                    </div>
                    <div className={cn(
                      "text-xs font-medium mt-0.5",
                      pnlPercent >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {formatPercent(pnlPercent)}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Stocks (Perps) */}
        {perps.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => router.push('/markets')}
              className="text-xs font-semibold text-muted-foreground mb-2 uppercase hover:text-[#0066FF] transition-colors cursor-pointer block"
            >
              STOCKS
            </button>
            <div className="space-y-2">
              {perps.slice(0, 3).map((perp) => (
                <button
                  key={perp.id}
                  onClick={() => {
                    setSelectedPosition(perp)
                    setModalType('perp')
                    setModalOpen(true)
                  }}
                  className="text-sm w-full text-left hover:bg-muted/30 rounded p-2 -ml-2 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">{perp.ticker}</span>
                    {perp.unrealizedPnLPercent >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-green-600" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-600" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatPoints(perp.size)} pts
                  </div>
                  <div className={cn(
                    "text-xs font-medium mt-0.5",
                    perp.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {formatPoints(perp.unrealizedPnL)} pts ({formatPercent(perp.unrealizedPnLPercent)})
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Agent Stakes */}
        {pools.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => router.push('/markets')}
              className="text-xs font-semibold text-muted-foreground mb-2 uppercase hover:text-[#0066FF] transition-colors cursor-pointer block"
            >
              AGENT STAKES
            </button>
            <div className="space-y-2">
              {pools.slice(0, 3).map((pool) => {
                const apr = calculateAPR(pool.returnPercent, pool.depositedAt)
                return (
                  <button
                    key={pool.id}
                    onClick={() => {
                      setSelectedPosition(pool)
                      setModalType('pool')
                      setModalOpen(true)
                    }}
                    className="text-sm w-full text-left hover:bg-muted/30 rounded p-2 -ml-2 transition-colors cursor-pointer"
                  >
                    <div className="font-medium text-foreground">{pool.poolName}</div>
                    <div className="text-xs text-muted-foreground">
                      Staked: {formatPoints(pool.amount)} pts
                    </div>
                    {apr > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {formatPercent(apr)} APR
                      </div>
                    )}
                    <div className={cn(
                      "text-xs font-medium mt-0.5",
                      pool.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {formatPercent(pool.returnPercent)} ({formatPoints(pool.unrealizedPnL)} pts)
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {predictions.length === 0 && perps.length === 0 && pools.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">
            No holdings yet
          </div>
        )}
      </div>

      {/* Stats Section */}
      {stats && (
        <div className="mb-6">
          <h3 className="text-lg font-bold text-foreground mb-3">Stats</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{stats.following} Following</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{stats.followers} Followers</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{stats.totalActivity} Total Activity</span>
            </div>
          </div>
        </div>
      )}

      {/* Help Icon */}
      <div className="mt-auto pt-4 flex justify-end">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Position Detail Modal */}
      <PositionDetailModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedPosition(null)
        }}
        type={modalType}
        data={selectedPosition}
        userId={userId}
        onSuccess={async () => {
          const [balanceRes, positionsRes] = await Promise.all([
            fetch(`/api/users/${encodeURIComponent(userId)}/balance`),
            fetch(`/api/markets/positions/${encodeURIComponent(userId)}`),
          ])
          
          const balanceJson = await balanceRes.json()
          setBalance({
            balance: Number(balanceJson.balance),
            totalDeposited: Number(balanceJson.totalDeposited),
            totalWithdrawn: Number(balanceJson.totalWithdrawn),
            lifetimePnL: Number(balanceJson.lifetimePnL),
          })
          
          const positionsJson = await positionsRes.json()
          setPredictions(positionsJson.predictions.positions)
          setPerps(positionsJson.perpetuals.positions)
        }}
      />
    </div>
  )
}

