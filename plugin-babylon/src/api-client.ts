/**
 * Babylon Game API Client
 *
 * Client for interacting with Babylon prediction market API
 * Supports both manual auth tokens and automatic agent authentication
 */

import type {
  BabylonMarket,
  BabylonMarketHistory,
  BabylonPosition,
  BabylonWallet,
  TradeRequest,
  TradeResult,
  AgentConfig,
  Chat,
} from "./types";
import { AgentAuthService } from "./agent-auth-service";
import { logger } from "@elizaos/core";

// Type for HTTP headers
type HeadersInit = Record<string, string>;

export class BabylonApiClient {
  private config: AgentConfig;
  private baseUrl: string;
  private authToken?: string;
  private agentAuthService: AgentAuthService | null = null;
  private useAgentAuth: boolean = false;

  constructor(config: AgentConfig) {
    this.config = config;
    this.baseUrl = config.apiBaseUrl || "http://localhost:3000";
    this.authToken = config.authToken;

    // Enable automatic agent authentication if no manual token provided
    if (!this.authToken) {
      this.agentAuthService = new AgentAuthService(this.baseUrl);
      this.useAgentAuth = this.agentAuthService.hasCredentials();

      if (this.useAgentAuth) {
        logger.info("🤖 Agent authentication enabled");
      }
    }
  }

  /**
   * Set authentication token (from Privy or other auth provider)
   */
  setAuthToken(token: string): void {
    this.authToken = token;
    this.useAgentAuth = false; // Disable auto-auth when manual token is set
  }

  /**
   * Get authentication headers
   */
  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
      return headers;
    }

    if (this.useAgentAuth && this.agentAuthService) {
      const sessionToken = await this.agentAuthService.getSessionToken();
      headers["Authorization"] = `Bearer ${sessionToken}`;
    }

    return headers;
  }

  /**
   * Fetch active markets
   */
  async getActiveMarkets(): Promise<BabylonMarket[]> {
    const response = await fetch(`${this.baseUrl}/api/markets/predictions`, {
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch markets: ${response.statusText}`);
    }

    const data = (await response.json()) as { markets: BabylonMarket[] };
    return data.markets || [];
  }

  /**
   * Get specific market by ID
   */
  async getMarket(marketId: string): Promise<BabylonMarket> {
    const response = await fetch(
      `${this.baseUrl}/api/markets/predictions/${marketId}`,
      {
        headers: await this.getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch market: ${response.statusText}`);
    }

    return (await response.json()) as BabylonMarket;
  }

  /**
   * Get user's wallet balance
   */
  async getWallet(): Promise<BabylonWallet> {
    const endpoint = this.useAgentAuth 
      ? `${this.baseUrl}/api/agents/wallet`
      : `${this.baseUrl}/api/wallet/balance`;
    
    const response = await fetch(endpoint, {
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch wallet: ${response.statusText}`);
    }

    return (await response.json()) as BabylonWallet;
  }

  /**
   * Get user's positions
   */
  async getPositions(): Promise<BabylonPosition[]> {
    const endpoint = this.useAgentAuth 
      ? `${this.baseUrl}/api/agents/positions`
      : `${this.baseUrl}/api/positions`;
    
    const response = await fetch(endpoint, {
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch positions: ${response.statusText}`);
    }

    const data = (await response.json()) as { 
      positions?: BabylonPosition[];
      predictions?: { positions?: BabylonPosition[] };
      perpetuals?: { positions?: BabylonPosition[] };
    };
    
    if (data.positions) {
      return data.positions;
    }
    
    const predictionPositions = data.predictions?.positions || [];
    const perpetualPositions = data.perpetuals?.positions || [];
    return [...predictionPositions, ...perpetualPositions];
  }

  /**
   * Place a trade (buy shares)
   */
  async buyShares(request: TradeRequest): Promise<TradeResult> {
    if (request.amount < 1) {
      throw new Error("Minimum trade size is $1");
    }

    if (!["yes", "no"].includes(request.side)) {
      throw new Error('Side must be "yes" or "no"');
    }

    const wallet = await this.getWallet();
    if (wallet.availableBalance < request.amount) {
      throw new Error("Insufficient balance");
    }

    if (request.amount > this.config.tradingLimits.maxTradeSize) {
      throw new Error(`Trade size exceeds limit of $${this.config.tradingLimits.maxTradeSize}`);
    }

    const response = await fetch(
      `${this.baseUrl}/api/markets/predictions/${request.marketId}/buy`,
      {
        method: "POST",
        headers: await this.getHeaders(),
        body: JSON.stringify({
          side: request.side,
          amount: request.amount,
        }),
      },
    );

    if (!response.ok) {
      const error = (await response.json()) as { message: string };
      throw new Error(error.message || response.statusText);
    }

    const result = (await response.json()) as {
      shares: number;
      avgPrice: number;
      position: BabylonPosition;
    };

    return {
      success: true,
      shares: result.shares,
      avgPrice: result.avgPrice,
      newPosition: result.position,
    };
  }

  /**
   * Sell shares (close position)
   */
  async sellShares(marketId: string, shares: number): Promise<TradeResult> {
    const response = await fetch(
      `${this.baseUrl}/api/markets/predictions/${marketId}/sell`,
      {
        method: "POST",
        headers: await this.getHeaders(),
        body: JSON.stringify({
          shares,
        }),
      },
    );

    if (!response.ok) {
      const error = (await response.json()) as { message: string };
      throw new Error(error.message || response.statusText);
    }

    const result = (await response.json()) as {
      shares: number;
      avgPrice: number;
    };

    return {
      success: true,
      shares: result.shares,
      avgPrice: result.avgPrice,
    };
  }

  /**
   * Get market history and price data
   */
  async getMarketHistory(
    marketId: string,
  ): Promise<BabylonMarketHistory> {
    const response = await fetch(
      `${this.baseUrl}/api/markets/predictions/${marketId}/history`,
      {
        headers: await this.getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch market history: ${response.statusText}`);
    }

    return (await response.json()) as BabylonMarketHistory;
  }

  async getChats(): Promise<Chat[]> {
    const response = await fetch(`${this.baseUrl}/api/chats`, {
      headers: await this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch chats: ${response.statusText}`);
    }
    const data = await response.json();
    return data.chats || [];
  }

  async sendMessage(chatId: string, content: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/chats/${chatId}/message`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to send message: ${response.statusText}`);
    }
  }

  /**
   * Like a post
   */
  async likePost(postId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/posts/${postId}/like`, {
      method: "POST",
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error((errorData as { error?: string }).error || `Failed to like post: ${response.statusText}`);
    }
  }

  /**
   * Create a post
   */
  async createPost(content: string): Promise<{ postId: string }> {
    const response = await fetch(`${this.baseUrl}/api/posts`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error((errorData as { error?: string }).error || `Failed to create post: ${response.statusText}`);
    }

    const data = await response.json();
    return { postId: (data.post as { id: string }).id };
  }

  /**
   * Follow a user
   */
  async followUser(userId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/users/${encodeURIComponent(userId)}/follow`, {
      method: "POST",
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error((errorData as { error?: string }).error || `Failed to follow user: ${response.statusText}`);
    }
  }

  /**
   * Comment on a post
   */
  async commentOnPost(postId: string, content: string): Promise<{ commentId: string }> {
    const response = await fetch(`${this.baseUrl}/api/posts/${postId}/comments`, {
      method: "POST",
      headers: await this.getHeaders(),
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error((errorData as { error?: string }).error || `Failed to comment: ${response.statusText}`);
    }

    const data = await response.json();
    return { commentId: (data.comment as { id: string }).id };
  }

  /**
   * Get recent posts from feed
   */
  async getRecentPosts(limit = 20): Promise<Array<{ id: string; content: string; authorId: string; timestamp: string; likeCount: number; commentCount: number }>> {
    const response = await fetch(`${this.baseUrl}/api/posts?limit=${limit}`, {
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.statusText}`);
    }

    const data = await response.json();
    return data.posts || [];
  }
}
