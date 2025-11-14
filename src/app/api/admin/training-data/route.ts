/**
 * Admin API: Training Data Status
 * Provides visibility into collected trajectories and training readiness
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/training-data
 * Returns training data statistics and ready windows
 */
export async function GET(_req: NextRequest) {
  try {
    // Get total trajectory count
    const totalTrajectories = await prisma.trajectory.count();
    
    // Get trajectories by window
    const windowStats = await prisma.$queryRaw<Array<{
      windowId: string;
      count: bigint;
      avgSteps: number;
      avgPnl: number;
    }>>`
      SELECT 
        "windowId",
        COUNT(*)::bigint as count,
        AVG("episodeLength")::float as "avgSteps",
        AVG(COALESCE("finalPnL", 0))::float as "avgPnl"
      FROM trajectories
      WHERE "windowId" IS NOT NULL
        AND "isTrainingData" = true
        AND "stepsJson" IS NOT NULL
      GROUP BY "windowId"
      ORDER BY "windowId" DESC
      LIMIT 50
    `;
    
    // Convert to serializable format
    const windows = windowStats.map(w => ({
      windowId: w.windowId,
      trajectoryCount: Number(w.count),
      avgSteps: w.avgSteps || 0,
      avgPnl: w.avgPnl || 0,
    }));
    
    // Find ready windows (>= 3 agents minimum for GRPO)
    const MIN_AGENTS_FOR_TRAINING = 3;
    const readyWindows = windows.filter(w => w.trajectoryCount >= MIN_AGENTS_FOR_TRAINING);
    
    // Get recent trajectories for preview
    const recentTrajectories = await prisma.trajectory.findMany({
      where: {
        isTrainingData: true,
      },
      select: {
        id: true,
        trajectoryId: true,
        agentId: true,
        windowId: true,
        episodeLength: true,
        finalPnL: true,
        tradesExecuted: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });
    
    // Calculate quality metrics
    const qualityMetrics = {
      avgEpisodeLength: windows.reduce((sum, w) => sum + w.avgSteps, 0) / (windows.length || 1),
      avgPnl: windows.reduce((sum, w) => sum + w.avgPnl, 0) / (windows.length || 1),
      trainingDataQuality: totalTrajectories > 100 ? 'good' : totalTrajectories > 20 ? 'fair' : 'low',
    };
    
    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalTrajectories,
          totalWindows: windows.length,
          readyWindows: readyWindows.length,
          minAgentsRequired: MIN_AGENTS_FOR_TRAINING,
        },
        windows,
        readyWindows,
        recentTrajectories,
        qualityMetrics,
      },
    });
  } catch (error) {
    logger.error('Failed to get training data stats', { error }, 'TrainingDataAPI');
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get training data statistics',
      },
      { status: 500 }
    );
  }
}

