/**
 * Training Monitor Service
 * 
 * Tracks training job progress and updates database with status.
 * Monitors Python training process and W&B runs.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export type TrainingStatus = 'pending' | 'preparing' | 'scoring' | 'training' | 'uploading' | 'completed' | 'failed';

export interface TrainingProgress {
  batchId: string;
  status: TrainingStatus;
  progress: number; // 0-1
  currentEpoch?: number;
  totalEpochs?: number;
  currentStep?: number;
  totalSteps?: number;
  loss?: number;
  eta?: number; // milliseconds
  error?: string;
}

export interface WandBRunStatus {
  status: string;
  currentEpoch: number;
  loss: number;
  eta: number;
}

export class TrainingMonitor {
  /**
   * Start monitoring a training job
   */
  async startMonitoring(batchId: string): Promise<void> {
    await prisma.trainingBatch.update({
      where: { batchId },
      data: {
        status: 'training',
        startedAt: new Date()
      }
    });

    logger.info('Started monitoring training job', { batchId }, 'TrainingMonitor');
  }

  /**
   * Update training progress
   */
  async updateProgress(batchId: string, progress: Partial<TrainingProgress>): Promise<void> {
    interface UpdateData {
      status?: string;
      completedAt?: Date;
      trainingLoss?: number;
      error?: string;
    }

    const updates: UpdateData = {};

    if (progress.status) {
      updates.status = progress.status;
    }

    if (progress.status === 'completed') {
      updates.completedAt = new Date();
      updates.trainingLoss = progress.loss;
    }

    if (progress.status === 'failed') {
      updates.error = progress.error;
    }

    await prisma.trainingBatch.update({
      where: { batchId },
      data: updates
    });

    logger.info('Updated training progress', {
      batchId,
      status: progress.status,
      progress: progress.progress
    }, 'TrainingMonitor');
  }

  /**
   * Get current progress for a job
   */
  async getProgress(batchId: string): Promise<TrainingProgress | null> {
    const batch = await prisma.trainingBatch.findUnique({
      where: { batchId }
    });

    if (!batch) {
      return null;
    }

    // Calculate progress based on status
    let progress = 0;
    switch (batch.status) {
      case 'pending': progress = 0; break;
      case 'preparing': progress = 0.1; break;
      case 'scoring': progress = 0.3; break;
      case 'training': progress = 0.6; break;
      case 'uploading': progress = 0.9; break;
      case 'completed': progress = 1.0; break;
      case 'failed': progress = 0; break;
    }

    // Estimate ETA based on average training time
    let eta: number | undefined;
    if (batch.status === 'training' && batch.startedAt) {
      const avgTrainingTime = 2 * 60 * 60 * 1000; // 2 hours average
      const elapsed = Date.now() - batch.startedAt.getTime();
      eta = Math.max(0, avgTrainingTime - elapsed);
    }

    return {
      batchId,
      status: batch.status as TrainingStatus,
      progress,
      loss: batch.trainingLoss ?? undefined,
      eta,
      error: batch.error ?? undefined
    };
  }

  /**
   * Monitor W&B run via Weights & Biases API
   * Requires WANDB_API_KEY environment variable
   */
  async monitorWandBRun(wandbRunId: string): Promise<WandBRunStatus | null> {
    const wandbApiKey = process.env.WANDB_API_KEY;
    
    if (!wandbApiKey) {
      logger.warn('WANDB_API_KEY not configured - cannot monitor W&B runs', undefined, 'TrainingMonitor');
      return null;
    }

    logger.info('Monitoring W&B run', { wandbRunId }, 'TrainingMonitor');

    // Call W&B API to get run status
    const wandbResponse = await fetch(`https://api.wandb.ai/runs/${wandbRunId}`, {
      headers: {
        'Authorization': `Bearer ${wandbApiKey}`
      }
    }).catch((error) => {
      logger.error('Failed to fetch W&B run status', { error, wandbRunId }, 'TrainingMonitor');
      return null;
    });

    if (!wandbResponse || !wandbResponse.ok) {
      logger.warn('W&B API returned error', { wandbRunId, status: wandbResponse?.status }, 'TrainingMonitor');
      return null;
    }

    const runData = await wandbResponse.json() as {
      state?: string;
      summary?: {
        epoch?: number;
        loss?: number;
      };
      runtime?: number;
    };

    return {
      status: runData.state || 'unknown',
      currentEpoch: runData.summary?.epoch || 0,
      loss: runData.summary?.loss || 0,
      eta: runData.runtime || 0
    };
  }

  /**
   * Check if training is stuck
   */
  async checkForStuckJobs(): Promise<string[]> {
    const stuckJobs = await prisma.trainingBatch.findMany({
      where: {
        status: 'training',
        startedAt: {
          lt: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
        }
      },
      select: {
        batchId: true
      }
    });

    if (stuckJobs.length > 0) {
      logger.warn('Found stuck training jobs', {
        count: stuckJobs.length,
        jobs: stuckJobs.map(j => j.batchId)
      }, 'TrainingMonitor');
    }

    return stuckJobs.map(j => j.batchId);
  }

  /**
   * Cancel training job
   */
  async cancelJob(batchId: string, reason: string): Promise<void> {
    await prisma.trainingBatch.update({
      where: { batchId },
      data: {
        status: 'failed',
        error: `Cancelled: ${reason}`,
        completedAt: new Date()
      }
    });

    logger.warn('Training job cancelled', { batchId, reason }, 'TrainingMonitor');
  }
}

// Singleton
export const trainingMonitor = new TrainingMonitor();

