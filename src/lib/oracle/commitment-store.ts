/**
 * Commitment Storage
 * 
 * Securely stores salts and commitments for commit-reveal pattern
 * 
 * SECURITY NOTE:
 * - Salts are encrypted before storage
 * - In production, use KMS or secure key vault
 * - This implementation uses simple encryption for demonstration
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { prisma } from '../prisma'
import { logger } from '../logger'
import type { StoredCommitment } from './types'

const ENCRYPTION_KEY = process.env.ORACLE_ENCRYPTION_KEY || 'default-key-change-in-production-32'
const ALGORITHM = 'aes-256-cbc'

export class CommitmentStore {
  /**
   * Generate a cryptographically secure random salt
   */
  static generateSalt(): string {
    return '0x' + randomBytes(32).toString('hex')
  }

  /**
   * Encrypt salt for storage
   */
  private static encryptSalt(salt: string): string {
    const iv = randomBytes(16)
    const cipher = createCipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
      iv
    )

    let encrypted = cipher.update(salt, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return iv.toString('hex') + ':' + encrypted
  }

  /**
   * Decrypt salt from storage
   */
  private static decryptSalt(encryptedSalt: string): string {
    const parts = encryptedSalt.split(':')
    const iv = Buffer.from(parts[0]!, 'hex')
    const encrypted = parts[1]!

    const decipher = createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)),
      iv
    )

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  /**
   * Store commitment with encrypted salt (upsert to handle updates)
   * Returns the stored commitment record
   */
  static async store(commitment: StoredCommitment): Promise<{ id: string; questionId: string }> {
    const encryptedSalt = this.encryptSalt(commitment.salt)

    const result = await prisma.oracleCommitment.upsert({
      where: {
        questionId: commitment.questionId
      },
      update: {
        sessionId: commitment.sessionId,
        saltEncrypted: encryptedSalt,
        commitment: commitment.commitment
      },
      create: {
        id: `commitment-${commitment.questionId}-${Date.now()}`,
        questionId: commitment.questionId,
        sessionId: commitment.sessionId,
        saltEncrypted: encryptedSalt,
        commitment: commitment.commitment,
        createdAt: commitment.createdAt
      }
    })

    logger.info(
      `Stored commitment for question ${commitment.questionId}`,
      { 
        sessionId: commitment.sessionId,
        recordId: result.id,
        wasCreated: !result.sessionId || result.sessionId === '',
        operation: result.id.includes(commitment.questionId) ? 'upsert' : 'unknown'
      },
      'CommitmentStore'
    )

    return result
  }

  /**
   * Retrieve commitment and decrypt salt
   */
  static async retrieve(questionId: string): Promise<StoredCommitment | null> {
    logger.info(
      `Retrieving commitment for question ${questionId}`,
      undefined,
      'CommitmentStore'
    )

    const stored = await prisma.oracleCommitment.findUnique({
      where: { questionId }
    })

    if (!stored) {
      logger.warn(
        `No commitment found for question ${questionId}`,
        undefined,
        'CommitmentStore'
      )
      return null
    }

    logger.info(
      `Found commitment for question ${questionId}`,
      { 
        recordId: stored.id,
        sessionId: stored.sessionId,
        hasCommitment: !!stored.commitment,
        hasSalt: !!stored.saltEncrypted
      },
      'CommitmentStore'
    )

    const salt = this.decryptSalt(stored.saltEncrypted)

    return {
      questionId: stored.questionId,
      sessionId: stored.sessionId,
      salt,
      commitment: stored.commitment,
      createdAt: stored.createdAt
    }
  }

  /**
   * Delete commitment after reveal (cleanup)
   * Idempotent - won't fail if commitment already deleted
   */
  static async delete(questionId: string): Promise<void> {
    try {
      await prisma.oracleCommitment.delete({
        where: { questionId }
      })
      logger.info(`Deleted commitment for question ${questionId}`, undefined, 'CommitmentStore')
    } catch (error: unknown) {
      // If record not found, that's okay (idempotent)
      if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2025') {
        logger.info(`Commitment already deleted for question ${questionId}`, undefined, 'CommitmentStore')
        return
      }
      throw error
    }
  }

  /**
   * List all pending commitments (for recovery/debugging)
   */
  static async listPending(): Promise<StoredCommitment[]> {
    const stored = await prisma.oracleCommitment.findMany({
      orderBy: { createdAt: 'asc' }
    })

    return stored.map(s => ({
      questionId: s.questionId,
      sessionId: s.sessionId,
      salt: this.decryptSalt(s.saltEncrypted),
      commitment: s.commitment,
      createdAt: s.createdAt
    }))
  }
}


