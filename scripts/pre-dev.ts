#!/usr/bin/env bun

/**
 * Pre-Development Check
 * 
 * Runs before `bun run dev` to ensure all services are ready
 * - Checks environment variables
 * - Checks Docker is installed and running
 * - Starts PostgreSQL, Redis, and MinIO if not running
 * - Validates database connection
 * - Checks database state and runs migrations/seed if needed
 * - Fails fast if any critical issues
 * 
 * NO error handling - let it crash if something is wrong
 */

import { $ } from 'bun';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { logger } from '../src/lib/logger';

const POSTGRES_CONTAINER_NAME = 'babylon-postgres';
const REDIS_CONTAINER_NAME = 'babylon-redis';
const MINIO_CONTAINER_NAME = 'babylon-minio';
const COMPOSE_FILE = 'docker-compose.yml';
const LOCAL_DATABASE_URL = 'postgresql://babylon:babylon_dev_password@localhost:5433/babylon';
const REDIS_URL = 'redis://localhost:6380';

logger.info('Pre-development checks...', undefined, 'Script');

// Check/create .env file with DATABASE_URL and REDIS_URL
const envPath = join(process.cwd(), '.env');
if (!existsSync(envPath)) {
  logger.info('Creating .env file...', undefined, 'Script');
  writeFileSync(envPath, `DATABASE_URL="${LOCAL_DATABASE_URL}"\nREDIS_URL="${REDIS_URL}"\n`);
  logger.info('.env created', undefined, 'Script');
} else {
  // Read existing .env to check for Prisma Accelerate URL
  let envContent = readFileSync(envPath, 'utf-8');
  let needsUpdate = false;
  
  if (!envContent.includes('DATABASE_URL=')) {
    logger.info('Adding DATABASE_URL to .env...', undefined, 'Script');
    envContent += `\nDATABASE_URL="${LOCAL_DATABASE_URL}"\n`;
    needsUpdate = true;
  }
  
  if (!envContent.includes('REDIS_URL=')) {
    logger.info('Adding REDIS_URL to .env...', undefined, 'Script');
    envContent += `REDIS_URL="${REDIS_URL}"\n`;
    needsUpdate = true;
  }
  
  if (needsUpdate) {
    writeFileSync(envPath, envContent);
    logger.info('.env updated with local database connection', undefined, 'Script');
  }
}

// Load environment variables for local development
process.env.DATABASE_URL = LOCAL_DATABASE_URL;
process.env.REDIS_URL = REDIS_URL;

// Check Docker is installed
await $`docker --version`.quiet();
logger.info('Docker installed', undefined, 'Script');

// Check Docker is running
await $`docker info`.quiet();
logger.info('Docker running', undefined, 'Script');

// Check compose file exists
if (!existsSync(join(process.cwd(), COMPOSE_FILE))) {
  logger.error('docker-compose.yml not found', undefined, 'Script');
  process.exit(1);
}

// Check if PostgreSQL is running
const postgresRunning = await $`docker ps --filter name=${POSTGRES_CONTAINER_NAME} --format "{{.Names}}"`.quiet().text();

if (postgresRunning.trim() !== POSTGRES_CONTAINER_NAME) {
  // Not running, start it
  logger.info('Starting PostgreSQL...', undefined, 'Script');
  await $`docker-compose up -d postgres`;
  
  // Wait a moment for container to be created
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Wait for health check
  let attempts = 0;
  while (attempts < 30) {
    try {
      const health = await $`docker inspect --format='{{.State.Health.Status}}' ${POSTGRES_CONTAINER_NAME}`.quiet().text();
      
      if (health.trim() === 'healthy') {
        logger.info('PostgreSQL ready', undefined, 'Script');
        break;
      }
    } catch (error) {
      // Container not ready yet, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  
  if (attempts === 30) {
    logger.error('PostgreSQL health check timeout', undefined, 'Script');
    process.exit(1);
  }
} else {
  logger.info('PostgreSQL running', undefined, 'Script');
}

// Check if Redis is running
const redisRunning = await $`docker ps --filter name=${REDIS_CONTAINER_NAME} --format "{{.Names}}"`.quiet().text();

if (redisRunning.trim() !== REDIS_CONTAINER_NAME) {
  // Not running, try to start it
  logger.info('Starting Redis (on port 6380)...', undefined, 'Script');
  
  try {
    await $`docker-compose up -d redis`;
    
    // Wait a moment for container to be created
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Wait for health check
    let attempts = 0;
    while (attempts < 30) {
      try {
        const health = await $`docker inspect --format='{{.State.Health.Status}}' ${REDIS_CONTAINER_NAME}`.quiet().text();
        
        if (health.trim() === 'healthy') {
          logger.info('Redis ready (localhost:6380)', undefined, 'Script');
          break;
        }
      } catch {
        // Container might not be fully created yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (attempts === 30) {
      logger.warn('Redis health check timeout (continuing anyway)', undefined, 'Script');
      logger.info('Redis is optional - SSE will use polling fallback', undefined, 'Script');
    }
  } catch (error) {
    // Redis failed to start (port conflict, etc.)
    logger.warn('Could not start Redis container (this is OK)', undefined, 'Script');
    logger.info('Redis is optional - you can use existing Redis on port 6379', undefined, 'Script');
    logger.info('Or the app will use polling fallback for real-time features', undefined, 'Script');
  }
} else {
  logger.info('Redis running (localhost:6380)', undefined, 'Script');
}

// Check if MinIO is running
const minioRunning = await $`docker ps --filter name=${MINIO_CONTAINER_NAME} --format "{{.Names}}"`.quiet().text();

if (minioRunning.trim() !== MINIO_CONTAINER_NAME) {
  // Not running, try to start it
  logger.info('Starting MinIO (on ports 9000-9001)...', undefined, 'Script');
  
  try {
    await $`docker-compose up -d minio`;
    
    // Wait for health check
    let attempts = 0;
    while (attempts < 30) {
      try {
        const health = await $`docker inspect --format='{{.State.Health.Status}}' ${MINIO_CONTAINER_NAME}`.quiet().text();
        
        if (health.trim() === 'healthy') {
          logger.info('MinIO ready (localhost:9000-9001)', undefined, 'Script');
          break;
        }
      } catch {
        // Container might not be fully created yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    if (attempts === 30) {
      logger.warn('MinIO health check timeout (continuing anyway)', undefined, 'Script');
      logger.info('MinIO is optional - you can use Vercel Blob or other storage', undefined, 'Script');
    }
  } catch (error) {
    // MinIO failed to start (port conflict, etc.)
    logger.warn('Could not start MinIO container (this is OK)', undefined, 'Script');
    logger.info('MinIO is optional - you can use Vercel Blob or other storage', undefined, 'Script');
  }
} else {
  logger.info('MinIO running (localhost:9000-9001)', undefined, 'Script');
}

// Test database connection with Prisma
logger.info('Testing database connection...', undefined, 'Script');
const prisma = new PrismaClient();

// Just try to connect - will throw if fails
await prisma.$connect();
logger.info('Database connected', undefined, 'Script');

// Check if database needs migrations
logger.info('Checking database state...', undefined, 'Script');
let actorCount = 0;
let poolCount = 0;

try {
  // Try to query - will fail if tables don't exist
  actorCount = await prisma.actor.count();
  poolCount = await prisma.pool.count();
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  // Check if it's a "table does not exist" error
  if (errorMessage.includes('does not exist') || errorMessage.includes('P2021')) {
    logger.info('Database tables not found, checking migration status...', undefined, 'Script');
    
    // First, try to clean up any failed migrations in the database
    try {
      // Check if _prisma_migrations table exists
      const migrationsTable = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
        `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL LIMIT 1`
      ).catch(() => []);
      
      if (migrationsTable.length > 0) {
        const failedMigration = migrationsTable[0]?.migration_name;
        if (failedMigration) {
          logger.info(`Found failed migration: ${failedMigration}, removing...`, undefined, 'Script');
          await prisma.$executeRawUnsafe(
            `DELETE FROM "_prisma_migrations" WHERE migration_name = $1`,
            failedMigration
          );
          logger.info('Failed migration removed', undefined, 'Script');
        }
      }
    } catch (cleanupError) {
      // _prisma_migrations table might not exist yet, which is fine
      logger.info('No migrations table or cleanup not needed', undefined, 'Script');
    }
    
    logger.info('Applying migrations...', undefined, 'Script');
    // First try migrate deploy for existing migrations
    try {
      await $`bunx prisma migrate deploy`.quiet();
      logger.info('Migrations deployed', undefined, 'Script');
    } catch (migrateError) {
      logger.info('migrate deploy failed, syncing schema...', undefined, 'Script');
      // If migrations fail, sync schema directly (for development)
      await $`bunx prisma db push --skip-generate`.quiet();
      logger.info('Schema synced', undefined, 'Script');
    }
    
    // Try again after migrations
    try {
      actorCount = await prisma.actor.count();
      poolCount = await prisma.pool.count();
    } catch {
      // Tables still don't exist, might need to seed
      actorCount = 0;
      poolCount = 0;
    }
  } else {
    // Some other error, rethrow
    throw error;
  }
}

if (actorCount === 0) {
  logger.info('Database is empty, running seed...', undefined, 'Script');
  await $`bun run prisma/seed.ts`;
  logger.info('Database seeded', undefined, 'Script');
} else {
  logger.info(`Database has ${actorCount} actors and ${poolCount} pools`, undefined, 'Script');
  
  // Check if trader actors need points initialization
  const traderActors = await prisma.actor.findMany({
    where: { hasPool: true },
    select: { id: true, reputationPoints: true, profileImageUrl: true },
  });
  
  const needsPointsUpdate = traderActors.some(a => a.reputationPoints !== 10000);
  const needsImageUpdate = traderActors.some(a => !a.profileImageUrl);
  
  if (needsPointsUpdate || needsImageUpdate) {
    logger.info('Trader actors need initialization, updating...', undefined, 'Script');

    for (const actor of traderActors) {
      const imagePath = join(process.cwd(), 'public', 'images', 'actors', `${actor.id}.jpg`);
      const hasImage = existsSync(imagePath);
      const imageUrl = hasImage ? `/images/actors/${actor.id}.jpg` : null;
      
      if (actor.reputationPoints !== 10000 || (hasImage && !actor.profileImageUrl)) {
        await prisma.actor.update({
          where: { id: actor.id },
          data: {
            reputationPoints: 10000,
            ...(imageUrl && { profileImageUrl: imageUrl }),
          },
        });
      }
    }
    logger.info('Trader actors initialized', undefined, 'Script');
  }
}

// Check trending and news (informational only)
logger.info('Checking trending and news...', undefined, 'Script');
const trendingCount = await prisma.trendingTag.count();
const newsCount = await prisma.post.count({ where: { type: 'article' } });

const MIN_TRENDING = 5;
const MIN_NEWS = 10;

if (trendingCount < MIN_TRENDING || newsCount < MIN_NEWS) {
  logger.info(`Trending (${trendingCount}/${MIN_TRENDING}) and news (${newsCount}/${MIN_NEWS}) not populated`, undefined, 'Script');
  logger.info('💡 To initialize: bun run scripts/init-trending-and-news.ts', undefined, 'Script');
  logger.info('   (This is optional and can be done later)', undefined, 'Script');
} else {
  logger.info(`Trending (${trendingCount}) and news (${newsCount}) already populated`, undefined, 'Script');
}

// Check if posts need tagging for trending to work
logger.info('Checking post tagging...', undefined, 'Script');
const totalPosts = await prisma.post.count();
const postsWithTags = await prisma.post.count({
  where: { postTags: { some: {} } }
});
const untaggedPosts = totalPosts - postsWithTags;

if (untaggedPosts > 0 && totalPosts > 0) {
  const taggedPercentage = Math.round((postsWithTags / totalPosts) * 100);
  logger.info(`Posts: ${postsWithTags}/${totalPosts} tagged (${taggedPercentage}%)`, undefined, 'Script');
  
  // If more than 20% of posts are untagged and we have more than 10 posts, suggest backfill
  if (untaggedPosts > 10 && taggedPercentage < 80) {
    logger.info('⚠️  Many posts are untagged. Trending may not work well.', undefined, 'Script');
    logger.info('💡 To tag existing posts, run: bun run backfill:tags', undefined, 'Script');
    logger.info('   New posts will be tagged automatically.', undefined, 'Script');
  }
} else {
  logger.info(`All ${totalPosts} posts are tagged`, undefined, 'Script');
}

await prisma.$disconnect();

logger.info('All checks passed! Starting Next.js...', undefined, 'Script');

