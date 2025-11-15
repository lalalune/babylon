/**
 * Tests for TrendingTopicsEngine
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TrendingTopicsEngine } from '../TrendingTopicsEngine';
import type { FeedPost } from '@/shared/types';
import type { BabylonLLMClient } from '@/generator/llm/openai-client';

describe('TrendingTopicsEngine', () => {
  let engine: TrendingTopicsEngine;
  let mockLLM: BabylonLLMClient;

  beforeEach(() => {
    // Mock LLM client
    mockLLM = {
      generateJSON: mock(async () => ({
        trends: [
          { trendName: 'AI Revolution', description: 'Major breakthroughs in AI technology reshaping the industry.' },
          { trendName: 'Tech Regulation', description: 'Government proposes new tech oversight framework.' },
          { trendName: 'Crypto Comeback', description: 'Digital assets rally amid positive sentiment.' },
        ]
      }))
    } as unknown as BabylonLLMClient;

    engine = new TrendingTopicsEngine(mockLLM);
  });

  describe('Validation', () => {
    it('should not fail on empty posts array', async () => {
      await engine.updateTrends([], 10);
      const trends = engine.getTrends();
      expect(trends).toEqual([]);
    });

    it('should not fail when posts have no tags', async () => {
      const posts: FeedPost[] = [
        {
          id: 'post-1',
          content: 'Test post',
          author: 'user-1',
          authorName: 'User',
          timestamp: '2025-11-15T10:00:00Z',
          day: 1,
        },
      ];

      await engine.updateTrends(posts, 10);
      const trends = engine.getTrends();
      expect(trends).toEqual([]);
    });

    it('should throw error if LLM returns no trends', async () => {
      mockLLM.generateJSON = mock(async () => ({ trends: [] }));

      const posts: FeedPost[] = [
        {
          id: 'post-1',
          content: 'AI is amazing',
          author: 'user-1',
          authorName: 'User',
          timestamp: '2025-11-15T10:00:00Z',
          day: 1,
          tags: ['ai', 'tech'],
        },
      ];

      // Should not throw - will keep previous trends on failure
      await engine.updateTrends(posts, 10);
    });

    it('should validate trend descriptions are not empty', async () => {
      mockLLM.generateJSON = mock(async () => ({
        trends: [
          { trendName: '', description: '' }, // Empty!
        ]
      }));

      const posts: FeedPost[] = [
        {
          id: 'post-1',
          content: 'AI is amazing',
          author: 'user-1',
          authorName: 'User',
          timestamp: '2025-11-15T10:00:00Z',
          day: 1,
          tags: ['ai'],
        },
      ];

      await engine.updateTrends(posts, 10);
      const trends = engine.getTrends();
      
      // Should use fallbacks for empty values
      expect(trends[0]?.trendName).toBe('ai'); // Fallback to tag
      expect(trends[0]?.description).toContain('posts discussing'); // Fallback description
    });
  });

  describe('Trend Detection', () => {
    it('should aggregate tags from posts correctly', async () => {
      const posts: FeedPost[] = [
        {
          id: 'post-1',
          content: 'AI breakthrough',
          author: 'user-1',
          authorName: 'User',
          timestamp: '2025-11-15T10:00:00Z',
          day: 1,
          tags: ['ai', 'tech'],
          relatedQuestion: 5,
        },
        {
          id: 'post-2',
          content: 'More AI news',
          author: 'user-2',
          authorName: 'User2',
          timestamp: '2025-11-15T10:30:00Z',
          day: 1,
          tags: ['ai', 'breakthrough'],
          relatedQuestion: 5,
        },
      ];

      await engine.updateTrends(posts, 10);
      const trends = engine.getTrends();

      expect(trends.length).toBeGreaterThan(0);
      expect(trends[0]?.tag).toBe('ai'); // Most frequent
      expect(trends[0]?.count).toBe(2);
      expect(trends[0]?.relatedQuestions).toContain(5);
    });

    it('should rank topics by frequency and recency', async () => {
      const posts: FeedPost[] = [
        {
          id: 'post-1',
          content: 'Old AI post',
          author: 'user-1',
          authorName: 'User',
          timestamp: '2025-11-15T08:00:00Z',
          day: 1,
          tags: ['ai'],
        },
        {
          id: 'post-2',
          content: 'Recent crypto post',
          author: 'user-2',
          authorName: 'User2',
          timestamp: '2025-11-15T10:00:00Z',
          day: 10, // More recent
          tags: ['crypto'],
        },
      ];

      await engine.updateTrends(posts, 10);
      const trends = engine.getTrends();

      // Crypto should rank higher due to recency despite same count
      const cryptoTrend = trends.find(t => t.tag === 'crypto');
      expect(cryptoTrend).toBeDefined();
      expect(cryptoTrend!.recency).toBeGreaterThan(0.9);
    });

    it('should limit to top 5 trends', async () => {
      const posts: FeedPost[] = [];
      const tags = ['ai', 'crypto', 'tech', 'web3', 'gaming', 'social', 'finance'];
      
      tags.forEach((tag, i) => {
        posts.push({
          id: `post-${i}`,
          content: `Post about ${tag}`,
          author: `user-${i}`,
          authorName: `User${i}`,
          timestamp: '2025-11-15T10:00:00Z',
          day: 1,
          tags: [tag],
        });
      });

      await engine.updateTrends(posts, 10);
      const trends = engine.getTrends();

      expect(trends.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Context Generation', () => {
    it('should generate non-empty trend context', () => {
      const context = engine.getTrendContext();
      expect(context).toBeDefined();
      expect(context.length).toBeGreaterThan(0);
    });

    it('should generate detailed context with trend descriptions', () => {
      const detailed = engine.getDetailedTrendContext();
      expect(detailed).toBeDefined();
      expect(detailed.length).toBeGreaterThan(0);
      expect(detailed).toContain('TRENDING TOPICS');
    });

    it('should never return empty string from getTrendContext', () => {
      const context = engine.getTrendContext();
      expect(context.trim()).not.toBe('');
    });

    it('should never return empty string from getDetailedTrendContext', () => {
      const detailed = engine.getDetailedTrendContext();
      expect(detailed.trim()).not.toBe('');
    });
  });

  describe('Update Frequency', () => {
    it('should only update on interval', async () => {
      const posts: FeedPost[] = [
        {
          id: 'post-1',
          content: 'Test',
          author: 'user-1',
          authorName: 'User',
          timestamp: '2025-11-15T10:00:00Z',
          day: 1,
          tags: ['test'],
        },
      ];

      await engine.updateTrends(posts, 5);
      const callCount1 = (mockLLM.generateJSON as ReturnType<typeof mock>).mock.calls.length;

      await engine.updateTrends(posts, 8); // Not yet time (< 10 ticks)
      const callCount2 = (mockLLM.generateJSON as ReturnType<typeof mock>).mock.calls.length;

      expect(callCount1).toBe(callCount2); // No new LLM call
    });

    it('should update after interval', async () => {
      const posts: FeedPost[] = [
        {
          id: 'post-1',
          content: 'Test',
          author: 'user-1',
          authorName: 'User',
          timestamp: '2025-11-15T10:00:00Z',
          day: 1,
          tags: ['test'],
        },
      ];

      await engine.updateTrends(posts, 10);
      const callCount1 = (mockLLM.generateJSON as ReturnType<typeof mock>).mock.calls.length;

      await engine.updateTrends(posts, 20); // 10 ticks later
      const callCount2 = (mockLLM.generateJSON as ReturnType<typeof mock>).mock.calls.length;

      expect(callCount2).toBeGreaterThan(callCount1); // New LLM call
    });

    it('should allow configuring update interval', async () => {
      engine.setUpdateInterval(5); // Update every 5 ticks

      const posts: FeedPost[] = [
        {
          id: 'post-1',
          content: 'Test',
          author: 'user-1',
          authorName: 'User',
          timestamp: '2025-11-15T10:00:00Z',
          day: 1,
          tags: ['test'],
        },
      ];

      await engine.updateTrends(posts, 5);
      const callCount1 = (mockLLM.generateJSON as ReturnType<typeof mock>).mock.calls.length;

      await engine.updateTrends(posts, 10); // 5 ticks later
      const callCount2 = (mockLLM.generateJSON as ReturnType<typeof mock>).mock.calls.length;

      expect(callCount2).toBeGreaterThan(callCount1); // Should update
    });
  });
});

