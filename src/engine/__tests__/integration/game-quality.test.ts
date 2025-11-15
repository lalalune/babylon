/**
 * Integration Tests: Game Quality
 * 
 * @module engine/__tests__/integration/game-quality.test
 * 
 * @description
 * Integration tests that validate generated game content quality with REAL LLM calls.
 * 
 * **Tests verify:**
 * 1. No undefined/missing fields in generated content
 * 2. All required data is present and valid
 * 3. Timestamps are properly formatted
 * 4. IDs are unique across game
 * 5. References (actor IDs, org IDs) are valid
 * 6. Content meets length requirements
 * 
 * ⚠️ **IMPORTANT**: These tests use real API calls and are marked .skip by default.
 * 
 * @usage
 * Run manually: `bun test src/engine/__tests__/integration/game-quality.test.ts`
 */

import { describe, test, expect } from 'bun:test';
import { GameGenerator } from '@/generator/GameGenerator';
import { logger } from '@/lib/logger';

describe('Game Quality Integration Tests', () => {
  test.skip('generated game has no undefined fields', async () => {
    const generator = new GameGenerator();
    const game = await generator.generateCompleteGame();
    
    logger.info('Validating game structure...', undefined, 'QualityTest');
    
    // Check all actors have required fields
    const allActors = [
      ...game.setup.mainActors,
      ...game.setup.supportingActors,
      ...game.setup.extras,
    ];
    
    for (const actor of allActors) {
      expect(actor.id).toBeDefined();
      expect(actor.name).toBeDefined();
      expect(actor.description).toBeDefined();
      expect(actor.tier).toBeDefined();
      expect(actor.role).toBeDefined();
      
      // Validate persona if present
      if (actor.persona) {
        expect(typeof actor.persona.reliability).toBe('number');
        expect(actor.persona.reliability).toBeGreaterThanOrEqual(0);
        expect(actor.persona.reliability).toBeLessThanOrEqual(1);
        expect(Array.isArray(actor.persona.insiderOrgs)).toBe(true);
        expect(typeof actor.persona.willingToLie).toBe('boolean');
      }
    }
    
    logger.info(`✅ All ${allActors.length} actors have required fields`, undefined, 'QualityTest');
    
    // Check all events have required fields
    let eventCount = 0;
    for (const day of game.timeline) {
      for (const event of day.events) {
        eventCount++;
        expect(event.id).toBeDefined();
        expect(event.day).toBeDefined();
        expect(event.type).toBeDefined();
        expect(event.description).toBeDefined();
        expect(event.description.length).toBeGreaterThan(0);
        expect(event.description.length).toBeLessThan(250); // Max length
        expect(event.actors).toBeDefined();
        expect(Array.isArray(event.actors)).toBe(true);
        expect(event.visibility).toBeDefined();
      }
    }
    
    logger.info(`✅ All ${eventCount} events have required fields`, undefined, 'QualityTest');
    
    // Check all feed posts have required fields
    let postCount = 0;
    for (const day of game.timeline) {
      for (const post of day.feedPosts) {
        postCount++;
        expect(post.id).toBeDefined();
        expect(post.content).toBeDefined();
        expect(post.content.length).toBeGreaterThan(0);
        expect(post.author).toBeDefined();
        expect(post.authorName).toBeDefined();
        expect(post.timestamp).toBeDefined();
        expect(post.day).toBeDefined();
        
        // Validate timestamp format
        const timestamp = new Date(post.timestamp);
        expect(isNaN(timestamp.getTime())).toBe(false);
        
        // Sentiment should be in valid range if present
        if (post.sentiment !== null && post.sentiment !== undefined) {
          expect(post.sentiment).toBeGreaterThanOrEqual(-1);
          expect(post.sentiment).toBeLessThanOrEqual(1);
        }
        
        // ClueStrength should be in valid range if present
        if (post.clueStrength !== null && post.clueStrength !== undefined) {
          expect(post.clueStrength).toBeGreaterThanOrEqual(0);
          expect(post.clueStrength).toBeLessThanOrEqual(1);
        }
      }
    }
    
    logger.info(`✅ All ${postCount} feed posts have required fields`, undefined, 'QualityTest');
    logger.info('✅ PASS: No undefined fields detected', undefined, 'QualityTest');
  }, {
    timeout: 120000,
  });
  
  test.skip('all actor IDs are unique', async () => {
    const generator = new GameGenerator();
    const game = await generator.generateCompleteGame();
    
    const allActors = [
      ...game.setup.mainActors,
      ...game.setup.supportingActors,
      ...game.setup.extras,
    ];
    
    const ids = allActors.map(a => a.id);
    const uniqueIds = new Set(ids);
    
    expect(uniqueIds.size).toBe(ids.length);
    logger.info(`✅ All ${ids.length} actor IDs are unique`, undefined, 'QualityTest');
  }, {
    timeout: 120000,
  });
  
  test.skip('all event IDs are unique', async () => {
    const generator = new GameGenerator();
    const game = await generator.generateCompleteGame();
    
    const allEvents = game.timeline.flatMap(day => day.events);
    const ids = allEvents.map(e => e.id);
    const uniqueIds = new Set(ids);
    
    expect(uniqueIds.size).toBe(ids.length);
    logger.info(`✅ All ${ids.length} event IDs are unique`, undefined, 'QualityTest');
  }, {
    timeout: 120000,
  });
  
  test.skip('all actor references are valid', async () => {
    const generator = new GameGenerator();
    const game = await generator.generateCompleteGame();
    
    const allActors = [
      ...game.setup.mainActors,
      ...game.setup.supportingActors,
      ...game.setup.extras,
    ];
    const validActorIds = new Set(allActors.map(a => a.id));
    const validOrgIds = new Set(game.setup.organizations.map(o => o.id));
    
    // Check events reference valid actors
    for (const day of game.timeline) {
      for (const event of day.events) {
        for (const actorId of event.actors) {
          expect(validActorIds.has(actorId)).toBe(true);
        }
      }
      
      // Check posts reference valid authors
      for (const post of day.feedPosts) {
        // Allow system authors
        if (post.author.startsWith('game-') || 
            post.author.startsWith('market-') ||
            post.author === 'ambient') {
          continue;
        }
        
        // Must be valid actor or organization
        const isValid = validActorIds.has(post.author) || validOrgIds.has(post.author);
        expect(isValid).toBe(true);
      }
    }
    
    logger.info('✅ All actor and organization references are valid', undefined, 'QualityTest');
  }, {
    timeout: 120000,
  });
  
  test.skip('questions have metadata and arc plans', async () => {
    const generator = new GameGenerator();
    const game = await generator.generateCompleteGame();
    
    for (const question of game.setup.questions) {
      // Questions should have metadata with arc plans
      expect(question.metadata).toBeDefined();
      expect(question.metadata?.arcPlan).toBeDefined();
      
      const arcPlan = question.metadata!.arcPlan!;
      
      // Validate arc plan structure
      expect(typeof arcPlan.uncertaintyPeakDay).toBe('number');
      expect(typeof arcPlan.clarityOnsetDay).toBe('number');
      expect(typeof arcPlan.verificationDay).toBe('number');
      expect(Array.isArray(arcPlan.insiders)).toBe(true);
      expect(Array.isArray(arcPlan.deceivers)).toBe(true);
      
      // Validate day ordering
      expect(arcPlan.clarityOnsetDay).toBeGreaterThan(arcPlan.uncertaintyPeakDay);
      expect(arcPlan.verificationDay).toBeGreaterThan(arcPlan.clarityOnsetDay);
      
      logger.info(`Q${question.id}: Uncertainty peak=${arcPlan.uncertaintyPeakDay}, Clarity=${arcPlan.clarityOnsetDay}, Verification=${arcPlan.verificationDay}`, undefined, 'QualityTest');
    }
    
    logger.info('✅ All questions have valid arc plans', undefined, 'QualityTest');
  }, {
    timeout: 120000,
  });
});

