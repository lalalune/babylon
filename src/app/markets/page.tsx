'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  ArrowUpDown,
  Clock,
  Flame,
  Search,
  TrendingDown,
  TrendingUp
} from 'lucide-react';

import { CategoryPnLCard } from '@/components/markets/CategoryPnLCard';
import { CategoryPnLShareModal } from '@/components/markets/CategoryPnLShareModal';
import { MarketsWidgetSidebar } from '@/components/markets/MarketsWidgetSidebar';
import { PerpPositionsList } from '@/components/markets/PerpPositionsList';
import { PortfolioPnLCard } from '@/components/markets/PortfolioPnLCard';
import { PortfolioPnLShareModal } from '@/components/markets/PortfolioPnLShareModal';
import { PredictionPositionsList } from '@/components/markets/PredictionPositionsList';
import { BuyPointsModal } from '@/components/points/BuyPointsModal';
import { PageContainer } from '@/components/shared/PageContainer';
import { Skeleton, WidgetPanelSkeleton } from '@/components/shared/Skeleton';

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

interface PredictionMarket {
  id: number | string;
  text: string;
  status: 'active' | 'resolved' | 'cancelled';
  createdDate?: string;
  resolutionDate?: string;
  resolvedOutcome?: boolean;
  scenario: number;
  yesShares?: number;
  noShares?: number;
  userPosition?: {
    id: string;
    side: 'YES' | 'NO';
    shares: number;
    avgPrice: number;
    currentPrice: number;
    currentValue: number;
    costBasis: number;
    unrealizedPnL: number;
  } | null;
}

type MarketTab = 'dashboard' | 'futures' | 'predictions';

type PredictionSort = 'trending' | 'newest' | 'ending-soon' | 'volume';

export default function MarketsPage() {
  const router = useRouter();
  const { user, authenticated, login } = useAuth();
  const [activeTab, setActiveTab] = useState<MarketTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [predictionSort, setPredictionSort] =
    useState<PredictionSort>('trending');
  const [showBuyPointsModal, setShowBuyPointsModal] = useState(false);
  const [showPnLShareModal, setShowPnLShareModal] = useState(false);
  const [showCategoryPnLShareModal, setShowCategoryPnLShareModal] = useState<
    'perps' | 'predictions' | null
  >(null);

  // Data
  const [perpMarkets, setPerpMarkets] = useState<PerpMarket[]>([]);
  const [predictions, setPredictions] = useState<PredictionMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceRefreshTrigger, setBalanceRefreshTrigger] = useState(0);

  const {
    data: portfolioPnL,
    loading: portfolioLoading,
    error: portfolioError,
    refresh: refreshPortfolio,
    lastUpdated: portfolioUpdatedAt,
  } = usePortfolioPnL();

  const {
    perpPositions,
    predictionPositions,
    refresh: refreshUserPositions,
  } = useUserPositions(user?.id, { enabled: authenticated });

  // Use refs to store latest values to break dependency chains
  const fetchDataRef = useRef<(() => Promise<void>) | null>(null);
  const refreshPositionsRef = useRef<(() => Promise<void>) | null>(
    refreshUserPositions
  );
  const authenticatedRef = useRef(authenticated);
  const userIdRef = useRef<string | null>(user?.id || null);
  const prevAuthRef = useRef<{
    authenticated: boolean;
    userId: string | null | undefined;
  } | null>(null);
  const hasMountedRef = useRef(false);

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

  // Fetch data - use refs inside to avoid dependencies on authenticated/user
  const fetchData = useCallback(async () => {
    const isAuth = authenticatedRef.current;
    const userId = userIdRef.current;

    const [perpsRes, predictionsRes] = await Promise.all([
      fetch('/api/markets/perps'),
      fetch(
        `/api/markets/predictions${isAuth && userId ? `?userId=${userId}` : ''}`
      ),
    ]);

    const perpsData = await perpsRes.json();
    const predictionsData = await predictionsRes.json();

    setPerpMarkets(perpsData.markets || []);
    setPredictions(predictionsData.questions || []);

    if (isAuth && userId) {
      if (refreshPositionsRef.current) {
        await refreshPositionsRef.current();
      }
    }

    // Trigger balance refresh after data fetch (after trades)
    setBalanceRefreshTrigger(Date.now());
    setLoading(false);
  }, []); // Empty dependency array - fetchData never changes

  // Store fetchData in ref (fetchData is stable with empty deps)
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    if (!authenticated) return;
    if (!balanceRefreshTrigger) return;
    void refreshPortfolio();
  }, [authenticated, balanceRefreshTrigger, refreshPortfolio]);

  // Initial fetch on mount and when auth state changes
  // Use refs to track auth state changes without causing fetchData to recreate
  useEffect(() => {
    const currentAuth = { authenticated, userId: user?.id };

    // Always fetch on initial mount
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      prevAuthRef.current = currentAuth;
      fetchData();
      return;
    }

    // On subsequent renders, only fetch if auth state actually changed
    const prevAuth = prevAuthRef.current;
    if (
      prevAuth &&
      (prevAuth.authenticated !== currentAuth.authenticated ||
        prevAuth.userId !== currentAuth.userId)
    ) {
      prevAuthRef.current = currentAuth;
      fetchData();
    }
  }, [authenticated, user?.id, fetchData]);

  // Note: Real-time updates via SSE removed - using periodic polling instead

  const filteredPerpMarkets = perpMarkets.filter(
    (m) =>
      !searchQuery.trim() ||
      m.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPredictions = predictions.filter(
    (p) =>
      !searchQuery.trim() ||
      p.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort predictions based on selected option
  const sortedPredictions = useMemo(() => {
    const active = filteredPredictions.filter((p) => p.status === 'active');

    const sorted = [...active].sort((a, b) => {
      switch (predictionSort) {
        case 'trending': {
          // Trending = combination of volume and recency
          const aVolume = (a.yesShares || 0) + (a.noShares || 0);
          const bVolume = (b.yesShares || 0) + (b.noShares || 0);
          const aTime = a.createdDate ? new Date(a.createdDate).getTime() : 0;
          const bTime = b.createdDate ? new Date(b.createdDate).getTime() : 0;
          // Weight: 70% volume, 30% recency
          const aScore = aVolume * 0.7 + (aTime / 1000000) * 0.3;
          const bScore = bVolume * 0.7 + (bTime / 1000000) * 0.3;
          return bScore - aScore;
        }
        case 'newest':
          return (
            (b.createdDate ? new Date(b.createdDate).getTime() : 0) -
            (a.createdDate ? new Date(a.createdDate).getTime() : 0)
          );
        case 'ending-soon':
          return (
            (a.resolutionDate
              ? new Date(a.resolutionDate).getTime()
              : Infinity) -
            (b.resolutionDate ? new Date(b.resolutionDate).getTime() : Infinity)
          );
        case 'volume':
          return (
            (b.yesShares || 0) +
            (b.noShares || 0) -
            ((a.yesShares || 0) + (a.noShares || 0))
          );
        default:
          return 0;
      }
    });

    return sorted;
  }, [filteredPredictions, predictionSort]);

  const activePredictions = sortedPredictions;
  const resolvedPredictions = filteredPredictions.filter(
    (p) => p.status === 'resolved'
  );

  // Calculate trending tokens (mix of % gain and volume) - memoized
  const trendingMarkets = useMemo(() => {
    if (perpMarkets.length === 0) return [];

    const maxVolume = Math.max(...perpMarkets.map((m) => m.volume24h), 1);

    return perpMarkets
      .map((market) => {
        // Trending score: 70% weight on % change, 30% on volume (normalized)
        const volumeScore = (market.volume24h / maxVolume) * 30;
        const changeScore = Math.abs(market.changePercent24h) * 0.7;
        return {
          ...market,
          trendingScore: changeScore + volumeScore,
        };
      })
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 6); // Top 6 trending
  }, [perpMarkets]);

  // Calculate top predictions by volume (total shares)
  const topPredictions = useMemo(() => {
    return predictions
      .filter((p) => p.status === 'active')
      .map((p) => ({
        ...p,
        totalShares: (p.yesShares || 0) + (p.noShares || 0),
      }))
      .sort((a, b) => b.totalShares - a.totalShares)
      .slice(0, 6);
  }, [predictions]);

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

  const predictionPnLData = useMemo(() => {
    if (predictionPositions.length === 0) return null;
    const unrealizedPnL = predictionPositions.reduce((sum, pos) => {
      const currentValue = pos.shares * pos.currentPrice;
      const costBasis = pos.shares * pos.avgPrice;
      return sum + (currentValue - costBasis);
    }, 0);
    const totalShares = predictionPositions.reduce(
      (sum, pos) => sum + pos.shares,
      0
    );
    const totalValue = predictionPositions.reduce(
      (sum, pos) => sum + pos.shares * pos.currentPrice,
      0
    );
    return {
      unrealizedPnL,
      positionCount: predictionPositions.length,
      totalValue,
      categorySpecific: { totalShares },
    };
  }, [predictionPositions]);

  const handleMarketClick = (market: PerpMarket) => {
    // Navigate to dedicated perp page with source tracking
    router.push(`/markets/perps/${market.ticker}?from=dashboard`);
  };

  const handlePredictionClick = (prediction: PredictionMarket) => {
    // Navigate to dedicated prediction page with source tracking
    router.push(`/markets/predictions/${prediction.id}?from=dashboard`);
  };

  const formatPrice = (p: number) => `$${p.toFixed(2)}`;
  const formatVolume = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    return `$${(v / 1e3).toFixed(2)}K`;
  };

  const getDaysLeft = (date?: string) => {
    if (!date) return null;
    const diff = Math.ceil(
      (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, diff);
  };

  if (loading) {
    return (
      <PageContainer noPadding className="flex flex-col">
        <div className="p-4 space-y-6">
          {/* Tabs skeleton */}
          <div className="flex gap-0">
            {['Dashboard', 'Perps', 'Predictions'].map((tab) => (
              <div key={tab} className="flex-1 px-4 py-2.5">
                <Skeleton className="h-5 w-20 mx-auto" />
              </div>
            ))}
          </div>

          {/* Content skeletons */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <WidgetPanelSkeleton />
            <WidgetPanelSkeleton />
          </div>
          <WidgetPanelSkeleton />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer noPadding className="flex flex-col">
      {/* Desktop: Content + Widgets layout */}
      <div className="hidden xl:flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background shadow-sm flex-shrink-0">
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              {/* Tabs */}
              <div
                role="tablist"
                aria-label="Market sections"
                className="flex gap-0 overflow-x-auto scrollbar-hide"
              >
                <button
                  role="tab"
                  aria-selected={activeTab === 'dashboard'}
                  aria-controls="dashboard-panel"
                  onClick={() => setActiveTab('dashboard')}
                  className={cn(
                    'flex-1 px-3 sm:px-4 py-2.5 transition-all whitespace-nowrap text-sm sm:text-base cursor-pointer',
                    activeTab === 'dashboard'
                      ? 'text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Dashboard
                </button>
              <button
                role="tab"
                aria-selected={activeTab === 'futures'}
                aria-controls="futures-panel"
                onClick={() => router.push('/markets/perps')}
                className={cn(
                  'flex-1 px-3 sm:px-4 py-2.5 transition-all whitespace-nowrap text-sm sm:text-base cursor-pointer',
                  activeTab === 'futures'
                    ? 'text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Perps
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'predictions'}
                aria-controls="predictions-panel"
                onClick={() => router.push('/markets/predictions')}
                className={cn(
                  'flex-1 px-3 sm:px-4 py-2.5 transition-all whitespace-nowrap text-sm sm:text-base cursor-pointer',
                  activeTab === 'predictions'
                    ? 'text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Predictions
              </button>
            </div>

            {/* Search - hide on dashboard */}
            {activeTab !== 'dashboard' && (
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label={
                    activeTab === 'futures'
                      ? 'Search tickers'
                      : 'Search questions'
                  }
                  placeholder={
                    activeTab === 'futures'
                      ? 'Search tickers...'
                      : 'Search questions...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-muted focus:ring-2 focus:ring-[#0066FF]/30"
                />
              </div>
            )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'dashboard' ? (
              <div
                id="dashboard-panel"
                role="tabpanel"
                aria-labelledby="dashboard-tab"
                className="p-4 space-y-6"
              >
                {authenticated && (
                  <PortfolioPnLCard
                    data={portfolioPnL}
                    loading={portfolioLoading}
                    error={portfolioError}
                    onShare={() => setShowPnLShareModal(true)}
                    setShowBuyPointsModal={setShowBuyPointsModal}
                  />
                )}

                {/* Positions Overview - Only show if authenticated and has positions */}
                {authenticated &&
                  (perpPositions.length > 0 ||
                    predictionPositions.length > 0) && (
                    <div className="bg-gradient-to-br from-[#0066FF]/10 to-purple-500/10 rounded-lg p-4 border border-[#0066FF]/20">
                      <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                        <div className="w-1 h-5 bg-[#0066FF] rounded-full" />
                        Your Positions
                      </h2>

                      {/* Perp Positions */}
                      {perpPositions.length > 0 && (
                        <div className="mb-4">
                          <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                            PERPETUAL FUTURES ({perpPositions.length})
                          </h3>
                          <PerpPositionsList
                            positions={perpPositions}
                            onPositionClosed={handlePositionsRefresh}
                          />
                        </div>
                      )}

                      {/* Prediction Positions */}
                      {predictionPositions.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                            PREDICTIONS ({predictionPositions.length})
                          </h3>
                          <PredictionPositionsList
                            positions={predictionPositions}
                            onPositionSold={handlePositionsRefresh}
                          />
                        </div>
                      )}
                    </div>
                  )}

                {/* Market Sections Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Trending Perps */}
                  <div className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border">
                    <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      Trending Perpetuals
                    </h2>
                    {trendingMarkets.length > 0 ? (
                      <div className="space-y-2">
                        {trendingMarkets.map((market, idx) => (
                          <button
                            key={`trending-${market.ticker}-${idx}`}
                            onClick={() => handleMarketClick(market)}
                            className="w-full p-3 rounded-lg text-left bg-muted/30 hover:bg-muted transition-all cursor-pointer border border-transparent hover:border-[#0066FF]/30"
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <div className="font-bold text-sm">
                                  ${market.ticker}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {market.name}
                                </div>
                              </div>
                              <div className="text-right ml-3">
                                <div className="font-bold text-sm">
                                  {formatPrice(market.currentPrice)}
                                </div>
                                <div
                                  className={cn(
                                    'text-xs font-bold flex items-center gap-1 justify-end',
                                    market.change24h >= 0
                                      ? 'text-green-600'
                                      : 'text-red-600'
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
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 rounded-lg bg-muted/30 text-center">
                        <p className="text-sm text-muted-foreground">
                          No markets available yet.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Top Predictions */}
                  <div className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border">
                    <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                      Hot Predictions
                    </h2>
                    {topPredictions.length > 0 ? (
                      <div className="space-y-2">
                        {topPredictions.map((prediction, idx) => {
                          const totalShares =
                            (prediction.yesShares || 0) +
                            (prediction.noShares || 0);
                          const yesPercent =
                            totalShares > 0
                              ? ((prediction.yesShares || 0) / totalShares) *
                                100
                              : 50;
                          const daysLeft = getDaysLeft(
                            prediction.resolutionDate
                          );

                          return (
                            <button
                              key={`hot-pred-${prediction.id}-${idx}`}
                              onClick={() => handlePredictionClick(prediction)}
                              className="w-full p-3 rounded-lg text-left bg-muted/30 hover:bg-muted transition-all cursor-pointer border border-transparent hover:border-purple-500/30"
                            >
                              <div className="font-medium text-sm mb-2 line-clamp-2">
                                {prediction.text}
                              </div>
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-600 font-bold">
                                    {yesPercent.toFixed(0)}% YES
                                  </span>
                                  <span className="text-muted-foreground">
                                    •
                                  </span>
                                  <span className="text-red-600 font-bold">
                                    {(100 - yesPercent).toFixed(0)}% NO
                                  </span>
                                </div>
                                {daysLeft !== null && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    {daysLeft}d
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-6 rounded-lg bg-muted/30 text-center">
                        <p className="text-sm text-muted-foreground">
                          No active predictions yet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA for non-authenticated users */}
                {!authenticated && (
                  <div className="flex flex-col items-center justify-center py-16 px-4 bg-gradient-to-br from-[#0066FF]/10 to-purple-500/10 rounded-lg border border-[#0066FF]/20">
                    <h3 className="text-2xl font-bold mb-2">
                      Start Trading Today
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                      Log in to trade perpetual futures and prediction markets
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
            ) : activeTab === 'futures' ? (
              <div
                id="futures-panel"
                role="tabpanel"
                aria-labelledby="futures-tab"
                className="p-4"
              >
                {/* Category P&L Card */}
                {authenticated && perpPnLData && (
                  <div className="mb-6">
                    <CategoryPnLCard
                      category="perps"
                      data={perpPnLData}
                      loading={portfolioLoading}
                      error={portfolioError}
                      onShare={() => setShowCategoryPnLShareModal('perps')}
                      onRefresh={refreshPortfolio}
                      lastUpdated={portfolioUpdatedAt}
                    />
                  </div>
                )}

                {/* Show positions section if authenticated and has positions */}
                {authenticated && perpPositions.length > 0 && (
                  <>
                    <h2 className="text-sm font-bold text-muted-foreground mb-3">
                      YOUR POSITIONS ({perpPositions.length})
                    </h2>
                    <div className="mb-6">
                      <PerpPositionsList
                        positions={perpPositions}
                        onPositionClosed={handlePositionsRefresh}
                      />
                    </div>
                  </>
                )}

                <h2 className="text-sm font-bold text-muted-foreground mb-3">
                  ALL MARKETS
                </h2>
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
                              market.change24h >= 0
                                ? 'text-green-600'
                                : 'text-red-600'
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
              </div>
            ) : (
              <div
                id="predictions-panel"
                role="tabpanel"
                aria-labelledby="predictions-tab"
                className="p-4"
              >
                {/* Category P&L Card */}
                {authenticated && predictionPnLData && (
                  <div className="mb-6">
                    <CategoryPnLCard
                      category="predictions"
                      data={predictionPnLData}
                      loading={portfolioLoading}
                      error={portfolioError}
                      onShare={() =>
                        setShowCategoryPnLShareModal('predictions')
                      }
                      onRefresh={refreshPortfolio}
                      lastUpdated={portfolioUpdatedAt}
                    />
                  </div>
                )}

                {/* Show positions section if authenticated and has positions */}
                {authenticated && predictionPositions.length > 0 && (
                  <>
                    <h2 className="text-sm font-bold text-muted-foreground mb-3">
                      YOUR POSITIONS ({predictionPositions.length})
                    </h2>
                    <div className="mb-6">
                      <PredictionPositionsList
                        positions={predictionPositions}
                        onPositionSold={handlePositionsRefresh}
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-muted-foreground">
                    ACTIVE MARKETS ({activePredictions.length})
                  </h2>

                  {/* Sorting Controls */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPredictionSort('trending')}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                        predictionSort === 'trending'
                          ? 'bg-[#0066FF] text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Flame className="w-3 h-3 inline mr-1" />
                      Trending
                    </button>
                    <button
                      onClick={() => setPredictionSort('volume')}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                        predictionSort === 'volume'
                          ? 'bg-[#0066FF] text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <ArrowUpDown className="w-3 h-3 inline mr-1" />
                      Volume
                    </button>
                    <button
                      onClick={() => setPredictionSort('newest')}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                        predictionSort === 'newest'
                          ? 'bg-[#0066FF] text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      )}
                    >
                      Newest
                    </button>
                    <button
                      onClick={() => setPredictionSort('ending-soon')}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                        predictionSort === 'ending-soon'
                          ? 'bg-[#0066FF] text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Clock className="w-3 h-3 inline mr-1" />
                      Ending Soon
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  {activePredictions.map((prediction, idx) => {
                    const daysLeft = getDaysLeft(prediction.resolutionDate);
                    const totalShares =
                      (prediction.yesShares || 0) + (prediction.noShares || 0);
                    const yesPrice =
                      totalShares > 0
                        ? (
                            ((prediction.yesShares || 0) / totalShares) *
                            100
                          ).toFixed(1)
                        : '50';
                    const noPrice =
                      totalShares > 0
                        ? (
                            ((prediction.noShares || 0) / totalShares) *
                            100
                          ).toFixed(1)
                        : '50';
                    const hasPosition =
                      prediction.userPosition !== null &&
                      prediction.userPosition !== undefined;

                    return (
                      <button
                        key={`prediction-${prediction.id}-${idx}`}
                        onClick={() => handlePredictionClick(prediction)}
                        className={cn(
                          'w-full p-3 rounded text-left transition-all cursor-pointer',
                          hasPosition
                            ? 'bg-[#0066FF]/5 hover:bg-[#0066FF]/20'
                            : 'bg-muted/30 hover:bg-muted'
                        )}
                      >
                        <div className="font-medium mb-2">
                          {prediction.text}
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-3 text-xs items-center justify-between">
                            <div className="flex gap-3 text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {daysLeft !== null ? `${daysLeft}d` : 'Soon'}
                              </div>
                              <div className="flex items-center gap-1">
                                <ArrowUpDown className="w-3 h-3" />
                                {totalShares > 0 ? totalShares.toFixed(0) : '0'}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <div className="text-green-600 font-medium">
                                {yesPrice}% YES
                              </div>
                              <div className="text-red-600 font-medium">
                                {noPrice}% NO
                              </div>
                            </div>
                          </div>
                          {hasPosition && prediction.userPosition && (
                            <div className="flex items-center gap-2 text-xs">
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded font-medium',
                                  prediction.userPosition.side === 'YES'
                                    ? 'bg-green-600/20 text-green-600'
                                    : 'bg-red-600/20 text-red-600'
                                )}
                              >
                                {prediction.userPosition.side}{' '}
                                {prediction.userPosition.shares.toFixed(2)}
                              </span>
                              <span
                                className={cn(
                                  'font-medium',
                                  prediction.userPosition.unrealizedPnL >= 0
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                )}
                              >
                                {prediction.userPosition.unrealizedPnL >= 0
                                  ? '+'
                                  : ''}
                                $
                                {prediction.userPosition.unrealizedPnL.toFixed(
                                  2
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {resolvedPredictions.length > 0 && (
                  <>
                    <h2 className="text-sm font-bold text-muted-foreground mb-3 mt-6">
                      RESOLVED ({resolvedPredictions.length})
                    </h2>
                    <div className="space-y-2">
                      {filteredPredictions
                        .filter((p) => p.status === 'resolved')
                        .map((prediction, idx) => (
                          <div
                            key={`resolved-${prediction.id}-${idx}`}
                            className="p-3 rounded bg-muted/20 opacity-60"
                          >
                            <div className="font-medium mb-2">
                              {prediction.text}
                            </div>
                            <div className="flex gap-2 text-xs">
                              <span className="text-muted-foreground">
                                Resolved:
                              </span>
                              <span
                                className={
                                  prediction.resolvedOutcome
                                    ? 'text-green-600 font-bold'
                                    : 'text-red-600 font-bold'
                                }
                              >
                                {prediction.resolvedOutcome ? 'YES' : 'NO'}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {!authenticated && activeTab !== 'dashboard' && (
            <div className="shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Log in to trade
              </p>
              <button
                onClick={login}
                className="px-6 py-3 bg-[#0066FF] text-primary-foreground rounded font-medium hover:bg-[#2952d9] transition-colors cursor-pointer"
              >
                Connect Wallet
              </button>
            </div>
          )}
        </div>

        {/* Widget Sidebar */}
        <MarketsWidgetSidebar
          onMarketClick={(market) => {
            // Navigate with dashboard source tracking
            router.push(`/markets/perps/${market.ticker}?from=dashboard`);
          }}
        />
      </div>

      {/* Mobile/Tablet: Full width content */}
      <div className="flex xl:hidden flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background shadow-sm flex-shrink-0">
          <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
            {/* Tabs */}
            <div
              role="tablist"
              aria-label="Market sections"
              className="flex gap-0 overflow-x-auto scrollbar-hide"
            >
              <button
                role="tab"
                aria-selected={activeTab === 'dashboard'}
                aria-controls="dashboard-panel"
                onClick={() => setActiveTab('dashboard')}
                className={cn(
                  'flex-1 px-3 sm:px-4 py-2.5 transition-all whitespace-nowrap text-sm sm:text-base cursor-pointer',
                  activeTab === 'dashboard'
                    ? 'text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Dashboard
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'futures'}
                aria-controls="futures-panel"
                onClick={() => router.push('/markets/perps')}
                className={cn(
                  'flex-1 px-3 sm:px-4 py-2.5 transition-all whitespace-nowrap text-sm sm:text-base cursor-pointer',
                  activeTab === 'futures'
                    ? 'text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Perps
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'predictions'}
                aria-controls="predictions-panel"
                onClick={() => router.push('/markets/predictions')}
                className={cn(
                  'flex-1 px-3 sm:px-4 py-2.5 transition-all whitespace-nowrap text-sm sm:text-base cursor-pointer',
                  activeTab === 'predictions'
                    ? 'text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Predictions
              </button>
            </div>

            {/* Search - hide on dashboard */}
            {activeTab !== 'dashboard' && (
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label={
                    activeTab === 'futures'
                      ? 'Search tickers'
                      : 'Search questions'
                  }
                  placeholder={
                    activeTab === 'futures'
                      ? 'Search tickers...'
                      : 'Search questions...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-muted focus:ring-2 focus:ring-[#0066FF]/30"
                />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' ? (
            <div
              id="dashboard-panel"
              role="tabpanel"
              aria-labelledby="dashboard-tab"
              className="p-4 space-y-6"
            >
              {authenticated && (
                <PortfolioPnLCard
                  data={portfolioPnL}
                  loading={portfolioLoading}
                  error={portfolioError}
                  onShare={() => setShowPnLShareModal(true)}
                  setShowBuyPointsModal={setShowBuyPointsModal}
                />
              )}

              {/* Positions Overview - Only show if authenticated and has positions */}
              {authenticated &&
                (perpPositions.length > 0 ||
                  predictionPositions.length > 0) && (
                  <div className="bg-gradient-to-br from-[#0066FF]/10 to-purple-500/10 rounded-lg p-4 border border-[#0066FF]/20">
                    <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                      <div className="w-1 h-5 bg-[#0066FF] rounded-full" />
                      Your Positions
                    </h2>

                    {/* Perp Positions */}
                    {perpPositions.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                          PERPETUAL FUTURES ({perpPositions.length})
                        </h3>
                        <PerpPositionsList
                          positions={perpPositions}
                          onPositionClosed={handlePositionsRefresh}
                        />
                      </div>
                    )}

                    {/* Prediction Positions */}
                    {predictionPositions.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                          PREDICTIONS ({predictionPositions.length})
                        </h3>
                        <PredictionPositionsList
                          positions={predictionPositions}
                          onPositionSold={handlePositionsRefresh}
                        />
                      </div>
                    )}
                  </div>
                )}

              {/* Trending Perps */}
              <div className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border">
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Trending Perpetuals
                </h2>
                {trendingMarkets.length > 0 ? (
                  <div className="space-y-2">
                    {trendingMarkets.map((market, idx) => (
                      <button
                        key={`trending-mobile-${market.ticker}-${idx}`}
                        onClick={() => handleMarketClick(market)}
                        className="w-full p-3 rounded-lg text-left bg-muted/30 hover:bg-muted transition-all cursor-pointer border border-transparent hover:border-[#0066FF]/30"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="font-bold text-sm">
                              ${market.ticker}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {market.name}
                            </div>
                          </div>
                          <div className="text-right ml-3">
                            <div className="font-bold text-sm">
                              {formatPrice(market.currentPrice)}
                            </div>
                            <div
                              className={cn(
                                'text-xs font-bold flex items-center gap-1 justify-end',
                                market.change24h >= 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
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
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-lg bg-muted/30 text-center">
                    <p className="text-sm text-muted-foreground">
                      No markets available yet.
                    </p>
                  </div>
                )}
              </div>

              {/* Top Predictions */}
              <div className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border">
                <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  Hot Predictions
                </h2>
                {topPredictions.length > 0 ? (
                  <div className="space-y-2">
                    {topPredictions.map((prediction, idx) => {
                      const totalShares =
                        (prediction.yesShares || 0) +
                        (prediction.noShares || 0);
                      const yesPercent =
                        totalShares > 0
                          ? ((prediction.yesShares || 0) / totalShares) * 100
                          : 50;
                      const daysLeft = getDaysLeft(prediction.resolutionDate);

                      return (
                        <button
                          key={`hot-pred-mobile-${prediction.id}-${idx}`}
                          onClick={() => handlePredictionClick(prediction)}
                          className="w-full p-3 rounded-lg text-left bg-muted/30 hover:bg-muted transition-all cursor-pointer border border-transparent hover:border-purple-500/30"
                        >
                          <div className="font-medium text-sm mb-2 line-clamp-2">
                            {prediction.text}
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-green-600 font-bold">
                                {yesPercent.toFixed(0)}% YES
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-red-600 font-bold">
                                {(100 - yesPercent).toFixed(0)}% NO
                              </span>
                            </div>
                            {daysLeft !== null && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {daysLeft}d
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 rounded-lg bg-muted/30 text-center">
                    <p className="text-sm text-muted-foreground">
                      No active predictions yet.
                    </p>
                  </div>
                )}
              </div>

              {/* CTA for non-authenticated users */}
              {!authenticated && (
                <div className="flex flex-col items-center justify-center py-16 px-4 bg-gradient-to-br from-[#0066FF]/10 to-purple-500/10 rounded-lg border border-[#0066FF]/20">
                  <h3 className="text-2xl font-bold mb-2">
                    Start Trading Today
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                    Log in to trade perpetual futures and prediction markets
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
          ) : activeTab === 'futures' ? (
            <div
              id="futures-panel"
              role="tabpanel"
              aria-labelledby="futures-tab"
              className="p-4"
            >
              {/* Category P&L Card */}
              {authenticated && perpPnLData && (
                <div className="mb-6">
                  <CategoryPnLCard
                    category="perps"
                    data={perpPnLData}
                    loading={portfolioLoading}
                    error={portfolioError}
                    onShare={() => setShowCategoryPnLShareModal('perps')}
                    onRefresh={refreshPortfolio}
                    lastUpdated={portfolioUpdatedAt}
                  />
                </div>
              )}

              {/* Show positions section if authenticated and has positions */}
              {authenticated && perpPositions.length > 0 && (
                <>
                  <h2 className="text-sm font-bold text-muted-foreground mb-3">
                    YOUR POSITIONS ({perpPositions.length})
                  </h2>
                  <div className="mb-6">
                    <PerpPositionsList
                      positions={perpPositions}
                      onPositionClosed={handlePositionsRefresh}
                    />
                  </div>
                </>
              )}

              <h2 className="text-sm font-bold text-muted-foreground mb-3">
                ALL MARKETS
              </h2>
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
                            market.change24h >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
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
            </div>
          ) : (
            <div
              id="predictions-panel"
              role="tabpanel"
              aria-labelledby="predictions-tab"
              className="p-4"
            >
              {/* Category P&L Card */}
              {authenticated && predictionPnLData && (
                <div className="mb-6">
                  <CategoryPnLCard
                    category="predictions"
                    data={predictionPnLData}
                    loading={portfolioLoading}
                    error={portfolioError}
                    onShare={() => setShowCategoryPnLShareModal('predictions')}
                    onRefresh={refreshPortfolio}
                    lastUpdated={portfolioUpdatedAt}
                  />
                </div>
              )}

              {/* Show positions section if authenticated and has positions */}
              {authenticated && predictionPositions.length > 0 && (
                <>
                  <h2 className="text-sm font-bold text-muted-foreground mb-3">
                    YOUR POSITIONS ({predictionPositions.length})
                  </h2>
                  <div className="mb-6">
                    <PredictionPositionsList
                      positions={predictionPositions}
                      onPositionSold={handlePositionsRefresh}
                    />
                  </div>
                </>
              )}

              <div className="mb-3">
                <h2 className="text-sm font-bold text-muted-foreground mb-2">
                  ACTIVE MARKETS ({activePredictions.length})
                </h2>

                {/* Sorting Controls - Mobile responsive */}
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                  <button
                    onClick={() => setPredictionSort('trending')}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
                      predictionSort === 'trending'
                        ? 'bg-[#0066FF] text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Flame className="w-3 h-3 inline mr-1" />
                    Trending
                  </button>
                  <button
                    onClick={() => setPredictionSort('volume')}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
                      predictionSort === 'volume'
                        ? 'bg-[#0066FF] text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <ArrowUpDown className="w-3 h-3 inline mr-1" />
                    Volume
                  </button>
                  <button
                    onClick={() => setPredictionSort('newest')}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
                      predictionSort === 'newest'
                        ? 'bg-[#0066FF] text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    Newest
                  </button>
                  <button
                    onClick={() => setPredictionSort('ending-soon')}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
                      predictionSort === 'ending-soon'
                        ? 'bg-[#0066FF] text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Clock className="w-3 h-3 inline mr-1" />
                    Ending Soon
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {activePredictions.map((prediction, idx) => {
                  const daysLeft = getDaysLeft(prediction.resolutionDate);
                  const totalShares =
                    (prediction.yesShares || 0) + (prediction.noShares || 0);
                  const yesPrice =
                    totalShares > 0
                      ? (
                          ((prediction.yesShares || 0) / totalShares) *
                          100
                        ).toFixed(1)
                      : '50';
                  const noPrice =
                    totalShares > 0
                      ? (
                          ((prediction.noShares || 0) / totalShares) *
                          100
                        ).toFixed(1)
                      : '50';
                  const hasPosition =
                    prediction.userPosition !== null &&
                    prediction.userPosition !== undefined;

                  return (
                    <button
                      key={`prediction-${prediction.id}-${idx}`}
                      onClick={() => handlePredictionClick(prediction)}
                      className={cn(
                        'w-full p-3 rounded text-left transition-all cursor-pointer',
                        hasPosition
                          ? 'bg-[#0066FF]/5 hover:bg-[#0066FF]/20'
                          : 'bg-muted/30 hover:bg-muted'
                      )}
                    >
                      <div className="font-medium mb-2">{prediction.text}</div>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-3 text-xs items-center justify-between">
                          <div className="flex gap-3 text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {daysLeft !== null ? `${daysLeft}d` : 'Soon'}
                            </div>
                            <div className="flex items-center gap-1">
                              <ArrowUpDown className="w-3 h-3" />
                              {totalShares > 0 ? totalShares.toFixed(0) : '0'}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <div className="text-green-600 font-medium">
                              {yesPrice}% YES
                            </div>
                            <div className="text-red-600 font-medium">
                              {noPrice}% NO
                            </div>
                          </div>
                        </div>
                        {hasPosition && prediction.userPosition && (
                          <div className="flex items-center gap-2 text-xs">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded font-medium',
                                prediction.userPosition.side === 'YES'
                                  ? 'bg-green-600/20 text-green-600'
                                  : 'bg-red-600/20 text-red-600'
                              )}
                            >
                              {prediction.userPosition.side}{' '}
                              {prediction.userPosition.shares.toFixed(2)}
                            </span>
                            <span
                              className={cn(
                                'font-medium',
                                prediction.userPosition.unrealizedPnL >= 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              )}
                            >
                              {prediction.userPosition.unrealizedPnL >= 0
                                ? '+'
                                : ''}
                              $
                              {prediction.userPosition.unrealizedPnL.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {resolvedPredictions.length > 0 && (
                <>
                  <h2 className="text-sm font-bold text-muted-foreground mb-3 mt-6">
                    RESOLVED ({resolvedPredictions.length})
                  </h2>
                  <div className="space-y-2">
                    {filteredPredictions
                      .filter((p) => p.status === 'resolved')
                      .map((prediction, idx) => (
                        <div
                          key={`resolved-${prediction.id}-${idx}`}
                          className="p-3 rounded bg-muted/20 opacity-60"
                        >
                          <div className="font-medium mb-2">
                            {prediction.text}
                          </div>
                          <div className="flex gap-2 text-xs">
                            <span className="text-muted-foreground">
                              Resolved:
                            </span>
                            <span
                              className={
                                prediction.resolvedOutcome
                                  ? 'text-green-600 font-bold'
                                  : 'text-red-600 font-bold'
                              }
                            >
                              {prediction.resolvedOutcome ? 'YES' : 'NO'}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {!authenticated && activeTab !== 'dashboard' && (
          <div className="shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Log in to trade
            </p>
            <button
              onClick={login}
              className="px-6 py-3 bg-[#0066FF] text-primary-foreground rounded font-medium hover:bg-[#2952d9] transition-colors cursor-pointer"
            >
              Connect Wallet
            </button>
          </div>
        )}
      </div>

      <PortfolioPnLShareModal
        isOpen={showPnLShareModal}
        onClose={() => setShowPnLShareModal(false)}
        data={portfolioPnL}
        user={user ?? null}
        lastUpdated={portfolioUpdatedAt}
      />

      {/* Category P&L Share Modals */}
      {showCategoryPnLShareModal === 'perps' && (
        <CategoryPnLShareModal
          isOpen={true}
          onClose={() => setShowCategoryPnLShareModal(null)}
          category="perps"
          data={perpPnLData}
          user={user ?? null}
          lastUpdated={portfolioUpdatedAt}
        />
      )}

      {showCategoryPnLShareModal === 'predictions' && (
        <CategoryPnLShareModal
          isOpen={true}
          onClose={() => setShowCategoryPnLShareModal(null)}
          category="predictions"
          data={predictionPnLData}
          user={user ?? null}
          lastUpdated={portfolioUpdatedAt}
        />
      )}

      {/* Buy Points Modal */}
      <BuyPointsModal
        isOpen={showBuyPointsModal}
        onClose={() => setShowBuyPointsModal(false)}
        onSuccess={() => {
          setBalanceRefreshTrigger(Date.now());
          fetchData();
        }}
      />
    </PageContainer>
  );
}
