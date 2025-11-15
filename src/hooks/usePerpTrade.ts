'use client';

import { useCallback } from 'react';

type TradeSide = 'long' | 'short';

interface UsePerpTradeOptions {
  getAccessToken?: () => Promise<string | null> | string | null;
}

interface OpenPerpPayload {
  ticker: string;
  side: TradeSide;
  size: number;
  leverage: number;
}

interface ApiPerpPosition {
  id: string;
  ticker: string;
  side: TradeSide;
  entryPrice: number;
  currentPrice: number;
  size: number;
  leverage: number;
  liquidationPrice?: number;
  realizedPnL?: number;
  fundingPaid: number;
  openedAt?: string;
  exitPrice?: number;
}

interface OpenPerpResponse {
  position: ApiPerpPosition;
  marginPaid: number;
  fee: {
    amount: number;
    referrerPaid: number;
  };
  newBalance: number;
}

interface ClosePerpResponse {
  position: ApiPerpPosition;
  grossSettlement: number;
  netSettlement: number;
  marginReturned: number;
  pnl: number;
  realizedPnL?: number;
  fee: {
    amount: number;
    referrerPaid: number;
  };
  wasLiquidated: boolean;
  newBalance: number;
}

async function resolveToken(
  resolver?: () => Promise<string | null> | string | null
): Promise<string | null> {
  if (!resolver) {
    if (typeof window === 'undefined') return null;
    return window.__privyAccessToken ?? null;
  }

  const value = typeof resolver === 'function' ? resolver() : resolver;
  const token = await Promise.resolve(value);
  if (token) return token;
  if (typeof window === 'undefined') return null;
  return window.__privyAccessToken ?? null;
}

function extractErrorMessage(payload: Record<string, unknown> | null, status: number): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error !== undefined
  ) {
    const errorPayload = payload.error;

    if (typeof errorPayload === 'string') {
      return errorPayload;
    }

    if (
      errorPayload &&
      typeof errorPayload === 'object' &&
      'message' in errorPayload &&
      typeof (errorPayload as { message?: string }).message === 'string'
    ) {
      return (errorPayload as { message: string }).message;
    }

    return JSON.stringify(errorPayload);
  }

  return `Request failed with status ${status}`;
}

export function usePerpTrade(options: UsePerpTradeOptions = {}) {
  const callApi = useCallback(
    async <T>(url: string, init: RequestInit = {}): Promise<T> => {
      const headers = new Headers(init.headers);
      headers.set('Content-Type', 'application/json');

      const token = await resolveToken(options.getAccessToken);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const response = await fetch(url, {
        ...init,
        headers,
      });

      let data: Record<string, unknown>;
      try {
        data = await response.json() as Record<string, unknown>;
      } catch (error) {
        throw new Error(`Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      if (!response.ok) {
        throw new Error(extractErrorMessage(data, response.status));
      }

      return data as T;
    },
    [options.getAccessToken]
  );

  const openPosition = useCallback(
    async (payload: OpenPerpPayload): Promise<OpenPerpResponse> => {
      return await callApi('/api/markets/perps/open', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    [callApi]
  );

  const closePosition = useCallback(
    async (positionId: string): Promise<ClosePerpResponse> => {
      return await callApi(`/api/markets/perps/${positionId}/close`, {
        method: 'POST',
      });
    },
    [callApi]
  );

  return {
    openPosition,
    closePosition,
  };
}
