/**
 * TypeScript types for Training Pipeline
 * 
 * Proper types to replace 'any' usage throughout the training system
 */

import type { Trajectory, TrainingBatch, TrainedModel, LlmCallLog, Prisma } from '@prisma/client';

// Re-export Prisma types for convenience
export type { Trajectory, TrainingBatch, TrainedModel, LlmCallLog };
export type { Prisma };

// Trajectory Step types
// Note: These are simplified versions for training pipeline.
// For full trajectory recording, see @/lib/agents/plugins/plugin-trajectory-logger/src/types
export interface TrajectoryStep {
  stepNumber: number;
  timestamp: number;
  environmentState: EnvironmentState;
  providerAccesses: ProviderAccess[];
  llmCalls: LLMCall[];
  action: Action;
  reward: number;
}

export interface EnvironmentState {
  agentBalance: number;
  agentPnL: number;
  openPositions: number;
  activeMarkets?: number;
  [key: string]: number | string | boolean | null | undefined;
}

export interface ProviderAccess {
  providerName: string;
  data: Record<string, unknown>;
  purpose: string;
}

export interface LLMCall {
  model: string;
  modelVersion?: string; // Trained model version if using RL model
  systemPrompt: string;
  userPrompt: string;
  response: string;
  reasoning?: string;
  temperature: number;
  maxTokens: number;
  latencyMs?: number;
  purpose: 'action' | 'reasoning' | 'evaluation' | 'response';
  actionType?: string;
}

export interface Action {
  actionType: string;
  parameters: Record<string, unknown>;
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  reasoning?: string;
  // Correctness tracking (for RL training)
  correctness?: {
    // Prediction market correctness
    predictionCorrect?: boolean; // Was the prediction correct?
    actualOutcome?: boolean; // Actual market outcome (YES=true, NO=false)
    predictedOutcome?: boolean; // What agent predicted
    
    // Perp trade correctness
    perpCorrect?: boolean; // Was the perp trade correct?
    sentimentAtTrade?: number; // Sentiment at time of trade (-1 to 1)
    priceChange?: number; // Actual price change after trade
    expectedDirection?: 'up' | 'down'; // Expected direction based on sentiment
    
    // Sentiment analysis accuracy
    sentimentAccuracy?: number; // How accurate was sentiment reading (0-1)
    sentimentAtTime?: number; // Sentiment value at time of action
    actualSentiment?: number; // Actual sentiment (if known)
  };
}

// Parsed trajectory data (from JSON fields)
export interface ParsedTrajectoryData {
  steps: TrajectoryStep[];
  rewardComponents: Record<string, number>;
  metrics: TrajectoryMetrics;
  metadata: TrajectoryMetadata;
}

export interface TrajectoryMetrics {
  episodeLength: number;
  finalStatus: string;
  finalBalance?: number;
  finalPnL?: number;
  tradesExecuted?: number;
  postsCreated?: number;
  errorCount?: number;
}

export interface TrajectoryMetadata {
  isTrainingData: boolean;
  gameKnowledge?: {
    trueProbabilities?: Record<string, number>;
    actualOutcomes?: Record<string, unknown>;
    futureOutcomes?: Record<string, unknown>;
  };
}

// Scenario group result (from Prisma groupBy)
export interface ScenarioGroupResult {
  scenarioId: string | null;
  _count: number;
}

// Training readiness stats
export interface TrainingReadinessStats {
  totalTrajectories: number;
  unscoredTrajectories: number;
  scenarioGroups: number;
  dataQuality: number;
}

// Training readiness result
export interface TrainingReadinessResult {
  ready: boolean;
  reason: string;
  stats: TrainingReadinessStats;
}

// Training trigger options
export interface TrainingTriggerOptions {
  force?: boolean;
  batchSize?: number;
}

// Training trigger result
export interface TrainingTriggerResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

// Training monitoring status
export interface TrainingMonitoringStatus {
  status: string;
  progress?: number;
  eta?: number;
  error?: string;
}

// Automation status
export interface AutomationStatus {
  dataCollection: {
    last24h: number;
    last7d: number;
    ratePerHour: number;
  };
  training: {
    currentJob: string | null;
    lastCompleted: Date | null;
    nextScheduled: Date | null;
  };
  models: {
    latest: string | null;
    deployed: number;
    training: number;
  };
  health: {
    database: boolean;
    storage: boolean;
    wandb: boolean;
  };
}

// Automation configuration
export interface AutomationConfig {
  minTrajectoriesForTraining: number;
  minGroupSize: number;
  dataQualityThreshold: number;
  autoTriggerTraining: boolean;
  trainingInterval: number;
  baseModel: string;
  modelNamePrefix: string;
  modelStoragePath: string;
  dataStoragePath: string;
  wandbProject?: string;
  wandbApiKey?: string;
}

// Full trajectory with all parsed data
export interface TrajectoryWithParsedData extends Trajectory {
  parsed: ParsedTrajectoryData;
}

// Helper type for trajectory queries
export type TrajectorySelect = Prisma.TrajectorySelect;
export type TrajectoryWhereInput = Prisma.TrajectoryWhereInput;
export type TrajectoryOrderByInput = Prisma.TrajectoryOrderByWithRelationInput;

