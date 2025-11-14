'use client';

import { useCallback, useMemo, useState } from 'react';

import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

import { TradeConfirmationDialog, type ClosePerpDetails } from './TradeConfirmationDialog';

import { cn } from '@/lib/utils';

import { useAuth } from '@/hooks/useAuth';
import { useMarketPrices } from '@/hooks/useMarketPrices';
import { usePerpTrade } from '@/hooks/usePerpTrade';

import { calculateUnrealizedPnL } from '@/shared/perps-types';

interface PerpPosition {
  id: string;
  ticker: string;
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  size: number;
  leverage: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  liquidationPrice: number;
  fundingPaid: number;
  openedAt: string;
}

interface PerpPositionsListProps {
  positions: PerpPosition[];
  onPositionClosed?: () => void;
}

export function PerpPositionsList({
  positions,
  onPositionClosed,
}: PerpPositionsListProps) {
  const [closingId, setClosingId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingClose, setPendingClose] = useState<{
    position: PerpPosition;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
  } | null>(null);
  const { getAccessToken } = useAuth();
  const { closePosition: closePerpPosition } = usePerpTrade({
    getAccessToken,
  });

  const tickers = useMemo(
    () => positions.map((pos) => pos.ticker),
    [positions]
  );
  const livePrices = useMarketPrices(tickers);

  const handleCloseClick = useCallback(
    (position: PerpPosition, currentPrice: number, pnl: number, pnlPercent: number) => {
      setPendingClose({ position, currentPrice, pnl, pnlPercent });
      setConfirmDialogOpen(true);
    },
    []
  );

  const handleConfirmClose = useCallback(async () => {
    if (!pendingClose) return;

    setClosingId(pendingClose.position.id);
    setConfirmDialogOpen(false);

    const data = await closePerpPosition(pendingClose.position.id);
    const pnl =
      typeof data?.pnl === 'number'
        ? data.pnl
        : typeof data?.realizedPnL === 'number'
          ? data.realizedPnL
          : 0;

    toast.success('Position closed!', {
      description: `${pendingClose.position.ticker}: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} PnL`,
    });

    await onPositionClosed?.();
    setClosingId(null);
    setPendingClose(null);
  }, [closePerpPosition, onPositionClosed, pendingClose]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (positions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No open positions</p>
        <p className="text-sm mt-1">
          Open a long or short position to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {positions.map((position) => {
        const livePrice = livePrices.get(position.ticker)?.price;
        const currentPrice = livePrice ?? position.currentPrice;
        const { pnl: dynamicPnL, pnlPercent: dynamicPnLPercent } =
          calculateUnrealizedPnL(
            position.entryPrice,
            currentPrice,
            position.side,
            position.size
          );

        const liquidationDistance =
          position.side === 'long'
            ? ((currentPrice - position.liquidationPrice) / currentPrice) * 100
            : ((position.liquidationPrice - currentPrice) / currentPrice) * 100;

        const isNearLiquidation = liquidationDistance < 5;
        const isClosing = closingId === position.id;

        return (
          <div
            key={position.id}
            className={cn(
              'p-4 rounded transition-all',
              isNearLiquidation ? 'bg-red-600/10' : 'bg-muted/40'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-xs font-bold px-2 py-1 rounded flex items-center gap-1',
                    position.side === 'long'
                      ? 'bg-green-600/20 text-green-600'
                      : 'bg-red-600/20 text-red-600'
                  )}
                >
                  {position.side === 'long' ? (
                    <TrendingUp size={12} />
                  ) : (
                    <TrendingDown size={12} />
                  )}
                  {position.leverage}x {position.side.toUpperCase()}
                </span>
                <span className="font-bold text-foreground">
                  ${position.ticker}
                </span>
              </div>

              <div className="text-right">
                <div
                  className={cn(
                    'text-lg font-bold',
                    dynamicPnL >= 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {dynamicPnL >= 0 ? '+' : ''}
                  {formatPrice(dynamicPnL)}
                </div>
                <div
                  className={cn(
                    'text-xs',
                    dynamicPnL >= 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {dynamicPnL >= 0 ? '+' : ''}
                  {dynamicPnLPercent.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Liquidation Warning */}
            {isNearLiquidation && (
              <div className="flex items-center gap-2 p-2 bg-red-600/20 rounded mb-3">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-xs text-red-600 font-medium">
                  Near liquidation! {liquidationDistance.toFixed(2)}% away
                </p>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div>
                <div className="text-muted-foreground">Entry</div>
                <div className="font-medium text-foreground">
                  {formatPrice(position.entryPrice)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Current</div>
                <div className="font-medium text-foreground">
                  {formatPrice(currentPrice)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Liquidation</div>
                <div className="font-bold text-red-600">
                  {formatPrice(position.liquidationPrice)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Size</div>
                <div className="font-medium text-foreground">
                  {formatPrice(position.size)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Funding Paid</div>
                <div
                  className={cn(
                    'font-medium',
                    position.fundingPaid >= 0
                      ? 'text-red-600'
                      : 'text-green-600'
                  )}
                >
                  {position.fundingPaid >= 0 ? '-' : '+'}
                  {formatPrice(Math.abs(position.fundingPaid))}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Opened</div>
                <div className="font-medium text-foreground">
                  {formatDate(position.openedAt)}
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => handleCloseClick(position, currentPrice, dynamicPnL, dynamicPnLPercent)}
              disabled={isClosing}
              className={cn(
                'w-full py-2 rounded font-medium transition-all cursor-pointer',
                isNearLiquidation
                  ? 'bg-red-600 hover:bg-red-700 text-primary-foreground'
                  : 'bg-muted hover:bg-muted text-foreground',
                isClosing && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isClosing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Closing...
                </span>
              ) : (
                'Close Position'
              )}
            </button>
          </div>
        );
      })}

      {/* Confirmation Dialog */}
      <TradeConfirmationDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handleConfirmClose}
        isSubmitting={closingId !== null}
        tradeDetails={
          pendingClose
            ? ({
                type: 'close-perp',
                ticker: pendingClose.position.ticker,
                side: pendingClose.position.side,
                size: pendingClose.position.size,
                leverage: pendingClose.position.leverage,
                entryPrice: pendingClose.position.entryPrice,
                currentPrice: pendingClose.currentPrice,
                unrealizedPnL: pendingClose.pnl,
                unrealizedPnLPercent: pendingClose.pnlPercent,
              } as ClosePerpDetails)
            : null
        }
      />
    </div>
  );
}
