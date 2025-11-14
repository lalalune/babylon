#!/usr/bin/env bun
/**
 * Quick diagnostic script to check game status
 */

import { prisma } from '../src/lib/prisma';
import { logger } from '../src/lib/logger';

async function main() {
  logger.info('🔍 Checking game status...', undefined, 'Diagnostic');
  
  // Check database connection
  try {
    await prisma.$connect();
    logger.info('✅ Database connected', undefined, 'Diagnostic');
  } catch (error) {
    logger.error('❌ Database connection failed', { error }, 'Diagnostic');
    process.exit(1);
  }

  // Check actors
  const actorCount = await prisma.actor.count();
  logger.info(`Actors: ${actorCount}`, undefined, 'Diagnostic');
  
  if (actorCount === 0) {
    logger.error('❌ No actors in database! Run: bun run db:seed', undefined, 'Diagnostic');
  }

  // Check questions
  const questionCount = await prisma.question.count();
  const activeQuestions = await prisma.question.count({ where: { status: 'active' } });
  logger.info(`Questions: ${questionCount} total, ${activeQuestions} active`, undefined, 'Diagnostic');

  // Check posts
  const postCount = await prisma.post.count();
  const recentPosts = await prisma.post.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
      },
    },
  });
  logger.info(`Posts: ${postCount} total, ${recentPosts} in last 5 minutes`, undefined, 'Diagnostic');
  
  if (recentPosts === 0 && postCount > 0) {
    logger.warn('⚠️  No recent posts - daemon might not be generating content', undefined, 'Diagnostic');
  } else if (recentPosts > 0) {
    logger.info('✅ Content is being generated!', undefined, 'Diagnostic');
  }

  // Check game state
  const game = await prisma.game.findFirst({ where: { isContinuous: true } });
  if (game) {
    logger.info('Game State:', {
      isRunning: game.isRunning,
      currentDay: game.currentDay,
      lastTickAt: game.lastTickAt?.toISOString() || 'never',
    }, 'Diagnostic');
    
    if (!game.isRunning) {
      logger.warn('⚠️  Game is paused! To start: UPDATE "Game" SET "isRunning" = true;', undefined, 'Diagnostic');
    }
  } else {
    logger.warn('⚠️  No game state found', undefined, 'Diagnostic');
  }

  // Check events
  const eventCount = await prisma.worldEvent.count();
  const recentEvents = await prisma.worldEvent.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 5 * 60 * 1000),
      },
    },
  });
  logger.info(`Events: ${eventCount} total, ${recentEvents} in last 5 minutes`, undefined, 'Diagnostic');

  // Check organizations
  const orgCount = await prisma.organization.count();
  const companiesWithPrices = await prisma.organization.count({
    where: {
      type: 'company',
      currentPrice: { not: null },
    },
  });
  logger.info(`Organizations: ${orgCount} total, ${companiesWithPrices} companies with prices`, undefined, 'Diagnostic');

  logger.info('', undefined, 'Diagnostic');
  logger.info('='.repeat(60), undefined, 'Diagnostic');
  
  // Summary
  if (actorCount === 0) {
    logger.error('❌ PROBLEM: No actors. Run: bun run db:seed', undefined, 'Diagnostic');
  } else if (recentPosts === 0 && postCount === 0) {
    logger.warn('⚠️  No posts yet. Daemon starting or API key missing?', undefined, 'Diagnostic');
    logger.info('Check GROQ_API_KEY or OPENAI_API_KEY in .env.local', undefined, 'Diagnostic');
  } else if (recentPosts === 0) {
    logger.warn('⚠️  Posts exist but none recent. Is daemon running?', undefined, 'Diagnostic');
    logger.info('Run: bun run daemon (in separate terminal)', undefined, 'Diagnostic');
  } else {
    logger.info('✅ Everything looks good! Game is generating content.', undefined, 'Diagnostic');
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  logger.error('Diagnostic failed:', error, 'Diagnostic');
  process.exit(1);
});

