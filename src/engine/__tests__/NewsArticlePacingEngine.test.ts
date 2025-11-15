/**
 * Tests for NewsArticlePacingEngine
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { NewsArticlePacingEngine } from '../NewsArticlePacingEngine';

describe('NewsArticlePacingEngine', () => {
  let pacer: NewsArticlePacingEngine;

  beforeEach(() => {
    pacer = new NewsArticlePacingEngine();
  });

  describe('Validation', () => {
    it('should throw on invalid questionId', () => {
      expect(() => {
        pacer.shouldGenerateArticle(0, 'org-1', 'breaking');
      }).toThrow('Invalid questionId');

      expect(() => {
        pacer.shouldGenerateArticle(-1, 'org-1', 'breaking');
      }).toThrow('Invalid questionId');
    });

    it('should throw on empty orgId', () => {
      expect(() => {
        pacer.shouldGenerateArticle(1, '', 'breaking');
      }).toThrow('Invalid orgId');

      expect(() => {
        pacer.shouldGenerateArticle(1, '   ', 'breaking');
      }).toThrow('Invalid orgId');
    });

    it('should throw on invalid stage', () => {
      expect(() => {
        pacer.shouldGenerateArticle(1, 'org-1', 'invalid' as never);
      }).toThrow('Invalid stage');
    });

    it('should throw when recording with invalid inputs', () => {
      expect(() => {
        pacer.recordArticle(0, 'org-1', 'breaking', 'article-1', 100);
      }).toThrow('Invalid questionId');

      expect(() => {
        pacer.recordArticle(1, '', 'breaking', 'article-1', 100);
      }).toThrow('Invalid orgId');

      expect(() => {
        pacer.recordArticle(1, 'org-1', 'invalid' as never, 'article-1', 100);
      }).toThrow('Invalid stage');

      expect(() => {
        pacer.recordArticle(1, 'org-1', 'breaking', '', 100);
      }).toThrow('Invalid articleId');

      expect(() => {
        pacer.recordArticle(1, 'org-1', 'breaking', 'article-1', -1);
      }).toThrow('Invalid tick');
    });

    it('should throw when selecting orgs with empty array', () => {
      expect(() => {
        pacer.selectOrgsForStage([], 1, 'breaking');
      }).toThrow('availableOrgs cannot be empty');
    });

    it('should throw when org missing id', () => {
      expect(() => {
        pacer.selectOrgsForStage([{ id: '', name: 'CNN' }], 1, 'breaking');
      }).toThrow('Organization missing id');
    });

    it('should throw when org missing name', () => {
      expect(() => {
        pacer.selectOrgsForStage([{ id: 'cnn', name: '' }], 1, 'breaking');
      }).toThrow('Organization missing name');
    });
  });

  describe('Breaking Stage', () => {
    it('should allow first 2 orgs to break story', () => {
      expect(pacer.shouldGenerateArticle(1, 'org-1', 'breaking')).toBe(true);
      pacer.recordArticle(1, 'org-1', 'breaking', 'article-1', 10);

      expect(pacer.shouldGenerateArticle(1, 'org-2', 'breaking')).toBe(true);
      pacer.recordArticle(1, 'org-2', 'breaking', 'article-2', 11);

      // Third org should be blocked
      expect(pacer.shouldGenerateArticle(1, 'org-3', 'breaking')).toBe(false);
    });

    it('should prevent same org from breaking twice', () => {
      expect(pacer.shouldGenerateArticle(1, 'org-1', 'breaking')).toBe(true);
      pacer.recordArticle(1, 'org-1', 'breaking', 'article-1', 10);

      expect(pacer.shouldGenerateArticle(1, 'org-1', 'breaking')).toBe(false);
    });

    it('should select 1-2 orgs for breaking', () => {
      const orgs = [
        { id: 'org-1', name: 'CNN' },
        { id: 'org-2', name: 'Fox' },
        { id: 'org-3', name: 'NYT' },
        { id: 'org-4', name: 'WSJ' },
      ];

      const selected = pacer.selectOrgsForStage(orgs, 1, 'breaking');
      expect(selected.length).toBeGreaterThanOrEqual(1);
      expect(selected.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Commentary Stage', () => {
    it('should allow up to 3 orgs for commentary', () => {
      expect(pacer.shouldGenerateArticle(1, 'org-1', 'commentary')).toBe(true);
      pacer.recordArticle(1, 'org-1', 'commentary', 'article-1', 20);

      expect(pacer.shouldGenerateArticle(1, 'org-2', 'commentary')).toBe(true);
      pacer.recordArticle(1, 'org-2', 'commentary', 'article-2', 21);

      expect(pacer.shouldGenerateArticle(1, 'org-3', 'commentary')).toBe(true);
      pacer.recordArticle(1, 'org-3', 'commentary', 'article-3', 22);

      // Fourth org should be blocked
      expect(pacer.shouldGenerateArticle(1, 'org-4', 'commentary')).toBe(false);
    });

    it('should select 2-3 orgs for commentary', () => {
      const orgs = [
        { id: 'org-1', name: 'CNN' },
        { id: 'org-2', name: 'Fox' },
        { id: 'org-3', name: 'NYT' },
        { id: 'org-4', name: 'WSJ' },
        { id: 'org-5', name: 'BBC' },
      ];

      const selected = pacer.selectOrgsForStage(orgs, 1, 'commentary');
      expect(selected.length).toBeGreaterThanOrEqual(2);
      expect(selected.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Resolution Stage', () => {
    it('should allow unlimited orgs for resolution', () => {
      for (let i = 1; i <= 10; i++) {
        expect(pacer.shouldGenerateArticle(1, `org-${i}`, 'resolution')).toBe(true);
        pacer.recordArticle(1, `org-${i}`, 'resolution', `article-${i}`, 30 + i);
      }

      // Still allows more
      expect(pacer.shouldGenerateArticle(1, 'org-11', 'resolution')).toBe(true);
    });

    it('should prevent same org from resolving twice', () => {
      expect(pacer.shouldGenerateArticle(1, 'org-1', 'resolution')).toBe(true);
      pacer.recordArticle(1, 'org-1', 'resolution', 'article-1', 30);

      expect(pacer.shouldGenerateArticle(1, 'org-1', 'resolution')).toBe(false);
    });

    it('should select up to 5 orgs for resolution', () => {
      const orgs = [
        { id: 'org-1', name: 'CNN' },
        { id: 'org-2', name: 'Fox' },
        { id: 'org-3', name: 'NYT' },
        { id: 'org-4', name: 'WSJ' },
        { id: 'org-5', name: 'BBC' },
        { id: 'org-6', name: 'Reuters' },
        { id: 'org-7', name: 'AP' },
      ];

      const selected = pacer.selectOrgsForStage(orgs, 1, 'resolution');
      expect(selected.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Multi-Question Isolation', () => {
    it('should track different questions separately', () => {
      // Question 1 - breaking
      expect(pacer.shouldGenerateArticle(1, 'org-1', 'breaking')).toBe(true);
      pacer.recordArticle(1, 'org-1', 'breaking', 'article-1', 10);

      // Question 2 - same org, same stage, different question
      expect(pacer.shouldGenerateArticle(2, 'org-1', 'breaking')).toBe(true);
      pacer.recordArticle(2, 'org-1', 'breaking', 'article-2', 11);

      // Both should be recorded
      expect(pacer.getArticlesForQuestion(1).length).toBe(1);
      expect(pacer.getArticlesForQuestion(2).length).toBe(1);
    });

    it('should allow same org for different stages of same question', () => {
      // Breaking
      expect(pacer.shouldGenerateArticle(1, 'org-1', 'breaking')).toBe(true);
      pacer.recordArticle(1, 'org-1', 'breaking', 'article-1', 10);

      // Commentary - same org, different stage
      expect(pacer.shouldGenerateArticle(1, 'org-1', 'commentary')).toBe(true);
      pacer.recordArticle(1, 'org-1', 'commentary', 'article-2', 20);

      // Resolution - same org, different stage
      expect(pacer.shouldGenerateArticle(1, 'org-1', 'resolution')).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should track articles per question', () => {
      pacer.recordArticle(1, 'org-1', 'breaking', 'article-1', 10);
      pacer.recordArticle(1, 'org-2', 'commentary', 'article-2', 20);
      pacer.recordArticle(2, 'org-1', 'breaking', 'article-3', 15);

      expect(pacer.getArticlesForQuestion(1).length).toBe(2);
      expect(pacer.getArticlesForQuestion(2).length).toBe(1);
    });

    it('should track stage statistics', () => {
      pacer.recordArticle(1, 'org-1', 'breaking', 'article-1', 10);
      pacer.recordArticle(1, 'org-2', 'breaking', 'article-2', 11);
      pacer.recordArticle(1, 'org-3', 'commentary', 'article-3', 20);

      const stats = pacer.getStageStats(1);
      expect(stats.breaking).toBe(2);
      expect(stats.commentary).toBe(1);
      expect(stats.resolution).toBe(0);
    });

    it('should track total articles across all stages', () => {
      pacer.recordArticle(1, 'org-1', 'breaking', 'article-1', 10);
      pacer.recordArticle(2, 'org-2', 'commentary', 'article-2', 20);
      pacer.recordArticle(3, 'org-3', 'resolution', 'article-3', 30);

      expect(pacer.getTotalArticles()).toBe(3);
    });

    it('should track articles by stage globally', () => {
      pacer.recordArticle(1, 'org-1', 'breaking', 'article-1', 10);
      pacer.recordArticle(2, 'org-2', 'breaking', 'article-2', 11);
      pacer.recordArticle(1, 'org-3', 'commentary', 'article-3', 20);
      pacer.recordArticle(2, 'org-4', 'commentary', 'article-4', 21);
      pacer.recordArticle(1, 'org-5', 'resolution', 'article-5', 30);

      const counts = pacer.getArticleCountByStage();
      expect(counts.breaking).toBe(2);
      expect(counts.commentary).toBe(2);
      expect(counts.resolution).toBe(1);
    });
  });

  describe('Cleanup', () => {
    it('should clear question records', () => {
      pacer.recordArticle(1, 'org-1', 'breaking', 'article-1', 10);
      pacer.recordArticle(1, 'org-2', 'commentary', 'article-2', 20);
      pacer.recordArticle(2, 'org-1', 'breaking', 'article-3', 15);

      pacer.clearQuestion(1);

      expect(pacer.getArticlesForQuestion(1).length).toBe(0);
      expect(pacer.getArticlesForQuestion(2).length).toBe(1);
    });

    it('should reset stage limits after clear', () => {
      // Fill up breaking stage
      pacer.recordArticle(1, 'org-1', 'breaking', 'article-1', 10);
      pacer.recordArticle(1, 'org-2', 'breaking', 'article-2', 11);

      // Third org blocked
      expect(pacer.shouldGenerateArticle(1, 'org-3', 'breaking')).toBe(false);

      // Clear question
      pacer.clearQuestion(1);

      // Now allowed again
      expect(pacer.shouldGenerateArticle(1, 'org-3', 'breaking')).toBe(true);
    });
  });

  describe('Org Selection', () => {
    const orgs = [
      { id: 'cnn', name: 'CNN' },
      { id: 'fox', name: 'Fox News' },
      { id: 'nyt', name: 'New York Times' },
      { id: 'wsj', name: 'Wall Street Journal' },
      { id: 'bbc', name: 'BBC' },
    ];

    it('should return empty array if all orgs have published', () => {
      // Mark all orgs as published
      orgs.forEach(org => {
        pacer.recordArticle(1, org.id, 'breaking', `article-${org.id}`, 10);
      });

      const selected = pacer.selectOrgsForStage(orgs, 1, 'breaking');
      expect(selected).toEqual([]);
    });

    it('should only select from eligible orgs', () => {
      // Mark some orgs as published
      pacer.recordArticle(1, 'cnn', 'breaking', 'article-1', 10);
      pacer.recordArticle(1, 'fox', 'breaking', 'article-2', 11);

      const selected = pacer.selectOrgsForStage(orgs, 1, 'breaking');
      
      // Should not include CNN or Fox
      expect(selected.every(org => org.id !== 'cnn' && org.id !== 'fox')).toBe(true);
    });

    it('should select different orgs each time (randomness)', () => {
      const selections = new Set<string>();
      
      // Run selection multiple times with valid question IDs
      for (let i = 1; i <= 10; i++) {
        const freshPacer = new NewsArticlePacingEngine();
        const selected = freshPacer.selectOrgsForStage(orgs, i, 'breaking');
        selections.add(JSON.stringify(selected.map(o => o.id).sort()));
      }

      // Should have some variety (at least 3 different selections)
      expect(selections.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single org available', () => {
      const orgs = [{ id: 'only-org', name: 'Only News' }];
      
      const selected = pacer.selectOrgsForStage(orgs, 1, 'breaking');
      expect(selected.length).toBe(1);
      expect(selected[0]?.id).toBe('only-org');
    });

    it('should handle more orgs than limit for breaking', () => {
      const orgs = Array.from({ length: 20 }, (_, i) => ({
        id: `org-${i}`,
        name: `Org ${i}`
      }));

      const selected = pacer.selectOrgsForStage(orgs, 1, 'breaking');
      expect(selected.length).toBeLessThanOrEqual(2);
    });

    it('should handle question ID collision for different stages', () => {
      // Same question, different stages
      pacer.recordArticle(1, 'org-1', 'breaking', 'article-1', 10);
      pacer.recordArticle(1, 'org-1', 'commentary', 'article-2', 20);
      pacer.recordArticle(1, 'org-1', 'resolution', 'article-3', 30);

      const stats = pacer.getStageStats(1);
      expect(stats.breaking).toBe(1);
      expect(stats.commentary).toBe(1);
      expect(stats.resolution).toBe(1);
    });
  });
});

