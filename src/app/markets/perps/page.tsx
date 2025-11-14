'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { ArrowLeft, Search, TrendingDown, TrendingUp } from 'lucide-react';

import { CategoryPnLCard } from '@/components/markets/CategoryPnLCard';
import { CategoryPnLShareModal } from '@/components/markets/CategoryPnLShareModal';
import { PerpPositionsList } from '@/components/markets/PerpPositionsList';
import { PageContainer } from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';

import { cn } from '@/lib/utils';

import { useAuth } from '@/hooks/useAuth';
import { usePortfolioPnL } from '@/hooks/usePortfolioPnL';
import { useUserPositions } from '@/hooks/useUserPositions';

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

export default function PerpsPage() {
  const router = useRouter();
  const { user, authenticated, login } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategoryPnLShareModal, setShowCategoryPnLShareModal] =
    useState(false);

  // Data
  const [perpMarkets, setPerpMarkets] = useState<PerpMarket[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    loading: portfolioLoading,
    error: portfolioError,
    refresh: refreshPortfolio,
    lastUpdated: portfolioUpdatedAt,
  } = usePortfolioPnL();

  const {
    perpPositions,
    refresh: refreshUserPositions,
  } = useUserPositions(user?.id, { enabled: authenticated });

  // Use refs to store latest values to break dependency chains
  const fetchDataRef = useRef<(() => Promise<void>) | null>(null);
  const refreshPositionsRef = useRef<(() => Promise<void>) | null>(
    refreshUserPositions
  );
  const authenticatedRef = useRef(authenticated);
  const userIdRef = useRef<string | null>(user?.id || null);

  // Update refs when values change
  useEffect(() => {
    authenticatedRef.current = authenticated;
    userIdRef.current = user?.id || null;
  }, [authenticated, user?.id]);

  useEffect(() => {
    refreshPositionsRef.current = refreshUserPositions;
  }, [refreshUserPositions]);

  const handlePositionsRefresh = useCallback(async () => {
    if (refreshPositionsRef.current) {
      await refreshPositionsRef.current();
    }
    if (fetchDataRef.current) {
      await fetchDataRef.current();
    }
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    const isAuth = authenticatedRef.current;
    const userId = userIdRef.current;

    const perpsRes = await fetch('/api/markets/perps');
    const perpsData = await perpsRes.json();

    setPerpMarkets(perpsData.markets || []);

    if (isAuth && userId) {
      if (refreshPositionsRef.current) {
        await refreshPositionsRef.current();
      }
    }

    setLoading(false);
  }, []);

  // Store fetchData in ref
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // Initial fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPerpMarkets = perpMarkets.filter(
    (m) =>
      !searchQuery.trim() ||
      m.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Category P&L data
  const perpPnLData = useMemo(() => {
    if (perpPositions.length === 0) return null;
    const unrealizedPnL = perpPositions.reduce(
      (sum, pos) => sum + (pos.unrealizedPnL || 0),
      0
    );
    const totalValue = perpPositions.reduce(
      (sum, pos) => sum + Math.abs(pos.size || 0),
      0
    );
    const openInterest = perpPositions.reduce(
      (sum, pos) => sum + Math.abs(pos.size || 0),
      0
    );
    return {
      unrealizedPnL,
      positionCount: perpPositions.length,
      totalValue,
      categorySpecific: { openInterest },
    };
  }, [perpPositions]);

  const handleMarketClick = (market: PerpMarket) => {
    router.push(`/markets/perps/${market.ticker}?from=list`);
  };

  const formatPrice = (p: number) => `$${p.toFixed(2)}`;
  const formatVolume = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    return `$${(v / 1e3).toFixed(2)}K`;
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="p-4 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-12 w-full" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="p-4 space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => router.push('/markets')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Markets
          </button>
          <h1 className="text-3xl font-bold">Perpetual Futures</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search tickers"
            placeholder="Search tickers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-muted focus:ring-2 focus:ring-[#0066FF]/30"
          />
        </div>

        {/* Category P&L Card */}
        {authenticated && perpPnLData && (
          <CategoryPnLCard
            category="perps"
            data={perpPnLData}
            loading={portfolioLoading}
            error={portfolioError}
            onShare={() => setShowCategoryPnLShareModal(true)}
            onRefresh={refreshPortfolio}
            lastUpdated={portfolioUpdatedAt}
          />
        )}

        {/* Show positions section if authenticated and has positions */}
        {authenticated && perpPositions.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-muted-foreground">
              YOUR POSITIONS ({perpPositions.length})
            </h2>
            <PerpPositionsList
              positions={perpPositions}
              onPositionClosed={handlePositionsRefresh}
            />
          </>
        )}

        <h2 className="text-sm font-bold text-muted-foreground">ALL MARKETS</h2>
        <div className="space-y-2">
          {filteredPerpMarkets.map((market, idx) => (
            <button
              key={`market-${market.ticker}-${idx}`}
              onClick={() => handleMarketClick(market)}
              className="w-full p-3 rounded text-left bg-muted/30 hover:bg-muted transition-all cursor-pointer"
            >
              <div className="flex justify-between mb-2">
                <div>
                  <div className="font-bold">${market.ticker}</div>
                  <div className="text-xs text-muted-foreground">
                    {market.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">
                    {formatPrice(market.currentPrice)}
                  </div>
                  <div
                    className={cn(
                      'text-xs font-medium flex items-center gap-1 justify-end',
                      market.change24h >= 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {market.change24h >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {market.change24h >= 0 ? '+' : ''}
                    {market.changePercent24h.toFixed(2)}%
                  </div>
                </div>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <div>Vol: {formatVolume(market.volume24h)}</div>
                <div>OI: {formatVolume(market.openInterest)}</div>
                <div
                  className={
                    market.fundingRate.rate >= 0
                      ? 'text-orange-500'
                      : 'text-blue-500'
                  }
                >
                  Fund: {(market.fundingRate.rate * 100).toFixed(4)}%
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* CTA for non-authenticated users */}
        {!authenticated && (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-gradient-to-br from-[#0066FF]/10 to-purple-500/10 rounded-lg border border-[#0066FF]/20">
            <h3 className="text-2xl font-bold mb-2">Start Trading Today</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              Log in to trade perpetual futures
            </p>
            <button
              onClick={login}
              className="px-8 py-3 bg-[#0066FF] text-primary-foreground rounded-lg font-medium hover:bg-[#2952d9] transition-colors cursor-pointer shadow-lg shadow-[#0066FF]/20"
            >
              Connect Wallet
            </button>
          </div>
        )}
      </div>

      {/* Category P&L Share Modal */}
      {showCategoryPnLShareModal && (
        <CategoryPnLShareModal
          isOpen={true}
          onClose={() => setShowCategoryPnLShareModal(false)}
          category="perps"
          data={perpPnLData}
          user={user ?? null}
          lastUpdated={portfolioUpdatedAt}
        />
      )}
    </PageContainer>
  );
}

