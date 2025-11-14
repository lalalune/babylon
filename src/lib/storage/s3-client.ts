/**
 * Storage client with support for both local (MinIO) and production (Vercel Blob)
 * Uses MinIO for local development and Vercel Blob for production deployments
 */

import { S3Client, DeleteObjectCommand, CreateBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { put as vercelBlobPut, del as vercelBlobDel } from '@vercel/blob'
import sharp from 'sharp'
import { logger } from '@/lib/logger'

// Storage configuration
const isProduction = process.env.NODE_ENV === 'production'
const useVercelBlob = process.env.USE_VERCEL_BLOB === 'true' || (isProduction && process.env.BLOB_READ_WRITE_TOKEN)

// MinIO configuration (local development)
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://localhost:9000'
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'babylon'
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'babylon_dev_password'
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'babylon-uploads'

// Vercel Blob configuration (production)
// Token is automatically available in Vercel environment as BLOB_READ_WRITE_TOKEN
const VERCEL_BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN

// Image processing configuration
const MAX_WIDTH = 2048
const MAX_HEIGHT = 2048
const QUALITY = 85

interface UploadOptions {
  file: Buffer
  filename: string
  contentType: string
  folder?: 'profiles' | 'covers' | 'posts'
  optimize?: boolean
}

interface UploadResult {
  url: string
  key: string
  size: number
}

class S3StorageClient {
  private client: S3Client | null = null
  private bucket!: string
  private publicUrl!: string | null
  private useVercel!: boolean

  constructor() {
    this.useVercel = !!useVercelBlob

    if (this.useVercel) {
      // Vercel Blob configuration
      if (!VERCEL_BLOB_TOKEN) {
        logger.warn('Vercel Blob token not found, falling back to MinIO')
        this.useVercel = false
      } else {
        this.bucket = 'babylon-uploads'
        this.publicUrl = null // Vercel Blob provides its own URLs
        logger.info('Storage: Using Vercel Blob (production)')
      }
    }
    
    if (!this.useVercel) {
      // MinIO configuration (local dev or fallback)
      this.client = new S3Client({
        region: 'us-east-1',
        endpoint: MINIO_ENDPOINT,
        credentials: {
          accessKeyId: MINIO_ACCESS_KEY,
          secretAccessKey: MINIO_SECRET_KEY,
        },
        forcePathStyle: true, // Required for MinIO
      })
      this.bucket = MINIO_BUCKET
      this.publicUrl = MINIO_ENDPOINT

      logger.info('Storage: Using MinIO (local)')
    }
  }

  /**
   * Upload an image file
   */
  async uploadImage(options: UploadOptions): Promise<UploadResult> {
    let buffer = options.file

    // Optimize image if requested
    if (options.optimize !== false) {
      buffer = await this.optimizeImage(buffer)
    }

    // Generate path/key
    const folder = options.folder || 'uploads'
    const pathname = `${folder}/${options.filename}`

    if (this.useVercel) {
      // Upload to Vercel Blob
      const blob = await vercelBlobPut(pathname, buffer, {
        access: 'public',
        contentType: options.contentType,
        addRandomSuffix: false, // We already have unique filenames
      })

      logger.info('Image uploaded successfully to Vercel Blob', {
        pathname: blob.pathname,
        size: buffer.length,
        url: blob.url,
      })

      return {
        url: blob.url,
        key: blob.pathname,
        size: buffer.length,
      }
    } else {
      // Upload to MinIO/S3
      if (!this.client) {
        throw new Error('S3 client not initialized')
      }

      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: pathname,
          Body: buffer,
          ContentType: options.contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        },
      })

      await upload.done()

      // Generate public URL
      const url = this.publicUrl 
        ? `${this.publicUrl}/${this.bucket}/${pathname}`
        : `http://localhost:9000/${this.bucket}/${pathname}`

      logger.info('Image uploaded successfully to MinIO', {
        key: pathname,
        size: buffer.length,
        bucket: this.bucket,
      })

      return {
        url,
        key: pathname,
        size: buffer.length,
      }
    }
  }

  /**
   * Delete an image file
   */
  async deleteImage(url: string): Promise<void> {
    if (this.useVercel) {
      // Delete from Vercel Blob
      await vercelBlobDel(url)
      logger.info('Image deleted successfully from Vercel Blob', { url })
    } else {
      // Delete from MinIO/S3
      if (!this.client) {
        throw new Error('S3 client not initialized')
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: url,
      })

      await this.client.send(command)
      logger.info('Image deleted successfully from MinIO', { key: url })
    }
  }

  /**
   * Optimize image using sharp
   */
  private async optimizeImage(buffer: Buffer): Promise<Buffer> {
    const image = sharp(buffer)
    const metadata = await image.metadata()

    if (metadata.width && metadata.width > MAX_WIDTH) {
      image.resize(MAX_WIDTH, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
    }

    if (metadata.height && metadata.height > MAX_HEIGHT) {
      image.resize(null, MAX_HEIGHT, {
        withoutEnlargement: true,
        fit: 'inside',
      })
    }

    const optimized = await image
      .webp({ quality: QUALITY })
      .toBuffer()

    logger.info('Image optimized', {
      originalSize: buffer.length,
      optimizedSize: optimized.length,
      compression: `${((1 - optimized.length / buffer.length) * 100).toFixed(1)}%`,
    })

    return optimized
  }

  /**
   * Initialize bucket (for development/MinIO only)
   */
  async initializeBucket(): Promise<void> {
    if (this.useVercel) {
      logger.info('Using Vercel Blob - no bucket initialization needed')
      return
    }

    await this.client!.send(new CreateBucketCommand({ Bucket: this.bucket }))
    logger.info(`Created bucket: ${this.bucket}`)

    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucket}/*`],
        },
      ],
    }

    await this.client!.send(
      new PutBucketPolicyCommand({
        Bucket: this.bucket,
        Policy: JSON.stringify(policy),
      })
    )
    logger.info(`Set public policy for bucket: ${this.bucket}`)
  }
}

// Singleton instance
let storageClient: S3StorageClient | null = null

export function getStorageClient(): S3StorageClient {
  if (!storageClient) {
    storageClient = new S3StorageClient()
  }
  return storageClient
}

export type { UploadOptions, UploadResult }

