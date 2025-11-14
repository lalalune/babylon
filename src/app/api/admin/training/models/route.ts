/**
 * Models API
 * GET /api/admin/training/models
 * 
 * Returns all trained model versions with metadata.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { modelStorage } from '@/lib/training/storage/ModelStorageService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get models from database
    const dbModels = await prisma.trainedModel.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Get models from Vercel Blob
    const blobModels = await modelStorage.listModels();

    // Merge data
    const models = dbModels.map(dbModel => {
      const blobModel = blobModels.find(b => b.version === dbModel.version);

      return {
        version: dbModel.version,
        baseModel: dbModel.baseModel,
        trainedAt: dbModel.createdAt,
        accuracy: dbModel.accuracy,
        avgReward: dbModel.avgReward,
        status: dbModel.status,
        agentsUsing: dbModel.agentsUsing,
        blobUrl: dbModel.storagePath,
        size: blobModel?.size || 0,
        wandbRunId: dbModel.wandbRunId
      };
    });

    return NextResponse.json({
      success: true,
      models,
      total: models.length
    });

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch models'
      },
      { status: 500 }
    );
  }
}

