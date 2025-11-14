'use client'

import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'

interface WalletBalanceProps {
  refreshTrigger?: number; // Timestamp or counter to force refresh
}

export function WalletBalance({ refreshTrigger }: WalletBalanceProps = {}) {
  const { user, authenticated } = useAuth()
  const [balance, setBalance] = useState(0)
  const [lifetimePnL, setLifetimePnL] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchBalance = async () => {
    if (!authenticated || !user) {
      setBalance(0)
      setLifetimePnL(0)
      return
    }

    setLoading(true)
    const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/balance`)
    if (response.ok) {
      const data = await response.json()
      setBalance(data.balance || 0)
      setLifetimePnL(data.lifetimePnL || 0)
    }
    setLoading(false)
  }

  // Initial fetch and periodic refresh
  useEffect(() => {
    if (!authenticated || !user) {
      setBalance(0)
      setLifetimePnL(0)
      return
    }

    fetchBalance()

    // Refresh every 30 seconds
    const interval = setInterval(fetchBalance, 30000)
    return () => clearInterval(interval)
  }, [authenticated, user])

  // Trigger immediate refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger) {
      fetchBalance()
    }
  }, [refreshTrigger])

  if (!authenticated) {
    return null
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const isProfit = lifetimePnL >= 0
  const startingBalance = 1000

  return (
    <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/30 rounded overflow-x-auto">
      <div className="flex items-center gap-2 flex-shrink-0">
        <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
        <div>
          <div className="text-xs text-muted-foreground">Balance</div>
          <div className={cn(
            "text-base sm:text-lg font-bold whitespace-nowrap",
            balance > startingBalance ? "text-green-600" : balance < startingBalance ? "text-red-600" : "text-foreground"
          )}>
            {loading ? '...' : formatCurrency(balance)}
          </div>
        </div>
      </div>

      <div className="h-8 w-px bg-border flex-shrink-0" />

      <div className="flex items-center gap-2 flex-shrink-0">
        {isProfit ? (
          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
        )}
        <div>
          <div className="text-xs text-muted-foreground">Lifetime PnL</div>
          <div className={cn(
            "text-sm font-bold whitespace-nowrap",
            isProfit ? "text-green-600" : "text-red-600"
          )}>
            {loading ? '...' : (isProfit ? '+' : '')}{formatCurrency(lifetimePnL)}
          </div>
        </div>
      </div>
    </div>
  )
}

