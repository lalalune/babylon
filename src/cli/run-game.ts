#!/usr/bin/env bun

/**
 * @fileoverview Game Simulation Runner CLI
 * 
 * Runs complete autonomous game simulations for testing, debugging, and analysis.
 * Simulates prediction market games with agents, betting, clues, and outcomes.
 * 
 * **Core Features:**
 * - Complete game simulation with agents and markets
 * - Configurable outcomes (YES/NO)
 * - Batch mode for running multiple simulations
 * - Fast mode for quick testing
 * - JSON export for data analysis
 * - Comprehensive event tracking
 * - Performance metrics and statistics
 * 
 * **Simulation Components:**
 * - Market initialization with starting odds
 * - Agent deployment (default: 5 agents)
 * - Clue distribution over time
 * - Agent betting based on clues
 * - Market updates based on bets
 * - Outcome revelation
 * - Winner calculation
 * 
 * **Use Cases:**
 * - Test game mechanics and rules
 * - Debug agent behavior
 * - Analyze market dynamics
 * - Batch testing for statistics
 * - Performance benchmarking
 * - Integration testing
 * 
 * @module cli/run-game
 * @category CLI - Testing
 * 
 * @example
 * ```bash
 * # Run single game with default settings
 * bun run src/cli/run-game.ts
 * 
 * # Run with specific outcome
 * bun run src/cli/run-game.ts --outcome=YES
 * 
 * # Run multiple games for analysis
 * bun run src/cli/run-game.ts --count=100 --fast
 * 
 * # Save detailed game data
 * bun run src/cli/run-game.ts --save=game-data.json --verbose
 * 
 * # Get JSON output only (for piping)
 * bun run src/cli/run-game.ts --json
 * ```
 * 
 * @see {@link GameSimulator} for simulation implementation
 * @see {@link ../engine/GameSimulator.ts} for implementation details
 * @since v0.1.0
 */

import { GameSimulator } from '../engine/GameSimulator';
import { writeFile } from 'fs/promises';
import { logger } from '@/lib/logger';

/**
 * Command-line options for game simulation
 * @interface CLIOptions
 * @property {'YES' | 'NO'} [outcome] - Predetermined game outcome
 * @property {number} [count] - Number of games to simulate (batch mode)
 * @property {string} [save] - File path to save game JSON
 * @property {boolean} [fast] - Fast mode (minimal logging)
 * @property {boolean} [verbose] - Verbose mode (detailed event logs)
 * @property {boolean} [json] - JSON output only (no logs)
 */
interface CLIOptions {
  outcome?: 'YES' | 'NO';
  count?: number;
  save?: string;
  fast?: boolean;
  verbose?: boolean;
  json?: boolean;
}

/**
 * Parses command-line arguments into typed options
 * 
 * **Supported Arguments:**
 * - `--outcome=YES` or `--outcome=NO` - Set predetermined outcome
 * - `--count=N` - Run N simulations in batch mode
 * - `--save=filename.json` - Save game data to file
 * - `--fast` - Skip detailed logging for speed
 * - `--verbose` or `-v` - Show all events and agent actions
 * - `--json` - Output JSON only (for scripts/pipelines)
 * 
 * @returns {CLIOptions} Parsed command-line options
 * @example
 * ```typescript
 * // Called with: bun run run-game.ts --count=10 --fast
 * const options = parseArgs();
 * // { count: 10, fast: true }
 * ```
 */
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

/**
 * Runs a single game simulation with full event tracking
 * 
 * Simulates a complete prediction market game from start to finish:
 * 1. Game starts with question and agents
 * 2. Days pass, agents receive clues
 * 3. Agents place bets based on clues
 * 4. Market odds update based on bets
 * 5. Outcome is revealed
 * 6. Winners are calculated
 * 
 * **Event Types:**
 * - `game:started` - Simulation begins
 * - `day:changed` - New day in simulation
 * - `clue:distributed` - Agent receives clue
 * - `agent:bet` - Agent places bet
 * - `market:updated` - Market odds change
 * - `outcome:revealed` - Final outcome shown
 * - `game:ended` - Simulation completes
 * 
 * @param {boolean} outcome - Predetermined game outcome (true=YES, false=NO)
 * @param {CLIOptions} options - CLI options for logging and output
 * @returns {Promise<SimulationResult>} Complete simulation data
 * @example
 * ```typescript
 * const result = await runSingleGame(true, { verbose: true });
 * // Returns: { id, question, outcome, agents, market, events, winners }
 * ```
 */
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

/**
 * Main execution function for game simulation CLI
 * 
 * Runs either single or batch game simulations based on options:
 * - Single mode: Runs one game with full logging
 * - Batch mode: Runs multiple games with statistics
 * 
 * **Single Game Mode:**
 * - Full event logging (if verbose)
 * - JSON export option
 * - Detailed final statistics
 * 
 * **Batch Mode:**
 * - Alternating YES/NO outcomes for balance
 * - Progress indicator
 * - Aggregate statistics (avg time, outcome distribution)
 * - Summary report
 * 
 * @throws {Error} Exits with code 1 if simulation fails
 * @returns {Promise<void>} Exits with code 0 on success
 * @example
 * ```bash
 * # Single game with verbose output
 * bun run src/cli/run-game.ts --verbose
 * 
 * # Batch run 100 games
 * bun run src/cli/run-game.ts --count=100 --fast
 * 
 * # Output (batch mode):
 * # Running 100 simulations...
 * # [100/100] 100%
 * # 100 games completed
 * # { totalTime: '45s', avgTime: '450ms/game',
 * #   yesOutcomes: '50 (50%)', noOutcomes: '50 (50%)' }
 * ```
 */
async function main() {
  const options = parseArgs();
  
  const outcomeValue = options.outcome === 'NO' ? false : true;
  const count = options.count || 1;

  if (count === 1) {
    // Single game
    const result = await runSingleGame(outcomeValue, options);
    
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
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
      console.log(JSON.stringify({
        count: results.length,
        duration,
        results: results.map(r => ({
          id: r.id,
          outcome: r.outcome,
          winners: r.winners.length,
          events: r.events.length,
        }))
      }, null, 2));
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

