'use client';

// @ts-nocheck


import { useCallback, useEffect, useMemo, useState } from 'react';

import { useParams, useRouter, useSearchParams } from 'next/navigation';

import {
  AlertTriangle,
  ArrowLeft,
  Info,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRef } from 'react';

import { PerpPositionsList } from '@/components/markets/PerpPositionsList';
import { PerpPriceChart } from '@/components/markets/PerpPriceChart';
import { TradeConfirmationDialog, type OpenPerpDetails } from '@/components/markets/TradeConfirmationDialog';
import { AssetTradesFeed } from '@/components/markets/AssetTradesFeed';
import { Skeleton } from '@/components/shared/Skeleton';
import { PageContainer } from '@/components/shared/PageContainer';

import { FEE_CONFIG } from '@/lib/config/fees';
import { cn } from '@/lib/utils';

import { useAuth } from '@/hooks/useAuth';
import { useMarketPrices } from '@/hooks/useMarketPrices';
import { usePerpTrade } from '@/hooks/usePerpTrade';
import { useMarketTracking } from '@/hooks/usePostHog';
import { useUserPositions } from '@/hooks/useUserPositions';
import { useWalletBalance } from '@/hooks/useWalletBalance';

interface PerpMarket {
  ticker: string;
  organizationId: string;
  name: string;
  currentPrice: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  openInterest: number;
  fundingRate: {
    rate: number;
    nextFundingTime: string;
    predictedRate: number;
  };
  maxLeverage: number;
  minOrderSize: number;
}

interface PricePoint {
  time: number;
  price: number;
}

export default function PerpDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, authenticated, login, getAccessToken } = useAuth();
  const ticker = params.ticker as string;
  const { trackMarketView } = useMarketTracking();
  const from = searchParams.get('from');

  const [market, setMarket] = useState<PerpMarket | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [size, setSize] = useState('100');
  const [leverage, setLeverage] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const { perpPositions, refresh: refreshUserPositions } = useUserPositions(
    user?.id,
    {
      enabled: authenticated,
    }
  );
  const userPositions = useMemo(
    () => perpPositions.filter((position) => position.ticker === ticker),
    [perpPositions, ticker]
  );
  const { openPosition } = usePerpTrade({
    getAccessToken,
  });
  const {
    balance,
    loading: balanceLoading,
    refresh: refreshWalletBalance,
  } = useWalletBalance(user?.id, { enabled: authenticated });

  const trackedTicker = market?.ticker ?? ticker;
  const livePrices = useMarketPrices(trackedTicker ? [trackedTicker] : []);
  const livePrice = trackedTicker ? livePrices.get(trackedTicker) : undefined;
  const displayPrice = livePrice?.price ?? market?.currentPrice ?? 0;

  // Track market view
  useEffect(() => {
    if (ticker && market) {
      trackMarketView(ticker, 'perp');
    }
  }, [ticker, market, trackMarketView]);

  const fetchMarketData = useCallback(async () => {
    const response = await fetch('/api/markets/perps');
    const data = await response.json();
    const foundMarket = data.markets?.find(
      (m: PerpMarket) => m.ticker === ticker
    );

    if (!foundMarket) {
      toast.error('Market not found');
      router.push(from === 'dashboard' ? '/markets' : '/markets/perps');
      return;
    }

    setMarket(foundMarket);

    // Generate mock price history (you'll want to replace this with real data)
    const now = Date.now();
    const history: PricePoint[] = [];
    const basePrice = foundMarket.currentPrice;
    const volatility = basePrice * 0.02; // 2% volatility

    for (let i = 100; i >= 0; i--) {
      const time = now - i * 15 * 60 * 1000; // 15 min intervals for last ~25 hours
      const randomChange = (Math.random() - 0.5) * volatility;
      const price =
        basePrice +
        randomChange +
        ((foundMarket.change24h / 100) * (100 - i)) / 100;
      history.push({ time, price });
    }

    setPriceHistory(history);
    setLoading(false);
  }, [ticker, router, from]);

  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  const handlePositionClosed = useCallback(async () => {
    await Promise.all([
      refreshUserPositions(),
      refreshWalletBalance(),
      fetchMarketData(),
    ]);
  }, [refreshUserPositions, refreshWalletBalance, fetchMarketData]);

  const handleSubmit = () => {
    if (!authenticated) {
      login();
      return;
    }

    if (!market || !user) return;

    const sizeNum = parseFloat(size) || 0;
    if (sizeNum < market.minOrderSize) {
      toast.error(`Minimum order size is $${market.minOrderSize}`);
      return;
    }

    if (authenticated && showBalanceWarning) {
      toast.error('Insufficient balance for margin + fees');
      return;
    }

    // Open confirmation dialog
    setConfirmDialogOpen(true);
  };

  const handleConfirmOpen = async () => {
    if (!market) return;

    const sizeNum = parseFloat(size) || 0;
    setSubmitting(true);
    setConfirmDialogOpen(false);

    await openPosition({
      ticker: market.ticker,
      side,
      size: sizeNum,
      leverage,
    }).then(async () => {
      toast.success('Position opened!', {
        description: `Opened ${leverage}x ${side} on ${market.ticker} at $${displayPrice.toFixed(2)}`,
      });

      await Promise.all([
        fetchMarketData(),
        refreshUserPositions(),
        refreshWalletBalance(),
      ]);
    }).catch((error: Error) => {
      toast.error(error.message);
    }).finally(() => {
      setSubmitting(false);
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatVolume = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    return `$${(v / 1e3).toFixed(2)}K`;
  };

  const sizeNum = parseFloat(size) || 0;
  const baseMargin = sizeNum > 0 ? sizeNum / leverage : 0;
  const estimatedFee = sizeNum > 0 ? sizeNum * FEE_CONFIG.TRADING_FEE_RATE : 0;
  const totalRequired = sizeNum > 0 ? baseMargin + estimatedFee : 0;
  const hasSufficientBalance = !authenticated || balance >= totalRequired;
  const showBalanceWarning =
    authenticated && sizeNum > 0 && !hasSufficientBalance;
  useEffect(() => {
    if (!livePrice) return;
    setMarket((prev) =>
      prev ? { ...prev, currentPrice: livePrice.price } : prev
    );
    setPriceHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last && Math.abs(last.price - livePrice.price) < 1e-6) {
        return prev;
      }
      const next = [...prev, { time: Date.now(), price: livePrice.price }];
      const maxPoints = 200;
      return next.slice(Math.max(0, next.length - maxPoints));
    });
  }, [livePrice]);

  const liquidationPrice =
    side === 'long'
      ? displayPrice * (1 - 0.9 / leverage)
      : displayPrice * (1 + 0.9 / leverage);

  const positionValue = sizeNum * leverage;
  const liquidationDistance =
    side === 'long'
      ? ((displayPrice - liquidationPrice) / displayPrice) * 100
      : ((liquidationPrice - displayPrice) / displayPrice) * 100;

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4 w-full max-w-md px-4">
            <Skeleton className="h-12 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4 mx-auto" />
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!market) return null;

  const isHighRisk = leverage > 50 || baseMargin > 1000;

  return (
    <PageContainer className="max-w-7xl mx-auto" ref={pageContainerRef}>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => {
            if (from === 'dashboard') {
              router.push('/markets');
            } else {
              router.push('/markets/perps');
            }
          }}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {from === 'dashboard' ? 'Back to Dashboard' : 'Back to Perps'}
        </button>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">${market.ticker}</h1>
            <p className="text-muted-foreground">{market.name}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {formatPrice(displayPrice)}
            </div>
            <div
              className={cn(
                'text-lg font-bold flex items-center gap-2 justify-end',
                market.change24h >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {market.change24h >= 0 ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
              {market.change24h >= 0 ? '+' : ''}
              {formatPrice(market.change24h)} (
              {market.changePercent24h.toFixed(2)}%)
            </div>
          </div>
        </div>

        {/* Market Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">24h High</div>
            <div className="text-lg font-bold">
              {formatPrice(market.high24h)}
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">24h Low</div>
            <div className="text-lg font-bold">
              {formatPrice(market.low24h)}
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-xs text-muted-foreground mb-1">24h Volume</div>
            <div className="text-lg font-bold">
              {formatVolume(market.volume24h)}
            </div>
          </div>
        </div>
      </div>

      {/* User Positions */}
      {userPositions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">Your Positions</h2>
          <PerpPositionsList
            positions={userPositions}
            onPositionClosed={handlePositionClosed}
          />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2">
          <div className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border">
            <h2 className="text-lg font-bold mb-4">Price Chart</h2>
            <PerpPriceChart data={priceHistory} currentPrice={displayPrice} ticker={ticker} />
          </div>

          {/* Funding Rate Info */}
          <div className="bg-muted/30 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Funding Rate</span>
                  <span
                    className={cn(
                      'font-bold',
                      market.fundingRate.rate >= 0
                        ? 'text-orange-500'
                        : 'text-blue-500'
                    )}
                  >
                    {(market.fundingRate.rate * 100).toFixed(4)}% / 8h
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {market.fundingRate.rate >= 0
                    ? 'Long positions pay shorts every 8 hours'
                    : 'Short positions pay longs every 8 hours'}
                </p>
              </div>
            </div>
          </div>

          {/* Recent Trades */}
          <div className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border mt-4">
            <h2 className="text-lg font-bold mb-4">Recent Trades</h2>
            <AssetTradesFeed 
              marketType="perp" 
              assetId={ticker} 
              containerRef={pageContainerRef}
            />
          </div>
        </div>

        {/* Trading Panel */}
        <div className="lg:col-span-1">
          <div className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border sticky top-4">
            <h2 className="text-lg font-bold mb-4">Trade</h2>

            {authenticated && (
              <div className="flex items-center justify-between bg-muted/40 rounded-lg p-3 mb-4 text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> Balance
                </span>
                <span className="font-semibold text-foreground">
                  {balanceLoading ? '...' : formatPrice(balance)}
                </span>
              </div>
            )}

            {/* Long/Short Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSide('long')}
                className={cn(
                  'flex-1 py-3 rounded font-bold transition-all flex items-center justify-center gap-2 cursor-pointer',
                  side === 'long'
                    ? 'bg-green-600 text-primary-foreground'
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
                    ? 'bg-red-600 text-primary-foreground'
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
                  <label className="text-sm font-medium text-muted-foreground">
                    Leverage
                  </label>
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
                    background: `linear-gradient(to right, ${side === 'long' ? '#16a34a' : '#dc2626'} 0%, ${side === 'long' ? '#16a34a' : '#dc2626'} ${(leverage / market.maxLeverage) * 100}%, hsl(var(--muted)) ${(leverage / market.maxLeverage) * 100}%, hsl(var(--muted)) 100%)`,
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
              <h3 className="text-sm font-bold mb-3 text-muted-foreground">
                Position Preview
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Margin Required</span>
                  <span className="font-bold">{formatPrice(baseMargin)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Position Value</span>
                  <span className="font-bold">
                    {formatPrice(positionValue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entry Price</span>
                  <span className="font-medium">
                    {formatPrice(displayPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Liquidation Price
                  </span>
                  <span className="font-bold text-red-600">
                    {formatPrice(liquidationPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Distance to Liq</span>
                  <span
                    className={cn(
                      'font-medium',
                      liquidationDistance > 5
                        ? 'text-green-600'
                        : liquidationDistance > 2
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    )}
                  >
                    {liquidationDistance.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Est. Trading Fee (
                    {(FEE_CONFIG.TRADING_FEE_RATE * 100).toFixed(1)}%)
                  </span>
                  <span className="font-bold">{formatPrice(estimatedFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Required</span>
                  <span className="font-bold">
                    {formatPrice(totalRequired)}
                  </span>
                </div>
              </div>
            </div>

            {authenticated && (
              <>
                <div className="text-sm text-muted-foreground mb-2">
                  Required (margin + est. fee):{' '}
                  <span className="font-semibold text-foreground">
                    {formatPrice(totalRequired)}
                  </span>
                  {estimatedFee > 0 && (
                    <span className="ml-1">
                      (fee ≈ {formatPrice(estimatedFee)})
                    </span>
                  )}
                </div>
                {showBalanceWarning && (
                  <div className="text-xs text-red-500 mb-4">
                    Insufficient balance to cover margin and fees for this
                    trade.
                  </div>
                )}
              </>
            )}

            {/* High Risk Warning */}
            {isHighRisk && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/15 rounded-lg mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-bold text-yellow-600 mb-1">
                    High Risk Position
                  </div>
                  <p className="text-muted-foreground">
                    {leverage > 50 && `Leverage above 50x is extremely risky. `}
                    {baseMargin > 1000 &&
                      `This position requires significant margin. `}
                    Small price movements can lead to liquidation.
                  </p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={
                submitting ||
                sizeNum < market.minOrderSize ||
                (authenticated && showBalanceWarning) ||
                balanceLoading
              }
              className={cn(
                'w-full py-4 rounded-lg font-bold text-primary-foreground text-lg transition-all cursor-pointer',
                side === 'long'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700',
                (submitting ||
                  sizeNum < market.minOrderSize ||
                  (authenticated && showBalanceWarning) ||
                  balanceLoading) &&
                  'opacity-50 cursor-not-allowed'
              )}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

      {/* Confirmation Dialog */}
      <TradeConfirmationDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handleConfirmOpen}
        isSubmitting={submitting}
        tradeDetails={
          market
            ? ({
                type: 'open-perp',
                ticker: market.ticker,
                side,
                size: sizeNum,
                leverage,
                entryPrice: displayPrice,
                margin: baseMargin,
                estimatedFee,
                liquidationPrice,
                liquidationDistance,
              } as OpenPerpDetails)
            : null
        }
      />
    </PageContainer>
  );
}
