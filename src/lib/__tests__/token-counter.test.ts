/**
 * Tests for token counter utility
 */

import { describe, test, expect } from 'bun:test';
import {
  countTokensSync,
  truncateToTokenLimitSync,
  getModelTokenLimit,
  getSafeContextLimit,
  budgetTokens,
  MODEL_TOKEN_LIMITS,
} from '../token-counter';

describe('TokenCounter', () => {
  describe('countTokensSync', () => {
    test('should count tokens for short text', () => {
      const text = 'Hello world';
      const tokens = countTokensSync(text);
      
      // Approximation: 11 chars / 4 = ~3 tokens
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });
    
    test('should count tokens for longer text', () => {
      const text = 'This is a much longer piece of text that contains multiple sentences. It should result in more tokens being counted. The approximation is 1 token per 4 characters.';
      const tokens = countTokensSync(text);
      
      // 164 chars / 4 = 41 tokens
      expect(tokens).toBeGreaterThanOrEqual(40);
      expect(tokens).toBeLessThanOrEqual(50);
    });
    
    test('should handle empty string', () => {
      const tokens = countTokensSync('');
      expect(tokens).toBe(0);
    });
  });
  
  describe('truncateToTokenLimitSync', () => {
    test('should not truncate if within limit', () => {
      const text = 'Short text';
      const limit = 100;
      
      const result = truncateToTokenLimitSync(text, limit);
      
      expect(result.text).toBe(text);
      expect(result.tokens).toBeLessThanOrEqual(limit);
    });
    
    test('should truncate long text to fit limit', () => {
      const text = 'A'.repeat(1000); // 1000 chars = ~250 tokens
      const limit = 50;
      
      const result = truncateToTokenLimitSync(text, limit);
      
      expect(result.tokens).toBeLessThanOrEqual(limit);
      expect(result.text.length).toBeLessThan(text.length);
      expect(result.text).toContain('...');
    });
    
    test('should truncate without ellipsis when specified', () => {
      const text = 'A'.repeat(1000);
      const limit = 50;
      
      const result = truncateToTokenLimitSync(text, limit, { ellipsis: false });
      
      expect(result.tokens).toBeLessThanOrEqual(limit);
      expect(result.text).not.toContain('...');
    });
    
    test('should preserve end of text when specified', () => {
      const text = 'Start of text ' + 'X'.repeat(500) + ' End of text';
      const limit = 50;
      
      const result = truncateToTokenLimitSync(text, limit, { preserveEnd: true });
      
      expect(result.tokens).toBeLessThanOrEqual(limit);
      expect(result.text).toContain('End of text');
      expect(result.text).toContain('...');
    });
  });
  
  describe('getModelTokenLimit', () => {
    test('should return correct limit for known models', () => {
      expect(getModelTokenLimit('gpt-4o')).toBe(128000);
      expect(getModelTokenLimit('llama-3.3-70b-versatile')).toBe(128000);
      expect(getModelTokenLimit('mixtral-8x7b-32768')).toBe(32768);
      expect(getModelTokenLimit('claude-3-opus')).toBe(200000);
    });
    
    test('should return default limit for unknown models', () => {
      expect(getModelTokenLimit('unknown-model')).toBe(8192);
    });
  });
  
  describe('getSafeContextLimit', () => {
    test('should calculate safe limit with defaults', () => {
      const model = 'llama-3.3-70b-versatile'; // 128k total
      const safeLimit = getSafeContextLimit(model);
      
      // 128k - 8k (output) = 120k, * 0.9 = 108k
      expect(safeLimit).toBe(108000);
    });
    
    test('should calculate safe limit with custom output tokens', () => {
      const model = 'llama-3.3-70b-versatile'; // 128k total
      const safeLimit = getSafeContextLimit(model, 16000);
      
      // 128k - 16k (output) = 112k, * 0.9 = 100.8k
      expect(safeLimit).toBe(100800);
    });
    
    test('should calculate safe limit with custom safety margin', () => {
      const model = 'llama-3.3-70b-versatile'; // 128k total
      const safeLimit = getSafeContextLimit(model, 8000, 0.2);
      
      // 128k - 8k (output) = 120k, * 0.8 = 96k
      expect(safeLimit).toBe(96000);
    });
    
    test('should enforce minimum limit', () => {
      const model = 'gpt-4'; // 8k total
      const safeLimit = getSafeContextLimit(model, 7500);
      
      // Would calculate to very small number, should return 1000
      expect(safeLimit).toBeGreaterThanOrEqual(1000);
    });
  });
  
  describe('budgetTokens', () => {
    test('should distribute tokens by priority', () => {
      const sections = [
        { name: 'high', priority: 3, minTokens: 100 },
        { name: 'medium', priority: 2, minTokens: 50 },
        { name: 'low', priority: 1, minTokens: 25 },
      ];
      
      const budget = budgetTokens(1000, sections);
      
      // Each section should get at least their minimum
      expect(budget.high ?? 0).toBeGreaterThanOrEqual(100);
      expect(budget.medium ?? 0).toBeGreaterThanOrEqual(50);
      expect(budget.low ?? 0).toBeGreaterThanOrEqual(25);
      
      // High priority should get more
      expect(budget.high ?? 0).toBeGreaterThan(budget.medium ?? 0);
      expect(budget.medium ?? 0).toBeGreaterThan(budget.low ?? 0);
      
      // Total should not exceed budget
      const total = (budget.high ?? 0) + (budget.medium ?? 0) + (budget.low ?? 0);
      expect(total).toBeLessThanOrEqual(1000);
    });
    
    test('should scale down when minimums exceed budget', () => {
      const sections = [
        { name: 'a', priority: 1, minTokens: 500 },
        { name: 'b', priority: 1, minTokens: 500 },
        { name: 'c', priority: 1, minTokens: 500 },
      ];
      
      const budget = budgetTokens(1000, sections);
      
      // Total should not exceed budget
      const total = (budget.a ?? 0) + (budget.b ?? 0) + (budget.c ?? 0);
      expect(total).toBeLessThanOrEqual(1000);
      
      // Should scale proportionally
      expect(budget.a ?? 0).toBeCloseTo(333, 0);
      expect(budget.b ?? 0).toBeCloseTo(333, 0);
      expect(budget.c ?? 0).toBeCloseTo(333, 0);
    });
    
    test('should handle sections without minimums', () => {
      const sections = [
        { name: 'required', priority: 2, minTokens: 200 },
        { name: 'optional', priority: 1 },
      ];
      
      const budget = budgetTokens(1000, sections);
      
      expect(budget.required ?? 0).toBeGreaterThanOrEqual(200);
      expect(budget.optional ?? 0).toBeGreaterThan(0);
    });
  });
  
  describe('MODEL_TOKEN_LIMITS', () => {
    test('should include common OpenAI models', () => {
      expect(MODEL_TOKEN_LIMITS['gpt-4o']).toBeDefined();
      expect(MODEL_TOKEN_LIMITS['gpt-4o-mini']).toBeDefined();
      expect(MODEL_TOKEN_LIMITS['gpt-4-turbo']).toBeDefined();
      expect(MODEL_TOKEN_LIMITS['gpt-3.5-turbo']).toBeDefined();
    });
    
    test('should include common Groq models', () => {
      expect(MODEL_TOKEN_LIMITS['llama-3.3-70b-versatile']).toBeDefined();
      expect(MODEL_TOKEN_LIMITS['llama-3.1-70b-versatile']).toBeDefined();
      expect(MODEL_TOKEN_LIMITS['llama-3.1-8b-instant']).toBeDefined();
      expect(MODEL_TOKEN_LIMITS['mixtral-8x7b-32768']).toBeDefined();
    });
    
    test('should include common Anthropic models', () => {
      expect(MODEL_TOKEN_LIMITS['claude-3-opus']).toBeDefined();
      expect(MODEL_TOKEN_LIMITS['claude-3-sonnet']).toBeDefined();
      expect(MODEL_TOKEN_LIMITS['claude-3-haiku']).toBeDefined();
    });
  });
});

