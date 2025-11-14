#!/usr/bin/env node

/**
 * Run Eliza Agent - ElizaOS Latest
 *
 * Starts an Eliza agent that interacts with Babylon prediction markets as a real player
 * Following latest ElizaOS best practices and architecture patterns
 */

import {
  logger,
  type Character,
  type IAgentRuntime,
  AgentRuntime,
  stringToUuid,
} from '@elizaos/core';
import sqlPlugin from '@elizaos/plugin-sql/node';
import { predictionMarketsPlugin } from '../../../plugin-babylon/src';
import * as fs from 'fs';
import * as path from 'path';
import type { JsonValue } from '@/types/common';

interface CLIOptions {
  character?: string;
  apiUrl?: string;
  authToken?: string;
  maxTradeSize?: number;
  autoTrade?: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    apiUrl: 'http://localhost:3000',
    maxTradeSize: 100,
    autoTrade: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--character':
      case '-c':
        options.character = args[++i];
        break;
      case '--api-url':
      case '-u':
        options.apiUrl = args[++i];
        break;
      case '--auth-token':
      case '-t':
        options.authToken = args[++i];
        break;
      case '--max-trade':
      case '-m':
        options.maxTradeSize = parseInt(args[++i] || '100');
        break;
      case '--auto-trade':
      case '-a':
        options.autoTrade = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  logger.info(`
🤖 Eliza Agent Runner for Babylon Game

Usage: bun run src/eliza/agents/run-eliza-agent-v2.ts [options]

Options:
  -c, --character <path>     Path to character JSON file (default: alice-trader.json)
  -u, --api-url <url>        Babylon API base URL (default: http://localhost:3000)
  -t, --auth-token <token>   Optional: Manual authentication token (overrides auto-auth)
  -m, --max-trade <amount>   Maximum trade size in USD (default: 100)
  -a, --auto-trade           Enable automatic trading based on analysis
  -h, --help                 Show this help message

Authentication:
  Agents authenticate automatically using BABYLON_AGENT_ID and BABYLON_AGENT_SECRET
  from environment variables. No manual Privy tokens required.

  Set in .env file:
    BABYLON_AGENT_ID=babylon-agent-alice
    BABYLON_AGENT_SECRET=<generate with: openssl rand -hex 32>

Database Configuration:
  PostgreSQL (Production - Recommended):
    POSTGRES_URL=postgresql://user:password@localhost:5432/babylon

  PGlite (Development - Embedded Database):
    If POSTGRES_URL is not set, PGlite will be used automatically
    Optional: PGLITE_DATA_DIR=./data/pglite (default)

Examples:
  # Run Alice with automatic authentication (requires .env configuration)
  bun run src/eliza/agents/run-eliza-agent-v2.ts

  # Run with auto-trading enabled
  bun run src/eliza/agents/run-eliza-agent-v2.ts --auto-trade --max-trade 50

  # Run custom character
  bun run src/eliza/agents/run-eliza-agent-v2.ts --character ./src/eliza/characters/bob-analyst.json
  `);
}

async function loadCharacter(characterPath?: string): Promise<Character> {
  if (!characterPath) {
    // Default to Alice trader
    characterPath = path.join(__dirname, '../characters/alice-trader.json');
  }

  const characterData = fs.readFileSync(characterPath, 'utf-8');
  const character = JSON.parse(characterData);

  // Validate required fields
  if (!character.name) {
    throw new Error('Character missing required field: name');
  }

  return character;
}

/**
 * Initialize character with Babylon plugin
 * This follows latest ElizaOS Service pattern
 *
 * Configuration is passed via character.settings, which BabylonClientService reads
 * during its start() method when the plugin loads
 */
async function initCharacter({ runtime, options }: { runtime: IAgentRuntime; options: CLIOptions }) {
  logger.info('Initializing Babylon trading character');
  logger.info({ name: runtime.character.name }, 'Character:');

  // Note: BabylonClientService.start() automatically reads from character.settings
  // The service was already initialized when plugins loaded during runtime creation

  logger.info('✅ Babylon services initialized via plugin');

  // Enable auto-trading if requested
  if (options.autoTrade) {
    logger.info('📊 Auto-trading enabled via CLI flag');
    const tradingService = runtime.getService('babylon_trading');
    interface TradingService {
      enableAutoTrading?: () => void
    }
    const typedTradingService = tradingService as TradingService | null
    if (typedTradingService && typeof typedTradingService.enableAutoTrading === 'function') {
      typedTradingService.enableAutoTrading();
    }
  }
}

async function main() {
  const options = parseArgs();

  logger.info('Starting Eliza Agent for Babylon Game');

  // Validate required environment variables
  // API keys are read automatically by ElizaOS from environment
  const hasModelProvider = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!hasModelProvider) {
    logger.warn('No model provider API key found in environment');
    logger.warn('Set OPENAI_API_KEY, GROQ_API_KEY, or ANTHROPIC_API_KEY');
    logger.warn('Agent may not be able to generate responses');
  }

  // Load character
  logger.info('Loading character...');
  let character = await loadCharacter(options.character);
  logger.info(`Loaded character: ${character.name}`);

  // Initialize database configuration
  logger.info('Configuring database...');

  const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  // Use .eliza/.elizadb as default to match ElizaOS conventions
  const dataDir = process.env.PGLITE_DATA_DIR || path.join(process.cwd(), '.eliza', '.elizadb');

  // Ensure data directory exists if using PGlite
  if (!postgresUrl) {
    if (!fs.existsSync(dataDir)) {
      logger.info(`Creating PGlite data directory: ${dataDir}`);
      fs.mkdirSync(dataDir, { recursive: true });
    }
    logger.warn('POSTGRES_URL not set, using PGlite embedded database for development');
    logger.warn('For production, set POSTGRES_URL=postgresql://user:password@host:5432/database');
    logger.info(`PGlite data directory: ${dataDir}`);
  } else {
    logger.info('Using PostgreSQL database');
  }

  // Add Babylon configuration and database settings to character
  // Latest ElizaOS pattern: plugins (including SQL plugin) are configured in character
  logger.info('Configuring character with plugins and settings...');

  // Determine model provider - prioritize Groq if available, otherwise use character default
  const hasGroqKey = !!process.env.GROQ_API_KEY;
  // Character JSON files have modelProvider, but TypeScript type may not include it
  const characterModelProvider = (character as { modelProvider?: string }).modelProvider || 'openai';
  const modelProvider = hasGroqKey ? 'groq' : characterModelProvider;
  
  if (hasGroqKey && characterModelProvider !== 'groq') {
    logger.info(`Overriding modelProvider from "${characterModelProvider}" to "groq" (GROQ_API_KEY found in .env)`, undefined, 'run-eliza-agent');
  }
  
  // Build settings object with only defined optional values
  const characterSettings: Record<string, string | number | boolean | Record<string, JsonValue>> = {
    ...(character.settings || {}),
    // Babylon plugin configuration
    babylonApiUrl: options.apiUrl || 'http://localhost:3000',
    babylonMaxTradeSize: options.maxTradeSize || 100,
    babylonMaxPositionSize: 500,
    babylonMinConfidence: 0.6,
    autoTrading: options.autoTrade || false,
    // Database configuration for SQL plugin
    dataDir,
  };

  // Add optional settings only if they're defined
  if (options.authToken) {
    characterSettings.babylonAuthToken = options.authToken;
  }
  if (postgresUrl) {
    characterSettings.postgresUrl = postgresUrl;
  }

  // Update character with modelProvider override if Groq is available
  character = {
    ...character,
    ...(hasGroqKey ? { modelProvider: 'groq' as const } : {}), // Override with Groq if available
    settings: characterSettings,
    plugins: [
      '@elizaos/plugin-bootstrap',  // Bootstrap plugin for core ElizaOS functionality
      '@elizaos/plugin-sql',        // SQL plugin provides database adapter
      ...(Array.isArray(character.plugins) ? character.plugins : []),
    ],
  } as Character;
  
  logger.info(`Using model provider: ${modelProvider}`, undefined, 'run-eliza-agent');
  logger.info(`Model provider details: groqKeyAvailable=${hasGroqKey}, selectedProvider=${modelProvider}, originalProvider=${characterModelProvider}`, undefined, 'run-eliza-agent');
  logger.info('Character configured with plugins and settings');

  // Generate agent ID from character name for stability across restarts
  // Falls back to random UUID if no character name
  const agentId = stringToUuid(character.name || crypto.randomUUID());

  // Create agent runtime
  // Latest ElizaOS: AgentRuntime automatically reads API keys from environment variables
  // API keys should be set: OPENAI_API_KEY, GROQ_API_KEY, or ANTHROPIC_API_KEY
  // Plugin objects (not strings) are passed to AgentRuntime constructor
  // The SQL plugin's init() function will create and register the database adapter
  logger.info('Creating agent runtime...');
  const runtime = new AgentRuntime({
    character,
    agentId,
    plugins: [sqlPlugin, predictionMarketsPlugin],  // SQL plugin must be first to initialize database adapter
  });

  // Initialize character with Babylon-specific setup
  await initCharacter({ runtime, options });

  logger.info('Agent runtime created');

  // Initialize runtime (starts all services including BabylonTradingService)
  logger.info('Initializing agent runtime...');
  await runtime.initialize();
  logger.info('Runtime initialized');

  // Start agent
  logger.info('Agent ready!');
  logger.info('════════════════════════════════════════════════════════════');
  logger.info(`Agent: ${character.name}`);
  logger.info(`Personality: ${character.bio?.[0] || 'No bio available'}`);
  logger.info(`API: ${options.apiUrl}`);
  logger.info(`Max Trade: $${options.maxTradeSize}`);
  logger.info(`Auto-Trade: ${options.autoTrade ? 'Enabled' : 'Disabled'}`);
  logger.info('Providers: Market Data, Wallet Status, Positions (active)');
  logger.info('════════════════════════════════════════════════════════════');

  if (!options.authToken) {
    if (process.env.BABYLON_AGENT_SECRET) {
      logger.info('Agent authentication: Using BABYLON_AGENT_SECRET from environment');
      logger.info('Agent will authenticate automatically without Privy tokens');
    } else {
      logger.warn('No authentication configured. Agent will not be able to trade.');
      logger.warn('Option 1: Set BABYLON_AGENT_SECRET in .env (recommended)');
      logger.warn('Option 2: Provide token with: --auth-token <your-privy-token>');
    }
  } else {
    logger.info('Agent authentication: Using provided auth token');
  }

  logger.info('Agent active and monitoring');
  logger.info('   - Providers inject real-time market/wallet/position data');
  logger.info('   - Evaluators analyze markets and portfolio');
  logger.info('   - Actions execute trades when triggered');
  if (options.autoTrade) {
    logger.info('   - Service monitors markets every 60s, reviews portfolio every 5m');
  } else {
    logger.info('   - Interactive mode: Send messages to trigger analysis and trading');
  }

  // Keep process alive
  await new Promise(() => {});
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down agent...');
  process.exit(0);
});

// Export main function for programmatic use
export { main };

// Run main function when executed directly
// This works for both Bun and Node runtimes
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
