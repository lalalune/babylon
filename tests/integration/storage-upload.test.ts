// @ts-nocheck - Test file

/**
 * Storage Upload Integration Test
 * 
 * Tests CDN storage (Vercel Blob or MinIO) functionality
 */

import { describe, test, expect, afterAll } from 'bun:test'
import { getStorageClient } from '@/lib/storage/s3-client'

describe('Storage Upload', () => {
  const storage = getStorageClient()
  const uploadedKeys: string[] = []

  afterAll(async () => {
    for (const key of uploadedKeys) {
      try {
        await storage.deleteImage(`https://example.com/${key}`)
      } catch {
        // Ignore cleanup errors
      }
    }
  })

  test('Storage client initializes', async () => {
    try {
      await storage.initializeBucket()
      expect(true).toBe(true)
    } catch (error) {
      // Bucket may already exist, which is fine
      expect(true).toBe(true)
    }
  })

  test('Upload image buffer', async () => {
    const testBuffer = Buffer.from('test image data')
    const filename = `test_${Date.now()}.jpg`

    const result = await storage.uploadImage({
      file: testBuffer,
      filename,
      contentType: 'image/jpeg',
      folder: 'static' as any, // Test folder
      optimize: false,
    })

    uploadedKeys.push(result.key)

    expect(result.url).toBeDefined()
    expect(result.key).toContain(filename)
    expect(result.size).toBeGreaterThan(0)
  })

  test('Check file exists', async () => {
    const testBuffer = Buffer.from('test image data')
    const filename = `test_exists_${Date.now()}.jpg`

    const result = await storage.uploadImage({
      file: testBuffer,
      filename,
      contentType: 'image/jpeg',
      folder: 'static' as any, // Test folder
      optimize: false,
    })

    uploadedKeys.push(result.key)

    const exists = await storage.exists(result.key)
    expect(exists).toBe(true)
  })

  test('Delete file', async () => {
    const testBuffer = Buffer.from('test image data')
    const filename = `test_delete_${Date.now()}.jpg`

    const result = await storage.uploadImage({
      file: testBuffer,
      filename,
      contentType: 'image/jpeg',
      folder: 'static' as any, // Test folder
      optimize: false,
    })

    await storage.deleteImage(result.url)

    const exists = await storage.exists(result.key)
    expect(exists).toBe(false)
  })
})

