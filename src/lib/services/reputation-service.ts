/**
 * Reputation Service
 *
 * Handles on-chain reputation updates based on prediction market outcomes
 * Winners get +10 reputation, losers get -5 reputation
 * Requires users to have NFT token IDs from on-chain registration
 */

import { createPublicClient, createWalletClient, http, parseEther, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import { REPUTATION_SYSTEM_ABI } from '../web3/abis'

// Contract addresses
const REPUTATION_SYSTEM = process.env.NEXT_PUBLIC_REPUTATION_SYSTEM_BASE_SEPOLIA as Address

// Server wallet for paying gas (testnet only!)
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`



interface MarketResolution {
  marketId: string
  outcome: boolean // true = YES, false = NO
}

interface ReputationUpdate {
  userId: string
  tokenId: number
  change: number // +10 or -5
  txHash?: string
  error?: string
}

export class ReputationService {
  /**
   * Update reputation for all users who had positions in a resolved market
   * Called after a prediction market question resolves
   */
  static async updateReputationForResolvedMarket(
    resolution: MarketResolution
  ): Promise<ReputationUpdate[]> {
    const results: ReputationUpdate[] = []

    // 1. Get all positions for this market
    const positions = await prisma.position.findMany({
      where: {
        marketId: resolution.marketId,
      },
      include: {
        User: {
          select: {
            id: true,
            nftTokenId: true,
            onChainRegistered: true,
          },
        },
      },
    })

    if (positions.length === 0) {
      logger.info(`No positions found for market ${resolution.marketId}`, undefined, 'ReputationService')
      return []
    }

    logger.info(`Updating reputation for ${positions.length} positions in market ${resolution.marketId}`, { count: positions.length, marketId: resolution.marketId }, 'ReputationService')

    // 2. Create clients
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL),
    })

    const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY)
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL),
    })

    // 3. Process each position
    for (const position of positions) {
      // Skip if user is not registered on-chain
      if (!position.User.onChainRegistered || !position.User.nftTokenId) {
        results.push({
          userId: position.userId,
          tokenId: 0,
          change: 0,
          error: 'User not registered on-chain',
        })
        continue
      }

      const tokenId = position.User.nftTokenId
      const isWinner = position.side === resolution.outcome
      const sharesAmount = Number(position.shares)
      const amount = parseEther(Math.abs(sharesAmount).toString())

      let txHash: `0x${string}`

      if (isWinner) {
        // Winner: +10 reputation
        logger.info(`Recording WIN for token ${tokenId} (+10 reputation)`, { tokenId, change: 10 }, 'ReputationService')
        txHash = await walletClient.writeContract({
          address: REPUTATION_SYSTEM,
          abi: REPUTATION_SYSTEM_ABI,
          functionName: 'recordWin',
          args: [BigInt(tokenId), amount],
        })
      } else {
        // Loser: -5 reputation
        logger.info(`Recording LOSS for token ${tokenId} (-5 reputation)`, { tokenId, change: -5 }, 'ReputationService')
        txHash = await walletClient.writeContract({
          address: REPUTATION_SYSTEM,
          abi: REPUTATION_SYSTEM_ABI,
          functionName: 'recordLoss',
          args: [BigInt(tokenId), amount],
        })
      }

      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      })

      results.push({
        userId: position.userId,
        tokenId,
        change: isWinner ? 10 : -5,
        txHash,
      })

      logger.info(`Updated reputation for token ${tokenId}`, { tokenId, txHash, change: isWinner ? 10 : -5 }, 'ReputationService')
    }

    return results
  }

  /**
   * Get current on-chain reputation for a user
   */
  static async getOnChainReputation(userId: string): Promise<number | null> {
    // Get user's NFT token ID
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        nftTokenId: true,
        onChainRegistered: true,
      },
    })

    if (!user || !user.onChainRegistered || !user.nftTokenId) {
      return null
    }

    // Query on-chain reputation
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL),
    })

    const reputation = await publicClient.readContract({
      address: REPUTATION_SYSTEM,
      abi: REPUTATION_SYSTEM_ABI,
      functionName: 'getReputation',
      args: [BigInt(user.nftTokenId)],
    }) as [bigint, bigint, bigint, bigint, bigint, bigint, boolean]

    // Reputation returns tuple: [totalBets, winningBets, totalVolume, profitLoss, accuracyScore, trustScore, isBanned]
    // We want trustScore (index 5) which is 0-10000 scale (divide by 100 to get 0-100)
    const trustScore = Number(reputation[5])
    return Math.floor(trustScore / 100) // Convert from 0-10000 to 0-100
  }

  /**
   * Sync database reputation with on-chain reputation
   * Useful for keeping local cache up-to-date
   */
  static async syncUserReputation(userId: string): Promise<number | null> {
    const onChainReputation = await this.getOnChainReputation(userId)

    if (onChainReputation === null) {
      return null
    }

    // Update local cache if you have a reputation field in the database
    // await prisma.user.update({
    //   where: { id: userId },
    //   data: { reputation: onChainReputation },
    // })

    return onChainReputation
  }

  /**
   * Batch update reputation for multiple market resolutions
   * Useful when processing multiple resolved markets at once
   */
  static async batchUpdateReputation(
    resolutions: MarketResolution[]
  ): Promise<Record<string, ReputationUpdate[]>> {
    const allResults: Record<string, ReputationUpdate[]> = {}

    for (const resolution of resolutions) {
      const results = await this.updateReputationForResolvedMarket(resolution)
      allResults[resolution.marketId] = results
    }

    return allResults
  }
}
