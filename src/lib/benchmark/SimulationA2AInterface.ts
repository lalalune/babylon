/**
 * Simulation A2A Interface
 * 
 * Provides A2A-compatible interface for agents to interact with simulation.
 * Wraps SimulationEngine to make it behave like a real game server.
 * 
 * Agents can use standard A2A methods like:
 * - a2a.getPredictions
 * - a2a.buyShares
 * - a2a.openPosition
 * - a2a.getFeed
 * etc.
 */

import type { SimulationEngine } from './SimulationEngine';
import { logger } from '@/lib/logger';

export class SimulationA2AInterface {
  private engine: SimulationEngine;
  private agentId: string;
  
  constructor(engine: SimulationEngine, agentId: string) {
    this.engine = engine;
    this.agentId = agentId;
  }
  
  /**
   * Send A2A request (JSON-RPC style)
   */
  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    logger.debug('Simulation A2A request', { method, params });
    
    const actionStart = Date.now();
    
    try {
      let result: unknown;
      
      // Route to appropriate handler
      switch (method) {
        case 'a2a.getPredictions':
          result = this.handleGetPredictions(params);
          break;
          
        case 'a2a.buyShares':
          result = await this.handleBuyShares(params);
          break;
          
        case 'a2a.sellShares':
          result = await this.handleSellShares(params);
          break;
          
        case 'a2a.getPerpetuals':
          result = this.handleGetPerpetuals(params);
          break;
          
        case 'a2a.openPosition':
          result = await this.handleOpenPosition(params);
          break;
          
        case 'a2a.closePosition':
          result = await this.handleClosePosition(params);
          break;
          
        case 'a2a.getFeed':
          result = this.handleGetFeed(params);
          break;
          
        case 'a2a.createPost':
          result = await this.handleCreatePost(params);
          break;
          
        case 'a2a.getChats':
          result = this.handleGetChats(params);
          break;
          
        case 'a2a.joinGroup':
          result = await this.handleJoinGroup(params);
          break;
          
        case 'a2a.getBalance':
          result = this.handleGetBalance(params);
          break;
          
        case 'a2a.getPortfolio':
          result = this.handleGetPortfolio(params);
          break;
          
        case 'a2a.getPositions':
          result = this.handleGetPositions(params);
          break;
          
        case 'a2a.getDashboard':
          result = this.handleGetDashboard(params);
          break;
          
        default:
          throw new Error(`Unknown A2A method: ${method}`);
      }
      
      // NOTE: Don't auto-advance tick here - let the benchmark runner control the tick progression
      // This allows the agent to make multiple A2A calls within a single tick
      
      const duration = Date.now() - actionStart;
      logger.debug('Simulation A2A response', { method, duration });
      
      return result;
    } catch (error) {
      logger.error('Simulation A2A error', { method, error });
      throw error;
    }
  }
  
  /**
   * Get prediction markets
   */
  private handleGetPredictions(_params: unknown): { predictions: unknown[] } {
    const state = this.engine.getGameState();
    
    const predictions = state.predictionMarkets
      .filter((m: { resolved: boolean }) => !m.resolved)
      .map((m: { id: string; question: string; yesShares: number; noShares: number; yesPrice: number; noPrice: number; liquidity: number; totalVolume: number; createdAt: number; resolveAt: number }) => ({
        id: m.id,
        question: m.question,
        yesShares: m.yesShares,
        noShares: m.noShares,
        yesPrice: m.yesPrice,
        noPrice: m.noPrice,
        liquidity: m.liquidity,
        totalVolume: m.totalVolume,
        createdAt: m.createdAt,
        resolveAt: m.resolveAt,
      }));
    
    return { predictions };
  }
  
  /**
   * Buy prediction market shares
   */
  private async handleBuyShares(params: unknown): Promise<{ shares: number; avgPrice: number; positionId: string }> {
    const { marketId, outcome, amount } = params as { marketId: string; outcome: 'YES' | 'NO'; amount: number };
    
    const result = await this.engine.performAction('buy_prediction', {
      marketId,
      outcome,
      amount,
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to buy shares');
    }
    
    const { positionId, shares } = result.result as { positionId: string; shares: number };
    
    const state = this.engine.getGameState();
    const market = state.predictionMarkets.find((m: { id: string }) => m.id === marketId);
    const avgPrice = market ? (outcome === 'YES' ? market.yesPrice : market.noPrice) : 0.5;
    
    return { shares, avgPrice, positionId };
  }
  
  /**
   * Sell prediction market shares
   */
  private async handleSellShares(params: unknown): Promise<{ proceeds: number }> {
    const { marketId, shares } = params as { marketId: string; shares: number };
    
    // Simplified: calculate proceeds based on current market price
    const state = this.engine.getGameState();
    const market = state.predictionMarkets.find((m: { id: string }) => m.id === marketId);
    
    if (!market) {
      throw new Error(`Market ${marketId} not found`);
    }
    
    // Use average of yes and no prices as sell price
    const avgPrice = (market.yesPrice + market.noPrice) / 2;
    const proceeds = shares * avgPrice;
    
    return { proceeds };
  }
  
  /**
   * Get perpetual markets
   */
  private handleGetPerpetuals(_params: unknown): { perpetuals: unknown[] } {
    const state = this.engine.getGameState();
    
    const perpetuals = state.perpetualMarkets.map((m: { ticker: string; price: number; priceChange24h?: number; volume24h: number; openInterest: number; fundingRate: number; nextFundingTime?: number }) => ({
      ticker: m.ticker,
      price: m.price,
      priceChange24h: m.priceChange24h,
      volume24h: m.volume24h,
      openInterest: m.openInterest,
      fundingRate: m.fundingRate,
      nextFundingTime: m.nextFundingTime,
    }));
    
    return { perpetuals };
  }
  
  /**
   * Open perpetual position
   */
  private async handleOpenPosition(params: unknown): Promise<{ positionId: string; entryPrice: number }> {
    const { ticker, side, size, leverage } = params as { ticker: string; side: 'LONG' | 'SHORT'; size: number; leverage: number };
    
    const result = await this.engine.performAction('open_perp', {
      ticker,
      side,
      size,
      leverage,
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to open position');
    }
    
    const { positionId } = result.result as { positionId: string };
    
    const state = this.engine.getGameState();
    const market = state.perpetualMarkets.find((m: { ticker: string }) => m.ticker === ticker);
    
    return {
      positionId,
      entryPrice: market?.price || 0,
    };
  }
  
  /**
   * Close perpetual position
   */
  private async handleClosePosition(_params: unknown): Promise<{ pnl: number; exitPrice: number }> {
    const { positionId } = _params as { positionId: string };
    
    const result = await this.engine.performAction('close_perp', {
      positionId,
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to close position');
    }
    
    const { pnl } = result.result as { pnl: number };
    
    return {
      pnl,
      exitPrice: 0, // Simplified
    };
  }
  
  /**
   * Get social feed
   */
  private handleGetFeed(_params: unknown): { posts: unknown[] } {
    const state = this.engine.getGameState();
    
    const posts = (state.posts || [])
      .slice(-20) // Last 20 posts
      .map((p: {
        id: string;
        authorId: string;
        authorName: string;
        content: string;
        createdAt: number;
        likes: number;
        comments: number;
        marketId?: string;
      }) => ({
        id: p.id,
        authorId: p.authorId,
        authorName: p.authorName,
        content: p.content,
        createdAt: p.createdAt,
        likes: p.likes,
        comments: p.comments,
        marketId: p.marketId,
      }));
    
    return { posts };
  }
  
  /**
   * Create post
   */
  private async handleCreatePost(_params: unknown): Promise<{ postId: string }> {
    const { content, marketId } = _params as { content: string; marketId?: string };
    
    const result = await this.engine.performAction('create_post', {
      content,
      marketId,
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create post');
    }
    
    const { postId } = result.result as { postId: string };
    
    return { postId };
  }
  
  /**
   * Get group chats
   */
  private handleGetChats(_params: unknown): { chats: unknown[] } {
    const state = this.engine.getGameState();
    
    const chats = (state.groupChats || []).map((g: {
      id: string;
      name: string;
      memberIds: string[];
      messageCount: number;
      lastActivity: number;
      invitedAgent?: boolean;
    }) => ({
      id: g.id,
      name: g.name,
      memberCount: g.memberIds.length,
      messageCount: g.messageCount,
      lastActivity: g.lastActivity,
      invited: g.invitedAgent || false,
    }));
    
    return { chats };
  }
  
  /**
   * Join group chat
   */
  private async handleJoinGroup(params: unknown): Promise<{ success: boolean }> {
    const { groupId } = params as { groupId: string };
    
    const result = await this.engine.performAction('join_group', {
      groupId,
    });
    
    return { success: result.success };
  }
  
  /**
   * Get agent balance
   */
  private handleGetBalance(_params: unknown): { balance: number } {
    // Simplified: return fixed balance
    return { balance: 10000 };
  }
  
  /**
   * Get portfolio (balance, positions, P&L)
   */
  private handleGetPortfolio(_params: unknown): { balance: number; positions: Array<Record<string, unknown>>; pnl: number } {
    const state = this.engine.getGameState();
    const agent = state.agents.find((a: { id: string }) => a.id === this.agentId);
    
    // Calculate positions from agent's state
    const positions: Array<Record<string, unknown>> = [];
    
    // Calculate P&L from agent's totalPnl
    const pnl = (agent as { totalPnl?: number } | undefined)?.totalPnl || 0;
    const balance = 10000 + pnl; // Starting balance + P&L
    
    return {
      balance,
      positions,
      pnl
    };
  }
  
  /**
   * Get positions (prediction market + perp positions)
   */
  private handleGetPositions(_params: unknown): { predictionPositions: Array<Record<string, unknown>>; perpPositions: Array<Record<string, unknown>> } {
    // Return empty arrays for simulation
    // In a real benchmark, we'd track actual positions made by the agent
    return {
      predictionPositions: [],
      perpPositions: []
    };
  }
  
  /**
   * Get dashboard data (balance, recent activity, etc)
   */
  private handleGetDashboard(_params: unknown): { balance: number; reputation: number; totalPnl: number; activePositions: number } {
    const state = this.engine.getGameState();
    const agent = state.agents.find((a: { id: string }) => a.id === this.agentId);
    
    const pnl = (agent as { totalPnl?: number } | undefined)?.totalPnl || 0;
    const balance = 10000 + pnl;
    
    return {
      balance,
      reputation: 1000,
      totalPnl: pnl,
      activePositions: 0
    };
  }
  
  /**
   * Check if connected (always true for simulation)
   */
  isConnected(): boolean {
    return true;
  }
  
  // ===== Wrapper methods to match BabylonA2AClient interface =====
  
  /**
   * Buy shares in prediction market
   */
  async buyShares(marketId: string, outcome: 'YES' | 'NO', amount: number): Promise<Record<string, unknown>> {
    return await this.sendRequest('a2a.buyShares', { marketId, outcome, amount }) as Record<string, unknown>;
  }
  
  /**
   * Sell shares from prediction market
   */
  async sellShares(marketId: string, shares: number): Promise<Record<string, unknown>> {
    const result = await this.sendRequest('a2a.sellShares', { marketId, shares }) as { proceeds: number };
    return { proceeds: result.proceeds };
  }
  
  /**
   * Open perp position
   */
  async openPosition(ticker: string, side: 'long' | 'short', size: number, leverage: number): Promise<Record<string, unknown>> {
    return await this.sendRequest('a2a.openPosition', { ticker, side, size, leverage }) as Record<string, unknown>;
  }
  
  /**
   * Close perp position
   */
  async closePosition(positionId: string): Promise<Record<string, unknown>> {
    return await this.sendRequest('a2a.closePosition', { positionId }) as Record<string, unknown>;
  }
  
  /**
   * Create post
   */
  async createPost(content: string, type: string = 'post'): Promise<Record<string, unknown>> {
    return await this.sendRequest('a2a.createPost', { content, type }) as Record<string, unknown>;
  }
  
  /**
   * Create comment
   */
  async createComment(postId: string, content: string): Promise<Record<string, unknown>> {
    return await this.sendRequest('a2a.createComment', { postId, content }) as Record<string, unknown>;
  }
  
  /**
   * Get portfolio (balance, positions, P&L)
   */
  async getPortfolio(): Promise<{ balance: number; positions: Array<Record<string, unknown>>; pnl: number }> {
    return await this.sendRequest('a2a.getPortfolio') as { balance: number; positions: Array<Record<string, unknown>>; pnl: number };
  }
  
  /**
   * Get markets
   */
  async getMarkets(): Promise<{ predictions: Array<Record<string, unknown>>; perps: Array<Record<string, unknown>> }> {
    const predictions = await this.sendRequest('a2a.getPredictions', { status: 'active' }) as { predictions: Array<Record<string, unknown>> };
    const perpetuals = await this.sendRequest('a2a.getPerpetuals', {}) as { perpetuals: Array<Record<string, unknown>> };
    return {
      predictions: predictions.predictions || [],
      perps: perpetuals.perpetuals || []
    };
  }
  
  /**
   * Get feed
   */
  async getFeed(limit = 20): Promise<{ posts: Array<Record<string, unknown>> }> {
    return await this.sendRequest('a2a.getFeed', { limit, offset: 0 }) as { posts: Array<Record<string, unknown>> };
  }
}

