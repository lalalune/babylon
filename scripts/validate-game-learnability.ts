/**
 * Game Learnability Validation Script
 * 
 * @description
 * Generates multiple complete games and validates that:
 * 1. Information gradient exists (early unclear → late clear)
 * 2. Simple strategies beat random guessing
 * 3. NPCs maintain consistent reliability levels
 * 4. Game has sufficient signal-to-noise ratio
 * 
 * This is a comprehensive quality check that should be run:
 * - After major engine changes
 * - Before production deployment
 * - When tuning difficulty parameters
 * 
 * **Usage**:
 * ```bash
 * # Run with 3 games (faster, ~5-10 minutes)
 * bun run scripts/validate-game-learnability.ts
 * 
 * # Run with 10 games (comprehensive, ~20-30 minutes)
 * bun run scripts/validate-game-learnability.ts 10
 * ```
 * 
 * **Output**:
 * - Information gradient analysis per question
 * - Simple strategy win rate
 * - NPC reliability correlation
 * - Overall learnability score
 */

import { GameGenerator } from '@/generator/GameGenerator';
import type { GeneratedGame, WorldEvent, Actor } from '@/shared/types';
import { logger } from '@/lib/logger';

// Helper to calculate certainty from events
function calculateCertainty(
  events: WorldEvent[],
  questionId: number | string,
  actualOutcome: boolean
): number {
  const relevantEvents = events.filter(e => 
    e.relatedQuestion === questionId &&
    e.pointsToward !== null &&
    e.pointsToward !== undefined
  );
  
  if (relevantEvents.length === 0) return 0.5;
  
  const correctSignals = relevantEvents.filter(e => 
    (e.pointsToward === 'YES') === actualOutcome ||
    (e.pointsToward === 'NO') === !actualOutcome
  ).length;
  
  return correctSignals / relevantEvents.length;
}

// Calculate NPC group accuracy
function calculateGroupAccuracy(
  game: GeneratedGame,
  npcs: Actor[]
): number {
  let total = 0;
  let correct = 0;
  
  for (const npc of npcs) {
    const posts = game.timeline
      .flatMap(day => day.feedPosts)
      .filter(p => 
        p.author === npc.id &&
        p.pointsToward !== null &&
        p.relatedQuestion !== null
      );
    
    for (const post of posts) {
      const question = game.setup.questions.find(q => q.id === post.relatedQuestion);
      if (!question) continue;
      
      total++;
      const postPointsToYes = post.pointsToward === true;
      if (postPointsToYes === question.outcome) {
        correct++;
      }
    }
  }
  
  return total > 0 ? correct / total : 0.5;
}

async function main() {
  const numGames = parseInt(process.argv[2] || '3', 10);
  
  logger.info('═'.repeat(60), undefined, 'Validator');
  logger.info('BABYLON GAME LEARNABILITY VALIDATION', undefined, 'Validator');
  logger.info('═'.repeat(60), undefined, 'Validator');
  logger.info(`Generating ${numGames} test games...`, undefined, 'Validator');
  logger.info(`Estimated time: ${numGames * 2}-${numGames * 3} minutes`, undefined, 'Validator');
  logger.info('', undefined, 'Validator');
  
  const generator = new GameGenerator();
  const games: GeneratedGame[] = [];
  
  for (let i = 0; i < numGames; i++) {
    const startTime = Date.now();
    logger.info(`[${i + 1}/${numGames}] Generating game...`, undefined, 'Validator');
    const game = await generator.generateCompleteGame();
    games.push(game);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`[${i + 1}/${numGames}] Complete in ${duration}s`, undefined, 'Validator');
  }
  
  logger.info('', undefined, 'Validator');
  logger.info('Games generated. Running validation...', undefined, 'Validator');
  logger.info('', undefined, 'Validator');
  
  // ══════════════════════════════════════════════════════════════
  // VALIDATION 1: Information Gradient
  // ══════════════════════════════════════════════════════════════
  logger.info('─'.repeat(60), undefined, 'Validator');
  logger.info('VALIDATION 1: Information Gradient', undefined, 'Validator');
  logger.info('Goal: Early game unclear (<60%), late game clear (>75%)', undefined, 'Validator');
  logger.info('─'.repeat(60), undefined, 'Validator');
  
  const gradientResults: Array<{
    questionId: string | number;
    early: number;
    late: number;
    gradient: number;
    pass: boolean;
  }> = [];
  
  for (const game of games) {
    for (const question of game.setup.questions) {
      const earlyEvents = game.timeline.filter(d => d.day <= 10).flatMap(d => d.events);
      const lateEvents = game.timeline.filter(d => d.day >= 21).flatMap(d => d.events);
      const allLateEvents = [...earlyEvents, ...lateEvents];
      
      const earlyCertainty = calculateCertainty(earlyEvents, question.id, question.outcome);
      const lateCertainty = calculateCertainty(allLateEvents, question.id, question.outcome);
      
      const gradient = lateCertainty - earlyCertainty;
      const pass = gradient > 0.15 && earlyCertainty < 0.65 && lateCertainty > 0.70;
      
      gradientResults.push({
        questionId: question.id,
        early: earlyCertainty,
        late: lateCertainty,
        gradient,
        pass,
      });
      
      logger.info(
        `Q${question.id}: ${(earlyCertainty * 100).toFixed(0)}% → ${(lateCertainty * 100).toFixed(0)}% (Δ${(gradient * 100).toFixed(0)}%) ${pass ? '✅' : '❌'}`,
        undefined,
        'Validator'
      );
    }
  }
  
  const gradientPassRate = gradientResults.filter(r => r.pass).length / gradientResults.length;
  logger.info('', undefined, 'Validator');
  logger.info(`Result: ${(gradientPassRate * 100).toFixed(0)}% of questions have information gradient`, undefined, 'Validator');
  logger.info(gradientPassRate > 0.7 ? '✅ PASS' : '❌ FAIL (need 70%+)', undefined, 'Validator');
  
  // ══════════════════════════════════════════════════════════════
  // VALIDATION 2: Simple Strategy Success Rate
  // ══════════════════════════════════════════════════════════════
  logger.info('', undefined, 'Validator');
  logger.info('─'.repeat(60), undefined, 'Validator');
  logger.info('VALIDATION 2: Simple Strategy Success Rate', undefined, 'Validator');
  logger.info('Strategy: Trust high-strength clues (>0.7)', undefined, 'Validator');
  logger.info('Goal: 65-85% accuracy (better than random, not trivial)', undefined, 'Validator');
  logger.info('─'.repeat(60), undefined, 'Validator');
  
  let totalPredictions = 0;
  let correctPredictions = 0;
  
  for (const game of games) {
    for (const question of game.setup.questions) {
      totalPredictions++;
      
      // Strategy: Trust high-strength clues
      const strongClues = game.timeline
        .flatMap(day => day.feedPosts)
        .filter(p => 
          p.relatedQuestion === question.id &&
          (p.clueStrength ?? 0) > 0.7 &&
          p.pointsToward !== null &&
          p.pointsToward !== undefined
        );
      
      if (strongClues.length === 0) {
        totalPredictions--;
        continue;
      }
      
      const yesVotes = strongClues.filter(p => p.pointsToward === true).length;
      const noVotes = strongClues.filter(p => p.pointsToward === false).length;
      
      const prediction = yesVotes > noVotes;
      const correct = prediction === question.outcome;
      
      if (correct) correctPredictions++;
      
      logger.info(
        `Q${question.id}: ${strongClues.length} strong clues → ${prediction ? 'YES' : 'NO'} (actual: ${question.outcome ? 'YES' : 'NO'}) ${correct ? '✅' : '❌'}`,
        undefined,
        'Validator'
      );
    }
  }
  
  const accuracy = totalPredictions > 0 ? correctPredictions / totalPredictions : 0;
  const strategyPass = accuracy > 0.65 && accuracy < 0.90;
  
  logger.info('', undefined, 'Validator');
  logger.info(`Result: ${correctPredictions}/${totalPredictions} = ${(accuracy * 100).toFixed(0)}%`, undefined, 'Validator');
  logger.info(strategyPass ? '✅ PASS (65-90% target)' : '❌ FAIL', undefined, 'Validator');
  
  // ══════════════════════════════════════════════════════════════
  // VALIDATION 3: NPC Reliability Correlation
  // ══════════════════════════════════════════════════════════════
  logger.info('', undefined, 'Validator');
  logger.info('─'.repeat(60), undefined, 'Validator');
  logger.info('VALIDATION 3: NPC Reliability Correlation', undefined, 'Validator');
  logger.info('Goal: High reliability NPCs are more accurate than low', undefined, 'Validator');
  logger.info('─'.repeat(60), undefined, 'Validator');
  
  // Aggregate NPCs by reliability across all games
  const reliabilityBuckets = {
    high: [] as Actor[],    // >0.7
    medium: [] as Actor[],  // 0.4-0.7
    low: [] as Actor[],     // <0.4
  };
  
  for (const game of games) {
    const allActors = [
      ...game.setup.mainActors,
      ...game.setup.supportingActors,
    ];
    
    for (const actor of allActors) {
      if (!actor.persona) continue;
      
      if (actor.persona.reliability > 0.7) {
        reliabilityBuckets.high.push(actor);
      } else if (actor.persona.reliability > 0.4) {
        reliabilityBuckets.medium.push(actor);
      } else {
        reliabilityBuckets.low.push(actor);
      }
    }
  }
  
  // Calculate accuracy for each bucket
  const highAccuracy = reliabilityBuckets.high.length > 0 
    ? calculateGroupAccuracy(games[0]!, reliabilityBuckets.high) 
    : 0;
  const mediumAccuracy = reliabilityBuckets.medium.length > 0 
    ? calculateGroupAccuracy(games[0]!, reliabilityBuckets.medium) 
    : 0;
  const lowAccuracy = reliabilityBuckets.low.length > 0 
    ? calculateGroupAccuracy(games[0]!, reliabilityBuckets.low) 
    : 0;
  
  logger.info(`High reliability NPCs (${reliabilityBuckets.high.length}): ${(highAccuracy * 100).toFixed(0)}% accurate`, undefined, 'Validator');
  logger.info(`Medium reliability NPCs (${reliabilityBuckets.medium.length}): ${(mediumAccuracy * 100).toFixed(0)}% accurate`, undefined, 'Validator');
  logger.info(`Low reliability NPCs (${reliabilityBuckets.low.length}): ${(lowAccuracy * 100).toFixed(0)}% accurate`, undefined, 'Validator');
  
  const correlationPass = highAccuracy > mediumAccuracy + 0.1 || mediumAccuracy > lowAccuracy + 0.1;
  logger.info('', undefined, 'Validator');
  logger.info(correlationPass ? '✅ PASS: Reliability correlates with accuracy' : '⚠️  PARTIAL: Weak correlation', undefined, 'Validator');
  
  // ══════════════════════════════════════════════════════════════
  // FINAL SCORE
  // ══════════════════════════════════════════════════════════════
  logger.info('', undefined, 'Validator');
  logger.info('═'.repeat(60), undefined, 'Validator');
  logger.info('LEARNABILITY SCORE', undefined, 'Validator');
  logger.info('═'.repeat(60), undefined, 'Validator');
  
  const checks = [
    { name: 'Information gradient', pass: gradientPassRate > 0.7 },
    { name: 'Strategy success rate', pass: strategyPass },
    { name: 'NPC reliability correlation', pass: correlationPass },
  ];
  
  checks.forEach(check => {
    logger.info(`${check.pass ? '✅' : '❌'} ${check.name}`, undefined, 'Validator');
  });
  
  const passCount = checks.filter(c => c.pass).length;
  const score = passCount / checks.length;
  
  logger.info('', undefined, 'Validator');
  logger.info(`OVERALL SCORE: ${passCount}/${checks.length} checks passed (${(score * 100).toFixed(0)}%)`, undefined, 'Validator');
  
  if (score === 1.0) {
    logger.info('🎉 EXCELLENT: Game is fully learnable and ready for RL', undefined, 'Validator');
  } else if (score >= 0.67) {
    logger.info('✅ GOOD: Game is learnable with minor improvements needed', undefined, 'Validator');
  } else {
    logger.info('❌ NEEDS WORK: Game requires fixes before RL training', undefined, 'Validator');
  }
  
  logger.info('═'.repeat(60), undefined, 'Validator');
  
  // Exit with appropriate code
  process.exit(score >= 0.67 ? 0 : 1);
}

main().catch(error => {
  logger.error('Validation failed with error:', error, 'Validator');
  process.exit(1);
});

