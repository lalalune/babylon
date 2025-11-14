/**
 * x402 Micropayment Manager
 * Implements HTTP 402-based micropayment protocol for agent services
 */

import { JsonRpcProvider, type Provider, parseEther, formatEther, hexlify, randomBytes } from 'ethers'
import type { PaymentRequest } from '../types'
import type { PaymentVerificationParams, PaymentVerificationResult } from '@/types/payments'
import { logger } from '../utils/logger'

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

export class X402Manager {
  private provider: Provider
  private pendingPayments: Map<string, PendingPayment> = new Map()
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

    // Periodically clean up expired payment requests
    setInterval(() => this.cleanupExpiredPayments(), 60000) // Every minute
  }

  /**
   * Create a payment request for a service
   */
  createPaymentRequest(
    from: string,
    to: string,
    amount: string,
    service: string,
    metadata?: Record<string, string | number | boolean | null>
  ): PaymentRequest {
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

    // Store pending payment
    this.pendingPayments.set(requestId, {
      request,
      createdAt: Date.now(),
      verified: false
    })

    return request
  }

  /**
   * Verify a payment receipt against blockchain transaction
   */
  async verifyPayment(verificationData: PaymentVerificationParams): Promise<PaymentVerificationResult> {
    const pending = this.pendingPayments.get(verificationData.requestId)
    if (!pending) {
      return { verified: false, error: 'Payment request not found or expired' }
    }

    if (pending.verified) {
      return { verified: true }
    }

    if (Date.now() > pending.request.expiresAt) {
      this.pendingPayments.delete(verificationData.requestId)
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

    if (tx.from.toLowerCase() !== pending.request.from.toLowerCase()) {
      errors.push(`Sender mismatch: expected ${pending.request.from}, got ${tx.from}`)
    }

    if (tx.to?.toLowerCase() !== pending.request.to.toLowerCase()) {
      errors.push(`Recipient mismatch: expected ${pending.request.to}, got ${tx.to}`)
    }

    const requestedAmount = BigInt(pending.request.amount)
    const paidAmount = tx.value
    if (paidAmount < requestedAmount) {
      errors.push(`Insufficient payment: expected ${requestedAmount}, got ${paidAmount}`)
    }

    if (errors.length > 0) {
      return { verified: false, error: errors.join('; ') }
    }

    pending.verified = true

    return { verified: true }
  }

  /**
   * Get payment request details
   */
  getPaymentRequest(requestId: string): PaymentRequest | null {
    const pending = this.pendingPayments.get(requestId)
    return pending ? pending.request : null
  }

  /**
   * Check if payment has been verified
   */
  isPaymentVerified(requestId: string): boolean {
    const pending = this.pendingPayments.get(requestId)
    return pending ? pending.verified : false
  }

  /**
   * Cancel a payment request
   */
  cancelPaymentRequest(requestId: string): boolean {
    return this.pendingPayments.delete(requestId)
  }

  /**
   * Get all pending payments for a specific agent
   */
  getPendingPayments(agentAddress: string): PaymentRequest[] {
    const pending: PaymentRequest[] = []

    for (const payment of this.pendingPayments.values()) {
      if (
        payment.request.from.toLowerCase() === agentAddress.toLowerCase() ||
        payment.request.to.toLowerCase() === agentAddress.toLowerCase()
      ) {
        pending.push(payment.request)
      }
    }

    return pending
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `x402-${Date.now()}-${hexlify(randomBytes(16))}`
  }

  /**
   * Clean up expired payment requests
   */
  private cleanupExpiredPayments(): void {
    const now = Date.now()
    const expired: string[] = []

    for (const [requestId, payment] of this.pendingPayments.entries()) {
      if (now > payment.request.expiresAt) {
        expired.push(requestId)
      }
    }

    for (const requestId of expired) {
      this.pendingPayments.delete(requestId)
    }

    if (expired.length > 0) {
      logger.info(`Cleaned up ${expired.length} expired payment requests`)
    }
  }

  /**
   * Get payment statistics
   */
  getStatistics(): {
    totalPending: number
    totalVerified: number
    totalExpired: number
  } {
    let verified = 0
    let expired = 0
    const now = Date.now()

    for (const payment of this.pendingPayments.values()) {
      if (payment.verified) {
        verified++
      }
      if (now > payment.request.expiresAt) {
        expired++
      }
    }

    return {
      totalPending: this.pendingPayments.size,
      totalVerified: verified,
      totalExpired: expired
    }
  }
}
