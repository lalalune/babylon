import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Cron Job: Scheduled Training Cycle
 * 
 * DISABLED: Training functionality is handled by separate Eliza agents
 * This endpoint is kept for future integration
 */

export async function GET() {
  logger.info('Training cron endpoint called (currently disabled)');
  
  return NextResponse.json({
    success: false,
    message: 'Training automation is currently disabled',
    hint: 'Training is handled by separate Eliza agent processes',
  });
}
