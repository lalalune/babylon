/**
 * W&B Model Fetcher
 * 
 * Fetches trained RL models from Weights & Biases for inference.
 */

import { prisma } from '@/lib/prisma';
import { getRLModelConfig } from './RLModelConfig';

export interface ModelArtifact {
  version: string;
  modelPath: string;
  metadata: {
    avgReward?: number;
    benchmarkScore?: number;
    baseModel: string;
    trainedAt: Date;
  };
}

/**
 * Get the latest RL model from database
 */
export async function getLatestRLModel(): Promise<ModelArtifact | null> {
  try {
    const model = await prisma.trainedModel.findFirst({
      where: {
        status: 'ready'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (!model) {
      return null;
    }
    
    return {
      version: model.version,
      modelPath: model.storagePath || '',
      metadata: {
        avgReward: model.avgReward || undefined,
        benchmarkScore: model.benchmarkScore || undefined,
        baseModel: model.baseModel,
        trainedAt: model.createdAt
      }
    };
  } catch (error) {
    console.error('Failed to fetch latest RL model:', error);
    return null;
  }
}

/**
 * Get a specific version of RL model
 */
export async function getRLModelByVersion(version: string): Promise<ModelArtifact | null> {
  try {
    const model = await prisma.trainedModel.findFirst({
      where: {
        version,
        status: 'ready'
      }
    });
    
    if (!model) {
      return null;
    }
    
    return {
      version: model.version,
      modelPath: model.storagePath || '',
      metadata: {
        avgReward: model.avgReward || undefined,
        benchmarkScore: model.benchmarkScore || undefined,
        baseModel: model.baseModel,
        trainedAt: model.createdAt
      }
    };
  } catch (error) {
    console.error(`Failed to fetch RL model version ${version}:`, error);
    return null;
  }
}

/**
 * Get model for inference (latest or pinned version)
 */
export async function getModelForInference(): Promise<ModelArtifact | null> {
  const config = getRLModelConfig();
  
  if (!config.enabled) {
    return null;
  }
  
  // Try to get pinned version first
  if (config.modelVersion) {
    const model = await getRLModelByVersion(config.modelVersion);
    if (model) {
      console.log(`Using pinned RL model version: ${config.modelVersion}`);
      return model;
    }
    console.warn(`Pinned model version ${config.modelVersion} not found, falling back to latest`);
  }
  
  // Get latest model
  const model = await getLatestRLModel();
  if (model) {
    console.log(`Using latest RL model version: ${model.version}`);
    return model;
  }
  
  return null;
}

/**
 * Download model weights from storage
 * For now, this returns the model path. In production, you'd download from Vercel Blob.
 */
export async function downloadModelWeights(modelPath: string): Promise<string> {
  // In a real implementation, you would:
  // 1. Download from Vercel Blob or W&B
  // 2. Cache locally
  // 3. Return local path
  
  // For now, just return the path
  return modelPath;
}

/**
 * Check if we should use RL model for this request
 */
export function shouldUseRLModel(): boolean {
  const config = getRLModelConfig();
  return config.enabled && !!(config.wandbApiKey && config.wandbEntity);
}

