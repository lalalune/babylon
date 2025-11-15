/**
 * Diagnostic Script: Trading System Status
 * 
 * Checks:
 * 1. Is the game running?
 * 2. Are there NPCs with trading enabled?
 * 3. Are there any trades in the database?
 * 4. When was the last game tick?
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

async function main() {
  logger.info('=== TRADING SYSTEM DIAGNOSTIC ===', undefined, 'Diagnostic');
  logger.info('', undefined, 'Diagnostic');
  
  // 1. Check game status
  const game = await prisma.game.findFirst({
    where: { isContinuous: true },
  });
  
  if (!game) {
    logger.error('❌ No continuous game found in database', undefined, 'Diagnostic');
  } else {
    logger.info('Game Status:', {
      isRunning: game.isRunning,
      currentDay: game.currentDay,
      lastTickAt: game.lastTickAt,
      activeQuestions: game.activeQuestions,
    }, 'Diagnostic');
    
    if (!game.isRunning) {
      logger.warn('⚠️  Game is NOT running - trades will not be generated', undefined, 'Diagnostic');
    } else {
      logger.info('✅ Game is running', undefined, 'Diagnostic');
    }
  }
  
  logger.info('', undefined, 'Diagnostic');
  
  // 2. Check NPCs (actors)
  const tradingNPCs = await prisma.user.findMany({
    where: {
      isActor: true,
    },
    select: {
      id: true,
      displayName: true,
    },
  });
  
  logger.info(`NPCs (actors): ${tradingNPCs.length}`, undefined, 'Diagnostic');
  
  if (tradingNPCs.length === 0) {
    logger.error('❌ No NPCs found - no trades will be generated', undefined, 'Diagnostic');
    logger.info('To fix: Create NPC actors in database', undefined, 'Diagnostic');
  } else {
    logger.info(`✅ ${tradingNPCs.length} NPCs available`, undefined, 'Diagnostic');
    logger.info('Sample NPCs:', tradingNPCs.slice(0, 5).map(n => ({
      name: n.displayName,
    })), 'Diagnostic');
  }
  
  logger.info('', undefined, 'Diagnostic');
  
  // 3. Check recent trades
  const recentTrades = await prisma.nPCTrade.findMany({
    take: 10,
    orderBy: { executedAt: 'desc' },
  });
  
  logger.info(`Total NPC trades in database: Checking...`, undefined, 'Diagnostic');
  const totalTrades = await prisma.nPCTrade.count();
  logger.info(`Total NPC trades: ${totalTrades}`, undefined, 'Diagnostic');
  
  if (totalTrades === 0) {
    logger.warn('⚠️  No NPC trades found in database', undefined, 'Diagnostic');
  } else {
    logger.info(`✅ ${totalTrades} NPC trades in database`, undefined, 'Diagnostic');
    logger.info('Recent trades:', recentTrades.slice(0, 3).map(t => ({
      npcActorId: t.npcActorId,
      action: t.action,
      amount: t.amount,
      executedAt: t.executedAt,
    })), 'Diagnostic');
  }
  
  logger.info('', undefined, 'Diagnostic');
  
  // 4. Check active questions
  const activeQuestions = await prisma.question.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      questionNumber: true,
      text: true,
    },
  });
  
  logger.info(`Active questions: ${activeQuestions.length}`, undefined, 'Diagnostic');
  
  if (activeQuestions.length === 0) {
    logger.warn('⚠️  No active questions - NPCs have nothing to trade on', undefined, 'Diagnostic');
  } else {
    logger.info(`✅ ${activeQuestions.length} active questions`, undefined, 'Diagnostic');
  }
  
  logger.info('', undefined, 'Diagnostic');
  logger.info('=== SUMMARY ===', undefined, 'Diagnostic');
  
  const issues = [];
  if (!game?.isRunning) issues.push('Game not running');
  if (tradingNPCs.length === 0) issues.push('No NPCs with trading enabled');
  if (totalTrades === 0) issues.push('No trades in database');
  if (activeQuestions.length === 0) issues.push('No active questions');
  
  if (issues.length === 0) {
    logger.info('✅ Everything looks good - trades should be appearing', undefined, 'Diagnostic');
    logger.info('If UI shows "No trades yet", check:', undefined, 'Diagnostic');
    logger.info('  1. API endpoint /api/trades', undefined, 'Diagnostic');
    logger.info('  2. Frontend query filters', undefined, 'Diagnostic');
    logger.info('  3. Browser console for errors', undefined, 'Diagnostic');
  } else {
    logger.error('❌ Issues found:', issues, 'Diagnostic');
    issues.forEach(issue => {
      logger.error(`  - ${issue}`, undefined, 'Diagnostic');
    });
  }
}

main()
  .catch(error => {
    logger.error('Diagnostic failed:', error, 'Diagnostic');
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });

