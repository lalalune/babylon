#!/usr/bin/env bun
/**
 * Initialize Game Content - Create game state and initial content
 *
 * This script:
 * 1. Creates/verifies game state
 * 2. Verifies actors are seeded
 * 3. Creates initial prediction questions
 * 4. Creates initial posts
 *
 * Run this once after seeding the database to bootstrap content.
 */

import { prisma } from '../src/lib/prisma';
import { logger } from '../src/lib/logger';

async function main() {
  logger.info('🎬 Initializing game content...', undefined, 'Init');

  // 1. Ensure game state exists and is running
  let game = await prisma.game.findFirst({ where: { isContinuous: true } });

  if (!game) {
    logger.info('Creating game state...', undefined, 'Init');
    game = await prisma.game.create({
      data: {
        isContinuous: true,
        isRunning: true,
        currentDate: new Date(),
        currentDay: 1,
        speed: 60000,
      },
    });
  } else if (!game.isRunning) {
    logger.info('Setting game to running...', undefined, 'Init');
    await prisma.game.update({
      where: { id: game.id },
      data: { isRunning: true },
    });
  }

  logger.info('✅ Game state ready', undefined, 'Init');

  // 2. Check if we have actors
  const actorCount = await prisma.actor.count();
  if (actorCount === 0) {
    logger.error('❌ No actors! Run: bun run db:seed', undefined, 'Init');
    process.exit(1);
  }
  logger.info(`✅ ${actorCount} actors loaded`, undefined, 'Init');

  // 3. Create initial questions if none exist
  const questionCount = await prisma.question.count();

  if (questionCount < 3) {
    logger.info('Creating initial prediction questions...', undefined, 'Init');

    const questions = [
      {
        questionNumber: 1,
        text: "Will OpenAI announce GPT-5 within the next 7 days?",
        scenarioId: 1,
        outcome: Math.random() > 0.5,
        rank: 1,
        resolutionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        questionNumber: 2,
        text: "Will Bitcoin break $100k this week?",
        scenarioId: 2,
        outcome: Math.random() > 0.5,
        rank: 2,
        resolutionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        questionNumber: 3,
        text: "Will Tesla stock move more than 5% in the next 3 days?",
        scenarioId: 3,
        outcome: Math.random() > 0.5,
        rank: 3,
        resolutionDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    ];

    for (const q of questions) {
      await prisma.question.create({ data: q });

      // Also create a Market for trading
      await prisma.market.create({
        data: {
          question: q.text,
          liquidity: 1000,
          endDate: q.resolutionDate,
          gameId: 'continuous',
        },
      });
    }

    logger.info(`✅ Created ${questions.length} initial questions`, undefined, 'Init');
  } else {
    logger.info(`✅ ${questionCount} questions already exist`, undefined, 'Init');
  }

  // 4. Create some initial posts if none exist
  const postCount = await prisma.post.count();

  if (postCount === 0) {
    logger.info('Creating initial posts...', undefined, 'Init');

    const actors = await prisma.actor.findMany({ take: 5 });
    const questions = await prisma.question.findMany({ take: 3 });

    const samplePosts = [
      "Just saw the latest AI developments. Market is about to get wild 🚀",
      "Technical analysis shows bullish patterns forming. Time to position? 📈",
      "Everyone sleeping on this opportunity. DYOR but the signs are there 👀",
      "Breaking: Major announcement incoming. This changes everything 🔥",
      "Market sentiment shifting fast. Watch closely next 24hrs ⏰",
    ];

    for (let i = 0; i < 5 && i < actors.length; i++) {
      await prisma.post.create({
        data: {
          content: samplePosts[i]!,
          authorId: actors[i]!.id,
          gameId: 'continuous',
          dayNumber: 1,
          timestamp: new Date(),
        },
      });
    }

    logger.info('✅ Created 5 initial posts', undefined, 'Init');
  } else {
    logger.info(`✅ ${postCount} posts already exist`, undefined, 'Init');
  }

  logger.info('', undefined, 'Init');
  logger.info('🎉 Initialization complete!', undefined, 'Init');
  logger.info('', undefined, 'Init');
  logger.info('Next steps:', undefined, 'Init');
  logger.info('1. Start the development server: bun run dev', undefined, 'Init');
  logger.info('2. Visit http://localhost:3000/feed', undefined, 'Init');
  logger.info('3. Posts and questions should now be visible', undefined, 'Init');
  logger.info('4. Daemon will continue generating content automatically', undefined, 'Init');

  await prisma.$disconnect();
}

main().catch((error) => {
  logger.error('Initialization failed:', error, 'Init');
  process.exit(1);
});
