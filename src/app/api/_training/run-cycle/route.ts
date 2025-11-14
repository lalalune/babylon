import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * API Route: Run Training Cycle
 * 
 * DISABLED: Training functionality is handled by separate Eliza agents
 * This endpoint is kept for future integration
 */

export async function POST() {
  logger.info('Training cycle endpoint called (currently disabled)');
  
  return NextResponse.json({
    success: false,
    message: 'Manual training cycles are currently disabled',
    hint: 'Training is handled by separate Eliza agent processes',
  });
}

export async function GET() {
  return NextResponse.json({
    enabled: false,
    message: 'Training automation is currently disabled',
    hint: 'Training is handled by separate Eliza agent processes',
  });
}
