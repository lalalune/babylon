/**
 * Training Check Cron
 * 
 * Runs hourly to:
 * 1. Score new trajectories with RULER
 * 2. Check training readiness
 * 3. Monitor system health
 * 
 * Triggered by Vercel Cron: 0 * * * * (hourly)
 */

import { NextResponse } from 'next/server';
import { automationPipeline } from '@/lib/training/AutomationPipeline';
import { rulerScoringService } from '@/lib/training/RulerScoringService';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * Hourly training check and RULER scoring
 */
export async function GET() {
  try {
    const startTime = Date.now();
    logger.info('Starting training check cycle', undefined, 'TrainingCheckCron');

    const results = {
      timestamp: new Date().toISOString(),
      scoring: {
        windowsScored: 0,
        trajectoriesScored: 0
      },
      readiness: null as Awaited<ReturnType<typeof automationPipeline.checkTrainingReadiness>> | null,
      status: null as Awaited<ReturnType<typeof automationPipeline.getStatus>> | null
    };

    // 1. Score trajectories with RULER (last 6 hours of windows)
    logger.info('Scoring trajectories with RULER...', undefined, 'TrainingCheckCron');
    
    const now = new Date();
    for (let hoursAgo = 0; hoursAgo < 6; hoursAgo++) {
      const windowDate = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
      const windowId = windowDate.toISOString().slice(0, 13) + ':00';
      
      try {
        const scored = await rulerScoringService.scoreWindow(windowId);
        if (scored > 0) {
          results.scoring.windowsScored++;
          results.scoring.trajectoriesScored += scored;
          logger.info('Scored window with RULER', { 
            windowId, 
            trajectoriesScored: scored 
          }, 'TrainingCheckCron');
        }
      } catch (error) {
        logger.warn('Scoring failed for window', { 
          windowId, 
          error: error instanceof Error ? error.message : String(error) 
        }, 'TrainingCheckCron');
      }
    }

    // 2. Check training readiness
    logger.info('Checking training readiness...', undefined, 'TrainingCheckCron');
    results.readiness = await automationPipeline.checkTrainingReadiness();
    
    if (results.readiness.ready) {
      logger.info('System is ready for training!', results.readiness.stats, 'TrainingCheckCron');
    } else {
      logger.info('System not ready for training', { 
        reason: results.readiness.reason 
      }, 'TrainingCheckCron');
    }

    // 3. Get system status
    results.status = await automationPipeline.getStatus();

    const duration = Date.now() - startTime;
    logger.info('Training check cycle complete', { 
      durationMs: duration,
      trajectoriesScored: results.scoring.trajectoriesScored,
      ready: results.readiness.ready
    }, 'TrainingCheckCron');

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      ...results
    });

  } catch (error) {
    logger.error('Training check cycle failed', error, 'TrainingCheckCron');
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
