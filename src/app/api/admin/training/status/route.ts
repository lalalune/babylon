/**
 * Training Status API
 * GET /api/admin/training/status
 * 
 * Returns complete training system status for admin panel
 */

import { NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';
import { automationPipeline } from '@/lib/training/AutomationPipeline';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Get automation status
  const status = await automationPipeline.getStatus();
  
  // Get readiness check
  const readiness = await automationPipeline.checkTrainingReadiness();
  
  // Note: Trajectory schema models require trajectory schema to be merged into main Prisma schema
  // Returning stub data until then
  const recentJobs: Array<Record<string, unknown>> = [];
  const models: Array<Record<string, unknown>> = [];
  const trajectoryStats = { _count: 0, _avg: { totalReward: null, episodeLength: null, durationMs: null } };
  
  return NextResponse.json({
    status: 'healthy',
    automation: status,
    readiness,
    recentJobs,
    models,
    trajectoryStats,
    timestamp: new Date().toISOString()
  });
}

