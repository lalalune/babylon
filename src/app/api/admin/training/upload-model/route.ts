/**
 * Model Upload API
 * POST /api/admin/training/upload-model
 * 
 * Uploads trained model to Vercel Blob storage.
 * Called by Python deployment script after training.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { modelStorage } from '@/lib/training/storage/ModelStorageService';
import { logger } from '@/lib/logger';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export const maxDuration = 300; // 5 minutes for large uploads

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const modelFile = formData.get('model') as File;
    const version = formData.get('version') as string;
    const metadataStr = formData.get('metadata') as string;

    if (!modelFile || !version) {
      return NextResponse.json(
        { error: 'Missing model file or version' },
        { status: 400 }
      );
    }

    const metadata = metadataStr ? JSON.parse(metadataStr) : {};

    logger.info('Uploading model to Vercel Blob', {
      version,
      size: modelFile.size
    });

    // Save to temp file
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'model-upload-'));
    const tempPath = path.join(tempDir, 'model.safetensors');
    
    const buffer = Buffer.from(await modelFile.arrayBuffer());
    await fs.writeFile(tempPath, buffer);

    // Upload using ModelStorageService
    const result = await modelStorage.uploadModel({
      version,
      modelPath: tempPath,
      metadata
    });

    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });

    logger.info('Model uploaded successfully', {
      version,
      url: result.blobUrl
    });

    return NextResponse.json({
      success: true,
      url: result.blobUrl,
      version: result.version,
      size: result.size
    });

  } catch (error) {
    logger.error('Model upload failed', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      },
      { status: 500 }
    );
  }
}

