import { useCallback, useEffect, useRef, useState } from 'react';

import { usePredictionMarketStream } from '@/hooks/usePredictionMarketStream';
import { logger } from '@/lib/logger';

export interface PredictionHistoryPoint {
  time: number;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
}

interface SeedSnapshot {
  yesShares?: number;
  noShares?: number;
  liquidity?: number;
}

interface UsePredictionHistoryOptions {
  limit?: number;
  seed?: SeedSnapshot;
}

export function usePredictionHistory(
  marketId: string | null,
  options?: UsePredictionHistoryOptions
) {
  const limit = options?.limit ?? 200;
  const seedRef = useRef<SeedSnapshot | undefined>(options?.seed);
  const [history, setHistory] = useState<PredictionHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    seedRef.current = options?.seed;
  }, [options?.seed?.yesShares, options?.seed?.noShares, options?.seed?.liquidity]);

  const formatHistory = useCallback(
    (points: Array<{
      yesPrice: number;
      noPrice: number;
      liquidity?: number;
      timestamp: string;
    }>): PredictionHistoryPoint[] => {
      let prevLiquidity: number | null = null;
      return points.map((point) => {
        const liquidity = Number(point.liquidity ?? prevLiquidity ?? 0);
        const volume =
          prevLiquidity === null ? 0 : Math.max(0, Math.abs(liquidity - prevLiquidity));
        prevLiquidity = liquidity;
        return {
          time: new Date(point.timestamp).getTime(),
          yesPrice: point.yesPrice,
          noPrice: point.noPrice,
          volume,
          liquidity,
        };
      });
    },
    []
  );

  const fallbackFromSeed = useCallback(() => {
    const seed = seedRef.current;
    if (!seed) return [];
    const yesShares = seed.yesShares ?? 0;
    const noShares = seed.noShares ?? 0;
    const totalShares = yesShares + noShares;
    const yesPrice = totalShares === 0 ? 0.5 : yesShares / totalShares;
    return [
      {
        time: Date.now(),
        yesPrice,
        noPrice: 1 - yesPrice,
        volume: 0,
        liquidity: seed.liquidity ?? 0,
      },
    ];
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!marketId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/markets/predictions/${marketId}/history?limit=${limit}`
      );
      let data;
      try {
        data = await response.json();
      } catch (error) {
        logger.error('Failed to parse prediction history response', { error, marketId }, 'usePredictionHistory');
        setError('Failed to parse response');
        setHistory(fallbackFromSeed());
        setLoading(false);
        return;
      }

      if (response.ok && Array.isArray(data.history) && data.history.length > 0) {
        setHistory(formatHistory(data.history));
      } else {
        setHistory(fallbackFromSeed());
      }
    } catch (err) {
      logger.error('Failed to fetch prediction price history', { error: err, marketId }, 'usePredictionHistory');
      setError('Failed to fetch history');
      setHistory(fallbackFromSeed());
    } finally {
      setLoading(false);
    }
  }, [marketId, limit, formatHistory, fallbackFromSeed]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const appendPoint = useCallback(
    (yesPrice: number, noPrice: number, liquidity: number | undefined, timestamp: number) => {
      setHistory((prev) => {
        const lastPoint = prev.length > 0 ? prev[prev.length - 1] : null;
        const normalizedLiquidity = Number.isFinite(liquidity) ? Number(liquidity) : lastPoint?.liquidity ?? 0;
        const lastLiquidity = lastPoint?.liquidity ?? normalizedLiquidity;
        const volume = Math.max(0, Math.abs(normalizedLiquidity - lastLiquidity));
        const point: PredictionHistoryPoint = {
          time: timestamp,
          yesPrice,
          noPrice,
          volume,
          liquidity: normalizedLiquidity,
        };
        const next = [...prev, point];
        if (next.length > limit) {
          next.shift();
        }
        return next;
      });
    },
    [limit]
  );

  usePredictionMarketStream(marketId, {
    onTrade: (event) => {
      const timestamp = new Date(
        event.trade.timestamp ?? new Date().toISOString()
      ).getTime();
      appendPoint(event.yesPrice, event.noPrice, event.liquidity, timestamp);
    },
    onResolution: (event) => {
      const timestamp = new Date(event.timestamp).getTime();
      appendPoint(event.yesPrice, event.noPrice, event.liquidity, timestamp);
    },
  });

  return {
    history,
    loading,
    error,
    refresh: fetchHistory,
  };
}
