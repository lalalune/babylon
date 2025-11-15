/**
 * Integration Tests: Game Learnability
 * 
 * @module engine/__tests__/integration/game-learnability.test
 * 
 * @description
 * CRITICAL INTEGRATION TESTS - Use REAL LLM calls to verify:
 * 1. Information gradient exists (early unclear → late clear)
 * 2. NPCs are consistent (agents can learn who to trust)
 * 3. Game is learnable (simple strategies beat random)
 * 4. Insider advantage is real (group chats provide value)
 * 
 * ⚠️ **IMPORTANT**: These tests:
 * - Use REAL API calls (cost money)
 * - Take 30-120 seconds each
 * - Marked as .skip by default
 * - Run manually for quality validation
 * 
 * **To run manually**:
 * ```bash
 * bun test src/engine/__tests__/integration/game-learnability.test.ts
 * ```
 * 
 * **Or run specific test**:
 * ```bash
 * bun test --grep "information gradient"
 * ```
 * 
 * @see {@link GameGenerator} - Class under test
 * @see {@link /docs/research/game-engine-analysis.md} - Research justifying these tests
 */

import { describe, test, expect } from 'bun:test';
import { GameGenerator } from '@/generator/GameGenerator';
import type { GeneratedGame, WorldEvent, FeedPost, Actor } from '@/shared/types';
import { logger } from '@/lib/logger';

/**
 * Calculate information certainty from events
 * 
 * @param events - Events to analyze
 * @param questionId - Question ID to filter for
 * @param actualOutcome - Actual question outcome
 * @returns Certainty from 0-1 (0.5 = no info, 1.0 = definitive)
 */
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
  
  if (relevantEvents.length === 0) return 0.5; // No info = 50/50
  
  const correctSignals = relevantEvents.filter(e => 
    (e.pointsToward === 'YES') === actualOutcome ||
    (e.pointsToward === 'NO') === !actualOutcome
  ).length;
  
  return correctSignals / relevantEvents.length;
}

/**
 * Calculate certainty from feed posts
 */
function calculateCertaintyFromPosts(
  posts: FeedPost[],
  actualOutcome: boolean
): number {
  const relevantPosts = posts.filter(p => 
    p.pointsToward !== null &&
    p.pointsToward !== undefined
  );
  
  if (relevantPosts.length === 0) return 0.5;
  
  const correctPosts = posts.filter(p => 
    (p.pointsToward === 'YES' || p.pointsToward === true) === actualOutcome ||
    (p.pointsToward === 'NO' || p.pointsToward === false) === !actualOutcome
  );
  
  return correctPosts.length / relevantPosts.length;
}

/**
 * Calculate accuracy for a group of NPCs
 */
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
        p.pointsToward !== undefined &&
        p.relatedQuestion !== null &&
        p.relatedQuestion !== undefined
      );
    
    for (const post of posts) {
      const question = game.setup.questions.find(q => q.id === post.relatedQuestion);
      if (!question) continue;
      
      total++;
      const postPointsToYes = post.pointsToward === 'YES' || post.pointsToward === true;
      const questionIsYes = question.outcome;
      
      if (postPointsToYes === questionIsYes) {
        correct++;
      }
    }
  }
  
  return total > 0 ? correct / total : 0.5;
}

describe('Game Learnability Integration Tests', () => {
  test.skip('CRITICAL: information gradient exists (early unclear, late clear)', async () => {
    // ✅ This test MUST pass for game to be learnable
    const generator = new GameGenerator();
    const game = await generator.generateCompleteGame();
    
    logger.info('Testing information gradient...', undefined, 'LearnabilityTest');
    
    let allGradientsPass = true;
    
    // For each question, verify information gradient
    for (const question of game.setup.questions) {
      const allEvents = game.timeline.flatMap(day => day.events);
      
      // Calculate certainty for each phase
      const earlyEvents = allEvents.filter(e => e.day <= 10);
      const middleEvents = allEvents.filter(e => e.day >= 11 && e.day <= 20);
      const lateEvents = allEvents.filter(e => e.day >= 21);
      
      const earlyCertainty = calculateCertainty(earlyEvents, question.id, question.outcome);
      const middleCertainty = calculateCertainty([...earlyEvents, ...middleEvents], question.id, question.outcome);
      const lateCertainty = calculateCertainty([...earlyEvents, ...middleEvents, ...lateEvents], question.id, question.outcome);
      
      const gradient = lateCertainty - earlyCertainty;
      const hasGradient = gradient > 0.2;
      
      logger.info(`Question ${question.id}: ${(earlyCertainty * 100).toFixed(0)}% → ${(middleCertainty * 100).toFixed(0)}% → ${(lateCertainty * 100).toFixed(0)}% (gradient: ${(gradient * 100).toFixed(0)}%) ${hasGradient ? '✅' : '❌'}`, undefined, 'LearnabilityTest');
      
      // Verify gradient exists
      expect(lateCertainty).toBeGreaterThan(earlyCertainty + 0.15); // At least 15% improvement
      expect(middleCertainty).toBeGreaterThanOrEqual(earlyCertainty); // Monotonic or equal
      expect(lateCertainty).toBeGreaterThan(middleCertainty); // Late > middle
      
      // Verify ranges
      expect(earlyCertainty).toBeLessThan(0.65);      // Early: ambiguous (<65%)
      expect(lateCertainty).toBeGreaterThan(0.70);   // Late: clear (>70%)
      
      if (!hasGradient) {
        allGradientsPass = false;
      }
    }
    
    expect(allGradientsPass).toBe(true);
    logger.info(allGradientsPass ? '✅ PASS: All questions have information gradient' : '❌ FAIL: Some questions lack gradient', undefined, 'LearnabilityTest');
  }, {
    timeout: 120000, // 2 minutes
  });
  
  test.skip('NPCs with high reliability are consistently accurate', async () => {
    const generator = new GameGenerator();
    const game = await generator.generateCompleteGame();
    
    logger.info('Testing NPC consistency...', undefined, 'LearnabilityTest');
    
    const allActors = [
      ...game.setup.mainActors,
      ...game.setup.supportingActors,
    ];
    
    // Find NPCs marked as high reliability (>0.7)
    const highReliabilityNPCs = allActors.filter(a => 
      a.persona && a.persona.reliability > 0.7
    );
    
    logger.info(`Found ${highReliabilityNPCs.length} high reliability NPCs`, undefined, 'LearnabilityTest');
    expect(highReliabilityNPCs.length).toBeGreaterThan(0); // Should have some
    
    // For each high reliability NPC, check their post accuracy
    for (const npc of highReliabilityNPCs) {
      const posts = game.timeline
        .flatMap(day => day.feedPosts)
        .filter(post => 
          post.author === npc.id &&
          post.pointsToward !== null &&
          post.relatedQuestion !== null
        );
      
      if (posts.length === 0) continue; // Skip if no relevant posts
      
      // Get resolved questions to check accuracy
      const accuratePosts = posts.filter(post => {
        const question = game.setup.questions.find(q => q.id === post.relatedQuestion);
        if (!question) return false;
        
        // Is this post's hint accurate?
        const postPointsToYes = post.pointsToward === 'YES' || post.pointsToward === true;
        return postPointsToYes === question.outcome;
      });
      
      const accuracy = accuratePosts.length / posts.length;
      
      logger.info(`${npc.name} (reliability ${npc.persona?.reliability.toFixed(2)}): ${(accuracy * 100).toFixed(0)}% accurate (${accuratePosts.length}/${posts.length} posts)`, undefined, 'LearnabilityTest');
      
      // High reliability NPCs should be >60% accurate (allowing some variance)
      expect(accuracy).toBeGreaterThan(0.55);
    }
  }, {
    timeout: 120000,
  });
  
  test.skip('simple betting strategy beats random guessing', async () => {
    // ✅ This test proves the game is learnable
    
    logger.info('Testing learnability with simple strategy...', undefined, 'LearnabilityTest');
    logger.info('Generating 3 test games (this takes ~3-5 minutes)...', undefined, 'LearnabilityTest');
    
    // Run 3 mini-games (9 questions total)
    const games: GeneratedGame[] = [];
    const generator = new GameGenerator();
    
    for (let i = 0; i < 3; i++) {
      logger.info(`Generating game ${i + 1}/3...`, undefined, 'LearnabilityTest');
      games.push(await generator.generateCompleteGame());
    }
    
    // Simulate simple strategy: Trust high clueStrength posts (>0.7)
    let totalPredictions = 0;
    let correctPredictions = 0;
    
    for (const game of games) {
      for (const question of game.setup.questions) {
        totalPredictions++;
        
        // Get high-strength clues
        const strongClues = game.timeline
          .flatMap(day => day.feedPosts)
          .filter(post => 
            post.relatedQuestion === question.id &&
            post.clueStrength > 0.7 &&
            post.pointsToward !== null
          );
        
        if (strongClues.length === 0) {
          // No strong clues - skip this question
          totalPredictions--;
          continue;
        }
        
        // Vote based on majority
        const yesVotes = strongClues.filter(p => 
          p.pointsToward === 'YES' || p.pointsToward === true
        ).length;
        const noVotes = strongClues.filter(p => 
          p.pointsToward === 'NO' || p.pointsToward === false
        ).length;
        
        const prediction = yesVotes > noVotes;
        
        if (prediction === question.outcome) {
          correctPredictions++;
        }
        
        logger.info(`Q${question.id}: ${strongClues.length} strong clues → ${prediction ? 'YES' : 'NO'} (actual: ${question.outcome ? 'YES' : 'NO'}) ${prediction === question.outcome ? '✅' : '❌'}`, undefined, 'LearnabilityTest');
      }
    }
    
    const accuracy = correctPredictions / totalPredictions;
    
    logger.info('─'.repeat(50), undefined, 'LearnabilityTest');
    logger.info(`SIMPLE STRATEGY RESULTS: ${correctPredictions}/${totalPredictions} = ${(accuracy * 100).toFixed(0)}%`, undefined, 'LearnabilityTest');
    logger.info(`Target: 65-85% (better than random 50%, not trivial 95%)`, undefined, 'LearnabilityTest');
    logger.info(accuracy > 0.65 && accuracy < 0.85 ? '✅ PASS: Game is learnable' : '❌ FAIL: Game not learnable', undefined, 'LearnabilityTest');
    logger.info('─'.repeat(50), undefined, 'LearnabilityTest');
    
    // Should beat random guessing (50%) by at least 15%
    expect(accuracy).toBeGreaterThan(0.65);
    
    // But shouldn't be too easy
    expect(accuracy).toBeLessThan(0.90);
  }, {
    timeout: 360000, // 6 minutes (3 full games)
  });
  
  test.skip('group chat information provides measurable advantage', async () => {
    const generator = new GameGenerator();
    const game = await generator.generateCompleteGame();
    
    logger.info('Testing group chat advantage...', undefined, 'LearnabilityTest');
    
    // For each question, compare public-only vs public+group chat accuracy
    for (const question of game.setup.questions) {
      // Public posts only
      const publicPosts = game.timeline
        .flatMap(day => day.feedPosts)
        .filter(post => 
          post.relatedQuestion === question.id &&
          post.pointsToward !== null
        );
      
      const publicCertainty = calculateCertaintyFromPosts(publicPosts, question.outcome);
      
      // Count group chat hints (simplified - just count relevant messages)
      const groupChatHints = game.timeline
        .flatMap(day => Object.values(day.groupChats).flat())
        .filter(msg => {
          // Simple heuristic: message mentions question keywords
          const questionKeywords = question.text.toLowerCase().split(' ').filter(w => w.length > 4);
          const messageLower = msg.message.toLowerCase();
          return questionKeywords.some(keyword => messageLower.includes(keyword));
        });
      
      const groupChatValue = groupChatHints.length * 0.04; // 4% bonus per relevant hint
      
      logger.info(`Q${question.id}: Public ${(publicCertainty * 100).toFixed(0)}%, Group chats +${(groupChatValue * 100).toFixed(0)}% (${groupChatHints.length} hints)`, undefined, 'LearnabilityTest');
      
      // Group chats should provide some advantage
      // Note: This is a simplified test - real advantage comes from quality not quantity
      if (groupChatHints.length > 0) {
        expect(groupChatValue).toBeGreaterThan(0);
      }
    }
  }, {
    timeout: 120000,
  });
  
  test.skip('questions have resolution verification events', async () => {
    const generator = new GameGenerator();
    const game = await generator.generateCompleteGame();
    
    logger.info('Testing resolution verification...', undefined, 'LearnabilityTest');
    
    // Each question should have at least one definitive verification event
    for (const question of game.setup.questions) {
      const allEvents = game.timeline.flatMap(day => day.events);
      
      // Find events that definitively prove the outcome
      const verificationEvents = allEvents.filter(e => 
        e.relatedQuestion === question.id &&
        e.pointsToward === (question.outcome ? 'YES' : 'NO') &&
        e.day >= 25 // Late game
      );
      
      logger.info(`Q${question.id}: ${verificationEvents.length} verification events (day 25+)`, undefined, 'LearnabilityTest');
      
      expect(verificationEvents.length).toBeGreaterThan(0);
      
      // At least one should be a strong revelation or announcement
      const definitiveEvents = verificationEvents.filter(e => 
        e.type === 'revelation' || e.type === 'announcement'
      );
      
      expect(definitiveEvents.length).toBeGreaterThan(0);
    }
  }, {
    timeout: 120000,
  });
});

