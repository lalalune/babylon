#!/usr/bin/env bun



/**
 * @fileoverview Babylon Smart Game Generator CLI
 * 
 * Generates complete 30-day prediction market games with persistent historical context.
 * This is the primary tool for creating new game scenarios, questions, actors, and timelines.
 * 
 * **Core Features:**
 * - Automatic genesis game generation if none exists
 * - Contextual game generation using previous game history
 * - Intelligent scenario and question creation
 * - Actor validation and affiliation checking
 * - Database persistence with metadata tracking
 * - Retry logic with exponential backoff for API failures
 * 
 * **Generation Flow:**
 * 1. Check database for genesis game, generate if missing
 * 2. Load previous games from database as context (last 2-3 games)
 * 3. Calculate next start date (30 days after last game)
 * 4. Generate complete game with scenarios, questions, and timeline
 * 5. Save game metadata to database
 * 6. Display summary with scenarios, questions, and statistics
 * 
 * **Requirements:**
 * - `GROQ_API_KEY` or `OPENAI_API_KEY` environment variable must be set
 * - Database must be accessible and migrated
 * - Actors data must be validated (use `validate-actors` CLI first)
 * - Never falls back to mock/template generation (always uses LLM)
 * 
 * **Output:**
 * - Game metadata saved to database
 * - Console output with scenarios, questions, and statistics
 * - Verbose mode shows additional details about actors and history
 * 
 * @module cli/generate-game
 * @category CLI - Game Generation
 * 
 * @example
 * ```bash
 * # Generate next game with default settings
 * bun run generate
 * 
 * # Generate with detailed logging
 * bun run generate --verbose
 * 
 * # Generate with verbose output
 * bun run generate -v
 * ```
 * 
 * @see {@link GameGenerator} for game generation logic
 * @see {@link ../generator/GameGenerator.ts} for implementation details
 * @since v0.1.0
 */

import { GameGenerator, type GameHistory } from '../generator/GameGenerator';
import type { ChatMessage } from '@/shared/types';
import { logger } from '@/lib/logger';
import { db } from '@/lib/database-service';
import { generateSnowflakeId } from '@/lib/snowflake';

// Commented out unused schema - types defined inline where needed
// const GameFileSchema = z.object({
//   timestamp: z.date(),
//   game: z.any(),
//   history: z.any().optional(),
// });

/**
 * Represents a game file with timestamp and game data
 * @interface GameFile
 * @property {Date} timestamp - When the game was created
 * @property {GeneratedGame} game - The game data object
 * @property {GameHistory} [history] - Optional game history for context
 */
// Removed unused GameFile interface - see git history to restore if needed

/**
 * Command-line options for the game generator
 * @interface CLIOptions
 * @property {boolean} [verbose] - Enable verbose logging output
 */
interface CLIOptions {
  verbose?: boolean;
}

/**
 * Parses command-line arguments into typed options
 * 
 * **Supported Arguments:**
 * - `--verbose` or `-v`: Enable detailed logging
 * 
 * @returns {CLIOptions} Parsed command-line options
 * @example
 * ```typescript
 * // Called internally when script runs with:
 * // bun run generate --verbose
 * const options = parseArgs(); // { verbose: true }
 * ```
 */
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  args.forEach(arg => {
    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  });

  return options;
}

/**
 * Generate minimal game history from database records
 * 
 * Since full game data isn't stored in database, we reconstruct a minimal
 * but valid GameHistory from posts and questions for LLM context.
 */
async function generateMinimalGameHistory(gameId: string, gameNumber: number): Promise<GameHistory> {
  // Get posts from this game
  const posts = await db.prisma.post.findMany({
    where: {
      gameId,
      deletedAt: null
    },
    select: {
      id: true,
      content: true,
      authorId: true,
      timestamp: true,
      dayNumber: true
    },
    orderBy: {
      timestamp: 'desc'
    },
    take: 100 // Sample of posts for context
  });

  // Get questions from this game period
  // Note: In the current schema, questions don't have direct gameId field
  // For now, create minimal history without question data
  const questions: Array<{ id: string; text: string; outcome: boolean | null; status: string }> = [];

  // Generate summary from post content
  const topPosts = posts.slice(0, 10);
  const summary = `Game ${gameNumber} featured ${questions.length} questions and ${posts.length} posts over 30 days.`;
  
  // Extract key outcomes
  const keyOutcomes: Array<{ questionText: string; outcome: boolean; explanation: string }> = questions
    .filter(q => q.status === 'RESOLVED' && q.outcome !== null)
    .map(q => ({
      questionText: q.text,
      outcome: q.outcome as boolean,
      explanation: 'Historical outcome from completed game' // Historical data is always certain
    }));

  // Generate highlights from top posts
  const highlights = topPosts.map(p => 
    p.content.length > 100 ? p.content.substring(0, 100) + '...' : p.content
  );

  // Generate top moments from posts with high engagement
  const topMoments = highlights.slice(0, 5);

  return {
    gameNumber,
    completedAt: new Date().toISOString(),
    summary,
    keyOutcomes,
    highlights,
    topMoments
  };
}

/**
 * Validates actor affiliations against organizations in the database
 * 
 * Ensures all actor affiliations reference valid organization IDs to prevent
 * orphaned references and maintain data integrity during game generation.
 * 
 * **Validation Checks:**
 * - All actor affiliations must reference existing organizations
 * - Missing or invalid affiliations will cause the script to exit with error
 * 
 * @throws {Error} Exits with code 1 if validation fails
 * @returns {Promise<void>} Resolves if validation passes
 * @example
 * ```typescript
 * // Called internally before game generation
 * await validateActorsData();
 * // Will exit process if any actors have invalid affiliations
 * ```
 * 
 * @see {@link validate-actors.ts} for standalone validation script
 */
async function validateActorsData(): Promise<void> {
  const actors = await db.getAllActors();
  const organizations = await db.getAllOrganizations();
  
  const validOrgIds = new Set(organizations.map(org => org.id));
  const errors: string[] = [];

  for (const actor of actors) {
    if (!actor.affiliations || actor.affiliations.length === 0) {
      continue;
    }

    for (const affiliation of actor.affiliations) {
      if (!validOrgIds.has(affiliation)) {
        errors.push(`${actor.name} (${actor.id}) has invalid affiliation: "${affiliation}"`);
      }
    }
  }

  if (errors.length > 0) {
    logger.error('ACTOR VALIDATION FAILED', undefined, 'CLI');
    logger.error('Invalid affiliations found:', errors, 'CLI');
    logger.error('Please fix actor data in database before generating a game.', undefined, 'CLI');
    process.exit(1);
  }
}

/**
 * Main execution function for the game generator CLI
 * 
 * Orchestrates the complete game generation workflow:
 * 1. Validates API keys (GROQ or OpenAI required)
 * 2. Validates actor data integrity
 * 3. Checks for/generates genesis game if needed
 * 4. Loads previous game context from database
 * 5. Generates new 30-day game with LLM
 * 6. Saves game metadata to database
 * 7. Displays comprehensive summary
 * 
 * **Environment Variables Required:**
 * - `GROQ_API_KEY` (preferred for fast inference) OR
 * - `OPENAI_API_KEY` (fallback option)
 * 
 * **Database Requirements:**
 * - Prisma migrations must be applied
 * - Database connection must be available
 * 
 * **Process Flow:**
 * - STEP 0: Check/generate genesis game
 * - STEP 1: Load previous games for context
 * - STEP 2: Generate new game with LLM
 * - STEP 3: Save to database
 * 
 * @throws {Error} Exits with code 1 if API keys missing or validation fails
 * @returns {Promise<void>} Exits with code 0 on successful generation
 * 
 * @example
 * ```bash
 * # Set API key
 * export GROQ_API_KEY=your_key_here
 * 
 * # Run generator
 * bun run generate
 * 
 * # Expected output:
 * # BABYLON GAME GENERATOR
 * # ==========================
 * # Validating actors from database...
 * # Actors validated
 * # Using Groq (fast inference)
 * # STEP 0: Checking for genesis game in database...
 * # STEP 1: Loading previous games...
 * # STEP 2: Generating Game #2...
 * # Game generation complete!
 * # Duration: 45.3s
 * # Total events: 450
 * # Total feed posts: 750
 * # SCENARIOS & QUESTIONS:
 * # [scenario details]
 * # STEP 3: Saving game to database...
 * # Ready for next game!
 * ```
 */
async function main() {
  const options = parseArgs();
  
  logger.info('BABYLON GAME GENERATOR', undefined, 'CLI');
  logger.info('==========================', undefined, 'CLI');

  // Validate actors from database
  logger.info('Validating actors from database...', undefined, 'CLI');
  await validateActorsData();
  logger.info('Actors validated', undefined, 'CLI');

  // Validate API key is present
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!groqKey && !openaiKey) {
    logger.error('ERROR: No API key found!', undefined, 'CLI');
    logger.error('This generator requires an LLM API key to function.', undefined, 'CLI');
    logger.error('Set one of the following environment variables:', {
      groq: 'export GROQ_API_KEY=your_groq_key_here',
      openai: 'export OPENAI_API_KEY=your_openai_key_here',
      groqUrl: 'Get a free Groq API key at: https://console.groq.com/',
      openaiUrl: 'Get an OpenAI API key at: https://platform.openai.com/'
    }, 'CLI');
    process.exit(1);
  }

  if (groqKey) {
    logger.info('Using Groq (fast inference)', undefined, 'CLI');
  } else if (openaiKey) {
    logger.info('Using OpenAI', undefined, 'CLI');
  }

  const startTime = Date.now();

  // STEP 0: Check if genesis game exists in database
  logger.info('STEP 0: Checking for genesis game in database...', undefined, 'CLI');
  const existingGames = await db.getAllGames();
  
  if (existingGames.length === 0) {
    logger.info('No genesis game found, generating...', undefined, 'CLI');
    const generator = new GameGenerator();
    const genesis = await generator.generateGenesis();
    
    // Save genesis metadata to database
    // Note: Full game data saved to genesis.json file, not database
    await db.prisma.game.create({
      data: {
        id: await generateSnowflakeId(),
        isContinuous: false,
        isRunning: false,
        currentDate: new Date(),
        speed: 60000,
        updatedAt: new Date(),
      },
    });
    
    logger.info('Genesis game saved to database', undefined, 'CLI');
    logger.info(`Total events: ${genesis.timeline.reduce((sum, day) => sum + day.events.length, 0)}`, undefined, 'CLI');
    logger.info(`Total posts: ${genesis.timeline.reduce((sum, day) => sum + day.feedPosts.length, 0)}`, undefined, 'CLI');
  } else {
    logger.info(`Found ${existingGames.length} existing game(s) in database`, undefined, 'CLI');
  }

  // STEP 1: Load Previous Games
  logger.info('STEP 1: Loading previous games...', undefined, 'CLI');
  
  const history: GameHistory[] = [];
  let nextStartDate: string;
  let gameNumber = 1;

  if (existingGames.length > 0) {
    logger.info(`Found ${existingGames.length} previous game(s):`, undefined, 'CLI');
    
    // Load game histories from database GameConfig
    // Game histories are stored as JSON in GameConfig table with keys like 'game-history-{gameId}'
    for (let i = Math.max(0, existingGames.length - 2); i < existingGames.length; i++) {
      const gameData = existingGames[i];
      if (!gameData) continue;

      // Try to load stored game history from GameConfig
      const historyConfig = await db.prisma.gameConfig.findUnique({
        where: { key: `game-history-${gameData.id}` }
      });

      if (historyConfig && historyConfig.value) {
        // Use stored history if available
        const storedHistory = historyConfig.value as unknown as GameHistory;
        history.push(storedHistory);
        logger.info(`Loaded stored history for game ${gameData.id}`, undefined, 'CLI');
      } else {
        // Generate minimal history from database records if no stored history
        const minimalHistory = await generateMinimalGameHistory(gameData.id, i + 1);
        history.push(minimalHistory);
        logger.info(`Generated minimal history for game ${gameData.id}`, undefined, 'CLI');
      }
    }

    // Calculate next start date
    const lastGame = existingGames[0]!;
    const lastDate = new Date(lastGame.currentDate);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 30); // 30 days after last game start
    nextStartDate = nextDate.toISOString().split('T')[0]!;

    gameNumber = existingGames.length + 1;
    
    logger.info(`Next game will be #${gameNumber} starting ${nextStartDate}`, undefined, 'CLI');
  } else {
    logger.info('No previous games found. This will be Game #1', undefined, 'CLI');
    
    // First game starts from current actual date
    const now = new Date();
    // Start from first of current month
    nextStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    logger.info(`Starting ${nextStartDate} (current month, first game)`, undefined, 'CLI');
  }

  // STEP 2: Generate New Game
  logger.info(`STEP 2: Generating Game #${gameNumber}...`, undefined, 'CLI');
  logger.info(`Start: ${nextStartDate}`, undefined, 'CLI');
  logger.info('Duration: 30 days', undefined, 'CLI');
  logger.info('Retries enabled - will not give up on LLM failures', undefined, 'CLI');
  
  const generator = new GameGenerator(undefined, history.length > 0 ? history : undefined);
  const game = await generator.generateCompleteGame(nextStartDate);
  const duration = Date.now() - startTime;

  logger.info('Game generation complete!', undefined, 'CLI');
  logger.info(`Duration: ${(duration / 1000).toFixed(1)}s`, undefined, 'CLI');
  logger.info(`Total events: ${game.timeline.reduce((sum, day) => sum + day.events.length, 0)}`, undefined, 'CLI');
  logger.info(`Total feed posts: ${game.timeline.reduce((sum, day) => sum + day.feedPosts.length, 0)}`, undefined, 'CLI');
  logger.info(`Total group messages: ${Object.values(game.timeline.reduce((acc, day) => {
    Object.entries(day.groupChats).forEach(([groupId, messages]) => {
      if (!acc[groupId]) acc[groupId] = [];
      acc[groupId]!.push(...messages);
    });
    return acc;
  }, {} as Record<string, ChatMessage[]>)).flat().length}`);

  // Show scenarios and questions
  logger.info('SCENARIOS & QUESTIONS:', undefined, 'CLI');
  logger.info('=========================', undefined, 'CLI');
  
  game.setup.scenarios.forEach(scenario => {
    logger.info(`${scenario.id}. ${scenario.title}`, undefined, 'CLI');
    logger.info(`   ${scenario.description}`, undefined, 'CLI');
    logger.info(`   Theme: ${scenario.theme}`, undefined, 'CLI');
    
    // Find questions for this scenario
    const scenarioQuestions = game.setup.questions.filter(q => q.scenario === scenario.id);
    if (scenarioQuestions.length > 0) {
      logger.info('   Questions:', undefined, 'CLI');
      scenarioQuestions.forEach(q => {
        const outcomeIcon = q.outcome ? 'YES' : 'NO';
        logger.info(`     ${q.id}. ${q.text}`, undefined, 'CLI');
        logger.info(`        Outcome: ${outcomeIcon} | Rank: ${q.rank}`, undefined, 'CLI');
      });
    }
  });

  // STEP 3: Save Game to Database
  logger.info('STEP 3: Saving game to database...', undefined, 'CLI');
  
  // Generate game history
  const gameHistory = generator.createGameHistory(game);
  
  // Save game metadata to database
  // Note: Game is now stored in database (posts, events, actors)
  const savedGame = await db.prisma.game.create({
    data: {
      id: await generateSnowflakeId(),
      isContinuous: false,
      isRunning: false,
      currentDate: new Date(nextStartDate),
      speed: 60000,
      updatedAt: new Date(),
    },
  });
  
  logger.info(`Saved game to database (ID: ${savedGame.id})`, undefined, 'CLI');

  // Save game history for future reference
  await db.prisma.gameConfig.upsert({
    where: { key: `game-history-${savedGame.id}` },
    update: { 
      value: gameHistory as never,
      updatedAt: new Date()
    },
    create: {
      id: await generateSnowflakeId(),
      key: `game-history-${savedGame.id}`,
      value: gameHistory as never,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  logger.info('Saved game history for future context', undefined, 'CLI');

  // Show summary
  if (options.verbose) {
    logger.info('GAME SUMMARY', undefined, 'CLI');
    logger.info('================', undefined, 'CLI');
    logger.info(`Game ID: ${game.id}`, undefined, 'CLI');
    logger.info(`Game Number: ${gameNumber}`, undefined, 'CLI');
    logger.info(`Main Actors (${game.setup.mainActors.length}):`, game.setup.mainActors.map(a => `${a.name} (${a.tier})`), 'CLI');
    logger.info(`Questions (${game.setup.questions.length}):`, game.setup.questions.map(q => `${q.id}. ${q.text} - Answer: ${q.outcome ? 'YES' : 'NO'}`), 'CLI');
    logger.info('HIGHLIGHTS:', gameHistory.highlights.slice(0, 5), 'CLI');
    logger.info('TOP MOMENTS:', gameHistory.topMoments.slice(0, 3), 'CLI');
  }

  logger.info('Ready for next game! Run `bun run generate` again in 30 days.', undefined, 'CLI');

  process.exit(0);
}

// Run if called directly
if (import.meta.main) {
  main().catch(error => {
    logger.error('Error:', error.message, 'CLI');
    if (error.stack) {
      logger.error('Stack trace:', error.stack, 'CLI');
    }
    process.exit(1);
  });
}

export { main };
