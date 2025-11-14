/**
 * Admin API: Load Testing
 * POST /api/admin/load-test - Run a load test
 * GET /api/admin/load-test/status - Get load test status
 * GET /api/admin/load-test/results - Get load test results
 */

import type { NextRequest } from 'next/server';
import { withErrorHandling, successResponse, errorResponse } from '@/lib/errors/error-handler';
import { requireAdmin } from '@/lib/api/admin-middleware';
import type { LoadTestResult } from '@/lib/testing/load-test-simulator';
import { LoadTestSimulator, TEST_SCENARIOS } from '@/lib/testing/load-test-simulator';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const LoadTestRequestSchema = z.object({
  scenario: z.enum(['LIGHT', 'NORMAL', 'HEAVY', 'STRESS']),
  baseUrl: z.string().url().optional(),
});

// Store active load test
let activeTest: {
  simulator: LoadTestSimulator;
  promise: Promise<LoadTestResult>;
  startTime: Date;
  scenario: string;
} | null = null;

let lastTestResult: LoadTestResult | null = null;

/**
 * POST /api/admin/load-test
 * Start a new load test
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin(request);

  // Check if test is already running
  if (activeTest) {
    return errorResponse('Load test already running', 'LOAD_TEST_RUNNING', 409);
  }

  // Parse request body
  const body = await request.json();
  const { scenario, baseUrl } = LoadTestRequestSchema.parse(body);

  // Get configuration
  const config = TEST_SCENARIOS[scenario];
  const testBaseUrl = baseUrl || (process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000');

  logger.info('Starting load test', {
    scenario,
    baseUrl: testBaseUrl,
    config,
  }, 'POST /api/admin/load-test');

  // Start test
  const simulator = new LoadTestSimulator(testBaseUrl);
  const testPromise = simulator.runTest(config);

  activeTest = {
    simulator,
    promise: testPromise,
    startTime: new Date(),
    scenario,
  };

  // Handle test completion
  testPromise.then(result => {
    lastTestResult = result;
    activeTest = null;
    
    logger.info('Load test completed', {
      scenario,
      totalRequests: result.totalRequests,
      successRate: result.throughput.successRate,
    }, 'LoadTest');
  }).catch(error => {
    logger.error('Load test failed', error, 'LoadTest');
    activeTest = null;
  });

  return successResponse({
    message: 'Load test started',
    scenario,
    config: {
      concurrentUsers: config.concurrentUsers,
      durationSeconds: config.durationSeconds,
      endpoints: config.endpoints.length,
    },
    startTime: activeTest.startTime,
  });
});

/**
 * GET /api/admin/load-test/status
 * Get current load test status
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin(request);

  if (activeTest) {
    const runningTime = Date.now() - activeTest.startTime.getTime();
    
    return successResponse({
      status: 'running',
      scenario: activeTest.scenario,
      startTime: activeTest.startTime,
      runningTimeMs: runningTime,
      runningTimeSeconds: Math.floor(runningTime / 1000),
    });
  }

  return successResponse({
    status: 'idle',
    lastResult: lastTestResult ? {
      endTime: lastTestResult.endTime,
      totalRequests: lastTestResult.totalRequests,
      successRate: lastTestResult.throughput.successRate,
      avgResponseTime: lastTestResult.responseTime.mean,
    } : null,
  });
});

