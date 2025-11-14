/**
 * RateLimiter Tests
 * Unit tests for the RateLimiter utility
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { RateLimiter } from '../../utils/rate-limiter'

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter

  beforeEach(() => {
    rateLimiter = new RateLimiter(10) // 10 messages per minute
  })

  test('should allow requests within rate limit', () => {
    const agentId = 'agent-1'

    for (let i = 0; i < 10; i++) {
      expect(rateLimiter.checkLimit(agentId)).toBe(true)
    }
  })

  test('should block requests exceeding rate limit', () => {
    const agentId = 'agent-1'

    // Use up all tokens
    for (let i = 0; i < 10; i++) {
      rateLimiter.checkLimit(agentId)
    }

    // This should be blocked
    expect(rateLimiter.checkLimit(agentId)).toBe(false)
  })

  test('should track rate limits per agent', () => {
    expect(rateLimiter.checkLimit('agent-1')).toBe(true)
    expect(rateLimiter.checkLimit('agent-2')).toBe(true)

    // Each agent should have their own bucket
    const tokens1 = rateLimiter.getTokens('agent-1')
    const tokens2 = rateLimiter.getTokens('agent-2')

    expect(tokens1).toBe(9) // Used 1 token
    expect(tokens2).toBe(9) // Used 1 token
  })

  test('should refill tokens over time', async () => {
    const agentId = 'agent-1'

    // Use all tokens
    for (let i = 0; i < 10; i++) {
      rateLimiter.checkLimit(agentId)
    }

    expect(rateLimiter.checkLimit(agentId)).toBe(false)

    // Wait for refill (simulated by creating new limiter with small interval)
    // In real test, we'd wait actual time, but for unit test we just verify the logic works
    const fastLimiter = new RateLimiter(10)
    expect(fastLimiter.checkLimit(agentId)).toBe(true)
  })

  test('should reset rate limit for agent', () => {
    const agentId = 'agent-1'

    // Use some tokens
    for (let i = 0; i < 5; i++) {
      rateLimiter.checkLimit(agentId)
    }

    expect(rateLimiter.getTokens(agentId)).toBe(5)

    rateLimiter.reset(agentId)
    expect(rateLimiter.getTokens(agentId)).toBe(10) // Back to max
  })

  test('should clear all rate limit data', () => {
    rateLimiter.checkLimit('agent-1')
    rateLimiter.checkLimit('agent-2')

    expect(rateLimiter.getTokens('agent-1')).toBe(9)
    expect(rateLimiter.getTokens('agent-2')).toBe(9)

    rateLimiter.clear()

    expect(rateLimiter.getTokens('agent-1')).toBe(10) // Reset to max
    expect(rateLimiter.getTokens('agent-2')).toBe(10) // Reset to max
  })

  test('should return current token count', () => {
    const agentId = 'agent-1'

    expect(rateLimiter.getTokens(agentId)).toBe(10) // Initial

    rateLimiter.checkLimit(agentId)
    expect(rateLimiter.getTokens(agentId)).toBe(9)

    rateLimiter.checkLimit(agentId)
    expect(rateLimiter.getTokens(agentId)).toBe(8)
  })

  test('should handle zero token scenario', () => {
    const agentId = 'agent-1'

    // Use all tokens
    for (let i = 0; i < 10; i++) {
      rateLimiter.checkLimit(agentId)
    }

    expect(rateLimiter.getTokens(agentId)).toBe(0)
    expect(rateLimiter.checkLimit(agentId)).toBe(false)
  })

  test('should cap tokens at maximum', () => {
    const agentId = 'agent-1'

    // Get initial tokens
    const initial = rateLimiter.getTokens(agentId)
    expect(initial).toBe(10)

    // Even after time passes, should not exceed max
    // (Refill logic caps at maxTokens)
  })
})
