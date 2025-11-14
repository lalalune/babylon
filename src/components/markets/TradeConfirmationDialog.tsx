'use client';

import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, CheckCircle, TrendingDown, TrendingUp, XCircle } from 'lucide-react';

type TradeType = 'open-perp' | 'close-perp' | 'buy-prediction' | 'sell-prediction';

interface BaseTradeDetails {
  type: TradeType;
}

interface OpenPerpDetails extends BaseTradeDetails {
  type: 'open-perp';
  ticker: string;
  side: 'long' | 'short';
  size: number;
  leverage: number;
  entryPrice: number;
  margin: number;
  estimatedFee: number;
  liquidationPrice: number;
  liquidationDistance: number;
}

interface ClosePerpDetails extends BaseTradeDetails {
  type: 'close-perp';
  ticker: string;
  side: 'long' | 'short';
  size: number;
  leverage: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

interface BuyPredictionDetails extends BaseTradeDetails {
  type: 'buy-prediction';
  question: string;
  side: 'YES' | 'NO';
  amount: number;
  sharesBought: number;
  avgPrice: number;
  newPrice: number;
  priceImpact: number;
  expectedPayout: number;
  expectedProfit: number;
}

interface SellPredictionDetails extends BaseTradeDetails {
  type: 'sell-prediction';
  question: string;
  side: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  expectedValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

type TradeDetails =
  | OpenPerpDetails
  | ClosePerpDetails
  | BuyPredictionDetails
  | SellPredictionDetails;

interface TradeConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  tradeDetails: TradeDetails | null;
  isSubmitting?: boolean;
}

export function TradeConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  tradeDetails,
  isSubmitting = false,
}: TradeConfirmationDialogProps) {
  if (!tradeDetails) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const getTitle = () => {
    switch (tradeDetails.type) {
      case 'open-perp':
        return `Confirm ${tradeDetails.side === 'long' ? 'Long' : 'Short'} Position`;
      case 'close-perp':
        return 'Confirm Close Position';
      case 'buy-prediction':
        return `Confirm Buy ${tradeDetails.side} Shares`;
      case 'sell-prediction':
        return `Confirm Sell ${tradeDetails.side} Shares`;
    }
  };

  const getDescription = () => {
    switch (tradeDetails.type) {
      case 'open-perp':
        return `You're about to open a ${tradeDetails.leverage}x ${tradeDetails.side} position on $${tradeDetails.ticker}`;
      case 'close-perp':
        return `You're about to close your ${tradeDetails.leverage}x ${tradeDetails.side} position on $${tradeDetails.ticker}`;
      case 'buy-prediction':
        return `You're about to buy ${tradeDetails.side} shares on this prediction market`;
      case 'sell-prediction':
        return `You're about to sell all your ${tradeDetails.side} shares`;
    }
  };

  const getIcon = () => {
    switch (tradeDetails.type) {
      case 'open-perp':
        return tradeDetails.side === 'long' ? (
          <TrendingUp className="w-6 h-6 text-green-600" />
        ) : (
          <TrendingDown className="w-6 h-6 text-red-600" />
        );
      case 'close-perp':
        return tradeDetails.unrealizedPnL >= 0 ? (
          <CheckCircle className="w-6 h-6 text-green-600" />
        ) : (
          <XCircle className="w-6 h-6 text-red-600" />
        );
      case 'buy-prediction':
        return tradeDetails.side === 'YES' ? (
          <CheckCircle className="w-6 h-6 text-green-600" />
        ) : (
          <XCircle className="w-6 h-6 text-red-600" />
        );
      case 'sell-prediction':
        return tradeDetails.unrealizedPnL >= 0 ? (
          <CheckCircle className="w-6 h-6 text-green-600" />
        ) : (
          <XCircle className="w-6 h-6 text-red-600" />
        );
    }
  };

  const renderDetails = () => {
    switch (tradeDetails.type) {
      case 'open-perp':
        return (
          <div className="space-y-3 bg-muted/30 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Market</span>
              <span className="font-medium">${tradeDetails.ticker}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Position Size</span>
              <span className="font-medium">{formatPrice(tradeDetails.size)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Leverage</span>
              <span className="font-medium">{tradeDetails.leverage}x</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Entry Price</span>
              <span className="font-medium">{formatPrice(tradeDetails.entryPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Margin Required</span>
              <span className="font-bold">{formatPrice(tradeDetails.margin)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. Trading Fee</span>
              <span className="font-medium">{formatPrice(tradeDetails.estimatedFee)}</span>
            </div>
            <div className="border-t border-border pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Liquidation Price</span>
                <span className="font-bold text-red-600">
                  {formatPrice(tradeDetails.liquidationPrice)}
                </span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-muted-foreground">Distance to Liquidation</span>
                <span
                  className={cn(
                    'font-medium',
                    tradeDetails.liquidationDistance > 5
                      ? 'text-green-600'
                      : tradeDetails.liquidationDistance > 2
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  )}
                >
                  {tradeDetails.liquidationDistance.toFixed(2)}%
                </span>
              </div>
            </div>
            {tradeDetails.liquidationDistance < 5 && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/15 rounded-lg mt-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-600 font-medium">
                  Warning: High leverage increases liquidation risk. Consider lowering your leverage or position size.
                </p>
              </div>
            )}
          </div>
        );

      case 'close-perp':
        return (
          <div className="space-y-3 bg-muted/30 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Market</span>
              <span className="font-medium">${tradeDetails.ticker}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Position Size</span>
              <span className="font-medium">{formatPrice(tradeDetails.size)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Entry Price</span>
              <span className="font-medium">{formatPrice(tradeDetails.entryPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Price</span>
              <span className="font-medium">{formatPrice(tradeDetails.currentPrice)}</span>
            </div>
            <div className="border-t border-border pt-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Unrealized P&L</span>
                <div className="text-right">
                  <div
                    className={cn(
                      'font-bold',
                      tradeDetails.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {tradeDetails.unrealizedPnL >= 0 ? '+' : ''}
                    {formatPrice(tradeDetails.unrealizedPnL)}
                  </div>
                  <div
                    className={cn(
                      'text-xs',
                      tradeDetails.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {tradeDetails.unrealizedPnL >= 0 ? '+' : ''}
                    {tradeDetails.unrealizedPnLPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'buy-prediction':
        return (
          <div className="space-y-3 bg-muted/30 rounded-lg p-4">
            <div className="text-sm">
              <div className="text-muted-foreground mb-2">Market Question</div>
              <div className="font-medium">{tradeDetails.question}</div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{formatPrice(tradeDetails.amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shares</span>
              <span className="font-medium">{tradeDetails.sharesBought.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg Price/Share</span>
              <span className="font-medium">{formatPrice(tradeDetails.avgPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">New {tradeDetails.side} Price</span>
              <span className="font-medium">{(tradeDetails.newPrice * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Price Impact</span>
              <span className="font-medium text-orange-500">
                +{Math.abs(tradeDetails.priceImpact).toFixed(2)}%
              </span>
            </div>
            <div className="border-t border-border pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">If {tradeDetails.side} Wins</span>
                <span className="font-bold text-green-600">
                  {formatPrice(tradeDetails.expectedPayout)}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Expected Profit</span>
                <span
                  className={cn(
                    'font-bold',
                    tradeDetails.expectedProfit >= 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {tradeDetails.expectedProfit >= 0 ? '+' : ''}
                  {formatPrice(tradeDetails.expectedProfit)}
                </span>
              </div>
            </div>
          </div>
        );

      case 'sell-prediction':
        return (
          <div className="space-y-3 bg-muted/30 rounded-lg p-4">
            <div className="text-sm">
              <div className="text-muted-foreground mb-2">Market Question</div>
              <div className="font-medium">{tradeDetails.question}</div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shares to Sell</span>
              <span className="font-medium">{tradeDetails.shares.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your Avg Cost</span>
              <span className="font-medium">{formatPrice(tradeDetails.avgPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Price</span>
              <span className="font-medium">{formatPrice(tradeDetails.currentPrice)}</span>
            </div>
            <div className="border-t border-border pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expected Value</span>
                <span className="font-bold">{formatPrice(tradeDetails.expectedValue)}</span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-sm text-muted-foreground">Realized P&L</span>
                <div className="text-right">
                  <div
                    className={cn(
                      'font-bold',
                      tradeDetails.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {tradeDetails.unrealizedPnL >= 0 ? '+' : ''}
                    {formatPrice(tradeDetails.unrealizedPnL)}
                  </div>
                  <div
                    className={cn(
                      'text-xs',
                      tradeDetails.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {tradeDetails.unrealizedPnL >= 0 ? '+' : ''}
                    {tradeDetails.unrealizedPnLPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {getIcon()}
            <AlertDialogTitle>{getTitle()}</AlertDialogTitle>
          </div>
          <AlertDialogDescription>{getDescription()}</AlertDialogDescription>
        </AlertDialogHeader>

        {renderDetails()}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isSubmitting}
            className={cn(
              tradeDetails.type === 'open-perp' &&
                tradeDetails.side === 'long'
                ? 'bg-green-600 hover:bg-green-700'
                : tradeDetails.type === 'open-perp' &&
                    tradeDetails.side === 'short'
                  ? 'bg-red-600 hover:bg-red-700'
                  : tradeDetails.type === 'buy-prediction' &&
                      tradeDetails.side === 'YES'
                    ? 'bg-green-600 hover:bg-green-700'
                    : tradeDetails.type === 'buy-prediction' &&
                        tradeDetails.side === 'NO'
                      ? 'bg-red-600 hover:bg-red-700'
                      : ''
            )}
          >
            {isSubmitting ? 'Processing...' : 'Confirm Trade'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Export types for use in other components
export type { TradeDetails, OpenPerpDetails, ClosePerpDetails, BuyPredictionDetails, SellPredictionDetails };

