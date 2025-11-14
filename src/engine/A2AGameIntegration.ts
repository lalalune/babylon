/**
 * A2A Game Integration
 *
 * Integrates the A2A protocol with the Babylon game engine to enable:
 * - Autonomous agent-to-agent communication
 * - Market data sharing between agents
 * - Coalition formation for coordinated strategies
 * - Distributed prediction market intelligence
 */
import { EventEmitter } from 'events';

import { logger } from '@/lib/logger';

import { getAgent0Client } from '@/agents/agent0/Agent0Client';
import { getUnifiedDiscoveryService } from '@/agents/agent0/UnifiedDiscovery';
import type {
  FeedPost,
  PriceUpdate,
  Question,
  SelectedActor,
} from '@/shared/types';
import { createPortSingleton } from '@/utils/singleton';

import { RegistryClient } from '../a2a/blockchain';
import { A2AWebSocketServer } from '../a2a/server';
import type { A2AServerConfig, AgentConnection } from '../a2a/types';

export interface A2AGameConfig {
  enabled: boolean;
  port?: number;
  host?: string;
  maxConnections?: number;
  enableBlockchain?: boolean;
  rpcUrl?: string;
  identityRegistryAddress?: string;
  reputationSystemAddress?: string;
}

export interface MarketDataBroadcast {
  type: 'market_update';
  timestamp: number;
  questions: Question[];
  priceUpdates: PriceUpdate[];
  activeMarkets: number;
}

export interface AgentAnalysis {
  agentId: string;
  questionId: number;
  prediction: boolean;
  confidence: number;
  reasoning: string;
  timestamp: number;
}

export interface Coalition {
  id: string;
  name: string;
  members: string[];
  strategy: string;
  createdAt: number;
  active: boolean;
}

// Singleton for A2A server instance
const a2aServerSingleton = createPortSingleton<A2AWebSocketServer>(
  'a2aServer',
  'a2aServerPort'
);

const describeError = (error: unknown) =>
  error instanceof Error
    ? { message: error.message, stack: error.stack }
    : { message: String(error) };

export class A2AGameIntegration extends EventEmitter {
  private server?: A2AWebSocketServer;
  private config: Required<A2AGameConfig>;
  private registryClient?: RegistryClient;
  private coalitions: Map<string, Coalition> = new Map();
  private agentAnalyses: Map<number, AgentAnalysis[]> = new Map();

  constructor(config?: A2AGameConfig) {
    super();

    this.config = {
      enabled: config?.enabled ?? false,
      port: config?.port ?? 8081,
      host: config?.host ?? '0.0.0.0',
      maxConnections: config?.maxConnections ?? 1000,
      enableBlockchain: config?.enableBlockchain ?? false,
      rpcUrl: config?.rpcUrl ?? process.env.BASE_SEPOLIA_RPC_URL ?? '',
      identityRegistryAddress:
        config?.identityRegistryAddress ??
        process.env.IDENTITY_REGISTRY_ADDRESS ??
        '',
      reputationSystemAddress:
        config?.reputationSystemAddress ??
        process.env.REPUTATION_SYSTEM_ADDRESS ??
        '',
    };
  }

  /**
   * Initialize the A2A integration
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('A2A integration disabled', undefined, 'A2AGameIntegration');
      return;
    }

    logger.info('INITIALIZING A2A PROTOCOL', undefined, 'A2AGameIntegration');
    logger.info(
      '==============================',
      undefined,
      'A2AGameIntegration'
    );

    // Set up blockchain registry if enabled
    if (this.config.enableBlockchain && this.config.rpcUrl) {
      this.registryClient = new RegistryClient({
        rpcUrl: this.config.rpcUrl,
        identityRegistryAddress: this.config.identityRegistryAddress,
        reputationSystemAddress: this.config.reputationSystemAddress,
      });
      logger.info(
        'Blockchain registry connected',
        undefined,
        'A2AGameIntegration'
      );
    }

    // Initialize Agent0 integration (if enabled)
    let agent0Client = null;
    let unifiedDiscovery = null;

    if (process.env.AGENT0_ENABLED === 'true') {
      try {
        agent0Client = getAgent0Client();
        unifiedDiscovery = getUnifiedDiscoveryService();
        logger.info(
          'Agent0 integration enabled for A2A server',
          undefined,
          'A2AGameIntegration'
        );
      } catch (error) {
        logger.warn(
          'Agent0 integration disabled (missing Agent0 env or failed initialization)',
          describeError(error),
          'A2AGameIntegration'
        );
      }
    }

    // Create A2A WebSocket server
    const serverConfig: A2AServerConfig = {
      port: this.config.port,
      host: this.config.host,
      maxConnections: this.config.maxConnections,
      messageRateLimit: 100,
      authTimeout: 30000,
      enableX402: true,
      enableCoalitions: true,
      logLevel: 'info',
      registryClient: this.registryClient,
      agent0Client: agent0Client ?? undefined,
      unifiedDiscovery: unifiedDiscovery ?? undefined,
    };

    const existing = a2aServerSingleton.getInstance(this.config.port);
    if (existing) {
      logger.info(
        'Reusing existing A2A WebSocket server from singleton',
        undefined,
        'A2AGameIntegration'
      );
      this.server = existing;
      this.setupServerEventHandlers();
      return;
    }

    this.server = new A2AWebSocketServer(serverConfig);
    await this.server.waitForReady();
    this.setupServerEventHandlers();

    logger.info(
      `A2A server listening on ws://${this.config.host}:${this.config.port}`,
      undefined,
      'A2AGameIntegration'
    );
  }

  /**
   * Set up A2A server event handlers
   */
  private setupServerEventHandlers(): void {
    if (!this.server) return;

    this.server.on('agent.connected', (data) => {
      logger.info(
        `Agent connected: ${data.agentId}`,
        undefined,
        'A2AGameIntegration'
      );
      this.emit('agent.connected', data);
    });

    this.server.on('agent.disconnected', (data) => {
      logger.info(
        `Agent disconnected: ${data.agentId}`,
        undefined,
        'A2AGameIntegration'
      );
      this.emit('agent.disconnected', data);
    });

    // Handle agent analysis sharing
    this.server.on('message', (data) => {
      if (data.method === 'a2a.shareAnalysis') {
        this.handleAnalysisShare(data);
      } else if (data.method === 'a2a.proposeCoalition') {
        this.handleCoalitionProposal(data);
      }
    });
  }

  /**
   * Broadcast market data to all connected agents
   */
  broadcastMarketData(
    questions: Question[],
    priceUpdates: PriceUpdate[]
  ): void {
    if (!this.server) return;

    const broadcast: MarketDataBroadcast = {
      type: 'market_update',
      timestamp: Date.now(),
      questions: questions.filter((q) => q.status === 'active'),
      priceUpdates: priceUpdates.slice(-10), // Last 10 updates
      activeMarkets: questions.filter((q) => q.status === 'active').length,
    };

    this.server.broadcastAll({
      jsonrpc: '2.0',
      method: 'a2a.marketUpdate',
      params: broadcast,
    });
  }

  /**
   * Broadcast game events to agents
   */
  broadcastGameEvent(event: {
    type: string;
    description: string;
    relatedQuestion?: number;
    timestamp: number;
  }): void {
    if (!this.server) return;

    this.server.broadcastAll({
      jsonrpc: '2.0',
      method: 'a2a.gameEvent',
      params: event,
    });
  }

  /**
   * Handle agent analysis sharing
   */
  private handleAnalysisShare(data: {
    agentId: string;
    params: {
      questionId: number;
      prediction: boolean;
      confidence: number;
      reasoning: string;
    };
  }): void {
    const analysis: AgentAnalysis = {
      agentId: data.agentId,
      questionId: data.params.questionId,
      prediction: data.params.prediction,
      confidence: data.params.confidence,
      reasoning: data.params.reasoning,
      timestamp: Date.now(),
    };

    // Store analysis
    const questionAnalyses = this.agentAnalyses.get(analysis.questionId) || [];
    questionAnalyses.push(analysis);
    this.agentAnalyses.set(analysis.questionId, questionAnalyses);

    // Emit event for game engine to process
    this.emit('agent.analysis', analysis);

    logger.info(
      `Agent ${analysis.agentId} shared analysis for question ${analysis.questionId}`,
      undefined,
      'A2AGameIntegration'
    );
  }

  /**
   * Broadcast actor updates to agents
   */
  broadcastActorUpdate(actor: SelectedActor): void {
    if (!this.server) return;
    this.server.broadcastAll({
      jsonrpc: '2.0',
      method: 'a2a.actorUpdate',
      params: { actor, timestamp: Date.now() },
    });
  }

  /**
   * Broadcast feed post to agents
   */
  broadcastFeedPost(post: FeedPost): void {
    if (!this.server) return;
    this.server.broadcastAll({
      jsonrpc: '2.0',
      method: 'a2a.feedPost',
      params: { post, timestamp: Date.now() },
    });
  }

  /**
   * Handle coalition proposals
   */
  private handleCoalitionProposal(data: {
    agentId: string;
    params: {
      name: string;
      invitedAgents: string[];
      strategy: string;
    };
  }): void {
    const coalition: Coalition = {
      id: `coalition-${Date.now()}`,
      name: data.params.name,
      members: [data.agentId, ...data.params.invitedAgents],
      strategy: data.params.strategy,
      createdAt: Date.now(),
      active: true,
    };

    this.coalitions.set(coalition.id, coalition);

    // Broadcast to invited agents
    this.server?.broadcast(data.params.invitedAgents, {
      jsonrpc: '2.0',
      method: 'a2a.coalitionInvite',
      params: {
        coalitionId: coalition.id,
        proposer: data.agentId,
        name: coalition.name,
        strategy: coalition.strategy,
      },
    });

    this.emit('coalition.created', coalition);
    logger.info(
      `Coalition "${coalition.name}" created by ${data.agentId}`,
      undefined,
      'A2AGameIntegration'
    );
  }

  /**
   * Get agent analyses for a specific question
   */
  getQuestionAnalyses(questionId: number): AgentAnalysis[] {
    return this.agentAnalyses.get(questionId) || [];
  }

  /**
   * Get consensus prediction for a question based on agent analyses
   */
  getConsensusPrediction(questionId: number): {
    prediction: boolean;
    confidence: number;
    agentCount: number;
  } | null {
    const analyses = this.getQuestionAnalyses(questionId);
    if (analyses.length === 0) return null;

    const yesVotes = analyses.filter((a) => a.prediction).length;
    const totalVotes = analyses.length;
    const avgConfidence =
      analyses.reduce((sum, a) => sum + a.confidence, 0) / totalVotes;

    return {
      prediction: yesVotes > totalVotes / 2,
      confidence: avgConfidence,
      agentCount: totalVotes,
    };
  }

  /**
   * Get all active coalitions
   */
  getActiveCoalitions(): Coalition[] {
    return Array.from(this.coalitions.values()).filter((c) => c.active);
  }

  /**
   * Get connected agents
   */
  getConnectedAgents(): AgentConnection[] {
    return this.server?.getConnectedAgents() || [];
  }

  /**
   * Get agent count
   */
  getAgentCount(): number {
    return this.getConnectedAgents().length;
  }

  /**
   * Shutdown the A2A integration
   */
  async shutdown(): Promise<void> {
    if (!this.server) return;

    logger.info('Shutting down A2A server...', undefined, 'A2AGameIntegration');
    await this.server.close();
    logger.info('A2A server closed', undefined, 'A2AGameIntegration');
  }

  /**
   * Get integration status
   */
  getStatus(): {
    enabled: boolean;
    agentCount: number;
    coalitionCount: number;
    analysesCount: number;
  } {
    return {
      enabled: this.config.enabled,
      agentCount: this.getAgentCount(),
      coalitionCount: this.getActiveCoalitions().length,
      analysesCount: Array.from(this.agentAnalyses.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
    };
  }
}
