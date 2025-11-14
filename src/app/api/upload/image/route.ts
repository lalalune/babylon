/**
 * Image Upload API
 * 
 * @description
 * Handles image uploads for user profiles, cover images, and post attachments.
 * Automatically optimizes images to WebP format with Sharp library and uploads
 * to S3-compatible storage (MinIO in development, Cloudflare R2 in production).
 * 
 * **Features:**
 * - Automatic WebP conversion for optimal performance
 * - Image optimization with Sharp (quality: 85%)
 * - Max dimensions: 2048x2048 (maintains aspect ratio)
 * - Rate limiting to prevent abuse
 * - Multi-folder organization (profiles, covers, posts)
 * - S3-compatible storage integration
 * - Local storage fallback for development
 * 
 * **Supported Image Types:**
 * - profile: User profile avatars
 * - cover: User cover images
 * - post: Post attachments
 * 
 * **Storage:**
 * - **Development:** Local filesystem (`USE_LOCAL_STORAGE=true`)
 * - **Production:** Cloudflare R2 or S3-compatible storage
 * - **Vercel-compatible:** No local filesystem in production
 * 
 * **File Processing:**
 * 1. Receive multipart/form-data
 * 2. Validate file type and size
 * 3. Convert to WebP format
 * 4. Resize to max 2048x2048 (if larger)
 * 5. Upload to storage
 * 6. Return public URL
 * 
 * @openapi
 * /api/upload/image:
 *   post:
 *     tags:
 *       - Upload
 *     summary: Upload image
 *     description: Upload and optimize images for profiles, covers, or posts
 *     security:
 *       - PrivyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Image file to upload
 *               type:
 *                 type: string
 *                 enum: [profile, cover, post]
 *                 description: Image type/category
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 url:
 *                   type: string
 *                   description: Public URL of uploaded image
 *                 key:
 *                   type: string
 *                   description: Storage key/path
 *                 size:
 *                   type: integer
 *                   description: File size in bytes
 *                 filename:
 *                   type: string
 *                   description: Generated filename
 *       400:
 *         description: Invalid file or type
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded
 * 
 * @example
 * ```typescript
 * // Upload profile image
 * const formData = new FormData();
 * formData.append('file', imageFile);
 * formData.append('type', 'profile');
 * 
 * const response = await fetch('/api/upload/image', {
 *   method: 'POST',
 *   headers: { 'Authorization': `Bearer ${token}` },
 *   body: formData
 * });
 * 
 * const { url, size } = await response.json();
 * console.log(`Uploaded to: ${url} (${size} bytes)`);
 * ```
 * 
 * @see {@link /lib/storage/s3-client} S3 storage client
 * @see {@link /lib/validation/schemas} Upload validation
 */

import type { NextRequest } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { ImageUploadSchema } from '@/lib/validation/schemas'
import { getStorageClient } from '@/lib/storage/s3-client'
import { logger } from '@/lib/logger'
import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { checkRateLimitAndDuplicates, RATE_LIMIT_CONFIGS } from '@/lib/rate-limiting'

// Configuration - only allow local storage in development
const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true' && process.env.NODE_ENV === 'development'

// Runtime configuration for Vercel
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/upload/image
 * Upload an image file to S3-compatible storage
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Authenticate user
  const authUser = await authenticate(request)

  // Apply rate limiting (no duplicate detection for uploads)
  const rateLimitError = checkRateLimitAndDuplicates(
    authUser.userId,
    null,
    RATE_LIMIT_CONFIGS.UPLOAD_IMAGE
  );
  if (rateLimitError) {
    return rateLimitError;
  }

  // Parse multipart form data
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const imageType = formData.get('type') as string | null // 'profile', 'cover', or 'post'

  // Validate using schema
  ImageUploadSchema.parse({
    file: file ? { size: file.size, type: file.type } : null,
    type: imageType || undefined
  })

  if (!file) {
    throw new Error('No file provided')
  }

  // Determine folder based on image type
  let folder: 'profiles' | 'covers' | 'posts' = 'posts'
  if (imageType === 'profile') folder = 'profiles'
  else if (imageType === 'cover') folder = 'covers'

  // Generate unique filename
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(7)
  const extension = 'webp' // We'll convert all images to webp for optimization
  const filename = `${authUser.userId}_${timestamp}_${randomString}.${extension}`

  // Convert file to buffer
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  if (USE_LOCAL_STORAGE) {
    const optimized = await sharp(buffer)
      .webp({ quality: 85 })
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .toBuffer()

    const uploadDir = join(process.cwd(), 'public', 'uploads', folder)
    await mkdir(uploadDir, { recursive: true })

    const filePath = join(uploadDir, filename)
    await writeFile(filePath, optimized)

    const url = `/uploads/${folder}/${filename}`

    logger.info(`Image uploaded successfully to local storage (dev only)`, {
      userId: authUser.userId,
      filename,
      path: filePath,
      size: optimized.length,
      originalSize: file.size,
      type: imageType || 'unknown',
    }, 'POST /api/upload/image')

    return successResponse({
      success: true,
      url,
      key: `${folder}/${filename}`,
      size: optimized.length,
      filename,
    })
  }

  // Upload to S3-compatible storage (production or fallback)
  const storage = getStorageClient()
  const result = await storage.uploadImage({
    file: buffer,
    filename,
    contentType: 'image/webp',
    folder,
    optimize: true, // Enable image optimization
  })

  logger.info(`Image uploaded successfully to external storage`, {
    userId: authUser.userId,
    filename,
    key: result.key,
    size: result.size,
    originalSize: file.size,
    type: imageType || 'unknown',
  }, 'POST /api/upload/image')

  return successResponse({
    success: true,
    url: result.url,
    key: result.key,
    size: result.size,
    filename,
  })
})

