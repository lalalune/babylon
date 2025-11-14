/**
 * Model Deployment API
 * POST /api/admin/training/deploy
 * 
 * Deploys a model version to agents.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { modelDeployer } from '@/lib/training/ModelDeployer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelVersion, strategy = 'gradual', rolloutPercentage = 10 } = body;

    if (!modelVersion) {
      return NextResponse.json(
        { error: 'Model version required' },
        { status: 400 }
      );
    }

    const result = await modelDeployer.deploy({
      modelVersion,
      strategy,
      rolloutPercentage
    });

    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Deployment failed'
      },
      { status: 500 }
    );
  }
}

