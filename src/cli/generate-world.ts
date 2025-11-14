#!/usr/bin/env bun

/**
 * Babylon CLI - Generate Game World
 * 
 * Generates complete game narratives with all NPC actions and events.
 * Shows everything that happens in the game world.
 * 
 * Usage:
 *   bun run src/cli/generate-world.ts --verbose
 *   bun run src/cli/generate-world.ts --outcome=SUCCESS
 *   bun run src/cli/generate-world.ts --save=world.json
 */

import { GameWorld } from '../engine/GameWorld';
import { writeFile } from 'fs/promises';
import { logger } from '@/lib/logger';

interface CLIOptions {
  outcome?: 'SUCCESS' | 'FAILURE';
  save?: string;
  verbose?: boolean;
  json?: boolean;
}

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

