#!/usr/bin/env bun

/**
 * Babylon CLI - Run Game Simulation
 * 
 * Runs autonomous game simulations from the command line
 * Perfect for testing, debugging, and batch analysis
 * 
 * Usage:
 *   bun run src/cli/run-game.ts
 *   bun run src/cli/run-game.ts --outcome=YES --verbose
 *   bun run src/cli/run-game.ts --count=10 --fast
 *   bun run src/cli/run-game.ts --save=game.json
 */

import { GameSimulator } from '../engine/GameSimulator';
import { writeFile } from 'fs/promises';
import { logger } from '@/lib/logger';

interface CLIOptions {
  outcome?: 'YES' | 'NO';
  count?: number;
  save?: string;
  fast?: boolean;
  verbose?: boolean;
  json?: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  args.forEach(arg => {
    if (arg.startsWith('--outcome=')) {
      const value = arg.split('=')[1];
      if (value) {
        options.outcome = value as 'YES' | 'NO';
      }
    } else if (arg.startsWith('--count=')) {
      const value = arg.split('=')[1];
      if (value) {
        options.count = parseInt(value, 10);
      }
    } else if (arg.startsWith('--save=')) {
      const value = arg.split('=')[1];
      if (value) {
        options.save = value;
      }
    } else if (arg === '--fast') {
      options.fast = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--json') {
      options.json = true;
    }
  });

  return options;
}

async function runSingleGame(outcome: boolean, options: CLIOptions) {
  const simulator = new GameSimulator({
    outcome,
    numAgents: 5,
    duration: 30,
  });

  if (options.verbose && !options.json) {
    logger.info('BABYLON GAME SIMULATION', undefined, 'CLI');
    logger.info('==========================', undefined, 'CLI');

    simulator.on('game:started', (event) => {
      logger.info(`Question: ${event.data.question}`, undefined, 'CLI');
      logger.info(`Predetermined Outcome: ${outcome ? 'YES' : 'NO'}`, undefined, 'CLI');
      logger.info(`Agents: ${event.data.agents}`, undefined, 'CLI');
    });

    simulator.on('day:changed', (event) => {
      if (!options.fast) {
        logger.debug(`[Day ${event.data.day}]`, undefined, 'CLI');
      }
    });

    simulator.on('clue:distributed', (event) => {
      if (options.verbose && !options.fast) {
        logger.debug(`${event.agentId}: Received clue (${event.data.tier})`, undefined, 'CLI');
      }
    });

    simulator.on('agent:bet', (event) => {
      logger.info(`${event.agentId}: Bet ${event.data.outcome ? 'YES' : 'NO'} (${event.data.amount} tokens)`, undefined, 'CLI');
    });

    simulator.on('market:updated', (event) => {
      if (options.verbose && event.day % 10 === 0) {
        logger.info(`Market: ${event.data.yesOdds}% YES / ${event.data.noOdds}% NO`, undefined, 'CLI');
      }
    });

    simulator.on('outcome:revealed', (event) => {
      logger.info(`Outcome revealed: ${event.data.outcome ? 'YES' : 'NO'}`, undefined, 'CLI');
    });

    simulator.on('game:ended', (event) => {
      logger.info(`Winners: ${event.data.winners.join(', ')}`, undefined, 'CLI');
    });
  }

  const result = await simulator.runCompleteGame();

  if (options.save) {
    const json = JSON.stringify(result, null, 2);
    await writeFile(options.save, json);
    
    if (!options.json) {
      logger.info(`Saved to: ${options.save}`, undefined, 'CLI');
    }
  }

  if (!options.json) {
    logger.info('Game complete', {
      duration: `${result.endTime - result.startTime}ms`,
      events: result.events.length,
      winners: `${result.winners.length}/${result.agents.length}`
    }, 'CLI');
  }

  return result;
}

async function main() {
  const options = parseArgs();
  
  const outcomeValue = options.outcome === 'NO' ? false : true;
  const count = options.count || 1;

  if (count === 1) {
    // Single game
    const result = await runSingleGame(outcomeValue, options);
    
    if (options.json) {
      logger.info(JSON.stringify(result, null, 2), undefined, 'CLI');
    }
  } else {
    // Batch games
    if (!options.json) {
      logger.info(`Running ${count} simulations...`, undefined, 'CLI');
    }

    const results = [];
    const start = Date.now();

    for (let i = 0; i < count; i++) {
      const outcome = i % 2 === 0; // Alternate YES/NO
      const sim = new GameSimulator({ outcome, numAgents: 5 });
      const result = await sim.runCompleteGame();
      results.push(result);

      if (!options.fast && !options.json) {
        process.stdout.write(`\r[${i + 1}/${count}] ${Math.round((i + 1) / count * 100)}%`);
      }
    }

    const duration = Date.now() - start;

    if (options.json) {
      logger.info(JSON.stringify({
        count: results.length,
        duration,
        results: results.map(r => ({
          id: r.id,
          outcome: r.outcome,
          winners: r.winners.length,
          events: r.events.length,
        }))
      }, null, 2), undefined, 'CLI');
    } else {
      const yesGames = results.filter(r => r.outcome).length;
      logger.info(`${count} games completed`, {
        totalTime: `${duration}ms`,
        avgTime: `${Math.round(duration / count)}ms/game`,
        yesOutcomes: `${yesGames} (${Math.round(yesGames/count*100)}%)`,
        noOutcomes: `${count - yesGames} (${Math.round((count-yesGames)/count*100)}%)`
      }, 'CLI');
    }
  }

  process.exit(0);
}

// Run if called directly
if (import.meta.main) {
  main().catch(error => {
    logger.error('Error:', error, 'CLI');
    process.exit(1);
  });
}

export { main, runSingleGame };

