/**
 * Blockchain Reputation Service
 *
 * Integrates with ERC-8004 Reputation System for on-chain reputation tracking.
 * Handles feedback submission, reputation queries, and sync with local database.
 */

import { createPublicClient, http, type Address, type WalletClient } from 'viem'
import { baseSepolia } from 'viem/chains'
import { REPUTATION_SYSTEM_ABI } from '@/lib/web3/abis'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'

// Contract addresses (should be from environment in production)
const REPUTATION_SYSTEM_ADDRESS = (process.env.NEXT_PUBLIC_REPUTATION_SYSTEM_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as Address

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL),
})

interface OnChainReputation {
  totalBets: bigint
  winningBets: bigint
  totalVolume: bigint
  profitLoss: bigint
  accuracyScore: bigint
  trustScore: bigint
  isBanned: boolean
}

/**
 * Get on-chain reputation for an agent
 *
 * @param tokenId - ERC-8004 token ID
 * @returns On-chain reputation data
 */
export async function getOnChainReputation(tokenId: number): Promise<OnChainReputation | null> {
  try {
    const reputation = (await publicClient.readContract({
      address: REPUTATION_SYSTEM_ADDRESS,
      abi: REPUTATION_SYSTEM_ABI,
      functionName: 'getReputation',
      args: [BigInt(tokenId)],
    })) as [bigint, bigint, bigint, bigint, bigint, bigint, boolean]

    return {
      totalBets: reputation[0],
      winningBets: reputation[1],
      totalVolume: reputation[2],
      profitLoss: reputation[3],
      accuracyScore: reputation[4],
      trustScore: reputation[5],
      isBanned: reputation[6],
    }
  } catch (error) {
    logger.error('Failed to get on-chain reputation', { tokenId, error })
    return null
  }
}

/**
 * Submit feedback to on-chain reputation system
 *
 * @param tokenId - ERC-8004 token ID
 * @param rating - Rating score (-128 to 127, maps to 0-100 scale)
 * @param comment - Optional comment
 * @param walletClient - Wallet client for signing transaction
 * @returns Transaction hash
 */
export async function submitOnChainFeedback(
  tokenId: number,
  rating: number,
  comment: string,
  walletClient: WalletClient
): Promise<string> {
  try {
    if (!walletClient.account) {
      throw new Error('Wallet client must have an account')
    }

    // Convert 0-100 scale to -128 to 127 scale
    // 0-100 → -128 to 127 (0 = -128, 50 = 0, 100 = 127)
    const int8Rating = Math.floor((rating / 100) * 255 - 128)

    const hash = await walletClient.writeContract({
      chain: baseSepolia,
      address: REPUTATION_SYSTEM_ADDRESS,
      abi: REPUTATION_SYSTEM_ABI,
      functionName: 'submitFeedback',
      args: [BigInt(tokenId), int8Rating, comment],
      account: walletClient.account,
    })

    logger.info('Submitted on-chain feedback', { tokenId, rating, hash })

    return hash
  } catch (error) {
    logger.error('Failed to submit on-chain feedback', { tokenId, rating, error })
    throw error
  }
}

/**
 * Record a bet on-chain
 *
 * @param tokenId - ERC-8004 token ID
 * @param amount - Bet amount
 * @param walletClient - Wallet client for signing transaction
 * @returns Transaction hash
 */
export async function recordBet(
  tokenId: number,
  amount: number,
  walletClient: WalletClient
): Promise<string> {
  try {
    if (!walletClient.account) {
      throw new Error('Wallet client must have an account')
    }

    const hash = await walletClient.writeContract({
      chain: baseSepolia,
      address: REPUTATION_SYSTEM_ADDRESS,
      abi: REPUTATION_SYSTEM_ABI,
      functionName: 'recordBet',
      args: [BigInt(tokenId), BigInt(amount)],
      account: walletClient.account,
    })

    logger.info('Recorded bet on-chain', { tokenId, amount, hash })

    return hash
  } catch (error) {
    logger.error('Failed to record bet on-chain', { tokenId, amount, error })
    throw error
  }
}

/**
 * Record a win on-chain
 *
 * @param tokenId - ERC-8004 token ID
 * @param profit - Profit amount
 * @param walletClient - Wallet client for signing transaction
 * @returns Transaction hash
 */
export async function recordWin(
  tokenId: number,
  profit: number,
  walletClient: WalletClient
): Promise<string> {
  try {
    if (!walletClient.account) {
      throw new Error('Wallet client must have an account')
    }

    const hash = await walletClient.writeContract({
      chain: baseSepolia,
      address: REPUTATION_SYSTEM_ADDRESS,
      abi: REPUTATION_SYSTEM_ABI,
      functionName: 'recordWin',
      args: [BigInt(tokenId), BigInt(profit)],
      account: walletClient.account,
    })

    logger.info('Recorded win on-chain', { tokenId, profit, hash })

    return hash
  } catch (error) {
    logger.error('Failed to record win on-chain', { tokenId, profit, error })
    throw error
  }
}

/**
 * Record a loss on-chain
 *
 * @param tokenId - ERC-8004 token ID
 * @param loss - Loss amount
 * @param walletClient - Wallet client for signing transaction
 * @returns Transaction hash
 */
export async function recordLoss(
  tokenId: number,
  loss: number,
  walletClient: WalletClient
): Promise<string> {
  try {
    if (!walletClient.account) {
      throw new Error('Wallet client must have an account')
    }

    const hash = await walletClient.writeContract({
      chain: baseSepolia,
      address: REPUTATION_SYSTEM_ADDRESS,
      abi: REPUTATION_SYSTEM_ABI,
      functionName: 'recordLoss',
      args: [BigInt(tokenId), BigInt(loss)],
      account: walletClient.account,
    })

    logger.info('Recorded loss on-chain', { tokenId, loss, hash })

    return hash
  } catch (error) {
    logger.error('Failed to record loss on-chain', { tokenId, loss, error })
    throw error
  }
}

/**
 * Sync on-chain reputation to local database
 *
 * @param userId - User ID
 * @param tokenId - ERC-8004 token ID
 * @returns Updated performance metrics
 */
export async function syncOnChainReputation(userId: string, tokenId: number) {
  try {
    const onChainRep = await getOnChainReputation(tokenId)

    if (!onChainRep) {
      throw new Error('Failed to fetch on-chain reputation')
    }

    // Update local database with on-chain data
    const updated = await prisma.agentPerformanceMetrics.update({
      where: { userId },
      data: {
        onChainReputationSync: true,
        lastSyncedAt: new Date(),
        onChainTrustScore: Number(onChainRep.trustScore),
        onChainAccuracyScore: Number(onChainRep.accuracyScore),
      },
    })

    logger.info('Synced on-chain reputation', {
      userId,
      tokenId,
      trustScore: onChainRep.trustScore.toString(),
      accuracyScore: onChainRep.accuracyScore.toString(),
    })

    return updated
  } catch (error) {
    logger.error('Failed to sync on-chain reputation', { userId, tokenId, error })
    throw error
  }
}

/**
 * Get feedback count from on-chain reputation system
 *
 * @param tokenId - ERC-8004 token ID
 * @returns Feedback count
 */
export async function getOnChainFeedbackCount(tokenId: number): Promise<number> {
  try {
    const count = await publicClient.readContract({
      address: REPUTATION_SYSTEM_ADDRESS,
      abi: REPUTATION_SYSTEM_ABI,
      functionName: 'getFeedbackCount',
      args: [BigInt(tokenId)],
    })

    return Number(count)
  } catch (error) {
    logger.error('Failed to get on-chain feedback count', { tokenId, error })
    return 0
  }
}

/**
 * Get specific feedback from on-chain reputation system
 *
 * @param tokenId - ERC-8004 token ID
 * @param index - Feedback index
 * @returns Feedback details
 */
export async function getOnChainFeedback(
  tokenId: number,
  index: number
): Promise<{
  from: Address
  rating: number
  comment: string
  timestamp: bigint
} | null> {
  try {
    const feedback = (await publicClient.readContract({
      address: REPUTATION_SYSTEM_ADDRESS,
      abi: REPUTATION_SYSTEM_ABI,
      functionName: 'getFeedback',
      args: [BigInt(tokenId), BigInt(index)],
    })) as [Address, number, string, bigint]

    return {
      from: feedback[0],
      rating: Number(feedback[1]),
      comment: feedback[2],
      timestamp: feedback[3],
    }
  } catch (error) {
    logger.error('Failed to get on-chain feedback', { tokenId, index, error })
    return null
  }
}
