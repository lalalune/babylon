/**
 * Perpetuals Trading Engine
 * 
 * Manages perpetual futures trading:
 * - Positions (long/short with leverage)
 * - Funding rate calculations
 * - Liquidations
 * - PnL tracking
 * - Daily price snapshots
 */

import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';
import type {
  PerpPosition,
  FundingRate,
  PerpMarket,
  OrderRequest,
  Liquidation,
  DailyPriceSnapshot,
  TradingStats,
} from '@/shared/perps-types';
import {
  calculateLiquidationPrice,
  calculateUnrealizedPnL,
  calculateFundingPayment,
  shouldLiquidate,
  calculateMarkPrice,
} from '@/shared/perps-types';
import type { Organization } from '@/shared/types';
import { prisma } from '@/lib/prisma';

interface ClosedPosition {
  userId: string;
  ticker: string;
  side: 'long' | 'short';
  size: number;
  leverage: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnL: number;
  fundingPaid: number;
  timestamp: string;
  reason: 'manual' | 'liquidation';
}

interface TradeRecord {
  userId: string;
  ticker: string;
  type: 'open' | 'close' | 'liquidation';
  size: number;
  price: number;
  volume: number;
  timestamp: string;
}

export class PerpetualsEngine extends EventEmitter {
  private positions: Map<string, PerpPosition> = new Map();
  private markets: Map<string, PerpMarket> = new Map();
  private fundingRates: Map<string, FundingRate> = new Map();
  private dailySnapshots: Map<string, DailyPriceSnapshot[]> = new Map(); // ticker -> snapshots
  private liquidations: Liquidation[] = [];
  private closedPositions: ClosedPosition[] = [];
  private tradeHistory: TradeRecord[] = [];
  private lastFundingTime: string = new Date().toISOString();
  private currentDate: string = new Date().toISOString().split('T')[0]!;
  private syncInterval: number = 10000; // Sync to DB every 10 seconds
  private syncTimer: NodeJS.Timeout | null = null;
  private dirtyPositions: Set<string> = new Set(); // Track positions that need DB sync

  constructor() {
    super();
    this.startPeriodicSync();
  }

  /**
   * Initialize markets from organizations
   */
  initializeMarkets(organizations: Organization[]): void {
    const companies = organizations.filter(o => o.type === 'company' && o.initialPrice);
    
    for (const company of companies) {
      const ticker = this.generateTicker(company.id);
      
      const market: PerpMarket = {
        ticker,
        organizationId: company.id,
        name: company.name,
        currentPrice: company.currentPrice || company.initialPrice || 100,
        change24h: 0,
        changePercent24h: 0,
        high24h: company.currentPrice || company.initialPrice || 100,
        low24h: company.currentPrice || company.initialPrice || 100,
        volume24h: 0,
        openInterest: 0,
        fundingRate: {
          ticker,
          rate: 0.01, // 1% annual default
          nextFundingTime: this.getNextFundingTime(),
          predictedRate: 0.01,
        },
        maxLeverage: 100,
        minOrderSize: 10,
        markPrice: company.currentPrice || company.initialPrice || 100,
        indexPrice: company.currentPrice || company.initialPrice || 100,
      };
      
      this.markets.set(ticker, market);
      this.fundingRates.set(ticker, market.fundingRate);
    }
    
    logger.info(`Initialized ${this.markets.size} perpetual markets`, undefined, 'PerpetualsEngine');
  }

  /**
   * Open a new position
   */
  openPosition(userId: string, order: OrderRequest): PerpPosition {
    const market = this.markets.get(order.ticker);
    if (!market) {
      throw new Error(`Market ${order.ticker} not found`);
    }

    if (order.size < market.minOrderSize) {
      throw new Error(`Order size below minimum (${market.minOrderSize} USD)`);
    }

    if (order.leverage > market.maxLeverage || order.leverage < 1) {
      throw new Error(`Invalid leverage (1-${market.maxLeverage}x)`);
    }

    const entryPrice = order.orderType === 'market' ? market.currentPrice : order.limitPrice!;
    const liquidationPrice = calculateLiquidationPrice(entryPrice, order.side, order.leverage);

    const timestamp = new Date().toISOString();
    const position: PerpPosition = {
      id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      ticker: order.ticker,
      organizationId: market.organizationId,
      side: order.side,
      entryPrice,
      currentPrice: market.currentPrice,
      size: order.size,
      leverage: order.leverage,
      liquidationPrice,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      fundingPaid: 0,
      openedAt: timestamp,
      lastUpdated: timestamp,
    };

    this.positions.set(position.id, position);

    // Record trade history
    this.tradeHistory.push({
      userId,
      ticker: order.ticker,
      type: 'open',
      size: order.size,
      price: entryPrice,
      volume: order.size, // Volume in USD (size is already in USD)
      timestamp,
    });

    // Update market open interest
    market.openInterest += order.size * order.leverage;
    market.volume24h += order.size;

    this.emit('position:opened', position);
    return position;
  }

  /**
   * Close a position
   */
  closePosition(positionId: string): { position: PerpPosition; realizedPnL: number } {
    const position = this.positions.get(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    const market = this.markets.get(position.ticker);
    if (!market) {
      throw new Error(`Market ${position.ticker} not found`);
    }

    // Calculate final PnL
    const { pnl } = calculateUnrealizedPnL(
      position.entryPrice,
      market.currentPrice,
      position.side,
      position.size
    );

    const realizedPnL = pnl - position.fundingPaid;
    const timestamp = new Date().toISOString();

    // Record closed position for statistics
    this.closedPositions.push({
      userId: position.userId,
      ticker: position.ticker,
      side: position.side,
      size: position.size,
      leverage: position.leverage,
      entryPrice: position.entryPrice,
      exitPrice: market.currentPrice,
      realizedPnL,
      fundingPaid: position.fundingPaid,
      timestamp,
      reason: 'manual',
    });

    // Record trade history
    this.tradeHistory.push({
      userId: position.userId,
      ticker: position.ticker,
      type: 'close',
      size: position.size,
      price: market.currentPrice,
      volume: position.size, // Volume in USD (size is already in USD)
      timestamp,
    });

    // Update market
    market.openInterest -= position.size * position.leverage;
    market.volume24h += position.size;

    // Remove position
    this.positions.delete(positionId);

    this.emit('position:closed', { position, realizedPnL });
    return { position, realizedPnL };
  }

  /**
   * Update all positions with new prices
   * Marks positions as dirty for periodic database sync
   */
  updatePositions(priceUpdates: Map<string, number>): void {
    const now = new Date().toISOString();
    
    for (const [positionId, position] of this.positions) {
      const newPrice = priceUpdates.get(position.organizationId);
      
      if (newPrice) {
        position.currentPrice = newPrice;
        position.lastUpdated = now;
        
        // Update PnL
        const { pnl, pnlPercent } = calculateUnrealizedPnL(
          position.entryPrice,
          newPrice,
          position.side,
          position.size
        );
        
        position.unrealizedPnL = pnl;
        position.unrealizedPnLPercent = pnlPercent;
        
        // Mark position as dirty for DB sync
        this.dirtyPositions.add(positionId);
        
        // Check for liquidation
        if (shouldLiquidate(newPrice, position.liquidationPrice, position.side)) {
          this.liquidatePosition(positionId, newPrice);
        }
      }
    }
    
    // Update markets
    for (const [ticker, market] of this.markets) {
      const newPrice = priceUpdates.get(market.organizationId);
      if (newPrice) {
        market.change24h = newPrice - market.currentPrice;
        market.changePercent24h = (market.change24h / market.currentPrice) * 100;
        market.currentPrice = newPrice;
        market.high24h = Math.max(market.high24h, newPrice);
        market.low24h = Math.min(market.low24h, newPrice);
        market.markPrice = calculateMarkPrice(market.indexPrice, newPrice, market.fundingRate.rate);
        
        // Emit market update event for ticker
        this.emit('market:updated', { ticker, market, newPrice });
      }
    }
  }

  /**
   * Process funding payments (called every 8 hours)
   * Should be called at 00:00, 08:00, and 16:00 UTC
   */
  processFunding(): void {
    const now = new Date();
    const hoursSinceLastFunding = (now.getTime() - new Date(this.lastFundingTime).getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastFunding < 8) {
      return; // Not time yet
    }
    
    let totalFundingPaid = 0;
    let positionsCharged = 0;
    
    for (const [_positionId, position] of this.positions) {
      const fundingRate = this.fundingRates.get(position.ticker);
      if (!fundingRate) continue;
      
      // Calculate funding for ONE 8-hour period only
      const fundingPayment = calculateFundingPayment(position.size, fundingRate.rate);
      
      // Longs pay shorts when funding is positive
      // Shorts pay longs when funding is negative
      const payment = position.side === 'long' ? fundingPayment : -fundingPayment;
      
      position.fundingPaid += payment;
      position.lastUpdated = now.toISOString();
      
      totalFundingPaid += Math.abs(payment);
      positionsCharged++;
    }
    
    this.lastFundingTime = now.toISOString();
    
    // Update next funding time for all markets
    const nextFundingTime = this.getNextFundingTime();
    for (const [ticker, fundingRate] of this.fundingRates) {
      fundingRate.nextFundingTime = nextFundingTime;
      
      // Emit funding rate update event
      this.emit('funding:rate:updated', { ticker, fundingRate, nextFundingTime });
    }
    
    this.emit('funding:processed', { 
      timestamp: now.toISOString(),
      positionsCharged,
      totalFundingPaid 
    });
    
    logger.info(`Processed funding: ${positionsCharged} positions, $${totalFundingPaid.toFixed(2)} total`, undefined, 'PerpetualsEngine');
  }

  /**
   * Liquidate a position
   * On liquidation, the user loses their entire margin (collateral)
   */
  private liquidatePosition(positionId: string, currentPrice: number): void {
    const position = this.positions.get(positionId);
    if (!position) return;

    const market = this.markets.get(position.ticker);
    if (!market) return;

    // Loss is the margin amount (not the full position size)
    const marginLoss = position.size / position.leverage;
    const timestamp = new Date().toISOString();

    const liquidation: Liquidation = {
      positionId,
      ticker: position.ticker,
      side: position.side,
      liquidationPrice: position.liquidationPrice,
      actualPrice: currentPrice,
      loss: marginLoss,
      timestamp,
    };

    this.liquidations.push(liquidation);

    // Record closed position for statistics (liquidation)
    this.closedPositions.push({
      userId: position.userId,
      ticker: position.ticker,
      side: position.side,
      size: position.size,
      leverage: position.leverage,
      entryPrice: position.entryPrice,
      exitPrice: currentPrice,
      realizedPnL: -marginLoss, // User loses their margin
      fundingPaid: position.fundingPaid,
      timestamp,
      reason: 'liquidation',
    });

    // Record trade history
    this.tradeHistory.push({
      userId: position.userId,
      ticker: position.ticker,
      type: 'liquidation',
      size: position.size,
      price: currentPrice,
      volume: position.size, // Volume in USD (size is already in USD)
      timestamp,
    });

    // Update market
    market.openInterest -= position.size * position.leverage;

    // Remove position
    this.positions.delete(positionId);

    this.emit('position:liquidated', liquidation);
  }

  /**
   * Record end-of-day price snapshot
   */
  recordDailySnapshot(date?: string): void {
    const snapshotDate = date || new Date().toISOString().split('T')[0]!;
    
    for (const [ticker, market] of this.markets) {
      const snapshot: DailyPriceSnapshot = {
        date: snapshotDate,
        ticker,
        organizationId: market.organizationId,
        openPrice: market.low24h, // Approximation
        closePrice: market.currentPrice,
        highPrice: market.high24h,
        lowPrice: market.low24h,
        volume: market.volume24h,
        timestamp: new Date().toISOString(),
      };
      
      if (!this.dailySnapshots.has(ticker)) {
        this.dailySnapshots.set(ticker, []);
      }
      
      this.dailySnapshots.get(ticker)!.push(snapshot);
      
      // Reset 24h stats
      market.high24h = market.currentPrice;
      market.low24h = market.currentPrice;
      market.volume24h = 0;
    }
    
    this.currentDate = snapshotDate;
    this.emit('daily:snapshot', { date: snapshotDate, markets: this.markets.size });
  }

  /**
   * Get daily snapshot for a ticker
   */
  getDailySnapshots(ticker: string, days: number = 30): DailyPriceSnapshot[] {
    const snapshots = this.dailySnapshots.get(ticker) || [];
    return snapshots.slice(-days);
  }

  /**
   * Get all markets
   */
  getMarkets(): PerpMarket[] {
    return Array.from(this.markets.values());
  }

  /**
   * Get user positions
   */
  getUserPositions(userId: string): PerpPosition[] {
    return Array.from(this.positions.values()).filter(p => p.userId === userId);
  }

  /**
   * Get trading stats
   */
  getTradingStats(userId: string): TradingStats {
    const userPositions = this.getUserPositions(userId);
    const userClosedPositions = this.closedPositions.filter(p => p.userId === userId);
    const userTrades = this.tradeHistory.filter(t => t.userId === userId);

    // Calculate total volume from trade history
    const totalVolume = userTrades.reduce((sum, t) => sum + t.volume, 0);

    // Calculate current unrealized PnL from open positions
    const unrealizedPnL = userPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);

    // Calculate realized PnL from closed positions
    const realizedPnL = userClosedPositions.reduce((sum, p) => sum + p.realizedPnL, 0);

    // Total PnL = realized + unrealized
    const totalPnL = realizedPnL + unrealizedPnL;

    // Calculate win/loss statistics from closed positions
    const winningTrades = userClosedPositions.filter(p => p.realizedPnL > 0);
    const losingTrades = userClosedPositions.filter(p => p.realizedPnL <= 0);

    const winRate = userClosedPositions.length > 0
      ? (winningTrades.length / userClosedPositions.length) * 100
      : 0;

    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, p) => sum + p.realizedPnL, 0) / winningTrades.length
      : 0;

    const avgLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, p) => sum + p.realizedPnL, 0) / losingTrades.length
      : 0;

    const largestWin = winningTrades.length > 0
      ? Math.max(...winningTrades.map(p => p.realizedPnL))
      : 0;

    const largestLoss = losingTrades.length > 0
      ? Math.min(...losingTrades.map(p => p.realizedPnL))
      : 0;

    // Calculate total funding paid
    const totalFundingPaid =
      userPositions.reduce((sum, p) => sum + p.fundingPaid, 0) +
      userClosedPositions.reduce((sum, p) => sum + p.fundingPaid, 0);

    // Count liquidations
    const totalLiquidations = userClosedPositions.filter(p => p.reason === 'liquidation').length;

    return {
      totalVolume,
      totalTrades: userClosedPositions.length + userPositions.length,
      totalPnL,
      winRate,
      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
      totalFundingPaid,
      totalLiquidations,
    };
  }

  /**
   * Start periodic database sync
   */
  private startPeriodicSync(): void {
    this.syncTimer = setInterval(() => {
      this.syncDirtyPositions().catch((error) => {
        logger.error('Error syncing positions to database:', error, 'PerpetualsEngine');
      });
    }, this.syncInterval);
  }

  /**
   * Sync dirty positions to database
   */
  private async syncDirtyPositions(): Promise<void> {
    if (this.dirtyPositions.size === 0) return;

    const positionsToSync = Array.from(this.dirtyPositions);
    this.dirtyPositions.clear();

    // Batch update positions in database
    const updates = positionsToSync.map((positionId) => {
      const position = this.positions.get(positionId);
      if (!position) return null;

      return prisma.perpPosition.update({
        where: { id: positionId },
        data: {
          currentPrice: position.currentPrice,
          unrealizedPnL: position.unrealizedPnL,
          unrealizedPnLPercent: position.unrealizedPnLPercent,
          fundingPaid: position.fundingPaid,
          lastUpdated: new Date(position.lastUpdated),
        },
      });
    }).filter(Boolean);

    await Promise.all(updates);

    if (updates.length > 0) {
      logger.debug(`Synced ${updates.length} positions to database`, undefined, 'PerpetualsEngine');
    }
  }

  /**
   * Stop periodic sync (cleanup)
   */
  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    // Final sync before stopping
    this.syncDirtyPositions().catch((error) => {
      logger.error('Error in final sync:', error, 'PerpetualsEngine');
    });
  }

  /**
   * Generate ticker symbol from organization ID
   * Max 12 characters, handles dashes and truncation
   */
  private generateTicker(orgId: string): string {
    // Remove dashes and convert to uppercase
    let ticker = orgId.toUpperCase().replace(/-/g, '');
    
    // Truncate to max 12 characters
    if (ticker.length > 12) {
      ticker = ticker.substring(0, 12);
    }
    
    return ticker;
  }

  /**
   * Get next funding time (every 8 hours: 00:00, 08:00, 16:00 UTC)
   */
  private getNextFundingTime(): string {
    const now = new Date();
    const currentHour = now.getUTCHours();
    
    let nextHour: number;
    if (currentHour < 8) nextHour = 8;
    else if (currentHour < 16) nextHour = 16;
    else nextHour = 24; // Midnight next day
    
    const nextFunding = new Date(now);
    nextFunding.setUTCHours(nextHour % 24, 0, 0, 0);
    
    if (nextHour === 24) {
      nextFunding.setUTCDate(nextFunding.getUTCDate() + 1);
    }
    
    return nextFunding.toISOString();
  }

  /**
   * Save state to JSON
   */
  exportState() {
    return {
      positions: Array.from(this.positions.values()),
      markets: Array.from(this.markets.values()),
      fundingRates: Array.from(this.fundingRates.values()),
      dailySnapshots: Object.fromEntries(this.dailySnapshots),
      liquidations: this.liquidations,
      lastFundingTime: this.lastFundingTime,
      currentDate: this.currentDate,
    };
  }

  /**
   * Load state from JSON
   */
  importState(state: {
    positions: PerpPosition[];
    markets: PerpMarket[];
    fundingRates: FundingRate[];
    dailySnapshots: Record<string, DailyPriceSnapshot[]>;
    liquidations: Liquidation[];
    lastFundingTime: number;
    currentDate: string;
  }) {
    this.positions = new Map(state.positions.map((p: PerpPosition) => [p.id, p]));
    this.markets = new Map(state.markets.map((m: PerpMarket) => [m.ticker, m]));
    this.fundingRates = new Map(state.fundingRates.map((f: FundingRate) => [f.ticker, f]));
    this.dailySnapshots = new Map(Object.entries(state.dailySnapshots));
    this.liquidations = state.liquidations || [];
    this.lastFundingTime = typeof state.lastFundingTime === 'number' 
      ? new Date(state.lastFundingTime).toISOString() 
      : String(state.lastFundingTime);
    this.currentDate = state.currentDate;
  }
}


