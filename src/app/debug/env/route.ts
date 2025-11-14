/**
 * Debug: Environment Check
 * GET /debug/env - Check environment variables and database connection
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// import { logger } from '@/lib/logger';

export async function GET(_request: NextRequest) {
  const checks = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercel: process.env.VERCEL === '1',
    vercelEnv: process.env.VERCEL_ENV,
    databaseUrl: {
      exists: !!process.env.DATABASE_URL,
      value: process.env.DATABASE_URL 
        ? `${process.env.DATABASE_URL.slice(0, 20)}...${process.env.DATABASE_URL.slice(-10)}`
        : 'NOT SET',
      isPlaceholder: process.env.DATABASE_URL?.includes('db.prisma.io'),
    },
    databaseConnection: 'checking...' as string,
    prismaVersion: 'unknown',
  };

  await prisma.$queryRawUnsafe<Array<{ '?column?': number }>>('SELECT 1');
  checks.databaseConnection = '✅ Connected';
  
  const result = await prisma.$queryRawUnsafe<Array<{ version: string | null }>>('SELECT version()');
  const rawVersion = result[0]!.version!;
  checks.prismaVersion = rawVersion.split(' ')[0]!

  // Check if we're using placeholder database URL
  if (checks.databaseUrl.isPlaceholder) {
    return NextResponse.json({
      success: false,
      error: 'Database not configured',
      message: '⚠️ You are using the default Prisma placeholder database URL',
      instructions: [
        '1. Set up your database (PostgreSQL recommended)',
        '2. Add DATABASE_URL to your Vercel environment variables',
        '3. Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE',
        '4. In Vercel dashboard: Settings → Environment Variables',
        '5. Add DATABASE_URL for all environments (Production, Preview, Development)',
        '6. Redeploy your application',
      ],
      checks,
    }, { status: 503 });
  }

  // Return diagnostics
  return NextResponse.json({
    success: checks.databaseConnection.includes('✅'),
    message: checks.databaseConnection.includes('✅') 
      ? '✅ Database configured and connected' 
      : '❌ Database connection failed',
    checks,
    nextSteps: checks.databaseConnection.includes('✅')
      ? ['✅ Everything looks good! Database is connected and ready.']
      : [
          'Check DATABASE_URL in Vercel environment variables',
          'Verify database is accessible from Vercel servers',
          'Check database credentials and connection string format',
          'Make sure database allows connections from Vercel IPs',
        ],
  });
}
