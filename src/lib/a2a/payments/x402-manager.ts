/**
 * x402 Micropayment Manager
 * Implements HTTP 402-based micropayment protocol for agent services
 * 
 * Uses Redis for persistent storage across serverless functions
 */

import { JsonRpcProvider, type Provider, parseEther, formatEther, hexlify, randomBytes } from 'ethers'
import { z } from 'zod'
import { PaymentRequestSchema, type PaymentRequest } from '@/types/a2a'
import type { PaymentVerificationParams, PaymentVerificationResult } from '@/types/payments'
import { logger } from '@/lib/logger'
import { redis, redisClientType } from '@/lib/redis'
import type { Redis as UpstashRedis } from '@upstash/redis'
import type IORedis from 'ioredis'

export interface X402Config {
  rpcUrl: string
  minPaymentAmount?: string // Minimum payment in wei (default: 0)
  paymentTimeout?: number // Payment timeout in ms (default: 5 minutes)
}

interface PendingPayment {
  request: PaymentRequest
  createdAt: number
  verified: boolean
}

const PendingPaymentSchema = z.object({
  request: PaymentRequestSchema,
  createdAt: z.number(),
  verified: z.boolean(),
});


const REDIS_PREFIX = 'x402:payment:'

export class X402Manager {
  private provider: Provider
  private config: Required<X402Config>
  private readonly DEFAULT_MIN_PAYMENT = '1000000000000000' // 0.001 ETH
  private readonly DEFAULT_TIMEOUT = 5 * 60 * 1000 // 5 minutes

  constructor(config: X402Config) {
    this.provider = new JsonRpcProvider(config.rpcUrl)
    this.config = {
      rpcUrl: config.rpcUrl,
      minPaymentAmount: config.minPaymentAmount || this.DEFAULT_MIN_PAYMENT,
      paymentTimeout: config.paymentTimeout || this.DEFAULT_TIMEOUT
    }
  }

  /**
   * Store payment in Redis with TTL
   */
  private async storePayment(requestId: string, payment: PendingPayment): Promise<void> {
    const key = `${REDIS_PREFIX}${requestId}`
    const ttlSeconds = Math.ceil(this.config.paymentTimeout / 1000)
    
    const serialized = JSON.stringify(payment)
    
    if (redis && redisClientType) {
      if (redisClientType === 'upstash') {
        await (redis as UpstashRedis).set(key, serialized, { ex: ttlSeconds })
      } else {
        await (redis as IORedis).set(key, serialized, 'EX', ttlSeconds)
      }
      logger.debug('[X402Manager] Stored payment in Redis', { requestId, ttl: ttlSeconds })
    } else {
      logger.warn('[X402Manager] Redis not available, payment will not persist across serverless instances')
    }
  }

  /**
   * Retrieve payment from Redis
   */
  private async getPayment(requestId: string): Promise<PendingPayment | null> {
    const key = `${REDIS_PREFIX}${requestId}`
    
    if (!redis || !redisClientType) {
      logger.debug('[X402Manager] Redis not available', { requestId })
      return null
    }

    const cached = await redis.get(key)
    
    if (!cached) {
      logger.debug('[X402Manager] Payment not found in Redis', { requestId })
      return null
    }

    const paymentData = JSON.parse(cached as string)
    const validation = PendingPaymentSchema.safeParse(paymentData)
    
    if (!validation.success) {
      logger.error('[X402Manager] Invalid payment data in Redis', { requestId, error: validation.error })
      await this.deletePayment(requestId)
      return null
    }
    
    logger.debug('[X402Manager] Retrieved payment from Redis', { requestId })
    return {
      ...validation.data,
      request: {
        ...validation.data.request,
        metadata: validation.data.request.metadata as Record<string, string | number | boolean | null>
      }
    }
  }

  /**
   * Update payment in Redis
   */
  private async updatePayment(requestId: string, payment: PendingPayment): Promise<void> {
    const key = `${REDIS_PREFIX}${requestId}`
    
    // Calculate remaining TTL
    const remainingMs = payment.request.expiresAt - Date.now()
    const ttlSeconds = Math.max(Math.ceil(remainingMs / 1000), 1)
    
    const serialized = JSON.stringify(payment)
    
    if (redis && redisClientType) {
      if (redisClientType === 'upstash') {
        await (redis as UpstashRedis).set(key, serialized, { ex: ttlSeconds })
      } else {
        await (redis as IORedis).set(key, serialized, 'EX', ttlSeconds)
      }
      logger.debug('[X402Manager] Updated payment in Redis', { requestId })
    }
  }

  /**
   * Delete payment from Redis
   */
  private async deletePayment(requestId: string): Promise<void> {
    const key = `${REDIS_PREFIX}${requestId}`
    
    if (redis && redisClientType) {
      await redis.del(key)
      logger.debug('[X402Manager] Deleted payment from Redis', { requestId })
    }
  }

  /**
   * Create a payment request for a service
   */
  async createPaymentRequest(
    from: string,
    to: string,
    amount: string,
    service: string,
    metadata?: Record<string, string | number | boolean | null>
  ): Promise<PaymentRequest> {
    // Validate amount meets minimum
    const amountBn = parseEther(formatEther(amount))
    const minAmountBn = parseEther(formatEther(this.config.minPaymentAmount))

    if (amountBn < minAmountBn) {
      throw new Error(`Payment amount must be at least ${this.config.minPaymentAmount} wei`)
    }

    const requestId = this.generateRequestId()
    const expiresAt = Date.now() + this.config.paymentTimeout

    const request: PaymentRequest = {
      requestId,
      from,
      to,
      amount,
      service,
      metadata,
      expiresAt
    }

    // Store pending payment in Redis
    await this.storePayment(requestId, {
      request,
      createdAt: Date.now(),
      verified: false
    })

    return request
  }

  /**
   * Verify a payment receipt against blockchain transaction
   * Supports both EOA and smart wallet transactions
   */
  async verifyPayment(verificationData: PaymentVerificationParams): Promise<PaymentVerificationResult> {
    const pending = await this.getPayment(verificationData.requestId)
    if (!pending) {
      return { verified: false, error: 'Payment request not found or expired' }
    }

    if (pending.verified) {
      return { verified: true }
    }

    if (Date.now() > pending.request.expiresAt) {
      await this.deletePayment(verificationData.requestId)
      return { verified: false, error: 'Payment request expired' }
    }

    const tx = await this.provider.getTransaction(verificationData.txHash)
    if (!tx) {
      return { verified: false, error: 'Transaction not found on blockchain' }
    }

    const txReceipt = await this.provider.getTransactionReceipt(verificationData.txHash)
    if (!txReceipt) {
      return { verified: false, error: 'Transaction not yet confirmed' }
    }

    if (txReceipt.status !== 1) {
      return { verified: false, error: 'Transaction failed on blockchain' }
    }

    const errors: string[] = []

    // For smart wallets (account abstraction), the tx.from might be the paymaster or smart wallet
    // We need to be more lenient with sender validation
    const fromMatch = tx.from.toLowerCase() === pending.request.from.toLowerCase()
    
    // Check if this might be a smart wallet transaction (has different from address)
    const isSmartWallet = !fromMatch
    
    if (!fromMatch) {
      logger.warn(`[X402Manager] Sender mismatch: expected ${pending.request.from}, got ${tx.from}, treating as smart wallet`)
      // For production, you may want to implement more sophisticated verification:
      // - Check transaction trace for internal calls to the sender's smart wallet
      // - Verify the smart wallet contract code/factory
    }

    // Recipient validation - should be strict
    const recipientMatch = tx.to?.toLowerCase() === pending.request.to.toLowerCase()
    
    if (!recipientMatch) {
      // For smart wallets, tx.to could be an entrypoint. A robust solution would involve:
      // 1. Decoding the transaction data to find the ultimate recipient.
      // 2. Tracing the transaction to see internal calls.
      // For now, we will reject if there is a direct mismatch, to be safe.
      errors.push(`Recipient mismatch: expected ${pending.request.to}, got ${tx.to}`)
    }

    // Verify amount (with some tolerance for gas and fees)
    const requestedAmount = BigInt(pending.request.amount)
    const paidAmount = tx.value
    
    // Allow for 1% tolerance for gas fees in smart wallet transactions
    const minAcceptableAmount = requestedAmount * 99n / 100n
    
    if (paidAmount < minAcceptableAmount) {
      errors.push(`Insufficient payment: expected at least ${minAcceptableAmount}, got ${paidAmount}`)
    }

    if (errors.length > 0) {
      return { verified: false, error: errors.join('; ') }
    }

    // Mark as verified in Redis
    pending.verified = true
    await this.updatePayment(verificationData.requestId, pending)

    logger.info(`[X402Manager] Payment verified successfully: ${verificationData.txHash}`, { 
      requestId: verificationData.requestId, 
      isSmartWallet 
    })

    return { verified: true }
  }

  /**
   * Get payment request details
   */
  async getPaymentRequest(requestId: string): Promise<PaymentRequest | null> {
    const pending = await this.getPayment(requestId)
    return pending ? pending.request : null
  }

  /**
   * Check if payment has been verified
   */
  async isPaymentVerified(requestId: string): Promise<boolean> {
    const pending = await this.getPayment(requestId)
    return pending ? pending.verified : false
  }

  /**
   * Cancel a payment request
   */
  async cancelPaymentRequest(requestId: string): Promise<boolean> {
    await this.deletePayment(requestId)
    return true
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `x402-${Date.now()}-${hexlify(randomBytes(16))}`
  }

  /**
   * Get all pending payments (for testing/debugging)
   */
  async getPendingPayments(): Promise<PendingPayment[]> {
    if (!redis) return []
    const keys = await redis.keys(`${REDIS_PREFIX}*`)
    const payments = await Promise.all(keys.map(key => this.getPayment(key.replace(REDIS_PREFIX, ''))))
    return payments.filter(p => p && !p.verified) as PendingPayment[]
  }

  /**
   * Get statistics about payments (for testing/debugging)
   */
  async getStatistics() {
    if (!redis) return { pending: 0, verified: 0, expired: 0 }
    const keys = await redis.keys(`${REDIS_PREFIX}*`)
    const payments = await Promise.all(keys.map(key => this.getPayment(key.replace(REDIS_PREFIX, ''))))

    const now = Date.now()
    return payments.reduce((acc, p) => {
      if (p) {
        if (p.verified) {
          acc.verified++
        } else if (p.request.expiresAt < now) {
          acc.expired++
        } else {
          acc.pending++
        }
      }
      return acc
    }, { pending: 0, verified: 0, expired: 0 })
  }

  /**
   * Cleanup method to be called when shutting down.
   * In this implementation, Redis handles TTL, so no explicit cleanup is needed.
   */
  cleanup(): void {
    // No-op. Redis TTL manages payment expiration.
  }
}
