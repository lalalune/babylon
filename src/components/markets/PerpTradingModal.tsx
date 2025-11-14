'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { FEE_CONFIG } from '@/lib/config/fees';
import { cn } from '@/lib/utils';

import { useAuth } from '@/hooks/useAuth';
import { usePerpTrade } from '@/hooks/usePerpTrade';
import { useWalletBalance } from '@/hooks/useWalletBalance';

interface PerpMarket {
  ticker: string;
  organizationId: string;
  name: string;
  currentPrice: number;
  fundingRate: {
    rate: number;
    nextFundingTime: string;
  };
  maxLeverage: number;
  minOrderSize: number;
}

interface PerpTradingModalProps {
  market: PerpMarket;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PerpTradingModal({
  market,
  isOpen,
  onClose,
  onSuccess,
}: PerpTradingModalProps) {
  const { user, authenticated, login, getAccessToken } = useAuth();
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [size, setSize] = useState('100');
  const [leverage, setLeverage] = useState(10);
  const [loading, setLoading] = useState(false);
  const { openPosition } = usePerpTrade({ getAccessToken });
  const {
    balance,
    loading: balanceLoading,
    refresh: refreshBalance,
  } = useWalletBalance(user?.id, { enabled: Boolean(user?.id) && isOpen });

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, loading, onClose]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!isOpen) return null;

  const sizeNum = parseFloat(size) || 0;
  const marginRequired = sizeNum > 0 ? sizeNum / leverage : 0;
  const liquidationPrice =
    side === 'long'
      ? market.currentPrice * (1 - 0.9 / leverage)
      : market.currentPrice * (1 + 0.9 / leverage);

  const positionValue = sizeNum * leverage;
  const liquidationDistance =
    side === 'long'
      ? ((market.currentPrice - liquidationPrice) / market.currentPrice) * 100
      : ((liquidationPrice - market.currentPrice) / market.currentPrice) * 100;

  const estimatedFee = useMemo(() => {
    if (sizeNum <= 0) return 0;
    return sizeNum * FEE_CONFIG.TRADING_FEE_RATE;
  }, [sizeNum]);

  const totalRequired = useMemo(() => {
    if (sizeNum <= 0) return 0;
    return marginRequired + estimatedFee;
  }, [estimatedFee, marginRequired, sizeNum]);

  const showBalanceWarning =
    authenticated && sizeNum > 0 && balance < totalRequired;

  const handleSubmit = async () => {
    if (!authenticated) {
      login?.();
      return;
    }

    if (!user) return;

    if (sizeNum < market.minOrderSize) {
      toast.error(`Minimum order size is $${market.minOrderSize}`);
      return;
    }

    if (showBalanceWarning) {
      toast.error('Insufficient balance to cover margin and fees');
      return;
    }

    setLoading(true);

    await openPosition({
      ticker: market.ticker,
      side,
      size: sizeNum,
      leverage,
    });

    toast.success('Position opened!', {
      description: `Opened ${leverage}x ${side} on ${market.ticker} at $${market.currentPrice.toFixed(2)}`,
    });

    await refreshBalance();
    onSuccess?.();
    onClose();
    setLoading(false);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const isHighRisk = leverage > 50 || marginRequired > 1000;

  return (
    <>
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg">
        <div className="bg-popover rounded shadow-xl p-4 sm:p-6 m-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                ${market.ticker}
              </h2>
              <p className="text-sm text-muted-foreground">{market.name}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-2"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mb-6 p-4 bg-muted rounded">
            <div className="text-sm text-muted-foreground mb-1">
              Current Price
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground">
              {formatPrice(market.currentPrice)}
            </div>
          </div>

          {authenticated && (
            <div className="flex items-center justify-between bg-muted/40 rounded p-3 mb-4 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="w-4 h-4" /> Balance
              </span>
              <span className="font-semibold text-foreground">
                {balanceLoading ? '...' : formatPrice(balance)}
              </span>
            </div>
          )}

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setSide('long')}
              className={cn(
                'flex-1 py-3 rounded font-bold transition-all flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer',
                side === 'long'
                  ? 'bg-green-600 text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted'
              )}
            >
              <TrendingUp size={18} />
              LONG
            </button>
            <button
              onClick={() => setSide('short')}
              className={cn(
                'flex-1 py-3 rounded font-bold transition-all flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer',
                side === 'short'
                  ? 'bg-red-600 text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted'
              )}
            >
              <TrendingDown size={18} />
              SHORT
            </button>
          </div>

          <div className="bg-muted rounded p-4 mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">
                Position Size (USD)
              </label>
              <input
                type="number"
                value={size}
                onChange={(event) => setSize(event.target.value)}
                min={market.minOrderSize}
                step="10"
                className="w-32 px-3 py-1.5 rounded bg-background/50 text-foreground text-right font-medium focus:outline-none focus:bg-background focus:ring-2 focus:ring-[#0066FF]/30"
                placeholder={`Min: $${market.minOrderSize}`}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground">
                  Leverage
                </label>
                <span className="text-base font-bold text-foreground">
                  {leverage}x
                </span>
              </div>
              <input
                type="range"
                min="1"
                max={market.maxLeverage}
                value={leverage}
                onChange={(event) => setLeverage(parseInt(event.target.value))}
                className="w-full h-2 mt-2 bg-background rounded appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1x</span>
                <span>{market.maxLeverage}x</span>
              </div>
            </div>
          </div>

          <div className="bg-muted/20 p-4 rounded mb-6">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-muted-foreground">Margin Required</span>
              <span className="font-bold text-foreground text-right">
                {formatPrice(marginRequired)}
              </span>

              <span className="text-muted-foreground">Position Value</span>
              <span className="font-bold text-foreground text-right">
                {formatPrice(positionValue)}
              </span>

              <span className="text-muted-foreground">Entry Price</span>
              <span className="font-medium text-foreground text-right">
                {formatPrice(market.currentPrice)}
              </span>

              <span className="text-muted-foreground">Liquidation Price</span>
              <span className="font-bold text-red-600 text-right">
                {formatPrice(liquidationPrice)}
              </span>

              <span className="text-muted-foreground">Distance to Liq</span>
              <span
                className={cn(
                  'font-medium text-right',
                  liquidationDistance > 5
                    ? 'text-green-600'
                    : liquidationDistance > 2
                      ? 'text-yellow-600'
                      : 'text-red-600'
                )}
              >
                {liquidationDistance.toFixed(2)}%
              </span>

              <span className="text-muted-foreground">
                Est. Trading Fee (
                {(FEE_CONFIG.TRADING_FEE_RATE * 100).toFixed(2)}%)
              </span>
              <span className="font-bold text-foreground text-right">
                {formatPrice(estimatedFee)}
              </span>

              <span className="text-muted-foreground">Total Required</span>
              <span
                className={cn(
                  'font-bold text-right',
                  showBalanceWarning ? 'text-red-600' : 'text-foreground'
                )}
              >
                {formatPrice(totalRequired)}
              </span>
            </div>
          </div>

          {authenticated && sizeNum > 0 && (
            <div className="text-xs text-muted-foreground mb-4">
              Required amount includes estimated fees.
              {showBalanceWarning && (
                <span className="text-red-500 font-semibold ml-1">
                  Balance too low for this trade.
                </span>
              )}
            </div>
          )}

          {isHighRisk && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/15 rounded-lg mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-bold text-yellow-600 mb-1">
                  High Risk Position
                </div>
                <p className="text-muted-foreground">
                  {leverage > 50 && 'Leverage above 50x is extremely risky. '}
                  {marginRequired > 1000 &&
                    'This position requires significant margin. '}
                  Small price movements can lead to liquidation.
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={
              loading ||
              sizeNum < market.minOrderSize ||
              showBalanceWarning ||
              balanceLoading
            }
            className={cn(
              'w-full py-3 rounded font-bold text-primary-foreground text-lg transition-all cursor-pointer flex items-center justify-center gap-2',
              side === 'long'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700',
              (loading ||
                sizeNum < market.minOrderSize ||
                showBalanceWarning ||
                balanceLoading) &&
                'opacity-50 cursor-not-allowed'
            )}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Opening Position...
              </>
            ) : (
              `${side === 'long' ? 'LONG' : 'SHORT'} ${market.ticker} ${leverage}x`
            )}
          </button>
        </div>
      </div>
    </>
  );
}
