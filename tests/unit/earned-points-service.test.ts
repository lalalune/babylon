/**
 * Unit Tests: EarnedPointsService
 * 
 * Tests P&L to points conversion and earned points logic
 */

import { describe, it, expect } from 'bun:test'
import { EarnedPointsService } from '../../src/lib/services/earned-points-service'

describe('EarnedPointsService', () => {
  describe('pnlToPoints', () => {
    it('should convert positive P&L to points correctly', () => {
      expect(EarnedPointsService.pnlToPoints(100)).toBe(10) // $100 = 10 pts
      expect(EarnedPointsService.pnlToPoints(500)).toBe(50) // $500 = 50 pts
      expect(EarnedPointsService.pnlToPoints(1000)).toBe(100) // $1000 = 100 pts
      expect(EarnedPointsService.pnlToPoints(10)).toBe(1) // $10 = 1 pt
      expect(EarnedPointsService.pnlToPoints(5)).toBe(0) // $5 = 0 pts (rounds down)
    })

    it('should convert negative P&L to points correctly', () => {
      expect(EarnedPointsService.pnlToPoints(-100)).toBe(-10) // -$100 = -10 pts
      expect(EarnedPointsService.pnlToPoints(-500)).toBe(-50) // -$500 = -50 pts
      expect(EarnedPointsService.pnlToPoints(-50)).toBe(-5) // -$50 = -5 pts
    })

    it('should cap negative points at -100', () => {
      expect(EarnedPointsService.pnlToPoints(-1000)).toBe(-100) // Capped
      expect(EarnedPointsService.pnlToPoints(-2000)).toBe(-100) // Capped
      expect(EarnedPointsService.pnlToPoints(-10000)).toBe(-100) // Capped
    })

    it('should handle zero P&L', () => {
      expect(EarnedPointsService.pnlToPoints(0)).toBe(0)
    })

    it('should handle decimal P&L by rounding down', () => {
      expect(EarnedPointsService.pnlToPoints(15.99)).toBe(1) // Rounds down
      expect(EarnedPointsService.pnlToPoints(19.99)).toBe(1)
      expect(EarnedPointsService.pnlToPoints(20)).toBe(2)
    })
  })

  describe('Formula Validation', () => {
    it('formula should be: points = floor(pnl / 10), min(-100)', () => {
      const testCases = [
        { pnl: 100, expected: 10 },
        { pnl: 95, expected: 9 },
        { pnl: -50, expected: -5 },
        { pnl: -1000, expected: -100 },
        { pnl: -2000, expected: -100 },
        { pnl: 0, expected: 0 },
      ]

      testCases.forEach(({ pnl, expected }) => {
        const result = EarnedPointsService.pnlToPoints(pnl)
        expect(result).toBe(expected)
      })
    })
  })
})

describe('Points Calculation Edge Cases', () => {
  it('should handle very large positive P&L', () => {
    const result = EarnedPointsService.pnlToPoints(100000)
    expect(result).toBe(10000) // No upper cap on positive
  })

  it('should handle very small positive P&L', () => {
    const result = EarnedPointsService.pnlToPoints(0.01)
    expect(result).toBe(0) // Rounds down
  })

  it('should be consistent for same input', () => {
    const pnl = 123.45
    const result1 = EarnedPointsService.pnlToPoints(pnl)
    const result2 = EarnedPointsService.pnlToPoints(pnl)
    expect(result1).toBe(result2)
  })
})

