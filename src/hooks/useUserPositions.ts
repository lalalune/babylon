'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { PerpPosition } from '@/shared/perps-types';

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export interface UserPredictionPosition {
  id: string;
  marketId: string;
  question: string;
  side: 'YES' | 'NO';
  shares: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  costBasis: number;
  unrealizedPnL: number;
  resolved: boolean;
  resolution: boolean | null;
}

interface PerpStats {
  totalPositions: number;
  totalPnL: number;
  totalFunding: number;
}

interface PositionsState {
  perpPositions: PerpPosition[];
  predictionPositions: UserPredictionPosition[];
  perpStats: PerpStats;
}

type NumericLike = number | string | null | undefined;

interface ApiPerpPositionPayload {
  id: string;
  userId?: string;
  ticker: string;
  organizationId?: string;
  side: PerpPosition['side'];
  entryPrice: NumericLike;
  currentPrice: NumericLike;
  size: NumericLike;
  leverage: NumericLike;
  liquidationPrice?: NumericLike;
  unrealizedPnL?: NumericLike;
  unrealizedPnLPercent?: NumericLike;
  fundingPaid?: NumericLike;
  openedAt: string;
  lastUpdated?: string;
}

interface ApiPredictionPositionPayload {
  id: string;
  marketId: string;
  question: string;
  side: UserPredictionPosition['side'];
  shares: NumericLike;
  avgPrice: NumericLike;
  currentPrice: NumericLike;
  currentValue?: NumericLike;
  costBasis?: NumericLike;
  unrealizedPnL?: NumericLike;
  currentProbability?: NumericLike;
  resolved?: boolean;
  resolution?: boolean | null;
}

interface UseUserPositionsOptions {
  enabled?: boolean;
}

const DEFAULT_STATS: PerpStats = {
  totalPositions: 0,
  totalPnL: 0,
  totalFunding: 0,
};

const createDefaultState = (): PositionsState => ({
  perpPositions: [],
  predictionPositions: [],
  perpStats: { ...DEFAULT_STATS },
});

export function useUserPositions(
  userId?: string | null,
  options: UseUserPositionsOptions = {}
) {
  const { enabled = true } = options;
  const [state, setState] = useState<PositionsState>(createDefaultState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!userId || !enabled) {
      setState(createDefaultState());
      setLoading(false);
      setError(null);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);

    const response = await fetch(
      `/api/markets/positions/${encodeURIComponent(userId)}`,
      { signal: controller.signal }
    );

    let data;
    try {
      data = await response.json();
    } catch (error) {
      console.error('Failed to parse positions response', error);
      setError(new Error('Failed to parse response'));
      setLoading(false);
      return;
    }

    if (controller.signal.aborted) return;

      const perpetuals = data?.perpetuals ?? {};
      const predictions = data?.predictions ?? {};

      const normalizedPerps = (perpetuals.positions ?? []).map(
        (pos: ApiPerpPositionPayload) => ({
          id: pos.id,
          userId: pos.userId,
          ticker: pos.ticker,
          organizationId: pos.organizationId,
          side: pos.side,
        entryPrice: toNumber(pos.entryPrice),
        currentPrice: toNumber(pos.currentPrice),
        size: toNumber(pos.size),
        leverage: toNumber(pos.leverage),
        liquidationPrice: toNumber(pos.liquidationPrice),
        unrealizedPnL: toNumber(pos.unrealizedPnL),
        unrealizedPnLPercent: toNumber(pos.unrealizedPnLPercent),
        fundingPaid: toNumber(pos.fundingPaid),
        openedAt: pos.openedAt,
          lastUpdated: pos.lastUpdated ?? pos.openedAt,
        })
      ) as PerpPosition[];

      const normalizedPredictions = (predictions.positions ?? []).map(
        (pos: ApiPredictionPositionPayload) => {
          const shares = toNumber(pos.shares);
          const avgPrice = toNumber(pos.avgPrice);
          return {
            id: pos.id,
            marketId: pos.marketId,
            question: pos.question,
            side: pos.side,
            shares,
            avgPrice,
            currentPrice: toNumber(pos.currentPrice),
            currentValue: toNumber(pos.currentValue ?? 0),
            costBasis: toNumber(pos.costBasis ?? shares * avgPrice),
            unrealizedPnL: toNumber(pos.unrealizedPnL ?? 0),
            resolved: Boolean(pos.resolved),
            resolution: pos.resolution ?? null,
          };
        }
      ) as UserPredictionPosition[];

    setState({
      perpPositions: normalizedPerps,
      predictionPositions: normalizedPredictions,
      perpStats: perpetuals.stats ?? { ...DEFAULT_STATS },
    });

    if (!controller.signal.aborted) {
      setLoading(false);
    }
  }, [userId, enabled]);

  useEffect(() => {
    if (enabled && userId) {
      void refresh();
    } else {
      setState(createDefaultState());
      setLoading(false);
      setError(null);
    }

    return () => {
      controllerRef.current?.abort();
    };
  }, [refresh, enabled, userId]);

  return {
    perpPositions: state.perpPositions,
    predictionPositions: state.predictionPositions,
    perpStats: state.perpStats,
    loading,
    error,
    refresh,
  };
}
