/**
 * Perpetuals Service - Singleton wrapper for PerpetualsEngine
 *
 * Provides server-side access to perpetuals trading functionality
 */
import { PerpetualsEngine } from '@/engine/PerpetualsEngine';
import type { Organization } from '@/shared/types';

import { db } from './database-service';
import { prisma } from './prisma';

let perpsEngineInstance: PerpetualsEngine | null = null;
let initializationPromise: Promise<void> | null = null;
let initializing = false;

export function getPerpsEngine(): PerpetualsEngine {
  // Only instantiate on server side
  if (typeof window !== 'undefined') {
    throw new Error(
      'PerpetualsEngine can only be instantiated on the server side'
    );
  }

  if (!perpsEngineInstance) {
    if (initializing) {
      throw new Error('PerpetualsEngine is being initialized elsewhere');
    }

    perpsEngineInstance = new PerpetualsEngine();
  }

  if (!initializationPromise) {
    initializationPromise = initializePerpsEngine();
  }

  return perpsEngineInstance;
}

export async function ensurePerpsEngineReady(): Promise<void> {
  if (!perpsEngineInstance) {
    getPerpsEngine();
  }

  if (initializationPromise) {
    await initializationPromise;
  }
}

export async function getReadyPerpsEngine(): Promise<PerpetualsEngine> {
  await ensurePerpsEngineReady();
  return getPerpsEngine();
}

export async function withPerpsEngine<T>(
  fn: (engine: PerpetualsEngine) => Promise<T> | T
): Promise<T> {
  const engine = await getReadyPerpsEngine();
  return await fn(engine);
}

async function initializePerpsEngine(): Promise<void> {
  if (!perpsEngineInstance) return;

  initializing = true;
  try {
    const organizations = (await db.getAllOrganizations()) as Organization[];
    perpsEngineInstance.initializeMarkets(organizations);

    // Hydrate user positions from perpPosition table
    const openUserPositions = await prisma.perpPosition.findMany({
      where: { closedAt: null },
    });

    // Also hydrate NPC pool positions (perp positions only)
    const openNPCPositions = await prisma.poolPosition.findMany({
      where: { 
        closedAt: null,
        marketType: 'perp',
      },
    });

    const allPositions = [
      ...openUserPositions.map((position) => ({
        id: position.id,
        userId: position.userId,
        ticker: position.ticker,
        organizationId: position.organizationId,
        side: position.side as 'long' | 'short',
        entryPrice: Number(position.entryPrice),
        currentPrice: Number(position.currentPrice),
        size: Number(position.size),
        leverage: Number(position.leverage),
        liquidationPrice: Number(position.liquidationPrice),
        unrealizedPnL: Number(position.unrealizedPnL),
        unrealizedPnLPercent: Number(position.unrealizedPnLPercent),
        fundingPaid: Number(position.fundingPaid),
        openedAt: position.openedAt,
        lastUpdated: position.lastUpdated ?? position.openedAt,
      })),
      ...openNPCPositions.map((position) => {
        // For NPC positions, we need to find the organizationId from the ticker
        // The ticker contains the organization ID
        const leverage = Number(position.leverage || 5);
        const entryPrice = Number(position.entryPrice);
        const side = position.side as 'long' | 'short';
        
        // Calculate liquidation price if not set (for long: 80% of entry, for short: 120% of entry)
        const liquidationPrice = position.liquidationPrice 
          ? Number(position.liquidationPrice)
          : entryPrice * (side === 'long' ? 0.8 : 1.2);
        
        return {
          id: position.id,
          userId: position.poolId, // Use poolId as userId for NPC positions
          ticker: position.ticker!,
          organizationId: position.ticker!, // For NPC positions, ticker === organizationId
          side,
          entryPrice,
          currentPrice: Number(position.currentPrice),
          size: Number(position.size),
          leverage,
          liquidationPrice,
          unrealizedPnL: Number(position.unrealizedPnL),
          unrealizedPnLPercent: 0,
          fundingPaid: 0,
          openedAt: position.updatedAt,
          lastUpdated: position.updatedAt,
        };
      }),
    ];

    if (allPositions.length > 0) {
      perpsEngineInstance.hydrateOpenPositions(allPositions);
    }
  } finally {
    initializing = false;
  }
}

// NOTE: Singleton export removed to prevent initialization during Next.js build
// Use getPerpsEngine() function instead to lazily initialize when needed
