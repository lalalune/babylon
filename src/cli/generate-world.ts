#!/usr/bin/env bun

/**
 * @fileoverview Game World Narrative Generator CLI
 * 
 * Generates complete game narratives with all NPC actions, events, conversations,
 * and social media posts. Creates a detailed timeline of events leading to a
 * predetermined outcome (SUCCESS or FAILURE).
 * 
 * **Core Features:**
 * - Full narrative generation with NPC behaviors
 * - Day-by-day timeline simulation (default: 30 days)
 * - Configurable outcome (YES/NO for prediction market)
 * - Event-driven architecture with detailed logging
 * - JSON export for integration with other systems
 * - Verbose mode for detailed event tracking
 * 
 * **Generated Content:**
 * - NPC actions and behaviors
 * - Conversations between NPCs
 * - News articles and publications
 * - Rumors and speculation
 * - Clues pointing to outcome
 * - Market developments
 * - Feed posts (news, reactions, threads)
 * 
 * **Event Types:**
 * - `world:started` - World generation begins
 * - `day:begins` - New day starts
 * - `npc:action` - NPC performs action
 * - `npc:conversation` - NPCs converse
 * - `news:published` - News article published
 * - `rumor:spread` - Rumor spreads
 * - `clue:revealed` - Clue about outcome revealed
 * - `development:occurred` - Major development happens
 * - `feed:post` - Social media post created
 * - `outcome:revealed` - Final outcome revealed
 * 
 * @module cli/generate-world
 * @category CLI - Game Generation
 * 
 * @example
 * ```bash
 * # Generate with default settings (SUCCESS outcome)
 * bun run src/cli/generate-world.ts
 * 
 * # Generate with specific outcome
 * bun run src/cli/generate-world.ts --outcome=FAILURE
 * 
 * # Generate with verbose logging
 * bun run src/cli/generate-world.ts --verbose
 * 
 * # Save to file
 * bun run src/cli/generate-world.ts --save=world.json
 * 
 * # Get JSON output only (for piping)
 * bun run src/cli/generate-world.ts --json
 * ```
 * 
 * @see {@link GameWorld} for world generation implementation
 * @see {@link ../engine/GameWorld.ts} for implementation details
 * @since v0.1.0
 */

import { GameWorld } from '../engine/GameWorld';
import { writeFile } from 'fs/promises';
import { logger } from '@/lib/logger';

/**
 * Command-line options for world generation
 * @interface CLIOptions
 * @property {'SUCCESS' | 'FAILURE'} [outcome] - Predetermined world outcome
 * @property {string} [save] - File path to save world JSON
 * @property {boolean} [verbose] - Enable detailed event logging
 * @property {boolean} [json] - Output JSON only (no logs)
 */
interface CLIOptions {
  outcome?: 'SUCCESS' | 'FAILURE';
  save?: string;
  verbose?: boolean;
  json?: boolean;
}

/**
 * Parses command-line arguments into typed options
 * 
 * **Supported Arguments:**
 * - `--outcome=SUCCESS` or `--outcome=FAILURE` - Set predetermined outcome
 * - `--save=filename.json` - Save world to JSON file
 * - `--verbose` or `-v` - Enable verbose logging
 * - `--json` - Output JSON only (for piping to other tools)
 * 
 * @returns {CLIOptions} Parsed command-line options
 * @example
 * ```typescript
 * // Called internally with:
 * // bun run generate-world.ts --outcome=SUCCESS --verbose
 * const options = parseArgs();
 * // { outcome: 'SUCCESS', verbose: true }
 * ```
 */
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  args.forEach(arg => {
    if (arg.startsWith('--outcome=')) {
      options.outcome = arg.split('=')[1] as 'SUCCESS' | 'FAILURE';
    } else if (arg.startsWith('--save=')) {
      options.save = arg.split('=')[1];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--json') {
      options.json = true;
    }
  });

  return options;
}

/**
 * Main execution function for world generation CLI
 * 
 * Creates a complete game world narrative with:
 * 1. Question/scenario setup
 * 2. NPC cast (default: 8 NPCs)
 * 3. 30-day timeline simulation
 * 4. Event-driven narrative generation
 * 5. Social media feed generation
 * 6. Outcome revelation
 * 
 * **Verbosity Levels:**
 * - Normal: Basic progress indicators
 * - Verbose: All events, actions, and posts
 * - JSON: Raw output only (no logs)
 * 
 * **Output Modes:**
 * - Console: Formatted narrative logs
 * - JSON: Machine-readable world data
 * - File: Saved JSON for later use
 * 
 * @throws {Error} Exits with code 1 if world generation fails
 * @returns {Promise<void>} Exits with code 0 on success
 * @example
 * ```bash
 * # Generate and watch narrative unfold
 * bun run src/cli/generate-world.ts --verbose
 * 
 * # Output:
 * # GENERATING BABYLON GAME WORLD
 * # =================================
 * # Question: Will the AI regulation bill pass?
 * # True Outcome: SUCCESS
 * # NPCs in world: 8
 * # --- TIMELINE ---
 * # DAY 1
 * # ──────────────────────────────────────────────
 * # Senator Smith: Announces support for AI bill
 * # Tech CEO Jones: Posts skepticism on social media
 * # ...
 * # ================================================
 * # FINAL OUTCOME: SUCCESS
 * # ================================================
 * # World generation complete
 * # { totalEvents: 450, npcs: 8, daysSimulated: 30 }
 * ```
 */
async function main() {
  const options = parseArgs();
  
  const outcomeValue = options.outcome === 'FAILURE' ? false : true;

  const world = new GameWorld({
    outcome: outcomeValue,
    numNPCs: 8,
    duration: 30,
    verbosity: options.verbose ? 'detailed' : 'normal',
  });

  if (options.verbose && !options.json) {
    logger.info('GENERATING BABYLON GAME WORLD', undefined, 'CLI');
    logger.info('=================================', undefined, 'CLI');

    world.on('world:started', (event) => {
      logger.info(`Question: ${event.data.question}`, undefined, 'CLI');
      logger.info(`True Outcome: ${outcomeValue ? 'SUCCESS' : 'FAILURE'}`, undefined, 'CLI');
      logger.info(`NPCs in world: ${event.data.npcs}`, undefined, 'CLI');
      logger.info('--- TIMELINE ---', undefined, 'CLI');
    });

    world.on('day:begins', (event) => {
      logger.info(`DAY ${event.data.day}`, undefined, 'CLI');
      logger.info('─'.repeat(50), undefined, 'CLI');
    });

    world.on('npc:action', (event) => {
      logger.info(`${event.npc}: ${event.description}`, undefined, 'CLI');
    });

    world.on('npc:conversation', (event) => {
      logger.info(event.description, undefined, 'CLI');
    });

    world.on('news:published', (event) => {
      logger.info(`${event.npc}: ${event.description}`, undefined, 'CLI');
    });

    world.on('rumor:spread', (event) => {
      logger.info(`Rumor: ${event.description}`, undefined, 'CLI');
    });

    world.on('clue:revealed', (event) => {
      logger.info(`${event.npc}: ${event.description}`, undefined, 'CLI');
    });

    world.on('development:occurred', (event) => {
      logger.info(`DEVELOPMENT: ${event.description}`, undefined, 'CLI');
    });

    world.on('feed:post', (post) => {
      const emoji = post.type === 'news' ? '📰' : 
                   post.type === 'reaction' ? '💬' :
                   post.type === 'thread' ? '🧵' : '📢';
      
      const prefix = post.replyTo ? '    ↳' : '  ';
      logger.info(`${prefix}${emoji} ${post.author}: ${post.content}`, undefined, 'CLI');
      
      if (post.clueStrength > 0.5) {
        logger.debug(`${prefix}   [Strong clue: ${post.clueStrength.toFixed(1)}]`, undefined, 'CLI');
      }
    });

    world.on('outcome:revealed', (event) => {
      logger.info('='.repeat(50), undefined, 'CLI');
      logger.info(`FINAL OUTCOME: ${event.data.outcome ? 'SUCCESS' : 'FAILURE'}`, undefined, 'CLI');
      logger.info('='.repeat(50), undefined, 'CLI');
    });
  }

  const finalWorld = await world.generate();

  if (options.save) {
    const json = JSON.stringify(finalWorld, null, 2);
    await writeFile(options.save, json);
    
    if (!options.json) {
      logger.info(`World saved to: ${options.save}`, undefined, 'CLI');
    }
  }

  if (!options.json) {
    logger.info('World generation complete', {
      totalEvents: finalWorld.events.length,
      npcs: finalWorld.npcs.length,
      daysSimulated: finalWorld.timeline.length,
      finalOutcome: finalWorld.outcome ? 'SUCCESS' : 'FAILURE'
    }, 'CLI');
  } else {
    logger.info(JSON.stringify(finalWorld, null, 2), undefined, 'CLI');
  }

  process.exit(0);
}

if (import.meta.main) {
  main().catch(error => {
    logger.error('Error:', error, 'CLI');
    process.exit(1);
  });
}

export { main };

