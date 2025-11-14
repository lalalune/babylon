/**
 * Trajectory-Aware Market Decision Engine
 * 
 * Wraps MarketDecisionEngine to record all decisions as trajectories for RL training.
 * Can be toggled on/off via environment variable for zero-overhead in production.
 */

import type { MarketDecisionEngine } from '@/engine/MarketDecisionEngine';
import { TrajectoryRecorder } from '@/lib/training/TrajectoryRecorder';
import { getCurrentWindowId } from '@/lib/training/window-utils';
import { logger } from '@/lib/logger';
import type { TradingDecision } from '@/types/market-decisions';
import type { EnvironmentState, Action } from '@/lib/training/types';

export class TrajectoryMarketEngine {
  private engine: MarketDecisionEngine;
  private recorder: TrajectoryRecorder | null = null;
  private trajectoryId: string | null = null;
  private enabled: boolean;
  private samplingRate: number;
  
  constructor(
    engine: MarketDecisionEngine,
    options: {
      enableRecording?: boolean;
      samplingRate?: number;
    } = {}
  ) {
    this.engine = engine;
    
    // Check environment variable for recording flag
    const envEnabled = process.env.RECORD_AGENT_TRAJECTORIES === 'true';
    this.enabled = options.enableRecording ?? envEnabled;
    
    // Sampling rate (1.0 = record everything, 0.5 = record 50%)
    this.samplingRate = options.samplingRate ?? 
      parseFloat(process.env.TRAJECTORY_SAMPLING_RATE || '1.0');
    
    if (this.enabled) {
      this.recorder = new TrajectoryRecorder();
      logger.info('Trajectory recording enabled for market decisions', {
        samplingRate: this.samplingRate
      }, 'TrajectoryMarketEngine');
    }
  }
  
  /**
   * Generate batch decisions with optional trajectory recording
   */
  async generateBatchDecisions(): Promise<TradingDecision[]> {
    // Check if we should record this batch (sampling)
    const shouldRecord = this.enabled && Math.random() < this.samplingRate;
    
    if (shouldRecord && this.recorder) {
      try {
        await this.startRecording();
      } catch (error) {
        logger.warn('Failed to start trajectory recording, continuing without', { error });
      }
    }
    
    // Generate decisions using underlying engine
    const decisions = await this.engine.generateBatchDecisions();
    
    // Record each decision if recording is active
    if (this.trajectoryId && this.recorder) {
      try {
        await this.recordDecisions(decisions);
      } catch (error) {
        logger.warn('Failed to record decisions, continuing anyway', { error });
      }
    }
    
    // End recording
    if (this.trajectoryId && this.recorder) {
      try {
        await this.endRecording(decisions);
      } catch (error) {
        logger.warn('Failed to end trajectory recording', { error });
      }
    }
    
    return decisions;
  }
  
  /**
   * Start a new trajectory recording
   */
  private async startRecording(): Promise<void> {
    if (!this.recorder) return;
    
    const windowId = getCurrentWindowId();
    
    this.trajectoryId = await this.recorder.startTrajectory({
      agentId: 'market-decision-engine',
      scenarioId: `market-decisions-${windowId}`,
      windowId,
      metadata: {
        recordingType: 'market_decisions',
        timestamp: new Date().toISOString(),
      },
    });
    
    logger.debug('Started trajectory recording', { 
      trajectoryId: this.trajectoryId,
      windowId 
    });
  }
  
  /**
   * Record each decision as a step
   */
  private async recordDecisions(decisions: TradingDecision[]): Promise<void> {
    if (!this.recorder || !this.trajectoryId) return;
    
    for (const decision of decisions) {
      // Build environment state
      const envState: EnvironmentState = {
        agentBalance: 0, // Would need pool balance data
        agentPoints: 0,
        agentPnL: 0, // Could calculate from pool history
        openPositions: 0, // Would need position data
        timestamp: Date.now(),
      };
      
      // Start step
      this.recorder.startStep(this.trajectoryId, envState);
      
      // Log LLM call if available (would need to capture this from engine)
      // For now, we'll record the decision reasoning as the LLM output
      if (decision.reasoning) {
        this.recorder.logLLMCall(this.trajectoryId, {
          model: 'market-decision-model',
          purpose: 'action',
          actionType: decision.action,
          systemPrompt: 'You are an NPC making trading decisions in prediction markets.',
          userPrompt: `NPC: ${decision.npcName}, Action: ${decision.action}, Market: ${decision.ticker || decision.marketId || 'unknown'}`,
          response: decision.reasoning,
          reasoning: decision.reasoning,
          temperature: 0.7,
          maxTokens: 1000,
          latencyMs: 0,
        });
      }
      
      // Build action
      const action: Action = {
        actionType: decision.action,
        parameters: {
          npcId: decision.npcId,
          npcName: decision.npcName,
          ticker: decision.ticker,
          marketId: decision.marketId,
          marketType: decision.marketType,
          amount: decision.amount,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
        },
        success: true,
        result: {
          action: decision.action,
          amount: decision.amount,
          market: decision.ticker || decision.marketId || 'unknown',
        },
      };
      
      // Calculate immediate reward (0 for now, will be updated after market resolves)
      const reward = 0;
      
      // Complete step
      this.recorder.completeStep(this.trajectoryId, action, reward);
    }
    
    logger.debug('Recorded decisions', { 
      count: decisions.length,
      trajectoryId: this.trajectoryId 
    });
  }
  
  /**
   * End the trajectory recording
   */
  private async endRecording(decisions: TradingDecision[]): Promise<void> {
    if (!this.recorder || !this.trajectoryId) return;
    
    // Calculate final metrics
    const totalInvested = decisions.reduce((sum, d) => sum + (d.amount || 0), 0);
    
    await this.recorder.endTrajectory(this.trajectoryId, {
      finalBalance: undefined, // Would need pool balance
      finalPnL: undefined, // Will be calculated later when markets resolve
      windowId: getCurrentWindowId(),
      gameKnowledge: {
        // Could add future outcomes here
        actualOutcomes: {},
      },
    });
    
    logger.info('Trajectory recording completed', { 
      trajectoryId: this.trajectoryId,
      decisions: decisions.length,
      totalInvested
    });
    
    this.trajectoryId = null;
  }
}

