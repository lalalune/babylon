'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Clock, TrendingDown, TrendingUp, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/shared/Skeleton';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;
const POLL_INTERVAL = 10000; // 10 seconds
const SCROLL_THRESHOLD = 100; // pixels from top to consider "at top"

interface BaseTradeUser {
  id: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  isActor: boolean;
}

interface PositionTrade {
  id: string;
  type: 'position';
  user: BaseTradeUser;
  side: string;
  shares: number;
  avgPrice: number;
  amount: number;
  timestamp: string;
  marketId: string;
}

interface PerpTrade {
  id: string;
  type: 'perp';
  user: BaseTradeUser;
  side: string;
  size: number;
  leverage: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  liquidationPrice: number;
  timestamp: string;
  closedAt: string | null;
  ticker: string;
}

interface NPCTrade {
  id: string;
  type: 'npc';
  user: BaseTradeUser | null;
  marketType: string;
  ticker: string;
  action: string;
  side: string | null;
  amount: number;
  price: number;
  sentiment: number | null;
  reason: string | null;
  timestamp: string;
}

interface BalanceTrade {
  id: string;
  type: 'balance';
  user: BaseTradeUser | null;
  transactionType: string;
  amount: number;
  side?: string | null;
  shares?: number | null;
  price?: number | null;
  size?: number | null;
  leverage?: number | null;
  ticker?: string;
  marketId?: string;
  timestamp: string;
}

type Trade = PositionTrade | PerpTrade | NPCTrade | BalanceTrade;

interface AssetTradesFeedProps {
  marketType: 'prediction' | 'perp';
  assetId: string; // marketId for predictions, ticker for perps
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export function AssetTradesFeed({ 
  marketType, 
  assetId, 
  containerRef 
}: AssetTradesFeedProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);
  const [shouldPoll, setShouldPoll] = useState(true);
  
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Build API endpoint based on market type
  const apiEndpoint = useMemo(() => {
    if (marketType === 'prediction') {
      return `/api/markets/predictions/${assetId}/trades`;
    }
    return `/api/markets/perps/${assetId}/trades`;
  }, [marketType, assetId]);

  // Fetch trades from API
  const fetchTrades = useCallback(async (requestOffset: number, append = false) => {
    const params = new URLSearchParams({
      limit: PAGE_SIZE.toString(),
      offset: requestOffset.toString(),
    });

    const response = await fetch(`${apiEndpoint}?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch trades');
    
    const data = await response.json();
    const newTrades = data.trades || [];

    if (append) {
      setTrades(prev => {
        // Deduplicate trades by ID
        const existingIds = new Set(prev.map(t => t.id));
        const uniqueNewTrades = newTrades.filter((t: Trade) => !existingIds.has(t.id));
        return [...prev, ...uniqueNewTrades];
      });
      setLoadingMore(false);
    } else {
      setTrades(newTrades);
      setLoading(false);
    }

    setHasMore(data.hasMore || false);
    setOffset(requestOffset + newTrades.length);
  }, [apiEndpoint]);

  // Refresh trades (used by polling)
  const refreshTrades = useCallback(async () => {
    // Silent refresh - don't show loading state
    const params = new URLSearchParams({
      limit: PAGE_SIZE.toString(),
      offset: '0',
    });

    const response = await fetch(`${apiEndpoint}?${params.toString()}`);
    if (!response.ok) return;
    
    const data = await response.json();
    const newTrades = data.trades || [];

    // Only update if we have new trades
    if (newTrades.length > 0) {
      setTrades(newTrades);
      setHasMore(data.hasMore || false);
      setOffset(newTrades.length);
    }
  }, [apiEndpoint]);

  // Initial load
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    setTrades([]);
    setLoading(true);
    fetchTrades(0, false);
  }, [fetchTrades]);

  // Handle scroll to detect if user is at top
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const isNearTop = scrollTop <= SCROLL_THRESHOLD;
      
      setIsAtTop(isNearTop);
      setShouldPoll(isNearTop);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef]);

  // Polling: refresh when at top
  useEffect(() => {
    if (!shouldPoll || !isAtTop) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Only poll if page is visible
    const pollIfVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshTrades();
      }
    };

    pollingIntervalRef.current = setInterval(pollIfVisible, POLL_INTERVAL);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [shouldPoll, isAtTop, refreshTrades]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setLoadingMore(true);
          fetchTrades(offset, true);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [offset, hasMore, loadingMore, fetchTrades]);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No trades yet for this market</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {trades.map((trade) => (
        <TradeCard key={trade.id} trade={trade} formatCurrency={formatCurrency} formatTime={formatTime} />
      ))}

      {/* Load More Trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="py-4">
          {loadingMore && (
            <div className="text-center">
              <div className="inline-block w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {!hasMore && trades.length > 0 && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          No more trades to load
        </div>
      )}
    </div>
  );
}

interface TradeCardProps {
  trade: Trade;
  formatCurrency: (value: string | number) => string;
  formatTime: (timestamp: string) => string;
}

function TradeCard({ trade, formatCurrency, formatTime }: TradeCardProps) {
  const user = trade.user;
  const profileUrl = user?.isActor ? `/profile/${user.id}` : user?.username ? `/profile/${user.username}` : '#';

  return (
    <div className="bg-muted/30 rounded-lg p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3">
        {/* User Avatar */}
        <Link href={user ? profileUrl : '#'} className="flex-shrink-0">
          {user?.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt={user.displayName || user.username || 'User'}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-primary" />
            </div>
          )}
        </Link>

        {/* Trade Details */}
        <div className="flex-1 min-w-0">
          {/* User Name and Time */}
          <div className="flex items-center gap-2 mb-1">
            <Link 
              href={user ? profileUrl : '#'} 
              className="font-medium text-sm hover:underline truncate"
            >
              {user?.displayName || user?.username || 'Unknown'}
            </Link>
            {user?.isActor && (
              <span className="text-xs bg-purple-600/20 text-purple-600 px-2 py-0.5 rounded">
                NPC
              </span>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(trade.timestamp)}
            </span>
          </div>

          {/* Trade-specific Content */}
          {trade.type === 'position' && <PositionTradeContent trade={trade} formatCurrency={formatCurrency} />}
          {trade.type === 'perp' && <PerpTradeContent trade={trade} formatCurrency={formatCurrency} />}
          {trade.type === 'npc' && <NPCTradeContent trade={trade} formatCurrency={formatCurrency} />}
          {trade.type === 'balance' && <BalanceTradeContent trade={trade} formatCurrency={formatCurrency} />}
        </div>
      </div>
    </div>
  );
}

function PositionTradeContent({ trade, formatCurrency }: { trade: PositionTrade; formatCurrency: (v: number) => string }) {
  const isYes = trade.side === 'YES';
  
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className={cn(
          'px-2 py-0.5 rounded font-medium text-xs',
          isYes ? 'bg-green-600/20 text-green-600' : 'bg-red-600/20 text-red-600'
        )}>
          {trade.side}
        </span>
        <span className="font-medium">{trade.shares.toFixed(2)} shares</span>
        <span className="text-muted-foreground">@</span>
        <span className="font-medium">{formatCurrency(trade.avgPrice)}</span>
      </div>
      <div className="text-muted-foreground">
        Total: {formatCurrency(trade.amount)}
      </div>
    </div>
  );
}

function PerpTradeContent({ trade, formatCurrency }: { trade: PerpTrade; formatCurrency: (v: number) => string }) {
  const isLong = trade.side === 'long';
  const isProfitable = trade.unrealizedPnL >= 0;
  
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className={cn(
          'px-2 py-0.5 rounded font-medium text-xs flex items-center gap-1',
          isLong ? 'bg-green-600/20 text-green-600' : 'bg-red-600/20 text-red-600'
        )}>
          {isLong ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trade.side.toUpperCase()}
        </span>
        <span className="font-medium">{trade.leverage}x</span>
        <span className="text-muted-foreground">•</span>
        <span className="font-medium">{formatCurrency(trade.size)}</span>
        <span className="text-muted-foreground">@</span>
        <span className="font-medium">{formatCurrency(trade.entryPrice)}</span>
      </div>
      {!trade.closedAt && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">P&L:</span>
          <span className={cn(
            'font-medium',
            isProfitable ? 'text-green-600' : 'text-red-600'
          )}>
            {isProfitable ? '+' : ''}{formatCurrency(trade.unrealizedPnL)}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">Liq: {formatCurrency(trade.liquidationPrice)}</span>
        </div>
      )}
      {trade.closedAt && (
        <div className="text-xs text-muted-foreground">
          Position closed
        </div>
      )}
    </div>
  );
}

function NPCTradeContent({ trade, formatCurrency }: { trade: NPCTrade; formatCurrency: (v: number) => string }) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium">{trade.action}</span>
        <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
        <span className="font-medium">{formatCurrency(trade.amount)}</span>
        <span className="text-muted-foreground">@</span>
        <span className="font-medium">{formatCurrency(trade.price)}</span>
      </div>
      {trade.reason && (
        <div className="text-muted-foreground italic text-xs mt-1 line-clamp-2">
          {trade.reason}
        </div>
      )}
      {trade.sentiment !== null && (
        <div className="flex items-center gap-1 mt-1 text-xs">
          <span className="text-muted-foreground">Sentiment:</span>
          <span className={cn(
            'font-medium',
            trade.sentiment > 0 ? 'text-green-600' : trade.sentiment < 0 ? 'text-red-600' : 'text-muted-foreground'
          )}>
            {trade.sentiment > 0 ? '🟢' : trade.sentiment < 0 ? '🔴' : '⚪'} {(trade.sentiment * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}

function BalanceTradeContent({ trade, formatCurrency }: { trade: BalanceTrade; formatCurrency: (v: number) => string }) {
  const getActionLabel = (type: string) => {
    switch (type) {
      case 'pred_buy': return 'Bought prediction shares';
      case 'pred_sell': return 'Sold prediction shares';
      case 'perp_open': return 'Opened perp position';
      case 'perp_close': return 'Closed perp position';
      case 'perp_liquidation': return 'Liquidated';
      default: return type;
    }
  };

  return (
    <div className="text-sm">
      <div className="mb-1">
        <span className="font-medium">{getActionLabel(trade.transactionType)}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Amount: {formatCurrency(trade.amount)}</span>
        {trade.side && (
          <>
            <span>•</span>
            <span className={cn(
              'font-medium',
              trade.side === 'YES' || trade.side === 'long' ? 'text-green-600' : 'text-red-600'
            )}>
              {trade.side}
            </span>
          </>
        )}
        {trade.shares && (
          <>
            <span>•</span>
            <span>{trade.shares} shares</span>
          </>
        )}
        {trade.leverage && (
          <>
            <span>•</span>
            <span>{trade.leverage}x leverage</span>
          </>
        )}
      </div>
    </div>
  );
}

