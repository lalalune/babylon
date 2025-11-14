/**
 * A2A Service for ElizaOS Plugin
 *
 * Integrates A2A WebSocket protocol for real-time agent-to-agent communication
 * Enables market data subscriptions, agent discovery, and coalition formation
 */

import { Service } from "@elizaos/core";
import type { IAgentRuntime, Memory } from "@elizaos/core";
import { A2AClient } from "../../src/a2a/client/a2a-client";
import { A2AEventType } from "../../src/a2a/types";
import type {
  A2AClientConfig,
  AgentCapabilities,
  MarketData,
  AgentProfile,
  MarketAnalysis,
} from "../../src/a2a/types";
import type { JsonValue } from "../../src/types/common";
import { logger } from "@elizaos/core";

interface A2AServiceConfig {
  endpoint?: string; // A2A WebSocket server URL (e.g., ws://localhost:8081)
  enabled?: boolean; // Enable A2A integration (default: true if endpoint provided)
  autoReconnect?: boolean;
  reconnectInterval?: number;
  heartbeatInterval?: number;
}

export class BabylonA2AService extends Service {
  static override serviceType = "babylon-a2a" as const;
  
  override capabilityDescription =
    "A2A WebSocket integration for real-time agent-to-agent communication and market data subscriptions";

  private client!: A2AClient;
  private a2aConfig: A2AServiceConfig;
  private connected = false;
  private agentWalletAddress: string | null = null;
  private agentTokenId: number | null = null;
  private agentPrivateKey: string | null = null;

  constructor(runtime: IAgentRuntime, config: A2AServiceConfig = {}) {
    super(runtime);
    this.a2aConfig = {
      enabled: !!config.endpoint,
      autoReconnect: true,
      reconnectInterval: 5000,
      heartbeatInterval: 30000,
      ...config,
    };
  }

  /**
   * Static factory method - called by ElizaOS
   */
  static override async start(
    runtime: IAgentRuntime,
    config?: A2AServiceConfig,
  ): Promise<BabylonA2AService> {
    logger.info("Starting BabylonA2AService");
    const service = new BabylonA2AService(runtime, config);
    return service;
  }

  /**
   * Instance start method - called automatically after static start()
   */
  async start(): Promise<void> {

    // Check if A2A is enabled
    if (!this.a2aConfig.enabled || !this.a2aConfig.endpoint) {
      logger.info("A2A integration disabled or endpoint not configured");
      return;
    }

    // Get agent credentials from runtime or environment
    await this.loadAgentCredentials();

    if (!this.agentWalletAddress || !this.agentPrivateKey) {
      logger.warn(
        "Agent credentials not available for A2A - A2A integration disabled",
      );
      return;
    }

    // Initialize A2A client
    await this.connect();
  }

  /**
   * Load agent credentials from runtime or environment
   */
  private async loadAgentCredentials(): Promise<void> {
    const agentId = this.runtime.agentId || process.env.BABYLON_AGENT_ID || "default";

    logger.info(`Loading A2A credentials for agent: ${agentId}`);

    this.agentWalletAddress = process.env.BABYLON_AGENT_WALLET_ADDRESS || null;
    this.agentPrivateKey = process.env.BABYLON_AGENT_PRIVATE_KEY || null;

    const tokenIdStr = process.env.BABYLON_AGENT_TOKEN_ID;
    this.agentTokenId = tokenIdStr ? parseInt(tokenIdStr, 10) : null;

    if (this.agentWalletAddress && this.agentPrivateKey) {
      logger.info(
        `A2A credentials loaded for agent ${agentId} - wallet: ${this.agentWalletAddress.slice(0, 10)}...`,
      );
    }
  }

  /**
   * Connect to A2A server
   */
  async connect(): Promise<void> {
    if (!this.a2aConfig.enabled) {
      return;
    }

    // Auto-discover Babylon endpoint from Agent0 registry if available
    if (process.env.AGENT0_ENABLED === 'true') {
      const discoveryService = this.runtime.getService('babylon-discovery') as unknown as {
        discoverAndConnect: () => Promise<{ endpoints: { a2a: string } } | null>
      }
      if (discoveryService?.discoverAndConnect) {
        logger.info('Attempting to discover Babylon via Agent0 registry...');
        const babylon = await discoveryService.discoverAndConnect()
        if (babylon?.endpoints?.a2a) {
          this.a2aConfig.endpoint = babylon.endpoints.a2a
          logger.info(`✅ Discovered A2A endpoint via Agent0: ${babylon.endpoints.a2a}`);
        }
      }
    }

    if (!this.a2aConfig.endpoint) {
      throw new Error("A2A endpoint not available");
    }

    if (!this.agentWalletAddress || !this.agentPrivateKey) {
      throw new Error("Cannot connect to A2A: missing credentials");
    }

    // Define agent capabilities
    const capabilities: AgentCapabilities = {
      strategies: ["momentum", "sentiment", "volume"],
      markets: ["prediction"],
      actions: ["analyze", "trade", "coordinate"],
      version: "1.0.0",
    };

    const clientConfig: A2AClientConfig = {
      endpoint: this.a2aConfig.endpoint,
      credentials: {
        address: this.agentWalletAddress,
        privateKey: this.agentPrivateKey,
        tokenId: this.agentTokenId || 0,
      },
      capabilities,
      autoReconnect: this.a2aConfig.autoReconnect,
      reconnectInterval: this.a2aConfig.reconnectInterval,
      heartbeatInterval: this.a2aConfig.heartbeatInterval,
    };

    this.client = new A2AClient(clientConfig);

    // Set up event handlers
    this.setupEventHandlers();

    // Connect
    await this.client.connect();
    this.connected = true;

    logger.info(`✅ Connected to A2A server: ${this.a2aConfig.endpoint}`);
  }

  /**
   * Set up A2A event handlers
   */
  private setupEventHandlers(): void {
    // Connection events
    this.client!.on(A2AEventType.AGENT_CONNECTED, (data) => {
      logger.info(`Agent connected to A2A: ${data.agentId}`);
      this.connected = true;
    });

    this.client!.on(A2AEventType.AGENT_DISCONNECTED, () => {
      logger.warn("Disconnected from A2A server");
      this.connected = false;
    });

    // Market update events - integrate with runtime providers
    this.client!.on(
      "market_update",
      (data: { marketId: string; prices?: number[]; volume?: string }) => {
        logger.info(`📊 Market update received: ${data.marketId}`);
        
        this.runtime.emitEvent!("a2a.marketUpdate", {
          marketId: data.marketId,
          prices: data.prices,
          volume: data.volume,
          timestamp: Date.now(),
        });
        
        const cacheKey = `a2a.market.${data.marketId}`;
        this.runtime.setCache!(cacheKey, {
          marketId: data.marketId,
          prices: data.prices,
          volume: data.volume,
          timestamp: Date.now(),
        });
      },
    );

    // Coalition events - integrate with runtime
    this.client!.on("coalition_created", (data: { coalitionId: string; [key: string]: unknown }) => {
      logger.info(`🤝 Coalition created: ${data.coalitionId}`);
      
      const { coalitionId, ...restData } = data;
      this.runtime.emitEvent!("a2a.coalitionCreated", {
        coalitionId,
        ...restData,
        timestamp: Date.now(),
      });
    });

    this.client!.on("coalition_message", (data: { coalitionId: string; message?: string; [key: string]: unknown }) => {
      logger.info(`💬 Coalition message received: ${data.coalitionId}`);
      
      const { coalitionId, message, ...restData } = data;
      this.runtime.emitEvent!("a2a.coalitionMessage", {
        coalitionId,
        message,
        ...restData,
        timestamp: Date.now(),
      });
      
      if (message) {
        const memoryId = this.runtime.createRunId();
        const roomId = this.runtime.agentId;
        const memory: Memory = {
          id: memoryId,
          agentId: this.runtime.agentId,
          entityId: this.runtime.agentId,
          roomId,
          content: {
            text: `Coalition ${coalitionId}: ${message}`,
            source: "a2a",
          },
          createdAt: Date.now(),
        };
        this.runtime.createMemory(memory, roomId);
      }
    });

    // Error handling
    this.client!.on("error", (error) => {
      logger.error(`A2A client error: ${error}`);
    });
  }

  /**
   * Get market data via A2A
   */
  async getMarketData(marketId: string): Promise<MarketData> {
    return await this.client!.getMarketData(marketId);
  }

  /**
   * Subscribe to market updates
   */
  async subscribeMarket(marketId: string): Promise<void> {
    await this.client!.subscribeMarket(marketId);
    logger.info(`Subscribed to market updates: ${marketId}`);
  }

  /**
   * Discover other agents
   */
  async discoverAgents(filters?: {
    strategies?: string[];
    minReputation?: number;
    markets?: string[];
  }): Promise<{ agents: AgentProfile[]; total: number }> {
    return await this.client!.discoverAgents(filters);
  }

  /**
   * Share market analysis with other agents
   */
  async shareAnalysis(analysis: {
    marketId: string;
    analyst: string;
    prediction: number;
    confidence: number;
    reasoning: string;
    dataPoints?: Record<string, unknown>;
    timestamp: number;
  }): Promise<void> {
    const analysisWithData: MarketAnalysis = {
      ...analysis,
      dataPoints: (analysis.dataPoints || {}) as Record<string, JsonValue>,
    };
    await this.client!.shareAnalysis(analysisWithData);
    logger.info(`Shared analysis for market: ${analysis.marketId}`);
  }

  /**
   * Check if A2A is connected
   */
  isConnected(): boolean {
    return this.connected && this.client!.isConnected();
  }

  /**
   * Get A2A client instance
   */
  getClient(): A2AClient {
    return this.client!;
  }

  /**
   * Disconnect from A2A server
   */
  async disconnect(): Promise<void> {
    await this.client!.disconnect();
    this.connected = false;
    logger.info("Disconnected from A2A server");
  }

  /**
   * Instance stop method - cleanup
   */
  override async stop(): Promise<void> {
    await this.disconnect();
    this.connected = false;
    this.runtime.logger.info("✅ Babylon A2A Service stopped");
  }

  /**
   * Static stop method - called by ElizaOS
   */
  static override async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info("Stopping BabylonA2AService");
    const service = runtime.getService<BabylonA2AService>(
      BabylonA2AService.serviceType,
    );
    await service?.stop();
  }
}
