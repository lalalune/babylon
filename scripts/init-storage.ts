#!/usr/bin/env bun
/**
 * Initialize S3-compatible storage (MinIO bucket)
 * Run this script to set up the storage system for local development
 */

import { getStorageClient } from '../src/lib/storage/s3-client'

async function initStorage() {
  console.log('🚀 Initializing storage system...\n')

  const storage = getStorageClient()
  
  console.log('📦 Creating bucket and setting permissions...')
  await storage.initializeBucket()
  
  console.log('\n✅ Storage initialization complete!')
  console.log('\n📝 Storage Information:')
  console.log('  - MinIO Console: http://localhost:9001')
  console.log('  - Username: babylon')
  console.log('  - Password: babylon_dev_password')
  console.log('  - API Endpoint: http://localhost:9000')
  console.log('  - Bucket: babylon-uploads')
  console.log('\n💡 You can now upload images through the application')
}

initStorage()

