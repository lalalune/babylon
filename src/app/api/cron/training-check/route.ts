/**
 * Training Automation Cron Job
 * 
 * Runs every hour to check if we should trigger training.
 * Called by Vercel Cron.
 * 
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/training-check",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */

import { NextResponse } from 'next/server';
import { automationPipeline } from '@/lib/training/AutomationPipeline';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  logger.info('🔄 Running training automation check');

  // Run automation cycle
  await automationPipeline.runAutomationCycle();

  const status = await automationPipeline.getStatus();

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    status
  });
}

