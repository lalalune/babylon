'use client';

import { useEffect } from 'react';

import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';

import { cn } from '@/lib/utils';

import { useAuth } from '@/hooks/useAuth';
import { useWalletBalance } from '@/hooks/useWalletBalance';

interface WalletBalanceProps {
  refreshTrigger?: number; // Timestamp or counter to force refresh
}

export function WalletBalance({ refreshTrigger }: WalletBalanceProps = {}) {
  const { user, authenticated } = useAuth();
  const { balance, lifetimePnL, loading, refresh } = useWalletBalance(
    user?.id,
    { enabled: authenticated }
  );

  useEffect(() => {
    if (refreshTrigger === undefined) return;
    void refresh();
  }, [refreshTrigger, refresh]);

  if (!authenticated) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const isProfit = lifetimePnL >= 0;
  const startingBalance = 1000;

  return (
    <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 bg-muted/30 rounded overflow-x-auto">
      <div className="flex items-center gap-2 flex-shrink-0">
        <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
        <div>
          <div className="text-xs text-muted-foreground">Balance</div>
          <div
            className={cn(
              'text-base sm:text-lg font-bold whitespace-nowrap',
              balance > startingBalance
                ? 'text-green-600'
                : balance < startingBalance
                  ? 'text-red-600'
                  : 'text-foreground'
            )}
          >
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
          <div
            className={cn(
              'text-sm font-bold whitespace-nowrap',
              isProfit ? 'text-green-600' : 'text-red-600'
            )}
          >
            {loading ? '...' : isProfit ? '+' : ''}
            {formatCurrency(lifetimePnL)}
          </div>
        </div>
      </div>
    </div>
  );
}
