/**
 * Babylon Game Daemon
 *
 * Continuously running game engine that generates content every minute.
 * - Runs at 1x speed
 * - Generates 10-20 posts per minute
 * - Updates stock prices every minute
 * - Creates/resolves questions automatically
 * - Keeps rolling 30-day history
 * - Does NOT auto-start ElizaOS agents (agents should be started separately)
 *
 * Usage:
 *   npm run daemon              (start daemon)
 *   npm run daemon:verbose      (with detailed logging)
 *
 * Environment Variables:
 *   AUTO_START_AGENTS=true      (default: false) - Auto-start agents on daemon launch (not recommended)
 *   AGENT_AUTO_TRADE=true       (default: false) - Enable auto-trading for agents
 */
import { type ChildProcess, spawn } from 'child_process';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

import { clearEngineInstance, setEngineInstance } from '@/lib/engine';
import { logger } from '@/lib/logger';

import { GameEngine } from '../engine/GameEngine';
import { registerBabylonGame } from '../lib/babylon-registry-init';

interface CLIOptions {
  verbose?: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  args.forEach((arg) => {
    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  });

  return options;
}

async function main() {
  const options = parseArgs();

  logger.info('BABYLON GAME DAEMON', undefined, 'CLI');
  logger.info('===================', undefined, 'CLI');

  // Validate API key
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!groqKey && !openaiKey) {
    logger.error('ERROR: No API key found!', undefined, 'CLI');
    logger.error(
      'Set GROQ_API_KEY or OPENAI_API_KEY environment variable.',
      undefined,
      'CLI'
    );
    process.exit(1);
  }

  if (groqKey) {
    logger.info('Using Groq (fast inference)', undefined, 'CLI');
  } else if (openaiKey) {
    logger.info('Using OpenAI', undefined, 'CLI');
  }

  // Create engine with A2A enabled
  const engine = new GameEngine({
    tickIntervalMs: 60000, // 1 minute
    postsPerTick: 15, // Average 15 posts/minute
    historyDays: 30,
    a2a: {
      enabled: true, // Enable A2A protocol
      port: 8081,
      host: '0.0.0.0',
      maxConnections: 1000,
      enableBlockchain: process.env.A2A_ENABLE_BLOCKCHAIN === 'true', // Enable blockchain integration for agent discovery
    },
  });

  // Set up event listeners
  engine.on('tick', (tick) => {
    if (options.verbose) {
      logger.info(
        'Tick Summary:',
        {
          posts: tick.posts.length,
          priceUpdates: tick.priceUpdates.length,
          events: tick.events.length,
          questionsResolved: tick.questionsResolved,
          questionsCreated: tick.questionsCreated,
        },
        'CLI'
      );
    }
  });

  engine.on('error', (error) => {
    logger.error('Engine Error:', error, 'CLI');
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down daemon...', undefined, 'CLI');
    logger.info('Final Stats:', undefined, 'CLI');
    const state = engine.getState();
    logger.info(`Total Actors: ${state.actors}`, undefined, 'CLI');
    logger.info(`Companies: ${state.companies}`, undefined, 'CLI');
    logger.info(`Active Questions: ${state.activeQuestions}`, undefined, 'CLI');
    logger.info(`Total Questions: ${state.totalQuestions}`, undefined, 'CLI');
    logger.info(`History Ticks: ${state.recentTicks}`, undefined, 'CLI');

    await engine.stop();
    clearEngineInstance();
    logger.info('Daemon stopped', undefined, 'CLI');
    process.exit(0);
  });

  // Also handle SIGTERM for process managers
  process.on('SIGTERM', async () => {
    logger.info(
      'Received SIGTERM, shutting down gracefully...',
      undefined,
      'CLI'
    );
    await engine.stop();
    clearEngineInstance();
    process.exit(0);
  });

  // Initialize and start
  await engine.initialize();
  engine.start();

  // Register engine instance so API routes can query status
  setEngineInstance(engine);
  logger.info('Engine instance registered for API access', undefined, 'CLI');

  // Auto-register game with Agent0 if enabled
  if (process.env.AGENT0_ENABLED === 'true') {
    logger.info('Registering Babylon with Agent0...', undefined, 'CLI');
    try {
      const result = await registerBabylonGame();
      if (result) {
        logger.info(
          `✅ Babylon registered with Agent0 (Token ID: ${result.tokenId})`,
          undefined,
          'CLI'
        );
      } else {
        logger.info('Babylon already registered with Agent0', undefined, 'CLI');
      }
    } catch (error) {
      logger.warn('Failed to register with Agent0 (non-fatal):', error, 'CLI');
      logger.warn(
        'Game will continue without Agent0 registration',
        undefined,
        'CLI'
      );
    }
  }

  // Auto-start agents only if explicitly enabled
  const autoStartAgents = process.env.AUTO_START_AGENTS === 'true'; // Default to false
  if (autoStartAgents) {
    logger.info(
      'Starting agents (AUTO_START_AGENTS=true)...',
      undefined,
      'CLI'
    );
    await startAgents();
  } else {
    logger.info(
      'Agent auto-start disabled. Start agents separately with: bun run eliza:all',
      undefined,
      'CLI'
    );
  }

  // Keep process alive
  await new Promise(() => {});
}

// Track if agents have been started to prevent duplicate spawning
let agentsStarted = false;
let agentProcess: ChildProcess | null = null;

/**
 * Start all agents using the spawn script
 * Prevents duplicate spawning if called multiple times
 */
async function startAgents(): Promise<void> {
  // If agents already started, don't start again
  if (agentsStarted && agentProcess) {
    logger.info(
      'Agents already started, skipping duplicate spawn',
      undefined,
      'CLI'
    );
    return;
  }

  const agentScript = join(process.cwd(), 'scripts', 'run-all-agents.ts');
  const autoTrade = process.env.AGENT_AUTO_TRADE === 'true';

  logger.info(
    `Spawning agents with auto-trade: ${autoTrade ? 'ENABLED' : 'DISABLED'}`,
    undefined,
    'CLI'
  );

  agentProcess = spawn(
    'bun',
    [
      agentScript,
      '--max=1', // Only start 1 agent on daemon bootup
      ...(autoTrade ? ['--auto-trade'] : []),
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
      },
    }
  );

  agentsStarted = true;

  // Log agent output
  agentProcess.stdout?.on('data', (data) => {
    const lines = data
      .toString()
      .split('\n')
      .filter((line: string) => line.trim());
    lines.forEach((line: string) => {
      if (
        line.includes('✅') ||
        line.includes('❌') ||
        line.includes('Starting')
      ) {
        logger.info(line, undefined, 'CLI');
      }
    });
  });

  agentProcess.stderr?.on('data', (data) => {
    const errorLines = data
      .toString()
      .split('\n')
      .filter((line: string) => line.trim());
    errorLines.forEach((line: string) => {
      if (line.includes('Error') || line.includes('error')) {
        logger.warn(line, undefined, 'CLI');
      }
    });
  });

  agentProcess.on('exit', (code) => {
    agentsStarted = false;
    agentProcess = null;
    if (code !== 0 && code !== null) {
      logger.warn(
        `Agent spawn process exited with code ${code}`,
        undefined,
        'CLI'
      );
    }
  });

  // Wait a bit to see if agents start successfully
  await new Promise((resolve) => setTimeout(resolve, 5000));

  logger.info('Agent spawn process started', undefined, 'CLI');
}

function isDirectExecution(): boolean {
  if (typeof process === 'undefined' || !process.argv?.[1]) {
    return false;
  }

  try {
    const modulePath = fileURLToPath(import.meta.url);
    return modulePath === resolve(process.argv[1]!);
  } catch {
    return false;
  }
}

const invokedDirectly =
  (import.meta as unknown as { main?: boolean })?.main === true
    ? true
    : isDirectExecution();

if (invokedDirectly) {
  main().catch((error) => {
    logger.error(
      'Daemon crashed during startup',
      {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'CLI'
    );
    process.exit(1);
  });
}

export { main };
