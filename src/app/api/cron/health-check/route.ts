/**
 * Vercel Cron Job: Health Check
 * 
 * Simple health check endpoint that runs every 15 minutes to:
 * - Keep serverless functions warm
 * - Verify database connectivity
 * - Log system health metrics
 * 
 * Configuration in vercel.json:
 * - Runs every 15 minutes
 * - Max execution time: 60s (quick check)
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

// Vercel function configuration
export const maxDuration = 60; // 1 minute max for health check
export const dynamic = 'force-dynamic';

// Verify this is a legitimate Vercel Cron request
function verifyVercelCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // In development, allow without secret for easy testing
  if (process.env.NODE_ENV === 'development') {
    if (!cronSecret) {
      return true;
    }
  }
  
  if (!cronSecret) {
    logger.error('CRON_SECRET not configured', undefined, 'HealthCheck');
    return false;
  }
  
  const expectedAuth = `Bearer ${cronSecret}`;
  return authHeader === expectedAuth;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron authorization
  if (!verifyVercelCronRequest(request)) {
    logger.warn('Unauthorized health check attempt', undefined, 'HealthCheck');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Quick database health check
    await prisma.$queryRaw`SELECT 1`;
    
    const duration = Date.now() - startTime;
    
    logger.info('Health check passed', {
      duration,
      timestamp: new Date().toISOString()
    }, 'HealthCheck');

    return NextResponse.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      duration,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Health check failed', error, 'HealthCheck');

    return NextResponse.json({
      success: false,
      status: 'unhealthy',
      database: 'error',
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

