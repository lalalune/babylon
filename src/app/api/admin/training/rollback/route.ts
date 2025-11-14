/**
 * Model Rollback API
 * POST /api/admin/training/rollback
 * 
 * Rolls back to a previous model version.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { modelDeployer } from '@/lib/training/ModelDeployer';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetVersion } = body;

    if (!targetVersion) {
      return NextResponse.json(
        { error: 'Target version required' },
        { status: 400 }
      );
    }

    // Get current deployed version
    const currentModel = await prisma.trainedModel.findFirst({
      where: { status: 'deployed' },
      orderBy: { deployedAt: 'desc' }
    });

    if (!currentModel) {
      return NextResponse.json(
        { error: 'No currently deployed model' },
        { status: 400 }
      );
    }

    const result = await modelDeployer.rollback(
      currentModel.version,
      targetVersion
    );

    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Rollback failed'
      },
      { status: 500 }
    );
  }
}

