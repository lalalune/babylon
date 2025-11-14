/**
 * Training Trigger API
 * POST /api/admin/training/trigger
 * 
 * Manually trigger a training job
 */

import { NextResponse } from 'next/server';
import { automationPipeline } from '@/lib/training/AutomationPipeline';

export async function POST(request: Request) {
  const body = await request.json();
  const { force = false, batchSize } = body;

  const result = await automationPipeline.triggerTraining({
    force,
    batchSize
  });

  return NextResponse.json(result);
}

export async function GET() {
  // Get training readiness
  const readiness = await automationPipeline.checkTrainingReadiness();
  return NextResponse.json(readiness);
}

