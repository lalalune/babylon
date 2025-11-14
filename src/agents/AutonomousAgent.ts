/**
 * Autonomous Agent
 *
 * Autonomous agent that connects to the Babylon game via A2A protocol.
 * Can analyze markets, make predictions, and coordinate with other agents.
 */

import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { A2AClient } from '../a2a/client/a2a-client';
import { BabylonLLMClient } from '../generator/llm/openai-client';
import { A2AEventType } from '../a2a/types';
import type {
  AgentCapabilities,
  MarketAnalysis,
  CoalitionProposal
} from '../a2a/types';
import type { Question, WorldEvent } from '@/shared/types';
import { logger } from '@/lib/logger';

export interface AgentConfig {
  name: string;
  personality: string;
  strategies: string[];
  riskTolerance: number; // 0-1
  analysisDepth: 'quick' | 'moderate' | 'deep';
  a2aEndpoint: string;
  privateKey?: string; // Optional, will generate if not provided
}

export interface AgentAnalysisResult {
  questionId: number;
  prediction: boolean;
  confidence: number;
  reasoning: string;
  timestamp: number;
}

/**
 * Event types emitted by AutonomousAgent
 */
export interface AutonomousAgentEvents {
  connected: (data: { agentId: string }) => void;
  disconnected: () => void;
  marketUpdate: (data: { questions: Question[]; priceUpdates?: Array<{ organizationId: string; newPrice: number; timestamp: string }>; timestamp?: number }) => void;
  gameEvent: (event: WorldEvent) => void;
  coalitionJoined: (invite: CoalitionProposal) => void;
  analysisComplete: (analysis: AgentAnalysisResult) => void;
  error: (error: Error) => void;
}

export class AutonomousAgent extends EventEmitter {
  private config: AgentConfig;
  private a2aClient: A2AClient;
  private llm: BabylonLLMClient;
  private wallet: ethers.Wallet | ethers.HDNodeWallet;
  private activeQuestions: Map<string | number, Question> = new Map();
  private analyses: Map<string | number, AgentAnalysisResult> = new Map();
  private coalitions: Set<string> = new Set();
  private isConnected = false;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.llm = new BabylonLLMClient();

    // Create or use provided wallet
    this.wallet = config.privateKey
      ? new ethers.Wallet(config.privateKey)
      : ethers.Wallet.createRandom();

    // Create A2A client
    const capabilities: AgentCapabilities = {
      strategies: config.strategies,
      markets: ['prediction'],
      actions: ['analyze', 'predict', 'coordinate'],
      version: '1.0.0'
    };

    this.a2aClient = new A2AClient({
      endpoint: config.a2aEndpoint,
      credentials: {
        address: this.wallet.address,
        privateKey: this.wallet.privateKey,
        tokenId: 0 // Could be assigned from NFT registry
      },
      capabilities,
      autoReconnect: true,
      reconnectInterval: 5000,
      heartbeatInterval: 30000
    });

    this.setupEventHandlers();
  }

  /**
   * Setup A2A client event handlers
   */
  private setupEventHandlers(): void {
    // Connection events
    this.a2aClient.on(A2AEventType.AGENT_CONNECTED, (data) => {
      this.isConnected = true;
      logger.info(`${this.config.name} connected as ${data.agentId}`, { agentId: data.agentId }, 'AutonomousAgent');
      this.emit('connected', data);
    });

    this.a2aClient.on(A2AEventType.AGENT_DISCONNECTED, () => {
      this.isConnected = false;
      logger.info(`${this.config.name} disconnected`, undefined, 'AutonomousAgent');
      this.emit('disconnected');
    });

    // Market data updates
    this.a2aClient.on('notification', async (notification) => {
      if (notification.method === 'a2a.marketUpdate') {
        await this.handleMarketUpdate(notification.params);
      } else if (notification.method === 'a2a.gameEvent') {
        await this.handleGameEvent(notification.params);
      } else if (notification.method === 'a2a.coalitionInvite') {
        await this.handleCoalitionInvite(notification.params);
      }
    });

    this.a2aClient.on('error', (error) => {
      logger.error(`${this.config.name} error: ${error.message}`, { error }, 'AutonomousAgent');
      this.emit('error', error);
    });
  }

  /**
   * Connect to the A2A server
   */
  async connect(): Promise<void> {
    await this.a2aClient.connect();
  }

  /**
   * Disconnect from the A2A server
   */
  async disconnect(): Promise<void> {
    await this.a2aClient.disconnect();
    this.isConnected = false;
  }

  /**
   * Handle market data update
   */
  private async handleMarketUpdate(data: {
    questions: Question[];
    priceUpdates?: Array<{ organizationId: string; newPrice: number; timestamp: string }>;
    timestamp?: number;
  }): Promise<void> {
    const { questions, priceUpdates, timestamp } = data;

    // Update active questions
    for (const question of questions) {
      this.activeQuestions.set(question.id, question);
    }

    // Analyze new or updated questions
    for (const question of questions) {
      if (!this.analyses.has(String(question.id))) {
        await this.analyzeQuestion(question);
      }
    }

    this.emit('marketUpdate', { questions, priceUpdates, timestamp });
  }

  /**
   * Handle game event
   */
  private async handleGameEvent(event: WorldEvent): Promise<void> {
    logger.debug(`${this.config.name} received event: ${event.type}`, { 
      eventType: event.type,
      eventId: event.id,
      relatedQuestion: event.relatedQuestion,
      description: typeof event.description === 'string' ? event.description : (event.description as { text?: string })?.text || ''
    }, 'AutonomousAgent');

    // If event affects a question we're tracking, re-analyze
    if (event.relatedQuestion != null) {
      const relatedQuestionId = event.relatedQuestion;
      if (this.activeQuestions.has(relatedQuestionId)) {
        const question = this.activeQuestions.get(relatedQuestionId)!;
        await this.analyzeQuestion(question);
      }
    }

    this.emit('gameEvent', event);
  }

  /**
   * Handle coalition invite
   */
  private async handleCoalitionInvite(invite: CoalitionProposal): Promise<void> {
    logger.info(`${this.config.name} invited to coalition: ${invite.coalitionId}`, { 
      coalitionId: invite.coalitionId,
      strategy: invite.strategy,
      targetMarket: invite.targetMarket
    }, 'AutonomousAgent');

    const shouldJoin = this.config.strategies.includes(invite.strategy);

    if (shouldJoin) {
      const result = await this.a2aClient.joinCoalition(invite.coalitionId);
      if (result.joined) {
        this.coalitions.add(invite.coalitionId);
        logger.info(`${this.config.name} joined coalition: ${invite.coalitionId}`, { coalitionId: invite.coalitionId }, 'AutonomousAgent');
        this.emit('coalitionJoined', invite);
      }
    }
  }

  /**
   * Analyze a question using LLM
   */
  private async analyzeQuestion(question: Question): Promise<void> {
    const prompt = this.buildAnalysisPrompt(question);

    interface AnalysisResponse {
      prediction: boolean;
      confidence: number;
      reasoning: string;
    }

    const response = await this.llm.generateJSON<AnalysisResponse>(
      prompt,
      {
        required: ['prediction', 'confidence', 'reasoning'],
        properties: {
          prediction: { type: 'boolean' },
          confidence: { type: 'number' },
          reasoning: { type: 'string' }
        }
      },
      {
        temperature: 0.7,
        maxTokens: 500
      }
    );

    const questionIdNumber = typeof question.id === 'number' ? question.id : parseInt(String(question.id), 10);
    const analysis: AgentAnalysisResult = {
      questionId: questionIdNumber,
      prediction: response.prediction,
      confidence: response.confidence,
      reasoning: response.reasoning,
      timestamp: Date.now()
    };
    
    this.analyses.set(question.id, analysis);

    if (analysis.confidence > 0.7) {
      await this.shareAnalysis(analysis);
    }

    this.emit('analysisComplete', analysis);
  }

  /**
   * Build analysis prompt for LLM
   */
  private buildAnalysisPrompt(question: Question): string {
    return `You are ${this.config.name}, an autonomous prediction market agent with the following characteristics:

Personality: ${this.config.personality}
Strategies: ${this.config.strategies.join(', ')}
Risk Tolerance: ${this.config.riskTolerance}

Analyze this prediction market question:
Question: ${question.text}
Question ID: ${question.id}
${question.status ? `Status: ${question.status}` : ''}
${question.createdDate ? `Created: ${new Date(question.createdDate).toLocaleString()}` : ''}
${question.resolutionDate ? `Resolves: ${new Date(question.resolutionDate).toLocaleString()}` : ''}

Provide your analysis as JSON with the following fields:
- prediction: boolean (true for YES, false for NO)
- confidence: number between 0.0 and 1.0
- reasoning: string with brief explanation

Be concise and analytical.`;
  }

  /**
   * Share analysis with other agents via A2A
   */
  private async shareAnalysis(analysis: AgentAnalysisResult): Promise<void> {
    const marketAnalysis: MarketAnalysis = {
      marketId: `question-${analysis.questionId}`,
      analyst: this.a2aClient.getAgentId()!,
      prediction: analysis.prediction ? 1 : 0,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      dataPoints: {},
      timestamp: analysis.timestamp
    };

    await this.a2aClient.shareAnalysis(marketAnalysis);
    logger.info(`${this.config.name} shared analysis for question ${analysis.questionId}`, { questionId: analysis.questionId }, 'AutonomousAgent');
  }

  /**
   * Propose a coalition to coordinate with other agents
   */
  async proposeCoalition(
    name: string,
    targetMarket: string,
    minMembers: number = 2,
    maxMembers: number = 5
  ): Promise<string> {
    const strategy = this.config.strategies[0]!;
    const result = await this.a2aClient.proposeCoalition(
      name,
      targetMarket,
      strategy,
      minMembers,
      maxMembers
    );

    this.coalitions.add(result.coalitionId);
    logger.info(`${this.config.name} created coalition: ${name}`, { coalitionId: result.coalitionId, name }, 'AutonomousAgent');
    return result.coalitionId;
  }

  /**
   * Get agent status
   */
  getStatus(): {
    name: string;
    connected: boolean;
    agentId: string | null;
    address: string;
    questionsTracked: number;
    analysesComplete: number;
    coalitions: number;
  } {
    return {
      name: this.config.name,
      connected: this.isConnected,
      agentId: this.a2aClient.getAgentId(),
      address: this.wallet.address,
      questionsTracked: this.activeQuestions.size,
      analysesComplete: this.analyses.size,
      coalitions: this.coalitions.size
    };
  }

  /**
   * Get analysis for a specific question
   */
  getAnalysis(questionId: string | number): AgentAnalysisResult | undefined {
    return this.analyses.get(questionId);
  }

  /**
   * Get all analyses
   */
  getAllAnalyses(): AgentAnalysisResult[] {
    return Array.from(this.analyses.values());
  }
}
