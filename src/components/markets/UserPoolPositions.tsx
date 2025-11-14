'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import type { UserPoolDeposit, UserPoolSummary } from '@/types/pools'
import { BouncingLogo } from '@/components/shared/BouncingLogo'

interface UserPoolPositionsProps {
  onWithdraw?: () => void
}

export function UserPoolPositions({ onWithdraw }: UserPoolPositionsProps) {
  const { user, authenticated } = useAuth()
  const [deposits, setDeposits] = useState<UserPoolDeposit[]>([])
  const [summary, setSummary] = useState<UserPoolSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [withdrawing, setWithdrawing] = useState<string | null>(null)

  useEffect(() => {
    if (authenticated && user) {
      fetchDeposits()
    }
  }, [authenticated, user])

  const fetchDeposits = async () => {
    if (!user) return
    
    setLoading(true)
    const res = await fetch(`/api/pools/deposits/${encodeURIComponent(user.id)}`)
    const data = await res.json()
    setDeposits(data.activeDeposits || [])
    setSummary(data.summary)
    setLoading(false)
  }

  const handleWithdraw = async (depositId: string, poolId: string) => {
    if (!user) return
    
    const confirmed = confirm('Are you sure you want to withdraw from this pool? Performance fees will be calculated.')
    if (!confirmed) return

    setWithdrawing(depositId)
    const res = await fetch(`/api/pools/${poolId}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        depositId,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Withdrawal failed')
    }

    alert(`Withdrew $${data.withdrawalAmount.toFixed(2)}!\nProfit: $${data.pnl.toFixed(2)}\nFee: $${data.performanceFee.toFixed(2)}\nReputation: ${data.reputationChange >= 0 ? '+' : ''}${data.reputationChange}`)
    
    fetchDeposits()
    onWithdraw?.()
    setWithdrawing(null)
  }

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`
  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`

  if (!authenticated) {
    return (
      <div className="p-4 rounded-lg bg-muted/50 text-center">
        <p className="text-sm text-muted-foreground">
          Log in to see your pool positions
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <BouncingLogo size={24} />
      </div>
    )
  }

  if (deposits.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <div className="p-4 bg-muted rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Invested</div>
              <div className="text-xl font-bold">{formatCurrency(summary.totalInvested)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Current Value</div>
              <div className="text-xl font-bold">{formatCurrency(summary.totalCurrentValue)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total P&L</div>
              <div className={cn(
                "text-xl font-bold",
                summary.totalUnrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {formatCurrency(summary.totalUnrealizedPnL)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Return</div>
              <div className={cn(
                "text-xl font-bold",
                summary.totalReturnPercent >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {formatPercent(summary.totalReturnPercent)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual Deposits */}
      <div className="space-y-2">
        {deposits.map((deposit) => (
          <div key={deposit.id} className="p-3 bg-card border border-border rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold">{deposit.poolName}</div>
                <div className="text-xs text-muted-foreground">
                  {deposit.npcActor.name} • {deposit.npcActor.tier?.replace('_TIER', '')}
                </div>
              </div>
              <div className="text-right">
                <div className={cn(
                  "font-bold",
                  deposit.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatCurrency(deposit.unrealizedPnL)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatPercent(deposit.returnPercent)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs mb-3">
              <div>
                <div className="text-muted-foreground">Invested</div>
                <div className="font-medium">{formatCurrency(deposit.amount)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Current</div>
                <div className="font-medium">{formatCurrency(deposit.currentValue)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Shares</div>
                <div className="font-medium">{deposit.shares.toFixed(2)}</div>
              </div>
            </div>

            <button
              onClick={() => handleWithdraw(deposit.id, deposit.poolId)}
              disabled={withdrawing === deposit.id}
              className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
            >
              {withdrawing === deposit.id ? 'Withdrawing...' : 'Withdraw'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

