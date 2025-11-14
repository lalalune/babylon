#!/usr/bin/env bun

/**
 * Database Management Script
 * 
 * Manages PostgreSQL Docker container for Babylon
 * - Checks for Docker installation
 * - Starts/stops PostgreSQL container
 * - Shows database status
 * - Runs migrations and seeds
 * 
 * Usage:
 *   bun scripts/db.ts start       # Start PostgreSQL
 *   bun scripts/db.ts stop        # Stop PostgreSQL
 *   bun scripts/db.ts restart     # Restart PostgreSQL
 *   bun scripts/db.ts status      # Check status
 *   bun scripts/db.ts migrate     # Run Prisma migrations
 *   bun scripts/db.ts seed        # Seed database
 *   bun scripts/db.ts reset       # Reset database (drop + migrate + seed)
 */

import { $ } from 'bun';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../src/lib/logger';

const CONTAINER_NAME = 'babylon-postgres';
const COMPOSE_FILE = 'docker-compose.yml';

/**
 * Check if Docker is installed and running
 */
async function checkDocker(): Promise<void> {
  logger.info('Checking Docker installation...', undefined, 'Script');

  // Check if Docker is installed
  await $`docker --version`.quiet().catch(() => {
    logger.error('ERROR: Docker is not installed!', undefined, 'Script');
    logger.error('Docker is required to run the PostgreSQL database.', undefined, 'Script');
    logger.error('Install Docker:', {
      macOS: 'https://docs.docker.com/desktop/install/mac-install/',
      linux: 'https://docs.docker.com/engine/install/',
      windows: 'https://docs.docker.com/desktop/install/windows-install/'
    }, 'Script');
    process.exit(1);
  });

  // Check if Docker daemon is running
  await $`docker info`.quiet().catch(() => {
    logger.error('ERROR: Docker is installed but not running!', undefined, 'Script');
    logger.error('Please start Docker Desktop or the Docker daemon.', undefined, 'Script');
    process.exit(1);
  });

  logger.info('Docker is installed and running', undefined, 'Script');
}

/**
 * Check if docker-compose.yml exists
 */
function checkComposeFile(): void {
  const composePath = join(process.cwd(), COMPOSE_FILE);
  
  if (!existsSync(composePath)) {
    logger.error(`ERROR: ${COMPOSE_FILE} not found!`, undefined, 'Script');
    logger.error('Please ensure docker-compose.yml exists in the project root.', undefined, 'Script');
    process.exit(1);
  }
}

/**
 * Check if PostgreSQL container is running
 */
async function isContainerRunning(): Promise<boolean> {
  const result = await $`docker ps --filter name=${CONTAINER_NAME} --format "{{.Names}}"`.quiet().text().catch(() => '');
  return result.trim() === CONTAINER_NAME;
}

/**
 * Check if PostgreSQL container exists (running or stopped)
 */
async function doesContainerExist(): Promise<boolean> {
  const result = await $`docker ps -a --filter name=${CONTAINER_NAME} --format "{{.Names}}"`.quiet().text().catch(() => '');
  return result.trim() === CONTAINER_NAME;
}

/**
 * Start PostgreSQL container
 */
async function startDatabase(): Promise<void> {
  logger.info('Starting PostgreSQL...', undefined, 'Script');

  await checkDocker();
  checkComposeFile();

  const isRunning = await isContainerRunning();
  
  if (isRunning) {
    logger.info('PostgreSQL is already running!', undefined, 'Script');
    await showConnectionInfo();
    return;
  }

  await $`docker-compose up -d postgres`;
  
  logger.info('Waiting for PostgreSQL to be ready...', undefined, 'Script');
  
  // Wait for health check
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    const health = await $`docker inspect --format='{{.State.Health.Status}}' ${CONTAINER_NAME}`.quiet().text().catch(() => '');
    
    if (health.trim() === 'healthy') {
      logger.info('PostgreSQL is ready!', undefined, 'Script');
      await showConnectionInfo();
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  
  logger.warn('PostgreSQL started but health check timeout. It may still be starting...', undefined, 'Script');
  await showConnectionInfo();
}

/**
 * Stop PostgreSQL container
 */
async function stopDatabase(): Promise<void> {
  logger.info('Stopping PostgreSQL...', undefined, 'Script');

  await checkDocker();

  const isRunning = await isContainerRunning();
  
  if (!isRunning) {
    logger.info('PostgreSQL is not running', undefined, 'Script');
    return;
  }

  await $`docker-compose stop postgres`;
  logger.info('PostgreSQL stopped', undefined, 'Script');
}

/**
 * Restart PostgreSQL container
 */
async function restartDatabase(): Promise<void> {
  logger.info('Restarting PostgreSQL...', undefined, 'Script');
  
  await stopDatabase();
  await new Promise(resolve => setTimeout(resolve, 2000));
  await startDatabase();
}

/**
 * Show database status
 */
async function showStatus(): Promise<void> {
  logger.info('Database Status', undefined, 'Script');
  logger.info('═'.repeat(50), undefined, 'Script');

  await checkDocker();

  const exists = await doesContainerExist();
  const isRunning = await isContainerRunning();

  if (!exists) {
    logger.info('Status: Not created', undefined, 'Script');
    logger.info('Run `bun run db:start` to create and start the database.', undefined, 'Script');
    return;
  }

  if (isRunning) {
    logger.info('Status: Running', undefined, 'Script');
    
    const uptime = await $`docker inspect --format='{{.State.StartedAt}}' ${CONTAINER_NAME}`.quiet().text().catch(() => '');
    if (uptime) {
      logger.info(`Started: ${uptime.trim()}`, undefined, 'Script');
    }
    
    const health = await $`docker inspect --format='{{.State.Health.Status}}' ${CONTAINER_NAME}`.quiet().text().catch(() => '');
    if (health) {
      logger.info(`Health: ${health.trim()}`, undefined, 'Script');
    }
    
    await showConnectionInfo();
  } else {
    logger.info('Status: Stopped', undefined, 'Script');
    logger.info('Run `bun run db:start` to start the database.', undefined, 'Script');
  }
}

/**
 * Show connection information
 */
async function showConnectionInfo(): Promise<void> {
  logger.info('Connection Info:', {
    host: 'localhost',
    port: 5432,
    database: 'babylon',
    user: 'babylon',
    password: 'babylon_dev_password',
    url: 'postgresql://babylon:babylon_dev_password@localhost:5432/babylon'
  }, 'Script');
}

/**
 * Run Prisma migrations
 */
async function runMigrations(): Promise<void> {
  logger.info('Running Prisma migrations...', undefined, 'Script');

  const isRunning = await isContainerRunning();
  
  if (!isRunning) {
    logger.error('PostgreSQL is not running!', undefined, 'Script');
    logger.error('Start it first with: bun run db:start', undefined, 'Script');
    process.exit(1);
  }

  await $`bunx prisma migrate dev`;
  logger.info('Migrations complete', undefined, 'Script');
}

/**
 * Seed the database
 */
async function seedDatabase(): Promise<void> {
  logger.info('Seeding database...', undefined, 'Script');

  const isRunning = await isContainerRunning();
  
  if (!isRunning) {
    logger.error('PostgreSQL is not running!', undefined, 'Script');
    logger.error('Start it first with: bun run db:start', undefined, 'Script');
    process.exit(1);
  }

  await $`bunx prisma db seed`;
  logger.info('Database seeded', undefined, 'Script');
}

/**
 * Reset database (drop + migrate + seed)
 */
async function resetDatabase(): Promise<void> {
  logger.warn('Resetting database (this will delete all data)...', undefined, 'Script');

  const isRunning = await isContainerRunning();
  
  if (!isRunning) {
    logger.error('PostgreSQL is not running!', undefined, 'Script');
    logger.error('Start it first with: bun run db:start', undefined, 'Script');
    process.exit(1);
  }

  logger.info('Dropping database...', undefined, 'Script');
  await $`bunx prisma migrate reset --force`;
  logger.info('Database reset complete', undefined, 'Script');
}

/**
 * Show help
 */
function showHelp(): void {
  logger.info(`
Babylon Database Management

Usage: bun scripts/db.ts <command>

Commands:
  start       Start PostgreSQL container
  stop        Stop PostgreSQL container
  restart     Restart PostgreSQL container
  status      Show database status
  migrate     Run Prisma migrations
  seed        Seed database with actors
  reset       Reset database (drop + migrate + seed)
  help        Show this help message

Examples:
  bun scripts/db.ts start
  bun scripts/db.ts migrate
  bun scripts/db.ts seed
  bun scripts/db.ts status

Environment:
  The database connection URL should be set in your .env file:
  DATABASE_URL="postgresql://babylon:babylon_dev_password@localhost:5432/babylon"
`, undefined, 'Script');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case 'start':
      await startDatabase();
      break;
    
    case 'stop':
      await stopDatabase();
      break;
    
    case 'restart':
      await restartDatabase();
      break;
    
    case 'status':
      await showStatus();
      break;
    
    case 'migrate':
      await runMigrations();
      break;
    
    case 'seed':
      await seedDatabase();
      break;
    
    case 'reset':
      await resetDatabase();
      break;
    
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    
    default:
      logger.error(`Unknown command: ${command || '(none)'}`, undefined, 'Script');
      showHelp();
      process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}

export { main };


