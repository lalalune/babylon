/**
 * Training Cron Endpoint
 *
 * Invoked by Vercel Cron to trigger the automated training pipeline.
 * Supports optional `force=true` and `batchSize` query parameters for
 * manual overrides.
 */

import { NextResponse } from 'next/server';
import { automationPipeline } from '@/lib/training/AutomationPipeline';
import { logger } from '@/lib/logger';
import type { TrainingTriggerResult, AutomationStatus } from '@/lib/training/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_SECRET_HEADER = 'authorization';

const TRAINING_NOT_READY_STATUS = 202;

interface TriggerOptions {
  force: boolean;
  batchSize?: number;
}

function authorize(request: Request): NextResponse | null {
  const token = request.headers.get(CRON_SECRET_HEADER);
  if (token === `Bearer ${process.env.CRON_SECRET}`) {
    return null;
  }

  return NextResponse.json(
    { success: false, error: 'Unauthorized' },
    { status: 401 }
  );
}

function parseTriggerOptions(request: Request): TriggerOptions | NextResponse {
  const url = new URL(request.url);
  const force = url.searchParams.get('force') === 'true';
  const batchSizeParam = url.searchParams.get('batchSize');

  if (batchSizeParam === null || batchSizeParam === '') {
    return { force };
  }

  const batchSize = Number(batchSizeParam);

  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    return NextResponse.json(
      { success: false, error: 'Invalid batchSize parameter' },
      { status: 400 }
    );
  }

  return { force, batchSize };
}

function buildResponse(
  result: TrainingTriggerResult,
  statusSnapshot: AutomationStatus | null
): NextResponse {
  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        message: result.error ?? 'Training not triggered',
        status: statusSnapshot,
      },
      { status: TRAINING_NOT_READY_STATUS }
    );
  }

  return NextResponse.json({
    success: true,
    jobId: result.jobId ?? null,
    status: statusSnapshot,
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  const authError = authorize(request);
  if (authError) {
    return authError;
  }

  const optionsOrResponse = parseTriggerOptions(request);
  if (optionsOrResponse instanceof NextResponse) {
    return optionsOrResponse;
  }

  const { force, batchSize } = optionsOrResponse;

  try {
    logger.info('🧠 Training cron triggered', { force, batchSize });

    const triggerResult = await automationPipeline.triggerTraining({
      force,
      batchSize,
    });

    if (triggerResult.success) {
      logger.info('✅ Training job queued', { jobId: triggerResult.jobId });
    } else {
      logger.info('ℹ️ Training not started', { reason: triggerResult.error });
    }

    const statusSnapshot = await automationPipeline.getStatus();

    return buildResponse(triggerResult, statusSnapshot);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown training error';

    logger.error('❌ Training cron failed', { error: message });

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

