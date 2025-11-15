/**
 * Test Setup Helper
 *
 * Ensures consistent test environment setup across all test suites.
 * Handles Prisma initialization and database readiness checks.
 */

import { prisma } from '@/lib/prisma';

/**
 * Check if database is available and properly configured
 */
export async function ensureDatabaseReady(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL;

  if (!databaseUrl) {
    return false;
  }

  try {
    // Simple connection test using prisma.$queryRaw
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Setup test environment
 * Call this in beforeAll() hooks for tests that need database
 * 
 * @param options.skipDatabase - If true, skip database connection (for unit tests)
 */
export async function setupTestEnvironment(options?: { skipDatabase?: boolean }) {
  // For unit tests, skip database setup
  if (options?.skipDatabase) {
    return;
  }

  // Ensure DATABASE_URL is available
  if (!process.env.DATABASE_URL && process.env.PRISMA_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.PRISMA_DATABASE_URL;
  }

  // Check database readiness
  const dbReady = await ensureDatabaseReady();
  if (!dbReady) {
    // For non-critical tests, just warn instead of throwing
    console.warn('⚠️  Database not available - database-dependent tests will be skipped');
    return;
  }

  try {
    // Ensure Prisma client is connected
    await prisma.$connect();
    console.log('✅ Test environment ready');
  } catch (error) {
    console.warn('⚠️  Could not connect to database:', error);
  }
}

/**
 * Cleanup test environment
 * Call this in afterAll() hooks
 */
export async function cleanupTestEnvironment() {
  try {
    await prisma.$disconnect();
  } catch (error) {
    // Ignore disconnection errors in tests
  }
}

/**
 * Helper to check if tests should skip based on database availability
 */
export function shouldSkipDatabaseTests(): boolean {
  const hasDatabase = !!(process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL);
  const skipRequested = process.env.SKIP_DATABASE_TESTS === 'true';

  return !hasDatabase || skipRequested;
}