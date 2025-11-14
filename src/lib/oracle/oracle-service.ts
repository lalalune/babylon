/**
 * Oracle Service
 * 
 * Main service for interacting with BabylonGameOracle contract
 * Handles commit-reveal pattern for publishing game results on-chain
 */

import { ethers } from 'ethers'
import { CommitmentStore } from './commitment-store'
import { logger } from '../logger'
import { getContractAddressesFromEnv } from '../deployment/validation'
import type {
  OracleConfig,
  CommitTransactionResult,
  RevealTransactionResult,
  BatchCommitResult,
  BatchRevealResult
} from './types'
import BabylonGameOracleABI from './abi/BabylonGameOracle.json'

export class OracleService {
  private provider: ethers.JsonRpcProvider
  private wallet: ethers.Wallet
  private contract: ethers.Contract
  private config: OracleConfig

  constructor(config?: Partial<OracleConfig>) {
    // Load config from environment or use provided
    const addresses = getContractAddressesFromEnv()
    
    this.config = {
      oracleAddress: config?.oracleAddress || addresses.babylonOracle || '',
      privateKey: config?.privateKey || process.env.ORACLE_PRIVATE_KEY || '',
      rpcUrl: config?.rpcUrl || process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545',
      chainId: config?.chainId || parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '31337'),
      gasMultiplier: config?.gasMultiplier || 1.2,
      maxGasPrice: config?.maxGasPrice,
      confirmations: config?.confirmations || 1
    }

    if (!this.config.oracleAddress) {
      throw new Error('Oracle address not configured')
    }

    if (!this.config.privateKey) {
      throw new Error('Oracle private key not configured')
    }

    // Setup provider and wallet
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl)
    this.wallet = new ethers.Wallet(this.config.privateKey, this.provider)
    
    // Setup contract
    this.contract = new ethers.Contract(
      this.config.oracleAddress,
      BabylonGameOracleABI,
      this.wallet
    )

    logger.info(
      'Oracle service initialized',
      {
        oracle: this.config.oracleAddress,
        wallet: this.wallet.address,
        chainId: this.config.chainId
      },
      'OracleService'
    )
  }

  /**
   * Generate commitment for a game outcome
   */
  private generateCommitment(outcome: boolean, salt: string): string {
    // keccak256(abi.encode(outcome, salt))
    const abiCoder = ethers.AbiCoder.defaultAbiCoder()
    const encoded = abiCoder.encode(['bool', 'bytes32'], [outcome, salt])
    return ethers.keccak256(encoded)
  }

  /**
   * Commit a game to the oracle (when question is created)
   */
  async commitGame(
    questionId: string,
    questionNumber: number,
    question: string,
    category: string,
    outcome: boolean
  ): Promise<CommitTransactionResult> {
    try {
      logger.info(
        `Committing game: ${questionId}`,
        { questionNumber, question: question.substring(0, 50) },
        'OracleService'
      )

      // Generate salt and commitment
      const salt = CommitmentStore.generateSalt()
      const commitment = this.generateCommitment(outcome, salt)

      // Store commitment locally
      await CommitmentStore.store({
        questionId,
        sessionId: '', // Will be set after transaction
        salt,
        commitment,
        createdAt: new Date()
      })

      // Call contract
      if (!this.contract?.commitBabylonGame) {
        throw new Error('commitBabylonGame not available on contract');
      }
      const tx = await this.contract.commitBabylonGame(
        questionId,
        questionNumber,
        question,
        commitment,
        category,
        {
          gasLimit: 500000 // Reasonable limit for commit
        }
      )

      logger.info(
        `Transaction sent: ${tx.hash}`,
        { questionId },
        'OracleService'
      )

      // Wait for confirmation
      const receipt = await tx.wait(this.config.confirmations)

      // Parse event to get sessionId
      const event = receipt.logs
        .map((log: ethers.Log | ethers.EventLog) => {
          try {
            return this.contract.interface.parseLog({ topics: log.topics, data: log.data })
          } catch {
            return null
          }
        })
        .find((e: ethers.LogDescription | null) => e && e.name === 'BabylonGameCommitted')

      const sessionId = event?.args?.sessionId || ethers.ZeroHash

      // Update stored commitment with sessionId
      const stored = await CommitmentStore.retrieve(questionId)
      if (stored) {
        await CommitmentStore.store({
          ...stored,
          sessionId: sessionId.toString()
        })
      }

      logger.info(
        `Game committed successfully`,
        {
          questionId,
          sessionId: sessionId.toString(),
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString()
        },
        'OracleService'
      )

      return {
        sessionId: sessionId.toString(),
        questionId,
        commitment,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      }
    } catch (error) {
      logger.error(
        'Failed to commit game',
        { error, questionId },
        'OracleService'
      )
      throw error
    }
  }

  /**
   * Reveal a game outcome (when question is resolved)
   */
  async revealGame(
    questionId: string,
    outcome: boolean,
    winners: string[] = [],
    totalPayout: bigint = BigInt(0)
  ): Promise<RevealTransactionResult> {
    try {
      logger.info(
        `Revealing game: ${questionId}`,
        { outcome, winnersCount: winners.length },
        'OracleService'
      )

      // Retrieve stored commitment
      const stored = await CommitmentStore.retrieve(questionId)
      if (!stored) {
        throw new Error(`No commitment found for question ${questionId}`)
      }

      // Call contract
      if (!this.contract?.revealBabylonGame) {
        throw new Error('revealBabylonGame not available on contract');
      }
      const tx = await this.contract.revealBabylonGame(
        stored.sessionId,
        outcome,
        stored.salt,
        '0x', // Empty TEE quote for now
        winners,
        totalPayout,
        {
          gasLimit: 800000 // Higher limit for reveal
        }
      )

      logger.info(
        `Reveal transaction sent: ${tx.hash}`,
        { questionId, sessionId: stored.sessionId },
        'OracleService'
      )

      // Wait for confirmation
      const receipt = await tx.wait(this.config.confirmations)

      // Cleanup stored commitment
      await CommitmentStore.delete(questionId)

      logger.info(
        `Game revealed successfully`,
        {
          questionId,
          sessionId: stored.sessionId,
          outcome,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString()
        },
        'OracleService'
      )

      return {
        sessionId: stored.sessionId,
        questionId,
        outcome,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      }
    } catch (error) {
      logger.error(
        'Failed to reveal game',
        { error, questionId },
        'OracleService'
      )
      throw error
    }
  }

  /**
   * Batch commit multiple games (gas optimization)
   */
  async batchCommitGames(
    games: Array<{
      questionId: string
      questionNumber: number
      question: string
      category: string
      outcome: boolean
    }>
  ): Promise<BatchCommitResult> {
    const successful: CommitTransactionResult[] = []
    const failed: Array<{ questionId: string; error: string }> = []

    logger.info(
      `Batch committing ${games.length} games`,
      undefined,
      'OracleService'
    )

    // Prepare batch data
    const questionIds: string[] = []
    const questionNumbers: number[] = []
    const questions: string[] = []
    const commitments: string[] = []
    const categories: string[] = []
    const salts: string[] = []

    for (const game of games) {
      try {
        const salt = CommitmentStore.generateSalt()
        const commitment = this.generateCommitment(game.outcome, salt)

        questionIds.push(game.questionId)
        questionNumbers.push(game.questionNumber)
        questions.push(game.question)
        commitments.push(commitment)
        categories.push(game.category)
        salts.push(salt)

        // Store commitment
        await CommitmentStore.store({
          questionId: game.questionId,
          sessionId: '', // Will be set after transaction
          salt,
          commitment,
          createdAt: new Date()
        })
      } catch (error) {
        failed.push({
          questionId: game.questionId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    if (questionIds.length === 0) {
      return { successful, failed }
    }

    try {
      // Call batch contract method
      if (!this.contract?.batchCommitBabylonGames) {
        throw new Error('batchCommitBabylonGames not available on contract');
      }
      const tx = await this.contract.batchCommitBabylonGames(
        questionIds,
        questionNumbers,
        questions,
        commitments,
        categories,
        {
          gasLimit: 500000 * questionIds.length // Scale with batch size
        }
      )

      const receipt = await tx.wait(this.config.confirmations)

      // Parse events to get session IDs
      const events = receipt.logs
        .map((log: ethers.Log | ethers.EventLog) => {
          try {
            return this.contract.interface.parseLog({ topics: log.topics, data: log.data })
          } catch {
            return null
          }
        })
        .filter((e: ethers.LogDescription | null) => e && e.name === 'BabylonGameCommitted')

      // Update stored commitments and build results
      for (let i = 0; i < questionIds.length; i++) {
        const event = events[i]
        const sessionId = event?.args?.sessionId?.toString() || ethers.ZeroHash

        const stored = await CommitmentStore.retrieve(questionIds[i]!)
        if (stored) {
          await CommitmentStore.store({
            ...stored,
            sessionId
          })
        }

        successful.push({
          sessionId,
          questionId: questionIds[i]!,
          commitment: commitments[i]!,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: (receipt.gasUsed / BigInt(questionIds.length)).toString()
        })
      }

      logger.info(
        `Batch commit successful: ${successful.length} games`,
        {
          txHash: receipt.hash,
          gasUsed: receipt.gasUsed.toString()
        },
        'OracleService'
      )
    } catch (error) {
      logger.error(
        'Batch commit failed',
        { error, count: questionIds.length },
        'OracleService'
      )
      
      // Mark all as failed
      for (const questionId of questionIds) {
        failed.push({
          questionId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return { successful, failed }
  }

  /**
   * Batch reveal multiple games (gas optimization)
   */
  async batchRevealGames(
    reveals: Array<{
      questionId: string
      outcome: boolean
      winners?: string[]
      totalPayout?: bigint
    }>
  ): Promise<BatchRevealResult> {
    const successful: RevealTransactionResult[] = []
    const failed: Array<{ questionId: string; error: string }> = []

    logger.info(
      `Batch revealing ${reveals.length} games`,
      undefined,
      'OracleService'
    )

    // Prepare batch data
    const sessionIds: string[] = []
    const outcomes: boolean[] = []
    const salts: string[] = []
    const teeQuotes: string[] = []
    const winnersArrays: string[][] = []
    const totalPayouts: bigint[] = []
    const questionIds: string[] = []

    for (const reveal of reveals) {
      try {
        const stored = await CommitmentStore.retrieve(reveal.questionId)
        if (!stored) {
          throw new Error(`No commitment found for question ${reveal.questionId}`)
        }

        sessionIds.push(stored.sessionId)
        outcomes.push(reveal.outcome)
        salts.push(stored.salt)
        teeQuotes.push('0x')
        winnersArrays.push(reveal.winners || [])
        totalPayouts.push(reveal.totalPayout || BigInt(0))
        questionIds.push(reveal.questionId)
      } catch (error) {
        failed.push({
          questionId: reveal.questionId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    if (sessionIds.length === 0) {
      return { successful, failed }
    }

    try {
      // Call batch contract method
      if (!this.contract?.batchRevealBabylonGames) {
        throw new Error('batchRevealBabylonGames not available on contract');
      }
      const tx = await this.contract.batchRevealBabylonGames(
        sessionIds,
        outcomes,
        salts,
        teeQuotes,
        winnersArrays,
        totalPayouts,
        {
          gasLimit: 800000 * sessionIds.length // Scale with batch size
        }
      )

      const receipt = await tx.wait(this.config.confirmations)

      // Build results and cleanup
      for (let i = 0; i < questionIds.length; i++) {
        await CommitmentStore.delete(questionIds[i]!)

        successful.push({
          sessionId: sessionIds[i]!,
          questionId: questionIds[i]!,
          outcome: outcomes[i]!,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: (receipt.gasUsed / BigInt(sessionIds.length)).toString()
        })
      }

      logger.info(
        `Batch reveal successful: ${successful.length} games`,
        {
          txHash: receipt.hash,
          gasUsed: receipt.gasUsed.toString()
        },
        'OracleService'
      )
    } catch (error) {
      logger.error(
        'Batch reveal failed',
        { error, count: sessionIds.length },
        'OracleService'
      )
      
      // Mark all as failed
      for (const questionId of questionIds) {
        failed.push({
          questionId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return { successful, failed }
  }

  /**
   * Get game info from oracle
   */
  async getGameInfo(sessionId: string) {
    try {
      if (!this.contract?.getCompleteGameInfo) {
        throw new Error('getCompleteGameInfo not available on contract');
      }
      const info = await this.contract.getCompleteGameInfo(sessionId)
      return info
    } catch (error) {
      logger.error('Failed to get game info', { error, sessionId }, 'OracleService')
      throw error
    }
  }

  /**
   * Get oracle statistics
   */
  async getStatistics() {
    try {
      if (!this.contract?.getStatistics) {
        throw new Error('getStatistics not available on contract');
      }
      const stats = await this.contract.getStatistics()
      return {
        committed: stats.committed.toString(),
        revealed: stats.revealed.toString(),
        pending: stats.pending.toString()
      }
    } catch (error) {
      logger.error('Failed to get statistics', { error }, 'OracleService')
      throw error
    }
  }

  /**
   * Health check - verify oracle is accessible and properly configured
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      // Check contract is deployed
      const code = await this.provider.getCode(this.config.oracleAddress)
      if (code === '0x' || code === '0x0') {
        return {
          healthy: false,
          error: 'Oracle contract not deployed'
        }
      }

      // Check wallet has balance
      const balance = await this.provider.getBalance(this.wallet.address)
      if (balance === BigInt(0)) {
        return {
          healthy: false,
          error: 'Wallet has no balance for gas'
        }
      }

      // Try to read from contract
      if (this.contract?.version) {
        await this.contract.version();
      }

      return { healthy: true }
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

// Singleton instance
let oracleServiceInstance: OracleService | null = null

/**
 * Get or create oracle service instance
 */
export function getOracleService(config?: Partial<OracleConfig>): OracleService {
  if (!oracleServiceInstance) {
    oracleServiceInstance = new OracleService(config)
  }
  return oracleServiceInstance
}

