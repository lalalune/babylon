import { useMemo } from 'react';

import { useSSEChannel } from '@/hooks/useSSE';

export interface PredictionTradeSSE {
  type: 'prediction_trade';
  marketId: string;
  yesPrice: number;
  noPrice: number;
  yesShares: number;
  noShares: number;
  liquidity?: number;
  trade: {
    actorType: 'user' | 'npc' | 'system';
    actorId?: string;
    action: 'buy' | 'sell' | 'close';
    side: 'yes' | 'no';
    shares: number;
    amount: number;
    price: number;
    source: 'user_trade' | 'npc_trade' | 'system';
    timestamp: string;
  };
}

export interface PredictionResolutionSSE {
  type: 'prediction_resolution';
  marketId: string;
  winningSide: 'yes' | 'no';
  yesPrice: number;
  noPrice: number;
  yesShares: number;
  noShares: number;
  liquidity?: number;
  totalPayout: number;
  timestamp: string;
}

type SSEPayload = PredictionTradeSSE | PredictionResolutionSSE;

const isPredictionPayload = (data: unknown): data is SSEPayload => {
  if (!data || typeof data !== 'object' || data === null) return false;
  const type = (data as { type?: string }).type;
  if (type !== 'prediction_trade' && type !== 'prediction_resolution') {
    return false;
  }
  return typeof (data as { marketId?: string }).marketId === 'string';
};

interface UsePredictionMarketStreamOptions {
  onTrade?: (event: PredictionTradeSSE) => void;
  onResolution?: (event: PredictionResolutionSSE) => void;
}

export function usePredictionMarketStream(
  marketId: string | null,
  { onTrade, onResolution }: UsePredictionMarketStreamOptions = {}
) {
  const normalizedMarketId = useMemo(() => marketId ?? null, [marketId]);

  useSSEChannel(normalizedMarketId ? 'markets' : null, (data) => {
    if (!normalizedMarketId) return;
    if (!isPredictionPayload(data)) return;
    if (data.marketId !== normalizedMarketId) return;

    if (data.type === 'prediction_trade') {
      onTrade?.(data as PredictionTradeSSE);
    } else if (data.type === 'prediction_resolution') {
      onResolution?.(data as PredictionResolutionSSE);
    }
  });
}

export function usePredictionMarketsSubscription(
  { onTrade, onResolution }: UsePredictionMarketStreamOptions = {}
) {
  useSSEChannel('markets', (data) => {
    if (!isPredictionPayload(data)) return;

    if (data.type === 'prediction_trade') {
      onTrade?.(data as PredictionTradeSSE);
    } else if (data.type === 'prediction_resolution') {
      onResolution?.(data as PredictionResolutionSSE);
    }
  });
}
