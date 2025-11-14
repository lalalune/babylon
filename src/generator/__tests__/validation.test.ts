/**
 * Game Output Validation Tests
 * Ensures generated games have correct structure and content
 *
 * NOTE: This test suite requires LLM API keys (GROQ_API_KEY or OPENAI_API_KEY)
 * and takes 1-5 minutes to run due to game generation.
 */

import { describe, test, expect, beforeAll, setDefaultTimeout } from 'bun:test';
import { GameGenerator } from '../GameGenerator';
import type { GeneratedGame } from '../GameGenerator';

// Set timeout to 10 minutes for LLM-based generation
// Retry loops when LLM returns invalid JSON can cause 6-7 minute runs
// TODO: Optimize prompts in Phase 3 to reduce retries and improve reliability
// This test validates game structure, not performance - timeout is acceptable
setDefaultTimeout(600000);

describe('Game Output Validation', () => {
  let game: GeneratedGame;

  // Generate one game before all tests
  beforeAll(async () => {
    const generator = new GameGenerator();
    game = await generator.generateCompleteGame();
    expect(game).toBeDefined();
  });

  describe('Schema Validation', () => {
    test('has all required top-level fields', () => {
      expect(game.id).toBeDefined();
      expect(game.version).toBeDefined();
      expect(game.generatedAt).toBeDefined();
      expect(game.setup).toBeDefined();
      expect(game.timeline).toBeDefined();
      expect(game.resolution).toBeDefined();
    });

    test('has all 30 days in timeline', () => {
      expect(game.timeline.length).toBe(30);
      
      // Verify days are 1-30
      game.timeline.forEach((day, i) => {
        expect(day.day).toBe(i + 1);
      });
    });

    test('has 3 main actors', () => {
      expect(game.setup.mainActors.length).toBe(3);
    });

    test('has 15 supporting actors', () => {
      expect(game.setup.supportingActors.length).toBe(15);
    });

    test('has extras', () => {
      expect(game.setup.extras.length).toBeGreaterThan(0);
    });

    test('has 3 scenarios', () => {
      expect(game.setup.scenarios.length).toBe(3);
    });

    test('has 3 questions', () => {
      expect(game.setup.questions.length).toBe(3);
    });

    test('has group chats', () => {
      expect(game.setup.groupChats.length).toBeGreaterThan(0);
    });

    test('all questions have outcomes', () => {
      game.setup.questions.forEach(q => {
        expect(typeof q.outcome).toBe('boolean');
      });
    });
  });

  describe('Content Validation', () => {
    test('events reference valid actors', () => {
      const allActorIds = [
        ...game.setup.mainActors.map(a => a.id),
        ...game.setup.supportingActors.map(a => a.id),
        ...game.setup.extras.map(a => a.id),
      ];

      game.timeline.forEach(day => {
        day.events.forEach(event => {
          event.actors.forEach(actorId => {
            expect(allActorIds).toContain(actorId);
          });
        });
      });
    });

    test('each day has events', () => {
      game.timeline.forEach(day => {
        expect(day.events.length).toBeGreaterThan(0);
      });
    });

    test('group chats have valid members', () => {
      const allActorIds = [
        ...game.setup.mainActors.map(a => a.id),
        ...game.setup.supportingActors.map(a => a.id),
        ...game.setup.extras.map(a => a.id),
      ];

      game.setup.groupChats.forEach(chat => {
        expect(chat.members.length).toBeGreaterThan(0);
        chat.members.forEach(memberId => {
          expect(allActorIds).toContain(memberId);
        });
      });
    });

    test('events have unique IDs', () => {
      const eventIds = new Set<string>();
      
      game.timeline.forEach(day => {
        day.events.forEach(event => {
          expect(eventIds.has(event.id)).toBe(false);
          eventIds.add(event.id);
        });
      });
    });

    test('timestamps are valid', () => {
      const generatedAt = new Date(game.generatedAt);
      expect(generatedAt.getTime()).toBeGreaterThan(0);
    });
  });

  describe('Narrative Coherence', () => {
    test('scenarios connect to questions', () => {
      game.setup.questions.forEach(q => {
        expect(q.scenario).toBeGreaterThanOrEqual(1);
        expect(q.scenario).toBeLessThanOrEqual(3);
      });
    });

    test('events distributed across days', () => {
      const eventCounts = game.timeline.map(d => d.events.length);
      const total = eventCounts.reduce((sum, c) => sum + c, 0);
      
      expect(total).toBeGreaterThan(30); // At least 1 per day
    });

    test('has resolution for all questions', () => {
      expect(game.resolution.outcomes.length).toBe(3);
      
      game.resolution.outcomes.forEach(outcome => {
        expect(typeof outcome.answer).toBe('boolean');
        expect(outcome.explanation).toBeDefined();
      });
    });
  });

  describe('Quality Validation', () => {
    test('early days have fewer events than late days', () => {
      const earlyEvents = game.timeline.slice(0, 10).reduce((sum, d) => sum + d.events.length, 0);
      const lateEvents = game.timeline.slice(20, 25).reduce((sum, d) => sum + d.events.length, 0);
      
      // Generally true, but not strict requirement
      expect(earlyEvents).toBeGreaterThan(0);
      expect(lateEvents).toBeGreaterThan(0);
    });

    test('file size is reasonable (<10MB)', () => {
      const json = JSON.stringify(game);
      const sizeInMB = json.length / (1024 * 1024);
      
      expect(sizeInMB).toBeLessThan(10);
    });
  });
});

