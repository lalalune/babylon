/**
 * X402Manager Tests
 * Unit tests for the X402 micropayment manager
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { X402Manager } from '../../payments/x402-manager'

describe('X402Manager', () => {
  let x402Manager: X402Manager
  const testConfig = {
    rpcUrl: 'https://sepolia.base.org',
    minPaymentAmount: '1000000000000000', // 0.001 ETH
    paymentTimeout: 5 * 60 * 1000 // 5 minutes
  }

  beforeEach(() => {
    x402Manager = new X402Manager(testConfig)
  })

  describe('Payment Request Creation', () => {
    test('should create a valid payment request', () => {
      const request = x402Manager.createPaymentRequest(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        '1000000000000000', // 0.001 ETH
        'market-analysis',
        { marketId: 'market-123' }
      )

      expect(request.requestId).toContain('x402-')
      expect(request.from).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb')
      expect(request.to).toBe('0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199')
      expect(request.amount).toBe('1000000000000000')
      expect(request.service).toBe('market-analysis')
      expect(request.metadata?.marketId).toBe('market-123')
      expect(request.expiresAt).toBeGreaterThan(Date.now())
    })

    test('should reject payment below minimum amount', () => {
      expect(() => {
        x402Manager.createPaymentRequest(
          '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
          '100', // Too small
          'test-service'
        )
      }).toThrow('Payment amount must be at least')
    })

    test('should set expiration time correctly', () => {
      const before = Date.now()
      const request = x402Manager.createPaymentRequest(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        '1000000000000000',
        'test-service'
      )
      const after = Date.now()

      expect(request.expiresAt).toBeGreaterThanOrEqual(before + testConfig.paymentTimeout)
      expect(request.expiresAt).toBeLessThanOrEqual(after + testConfig.paymentTimeout + 100)
    })

    test('should generate unique request IDs', () => {
      const request1 = x402Manager.createPaymentRequest(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        '1000000000000000',
        'service-1'
      )

      const request2 = x402Manager.createPaymentRequest(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        '1000000000000000',
        'service-2'
      )

      expect(request1.requestId).not.toBe(request2.requestId)
    })
  })

  describe('Payment Request Management', () => {
    test('should retrieve payment request by ID', () => {
      const request = x402Manager.createPaymentRequest(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        '1000000000000000',
        'test-service'
      )

      const retrieved = x402Manager.getPaymentRequest(request.requestId)
      expect(retrieved).toEqual(request)
    })

    test('should return null for non-existent request ID', () => {
      const retrieved = x402Manager.getPaymentRequest('non-existent-id')
      expect(retrieved).toBeNull()
    })

    test('should cancel payment request', () => {
      const request = x402Manager.createPaymentRequest(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        '1000000000000000',
        'test-service'
      )

      const cancelled = x402Manager.cancelPaymentRequest(request.requestId)
      expect(cancelled).toBe(true)

      const retrieved = x402Manager.getPaymentRequest(request.requestId)
      expect(retrieved).toBeNull()
    })

    test('should return false when cancelling non-existent request', () => {
      const cancelled = x402Manager.cancelPaymentRequest('non-existent-id')
      expect(cancelled).toBe(false)
    })
  })

  describe('Payment Verification', () => {
    test('should reject verification for non-existent request', async () => {
      const result = await x402Manager.verifyPayment({
        requestId: 'non-existent',
        txHash: '0x123',
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        to: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        amount: '1000000000000000',
        timestamp: Date.now(),
        confirmed: false
      })

      expect(result.verified).toBe(false)
      expect(result.error).toContain('not found or expired')
    })

    test('should check if payment is verified', () => {
      const request = x402Manager.createPaymentRequest(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        '1000000000000000',
        'test-service'
      )

      expect(x402Manager.isPaymentVerified(request.requestId)).toBe(false)
    })
  })

  describe('Pending Payments', () => {
    test('should get pending payments for agent', () => {
      const agentAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'

      const request1 = x402Manager.createPaymentRequest(
        agentAddress,
        '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        '1000000000000000',
        'service-1'
      )

      const request2 = x402Manager.createPaymentRequest(
        agentAddress,
        '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        '1000000000000000',
        'service-2'
      )

      // Request from another agent
      x402Manager.createPaymentRequest(
        '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        agentAddress,
        '1000000000000000',
        'service-3'
      )

      const pending = x402Manager.getPendingPayments(agentAddress)
      expect(pending.length).toBe(3) // 2 as sender, 1 as receiver
      expect(pending.some(p => p.requestId === request1.requestId)).toBe(true)
      expect(pending.some(p => p.requestId === request2.requestId)).toBe(true)
    })

    test('should return empty array for agent with no pending payments', () => {
      const pending = x402Manager.getPendingPayments('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb')
      expect(pending.length).toBe(0)
    })
  })

  describe('Statistics', () => {
    test('should return accurate statistics', () => {
      x402Manager.createPaymentRequest(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        '1000000000000000',
        'service-1'
      )

      x402Manager.createPaymentRequest(
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        '1000000000000000',
        'service-2'
      )

      const stats = x402Manager.getStatistics()
      expect(stats.totalPending).toBe(2)
      expect(stats.totalVerified).toBe(0)
      expect(stats.totalExpired).toBe(0)
    })

    test('should return zero statistics for empty manager', () => {
      const stats = x402Manager.getStatistics()
      expect(stats.totalPending).toBe(0)
      expect(stats.totalVerified).toBe(0)
      expect(stats.totalExpired).toBe(0)
    })
  })
})
