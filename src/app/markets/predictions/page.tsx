'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  ArrowLeft,
  ArrowUpDown,
  Clock,
  Flame,
  Search,
} from 'lucide-react';

import { CategoryPnLCard } from '@/components/markets/CategoryPnLCard';
import { CategoryPnLShareModal } from '@/components/markets/CategoryPnLShareModal';
import { PredictionPositionsList } from '@/components/markets/PredictionPositionsList';
import { PageContainer } from '@/components/shared/PageContainer';
import { Skeleton } from '@/components/shared/Skeleton';
import { PredictionSparkline } from '@/components/markets/PredictionSparkline';

import { cn } from '@/lib/utils';

import { useAuth } from '@/hooks/useAuth';
import { usePortfolioPnL } from '@/hooks/usePortfolioPnL';
import { useUserPositions } from '@/hooks/useUserPositions';
import { usePredictionMarketsSubscription } from '@/hooks/usePredictionMarketStream';

interface PredictionUserPosition {
  id: string;
  marketId: string;
  question?: string;
  side: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  costBasis: number;
  unrealizedPnL: number;
  resolved?: boolean;
  resolution?: boolean | null;
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
  userPosition?: PredictionUserPosition | null;
  userPositions?: PredictionUserPosition[];
  oracleCommitTxHash?: string | null;
  oracleRevealTxHash?: string | null;
  oraclePublishedAt?: string | null;
}

type PredictionSort = 'trending' | 'newest' | 'ending-soon' | 'volume';

export default function PredictionsPage() {
  const router = useRouter();
  const { user, authenticated, login } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [predictionSort, setPredictionSort] =
    useState<PredictionSort>('trending');
  const [showCategoryPnLShareModal, setShowCategoryPnLShareModal] =
    useState(false);

  // Data
  const [predictions, setPredictions] = useState<PredictionMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [sparklineData, setSparklineData] = useState<Record<string, Array<{ time: number; yesPrice: number; noPrice: number }>>>({});

  const {
    data: _portfolioPnL,
    loading: portfolioLoading,
    error: portfolioError,
    refresh: refreshPortfolio,
    lastUpdated: portfolioUpdatedAt,
  } = usePortfolioPnL();

  const {
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

    try {
      const predictionsRes = await fetch(
        `/api/markets/predictions${isAuth && userId ? `?userId=${userId}` : ''}`
      );

      if (!predictionsRes.ok) {
        throw new Error('Failed to fetch predictions');
      }

      const predictionsData = await predictionsRes.json();

      const fetchedAt = Date.now();
      const fetchedPredictions: PredictionMarket[] = (predictionsData.questions || []).map(
        (prediction: PredictionMarket) => {
          if (
            prediction.resolutionDate &&
            new Date(prediction.resolutionDate).getTime() < fetchedAt
          ) {
            return {
              ...prediction,
              status: 'resolved',
            };
          }
          return prediction;
        }
      );
      setPredictions(fetchedPredictions);

      setSparklineData((prev) => {
        const next = { ...prev };
        fetchedPredictions.forEach((prediction) => {
          const id = prediction.id.toString();
          const totalShares = (prediction.yesShares || 0) + (prediction.noShares || 0);
          const yesProbability =
            totalShares > 0 ? (prediction.yesShares || 0) / totalShares : 0.5;
          const noProbability = 1 - yesProbability;
          if (!next[id] || next[id].length === 0) {
            next[id] = [{ time: fetchedAt, yesPrice: yesProbability, noPrice: noProbability }];
          }
        });
        return next;
      });

      if (isAuth && userId && refreshPositionsRef.current) {
        await refreshPositionsRef.current();
      }
    } catch (err) {
      console.error('Failed to fetch predictions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Store fetchData in ref
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // Initial fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const appendSparklinePoint = useCallback((marketId: string, yesPrice: number, noPrice: number) => {
    setSparklineData((prev) => {
      const existing = prev[marketId] ?? [];
      const nextPoints = [...existing, { time: Date.now(), yesPrice, noPrice }];
      while (nextPoints.length > 20) {
        nextPoints.shift();
      }
      return {
        ...prev,
        [marketId]: nextPoints,
      };
    });
  }, []);

  usePredictionMarketsSubscription({
    onTrade: (event) => {
      setPredictions((prev) =>
        prev.map((market) => {
          if (market.id.toString() !== event.marketId) return market;
          return {
            ...market,
            yesShares: event.yesShares,
            noShares: event.noShares,
            status: 'active',
            resolvedOutcome: undefined,
          };
        })
      );
      const totalShares = event.yesShares + event.noShares;
      const yesProbability =
        totalShares > 0 ? event.yesPrice : 0.5;
      appendSparklinePoint(event.marketId, yesProbability, 1 - yesProbability);
    },
    onResolution: (event) => {
      setPredictions((prev) =>
        prev.map((market) => {
          if (market.id.toString() !== event.marketId) return market;
          return {
            ...market,
            yesShares: event.yesShares,
            noShares: event.noShares,
            status: 'resolved',
            resolvedOutcome: event.winningSide === 'yes',
          };
        })
      );
      appendSparklinePoint(event.marketId, event.yesPrice, event.noPrice);
    },
  });

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

  // Category P&L data
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

  const handlePredictionClick = (prediction: PredictionMarket) => {
    router.push(`/markets/predictions/${prediction.id}?from=list`);
  };


  const getTimeUntilResolution = (date?: string) => {
    if (!date) return { display: 'Soon', exact: null };
    const now = Date.now();
    const resolutionTime = new Date(date).getTime();
    const diff = resolutionTime - now;
    
    if (diff < 0) return { display: 'Ended', exact: null };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    let display = '';
    if (days > 0) {
      display = hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    } else if (hours > 0) {
      display = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else {
      display = `${minutes}m`;
    }
    
    const exact = new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    
    return { display, exact };
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
          <h1 className="text-3xl font-bold">Prediction Markets</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search questions"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-muted focus:ring-2 focus:ring-[#0066FF]/30"
          />
        </div>

        {/* Category P&L Card */}
        {authenticated && predictionPnLData && (
          <CategoryPnLCard
            category="predictions"
            data={predictionPnLData}
            loading={portfolioLoading}
            error={portfolioError}
            onShare={() => setShowCategoryPnLShareModal(true)}
            onRefresh={refreshPortfolio}
            lastUpdated={portfolioUpdatedAt}
          />
        )}

        {/* Show positions section if authenticated and has positions */}
        {authenticated && predictionPositions.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-muted-foreground">
              YOUR POSITIONS ({predictionPositions.length})
            </h2>
            <PredictionPositionsList
              positions={predictionPositions}
              onPositionSold={handlePositionsRefresh}
            />
          </>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-bold text-muted-foreground">
            ACTIVE MARKETS ({activePredictions.length})
          </h2>

          {/* Sorting Controls */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setPredictionSort('trending')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap',
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
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap',
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
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap',
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
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap',
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

        <div className="space-y-2">
          {activePredictions.map((prediction, idx) => {
            const timeInfo = getTimeUntilResolution(prediction.resolutionDate);
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
                  {/* Oracle Status Indicators */}
                  {prediction.oracleCommitTxHash && (
                    <span className="ml-2 text-xs text-green-600" title="Committed to oracle">
                      ✓ Committed
                    </span>
                  )}
                  {prediction.oracleRevealTxHash && (
                    <span className="ml-2 text-xs text-purple-600" title="Revealed on-chain">
                      ✓ Revealed
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-3 text-xs items-center justify-between">
                    <div className="flex gap-3 text-muted-foreground">
                      <div 
                        className="flex items-center gap-1"
                        title={timeInfo.exact || undefined}
                      >
                        <Clock className="w-3 h-3" />
                        {timeInfo.display}
                      </div>
                      <div className="flex items-center gap-1">
                        <ArrowUpDown className="w-3 h-3" />
              {totalShares > 0 ? totalShares.toFixed(0) : '0'}
            </div>
          </div>
                    <div className="flex gap-2 items-center">
                      <PredictionSparkline
                        data={sparklineData[prediction.id.toString()] ?? []}
                        width={80}
                        height={28}
                      />
                      <div className="flex flex-col text-right">
                        <span className="text-green-600 font-medium">
                          {yesPrice}% YES
                        </span>
                        <span className="text-red-600 font-medium text-xs text-muted-foreground">
                          {noPrice}% NO
                        </span>
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
                        {prediction.userPosition.unrealizedPnL >= 0 ? '+' : ''}
                        ${prediction.userPosition.unrealizedPnL.toFixed(2)}
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
            <h2 className="text-sm font-bold text-muted-foreground mt-6">
              RESOLVED ({resolvedPredictions.length})
            </h2>
            <div className="space-y-2">
              {resolvedPredictions.map((prediction, idx) => (
                <div
                  key={`resolved-${prediction.id}-${idx}`}
                  className="p-3 rounded bg-muted/20 opacity-60"
                >
                  <div className="font-medium mb-2">{prediction.text}</div>
                  <div className="flex gap-2 text-xs">
                    <span className="text-muted-foreground">Resolved:</span>
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

        {/* CTA for non-authenticated users */}
        {!authenticated && (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-gradient-to-br from-[#0066FF]/10 to-purple-500/10 rounded-lg border border-[#0066FF]/20">
            <h3 className="text-2xl font-bold mb-2">Start Trading Today</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              Log in to trade prediction markets
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
          category="predictions"
          data={predictionPnLData}
          user={user ?? null}
          lastUpdated={portfolioUpdatedAt}
        />
      )}
    </PageContainer>
  );
}
