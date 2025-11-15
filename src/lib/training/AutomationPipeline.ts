/**
 * Training Automation Pipeline
 * 
 * Fully automated RL training pipeline:
 * 1. Monitor data collection
 * 2. Trigger training when ready
 * 3. Score with RULER
 * 4. Export data
 * 5. Train model
 * 6. Deploy new version
 * 7. Monitor performance
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { exportGroupedForGRPO } from '../agents/plugins/plugin-trajectory-logger/src/export';
import path from 'node:path';
import fs from 'node:fs/promises';
import type {
  AutomationConfig,
  TrainingReadinessResult,
  TrainingTriggerOptions,
  TrainingTriggerResult,
  TrainingMonitoringStatus,
  AutomationStatus,
  TrajectoryStep,
} from './types';

export type { AutomationConfig };

export class AutomationPipeline {
  private config: AutomationConfig;
  private currentTrainingJob: string | null = null;

  constructor(config: Partial<AutomationConfig> = {}) {
    const envMinTrajectories = parseInt(process.env.TRAINING_MIN_TRAJECTORIES ?? '', 10);
    const envMinGroupSize = parseInt(process.env.TRAINING_MIN_GROUP_SIZE ?? '', 10);

    this.config = {
      minTrajectoriesForTraining: config.minTrajectoriesForTraining
        ?? (Number.isFinite(envMinTrajectories) && envMinTrajectories > 0 ? envMinTrajectories : 1000),
      minGroupSize: config.minGroupSize
        ?? (Number.isFinite(envMinGroupSize) && envMinGroupSize > 0 ? envMinGroupSize : 10),
      dataQualityThreshold: config.dataQualityThreshold ?? 0.95,
      autoTriggerTraining: config.autoTriggerTraining !== false,
      trainingInterval: config.trainingInterval || 24, // Daily by default
      baseModel: config.baseModel || 'OpenPipe/Qwen3-14B-Instruct',
      modelNamePrefix: config.modelNamePrefix || 'babylon-agent',
      modelStoragePath: config.modelStoragePath || path.resolve(process.cwd(), 'storage/models'),
      dataStoragePath: config.dataStoragePath || path.resolve(process.cwd(), 'storage/training-data'),
      wandbProject: config.wandbProject || process.env.WANDB_PROJECT,
      wandbApiKey: config.wandbApiKey || process.env.WANDB_API_KEY
    };
  }

  /**
   * Check if we're ready to train
   */
  async checkTrainingReadiness(): Promise<TrainingReadinessResult> {
    // Count unscored trajectories
    const unscored = await prisma.trajectory.count({
      where: {
        isTrainingData: true,
        usedInTraining: false,
        aiJudgeReward: null
      }
    });

    // Get scenario groups
    const scenarios = await prisma.trajectory.groupBy({
      by: ['scenarioId'],
      where: {
        isTrainingData: true,
        usedInTraining: false,
        scenarioId: { not: null }
      },
      _count: true
    });

    const validGroups = scenarios.filter((s: { _count: number }) => s._count >= this.config.minGroupSize);

    // Calculate data quality
    const quality = await this.calculateDataQuality();

    const stats = {
      totalTrajectories: unscored,
      unscoredTrajectories: unscored,
      scenarioGroups: validGroups.length,
      dataQuality: quality
    };

    // Check if ready
    if (unscored < this.config.minTrajectoriesForTraining) {
      return {
        ready: false,
        reason: `Need ${this.config.minTrajectoriesForTraining - unscored} more trajectories`,
        stats
      };
    }

    if (validGroups.length < 10) {
      return {
        ready: false,
        reason: `Need more scenario groups (${validGroups.length}/10 minimum)`,
        stats
      };
    }

    if (quality < this.config.dataQualityThreshold) {
      return {
        ready: false,
        reason: `Data quality too low (${(quality * 100).toFixed(1)}% < ${this.config.dataQualityThreshold * 100}%)`,
        stats
      };
    }

    return {
      ready: true,
      reason: 'Ready to train!',
      stats
    };
  }

  /**
   * Calculate data quality score
   */
  private async calculateDataQuality(): Promise<number> {
    const sample = await prisma.trajectory.findMany({
      where: {
        isTrainingData: true,
        usedInTraining: false
      },
      take: 50,
      orderBy: { createdAt: 'desc' }
    });

    if (sample.length === 0) return 0;

    let qualityScore = 0;
    let totalChecks = 0;

    for (const traj of sample) {
      const steps: TrajectoryStep[] = JSON.parse(traj.stepsJson);
      
      // Check 1: Has steps
      totalChecks++;
      if (steps.length > 0) qualityScore++;

      // Check 2: Steps have LLM calls
      totalChecks++;
      const hasLLMCalls = steps.every((s) => s.llmCalls && Array.isArray(s.llmCalls) && s.llmCalls.length > 0);
      if (hasLLMCalls) qualityScore++;

      // Check 3: LLM calls have substantial prompts
      totalChecks++;
      const hasGoodPrompts = steps.every((s) => 
        Array.isArray(s.llmCalls) && s.llmCalls.every((llm) => 
          llm.systemPrompt && llm.systemPrompt.length > 50 &&
          llm.userPrompt && llm.userPrompt.length > 100
        )
      );
      if (hasGoodPrompts) qualityScore++;

      // Check 4: Has provider accesses
      totalChecks++;
      const hasProviders = steps.some((s) => s.providerAccesses && Array.isArray(s.providerAccesses) && s.providerAccesses.length > 0);
      if (hasProviders) qualityScore++;

      // Check 5: Actions have results
      totalChecks++;
      const hasResults = steps.every((s) => s.action && (s.action.result || s.action.error));
      if (hasResults) qualityScore++;
    }

    return qualityScore / totalChecks;
  }

  /**
   * Trigger training job
   */
  async triggerTraining(options: TrainingTriggerOptions = {}): Promise<TrainingTriggerResult> {
    // Check readiness
    const readiness = await this.checkTrainingReadiness();
    
    if (!readiness.ready && !options.force) {
      return {
        success: false,
        error: readiness.reason
      };
    }

    // Prepare data
    logger.info('Preparing training data...', readiness.stats);
    
    const batchId = `batch-${Date.now()}`;
    // Use standardized window ID format (YYYY-MM-DDTHH:00)
    const { getCurrentWindowId } = await import('./window-utils');
    const windowId = getCurrentWindowId();

    // Export trajectories
    const exportResult = await exportGroupedForGRPO({
      datasetName: `${this.config.modelNamePrefix}-${batchId}`,
      maxTrajectories: options.batchSize || readiness.stats.totalTrajectories,
      includeJudged: false // Will score with RULER
    });

    if (!exportResult.success) {
      return {
        success: false,
        error: 'Export failed: ' + exportResult.error
      };
    }

    // Create training batch record
    const nextVersion = await this.getNextModelVersion();
    
    const batch = await prisma.trainingBatch.create({
      data: {
        id: batchId,
        batchId,
        scenarioId: windowId,
        baseModel: this.config.baseModel,
        modelVersion: nextVersion,
        trajectoryIds: JSON.stringify(await this.getTrajectoryIds(options.batchSize)),
        rewardsJson: JSON.stringify([]),
        status: 'pending',
        createdAt: new Date()
      }
    });

    // Update batch status to 'pending' (will be updated to 'training' by Python script)
    await prisma.trainingBatch.update({
      where: { batchId },
      data: { status: 'pending' }
    });

    // Trigger Python training script
    const pythonScript = path.resolve(process.cwd(), 'python/src/training/babylon_trainer.py');
    const spawn = await import('child_process');
    
    // Set environment variables for Python script
    const env = {
      ...process.env,
      MODE: 'single',
      BATCH_ID: batchId,
      MODEL_VERSION: nextVersion,
      WINDOW_ID: windowId,
      WANDB_PROJECT: this.config.wandbProject || 'babylon-training',
      DATABASE_URL: process.env.DATABASE_URL || '',
      TRAIN_RL_LOCAL: 'true'
    };
    
    // Use python3 if available, fallback to python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    const trainingProcess = spawn.spawn(pythonCmd, [pythonScript], {
      detached: false, // Keep attached to see output
      stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout/stderr for debugging
      env
    });
    
    // Log output for debugging
    trainingProcess.stdout?.on('data', (data: Buffer) => {
      logger.info('Training stdout', { output: data.toString().trim() });
    });
    
    trainingProcess.stderr?.on('data', (data: Buffer) => {
      logger.warn('Training stderr', { output: data.toString().trim() });
    });
    
    trainingProcess.on('error', (error: Error) => {
      logger.error('Training process error', { error: error.message });
      // Update batch status to failed
      prisma.trainingBatch.update({
        where: { batchId },
        data: { 
          status: 'failed',
          error: `Process spawn failed: ${error.message}`
        }
      }).catch((err) => logger.error('Failed to update batch status', { error: err }));
    });

    trainingProcess.unref();

    this.currentTrainingJob = batch.id;

    logger.info('Training job triggered', {
      batchId: batch.id,
      version: nextVersion,
      trajectories: exportResult.trajectoriesExported
    });

    return {
      success: true,
      jobId: batch.id
    };
  }

  /**
   * Get next model version
   */
  private async getNextModelVersion(): Promise<string> {
    const latestModel = await prisma.trainedModel.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    if (!latestModel) {
      return 'v1.0.0';
    }

    // Increment patch version
    const [major, minor, patch] = latestModel.version.substring(1).split('.').map(Number);
    return `v${major}.${minor}.${patch! + 1}`;
  }

  /**
   * Get trajectory IDs for training
   */
  private async getTrajectoryIds(limit?: number): Promise<string[]> {
    const trajectories = await prisma.trajectory.findMany({
      where: {
        isTrainingData: true,
        usedInTraining: false
      },
      select: { trajectoryId: true },
      take: limit,
      orderBy: { createdAt: 'asc' }
    });

    return trajectories.map((t: { trajectoryId: string }) => t.trajectoryId);
  }

  /**
   * Monitor training job
   */
  async monitorTraining(batchId: string): Promise<TrainingMonitoringStatus> {
    const batch = await prisma.trainingBatch.findUnique({
      where: { batchId }
    });

    if (!batch) {
      return { status: 'not_found' };
    }

    // Check if Python process is still running
    // In production, this would check actual training status from W&B or logs
    
    return {
      status: batch.status,
      progress: batch.status === 'training' ? 0.5 : batch.status === 'completed' ? 1.0 : 0,
      eta: batch.status === 'training' ? 1800000 : undefined, // 30 min estimate
      error: batch.error || undefined
    };
  }

  /**
   * Automation loop (called by cron)
   */
  async runAutomationCycle(): Promise<void> {
    logger.info('Running automation cycle');

    // Check if training is already running
    if (this.currentTrainingJob) {
      const status = await this.monitorTraining(this.currentTrainingJob);
      if (status.status === 'completed') {
        // Deploy model (Python script already created model record)
        await this.deployModel(this.currentTrainingJob);
        this.currentTrainingJob = null;
      } else if (status.status === 'failed') {
        logger.error('Training job failed', { batchId: this.currentTrainingJob });
        this.currentTrainingJob = null;
      }
      return;
    }

    // Check for newly completed batches (Python script may have completed)
    // Check last 24 hours to catch long-running training jobs
    const newlyCompleted = await prisma.trainingBatch.findFirst({
      where: {
        status: 'completed',
        completedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { completedAt: 'desc' }
    });

    // Check if this batch has already been deployed
    if (newlyCompleted) {
      const existingModel = await prisma.trainedModel.findFirst({
        where: {
          trainingBatch: newlyCompleted.batchId,
          status: 'deployed'
        }
      });

      if (existingModel) {
        return; // Skip if already deployed
      }
      
      logger.info('Found newly completed training batch', { batchId: newlyCompleted.batchId });
      await this.deployModel(newlyCompleted.batchId);
    }

    // Check if we should trigger training
    const readiness = await this.checkTrainingReadiness();
    
    if (readiness.ready && this.config.autoTriggerTraining) {
      // Check if enough time has passed since last training
      const lastTraining = await prisma.trainingBatch.findFirst({
        where: { status: 'completed' },
        orderBy: { completedAt: 'desc' }
      });

      const hoursSinceLastTraining = lastTraining
        ? (Date.now() - lastTraining.completedAt!.getTime()) / (1000 * 60 * 60)
        : 999;

      if (hoursSinceLastTraining >= this.config.trainingInterval) {
        logger.info('Triggering automatic training', readiness.stats);
        await this.triggerTraining();
      }
    }

    // Track market outcomes for recent windows (prerequisite for reward backpropagation)
    try {
      const { MarketOutcomesTracker } = await import('./MarketOutcomesTracker');
      const outcomesTracker = new MarketOutcomesTracker();
      const synced = await outcomesTracker.syncRecentWindows(24); // Sync last 24 hours
      if (synced > 0) {
        logger.info('Synced market outcomes for windows', { windowsSynced: synced });
      }
    } catch (error) {
      logger.warn('Market outcomes tracking failed', { error: error instanceof Error ? error.message : String(error) });
    }

    // Update rewards for windows with known outcomes (reward backpropagation)
    try {
      const { rewardBackpropagationService } = await import('./RewardBackpropagationService');
      const processed = await rewardBackpropagationService.processPendingWindows();
      if (processed > 0) {
        logger.info('Updated rewards for trajectories', { windowsProcessed: processed });
      }
    } catch (error) {
      logger.warn('Reward backpropagation failed', { error: error instanceof Error ? error.message : String(error) });
    }

    // Score trajectories using RULER framework
    try {
      const { rulerScoringService } = await import('./RulerScoringService');
      // Score trajectories from recent windows (last 24 hours)
      
      // Score current window and previous windows
      for (let hoursAgo = 0; hoursAgo < 24; hoursAgo++) {
        const windowDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
        const windowId = windowDate.toISOString().slice(0, 13) + ':00';
        
        try {
          const scored = await rulerScoringService.scoreWindow(windowId);
          if (scored > 0) {
            logger.info('Scored trajectories with RULER', { windowId, scored });
          }
        } catch (error) {
          logger.warn('RULER scoring failed for window', { 
            windowId, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
    } catch (error) {
      logger.warn('RULER scoring failed', { error: error instanceof Error ? error.message : String(error) });
    }

    // Health checks
    await this.runHealthChecks();
  }

  /**
   * Deploy trained model
   * Note: Model is already created by Python script, this just marks trajectories as used
   */
  private async deployModel(batchId: string): Promise<void> {
    const batch = await prisma.trainingBatch.findUnique({
      where: { batchId }
    });

    if (!batch) {
      logger.warn('Batch not found for deployment', { batchId });
      return;
    }

    // Check if model was created by Python script
    const model = await prisma.trainedModel.findFirst({
      where: {
        trainingBatch: batch.id,
        status: 'ready'
      }
    });

    if (!model) {
      logger.warn('Model not found for batch', { batchId });
      return;
    }

    logger.info('Deploying model', {
      version: batch.modelVersion,
      modelId: model.modelId,
      batchId
    });

    // Mark trajectories as used
    const trajectoryIds = JSON.parse(batch.trajectoryIds);
    await prisma.trajectory.updateMany({
      where: {
        trajectoryId: { in: trajectoryIds }
      },
      data: {
        usedInTraining: true,
        trainedInBatch: batch.id
      }
    });

    // Update model status to deployed
    await prisma.trainedModel.update({
      where: { modelId: model.modelId },
      data: {
        status: 'deployed',
        deployedAt: new Date()
      }
    });

    logger.info('Model deployed', { 
      version: batch.modelVersion,
      modelId: model.modelId
    });
  }

  /**
   * Run health checks
   */
  private async runHealthChecks(): Promise<void> {
    // Check database connectivity
    await prisma.user.count().catch((error: Error) => {
      logger.error('Database health check failed', error);
    });

    // Check data collection rate
    const last1h = await prisma.trajectory.count({
      where: {
        startTime: {
          gte: new Date(Date.now() - 60 * 60 * 1000)
        }
      }
    });

    if (last1h < 1) {
      logger.warn('Low data collection rate', { trajectoriesLastHour: last1h });
    }

    // Check disk space for model storage
    await fs.mkdir(this.config.modelStoragePath, { recursive: true }).catch((error: Error) => {
      logger.error('Storage health check failed', error);
    });
    await fs.mkdir(this.config.dataStoragePath, { recursive: true }).catch((error: Error) => {
      logger.error('Storage health check failed', error);
    });
  }

  /**
   * Get automation status
   */
  async getStatus(): Promise<AutomationStatus> {
    // Data collection stats
    const last24h = await prisma.trajectory.count({
      where: {
        startTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });

    const last7d = await prisma.trajectory.count({
      where: {
        startTime: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    });

    // Training stats
    const lastCompleted = await prisma.trainingBatch.findFirst({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' }
    });

    // Model stats
    const latestModel = await prisma.trainedModel.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    const deployedCount = await prisma.trainedModel.count({
      where: { status: 'deployed' }
    });

    const trainingCount = await prisma.trainingBatch.count({
      where: { status: 'training' }
    });

    // Health checks
    const dbHealthy = await prisma.user.count().then(() => true).catch(() => false);
    const storageHealthy = await fs.access(this.config.modelStoragePath).then(() => true).catch(() => false);
    const wandbHealthy = !!this.config.wandbApiKey;

    return {
      dataCollection: {
        last24h,
        last7d,
        ratePerHour: last24h / 24
      },
      training: {
        currentJob: this.currentTrainingJob,
        lastCompleted: lastCompleted?.completedAt || null,
        nextScheduled: lastCompleted
          ? new Date(lastCompleted.completedAt!.getTime() + this.config.trainingInterval * 60 * 60 * 1000)
          : null
      },
      models: {
        latest: latestModel?.version || null,
        deployed: deployedCount,
        training: trainingCount
      },
      health: {
        database: dbHealthy,
        storage: storageHealthy,
        wandb: wandbHealthy
      }
    };
  }
}

// Singleton
export const automationPipeline = new AutomationPipeline();

