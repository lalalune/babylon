#!/usr/bin/env bun

/**
 * Initialize MinIO bucket for local development
 * Creates the babylon-uploads bucket and sets public read policy
 */

import { getStorageClient } from '../src/lib/storage/s3-client'
import { logger } from '../src/lib/logger'

async function main() {
  logger.info('Initializing MinIO bucket...', undefined, 'Script')

  const storage = getStorageClient()
  await storage.initializeBucket()
  logger.info('MinIO bucket initialized successfully', undefined, 'Script')
}

main()


