/**
 * Model Storage Service (Vercel Blob)
 * 
 * Handles model versioning and storage using Vercel Blob.
 * Stores trained models with metadata for easy deployment.
 */

import { put, del, list } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import fs from 'fs/promises';
import path from 'path';

export interface ModelVersion {
  version: string;
  baseModel: string;
  blobUrl: string;
  size: number;
  uploadedAt: Date;
  metadata: {
    trainingBatch?: string;
    accuracy?: number;
    avgReward?: number;
    wandbRunId?: string;
  };
}

export class ModelStorageService {
  private readonly blobPrefix = 'models/';
  
  /**
   * Upload trained model to Vercel Blob
   */
  async uploadModel(options: {
    version: string;
    modelPath: string;
    metadata?: Record<string, unknown>;
  }): Promise<ModelVersion> {
    try {
      logger.info('Uploading model to Vercel Blob', {
        version: options.version,
        path: options.modelPath
      });

      // Read model file
      const modelData = await fs.readFile(options.modelPath);
      const fileName = path.basename(options.modelPath);

      // Upload to Vercel Blob
      const blob = await put(
        `${this.blobPrefix}${options.version}/${fileName}`,
        modelData,
        {
          access: 'public', // Models can be publicly downloaded
          addRandomSuffix: false
        }
      );

      // Upload metadata
      await put(
        `${this.blobPrefix}${options.version}/metadata.json`,
        JSON.stringify(options.metadata || {}, null, 2),
        {
          access: 'public',
          addRandomSuffix: false
        }
      );

      logger.info('Model uploaded to Vercel Blob', {
        version: options.version,
        url: blob.url,
        size: (blob as { size?: number }).size || 0
      });

      // Save to database
      const prismaExt = prisma as any;
      await prismaExt.trainedModel.create({
        data: {
          id: `model-${Date.now()}`,
          modelId: `babylon-agent-${options.version}`,
          version: options.version,
          baseModel: (options.metadata?.baseModel as string) || 'OpenPipe/Qwen3-14B-Instruct',
          storagePath: blob.url,
          wandbRunId: options.metadata?.wandbRunId as string,
          accuracy: options.metadata?.accuracy as number,
          avgReward: options.metadata?.avgReward as number,
          status: 'ready',
          agentsUsing: 0
        }
      });

      return {
        version: options.version,
        baseModel: (options.metadata?.baseModel as string) || 'OpenPipe/Qwen3-14B-Instruct',
        blobUrl: blob.url,
        size: (blob as { size?: number }).size || 0,
        uploadedAt: new Date(),
        metadata: options.metadata || {}
      };

    } catch (error) {
      logger.error('Failed to upload model', error);
      throw error;
    }
  }

  /**
   * Download model from Vercel Blob
   */
  async downloadModel(version: string): Promise<{
    modelData: Buffer;
    metadata: Record<string, unknown>;
  }> {
    try {
      const prismaExt = prisma as any;
      const model = await prismaExt.trainedModel.findFirst({
        where: { version }
      });

      if (!model) {
        throw new Error(`Model version ${version} not found`);
      }

      // Download model file
      const modelResponse = await fetch(model.storagePath);
      const modelData = Buffer.from(await modelResponse.arrayBuffer());

      // Download metadata
      const metadataUrl = model.storagePath.replace(/\/[^/]+$/, '/metadata.json');
      const metadataResponse = await fetch(metadataUrl);
      const metadata = await metadataResponse.json();

      return {
        modelData,
        metadata
      };

    } catch (error) {
      logger.error('Failed to download model', error);
      throw error;
    }
  }

  /**
   * List all model versions
   */
  async listModels(): Promise<ModelVersion[]> {
    try {
      const { blobs } = await list({
        prefix: this.blobPrefix
      });

      // Group by version
      const versions = new Map<string, any>();

      for (const blob of blobs) {
        const parts = blob.pathname.split('/');
        const version = parts[1];
        if (!version) continue;

        if (!versions.has(version)) {
          versions.set(version, {
            version,
            blobs: []
          });
        }
        versions.get(version).blobs.push(blob);
      }

      // Get metadata for each version
      const models: ModelVersion[] = [];

      for (const [version, data] of versions) {
        const modelBlob = data.blobs.find((b: any) => 
          b.pathname.endsWith('.safetensors') || b.pathname.endsWith('.bin')
        );

        if (modelBlob) {
          // Try to get metadata
          let metadata = {};
          try {
            const metadataBlob = data.blobs.find((b: any) => b.pathname.endsWith('metadata.json'));
            if (metadataBlob) {
              const response = await fetch(metadataBlob.url);
              metadata = await response.json();
            }
          } catch {
            // No metadata, use defaults
          }

          models.push({
            version,
            baseModel: (metadata as any).baseModel || 'unknown',
            blobUrl: modelBlob.url,
            size: modelBlob.size,
            uploadedAt: new Date(modelBlob.uploadedAt),
            metadata
          });
        }
      }

      return models.sort((a, b) => 
        b.uploadedAt.getTime() - a.uploadedAt.getTime()
      );

    } catch (error) {
      logger.error('Failed to list models', error);
      return [];
    }
  }

  /**
   * Delete model version
   */
  async deleteModel(version: string): Promise<void> {
    try {
      const { blobs } = await list({
        prefix: `${this.blobPrefix}${version}/`
      });

      for (const blob of blobs) {
        await del(blob.url);
      }

      // Update database
      const prismaExt = prisma as any;
      await prismaExt.trainedModel.updateMany({
        where: { version },
        data: {
          status: 'archived',
          archivedAt: new Date()
        }
      });

      logger.info('Model deleted from Vercel Blob', { version });

    } catch (error) {
      logger.error('Failed to delete model', error);
      throw error;
    }
  }

  /**
   * Get latest model version
   */
  async getLatestVersion(): Promise<ModelVersion | null> {
    const models = await this.listModels();
    return models[0] || null;
  }
}

// Singleton
export const modelStorage = new ModelStorageService();

