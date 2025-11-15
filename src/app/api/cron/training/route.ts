/**
 * Training Status Cron
 * 
 * Runs daily to:
 * 1. Check if system is ready to train
 * 2. Report readiness status  
 * 3. Log training metrics
 * 
 * Triggered by Vercel Cron: 0 0 * * * (daily at midnight)
 * 
 * NOTE: Training is triggered by GitHub Actions cron (2 AM UTC daily)
 * This endpoint just monitors readiness and reports status
 */

import { NextResponse } from 'next/server';
import { automationPipeline } from '@/lib/training/AutomationPipeline';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minute

/**
 * Daily training status check and reporting
 */
export async function GET() {
  try {
    logger.info('Checking training system status', undefined, 'TrainingStatusCron');

    // 1. Check if ready to train
    const readiness = await automationPipeline.checkTrainingReadiness();
    
    // 2. Get overall system status
    const status = await automationPipeline.getStatus();
    
    // 3. Log readiness status
    if (readiness.ready) {
      logger.info('✅ System ready for training', {
        trajectories: readiness.stats.totalTrajectories,
        scenarioGroups: readiness.stats.scenarioGroups,
        dataQuality: readiness.stats.dataQuality
      }, 'TrainingStatusCron');
    } else {
      logger.info('⏳ System not ready for training', {
        reason: readiness.reason,
        stats: readiness.stats
      }, 'TrainingStatusCron');
    }
    
    // 4. Log recent activity
    logger.info('Training system metrics', {
      dataCollection: status.dataCollection,
      latestModel: status.models.latest,
      deployedModels: status.models.deployed,
      lastTraining: status.training.lastCompleted
    }, 'TrainingStatusCron');

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      readiness,
      status,
      message: readiness.ready 
        ? '✅ Ready for training - will run via GitHub Actions at 2 AM UTC'
        : `⏳ Not ready: ${readiness.reason}`
    });

  } catch (error) {
    logger.error('Training status check failed', error, 'TrainingStatusCron');
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
