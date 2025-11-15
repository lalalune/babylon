/**
 * Hook for on-chain prediction market betting with Base Sepolia ETH
 * 
 * Enables users to buy/sell shares using their smart wallet
 * Transactions execute on Base Sepolia blockchain
 */

import { CHAIN } from '@/constants/chains'
import { useSmartWallet } from '@/hooks/useSmartWallet'
import { getContractAddresses } from '@/lib/deployment/addresses'
import { logger } from '@/lib/logger'
import { useCallback, useState } from 'react'
import { encodeFunctionData, pad } from 'viem'

/**
 * Convert market ID (Snowflake ID string) to bytes32
 * Preserves the numeric value by converting to hex and padding
 */
function marketIdToBytes32(marketId: string): `0x${string}` {
  // Convert string number to BigInt, then to hex, then pad to 32 bytes
  const bigintValue = BigInt(marketId)
  const hexValue = `0x${bigintValue.toString(16)}` as `0x${string}`
  return pad(hexValue, { size: 32 })
}

// Get contract addresses for current network (localnet or testnet/mainnet)
const { diamond: DIAMOND_ADDRESS, network: NETWORK } = getContractAddresses()

// Prediction Market Facet ABI
const PREDICTION_MARKET_ABI = [
  {
    type: 'function',
    name: 'buyShares',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_outcome', type: 'uint8' },
      { name: '_numShares', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'sellShares',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_outcome', type: 'uint8' },
      { name: '_numShares', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'calculateCost',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_outcome', type: 'uint8' },
      { name: '_numShares', type: 'uint256' }
    ],
    outputs: [{ name: 'cost', type: 'uint256' }],
    stateMutability: 'view'
  }
] as const

export interface OnChainBetResult {
  txHash: string
  shares: number
  gasUsed?: string
}

export function useOnChainBetting() {
  const { client, smartWalletReady, sendSmartWalletTransaction } = useSmartWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Buy shares on-chain with smart wallet
   */
  const buyShares = useCallback(
    async (marketId: string, outcome: 'YES' | 'NO', numShares: number): Promise<OnChainBetResult> => {
      if (!smartWalletReady || !client) {
        throw new Error('Smart wallet not ready. Please connect your wallet.')
      }

      setLoading(true)
      setError(null)

      try {
        const outcomeIndex = outcome === 'YES' ? 1 : 0
        const sharesBigInt = BigInt(Math.floor(numShares * 1e18))
        
        // Convert Snowflake ID to bytes32
        const marketIdBytes32 = marketIdToBytes32(marketId)

        logger.info('Buying shares on-chain', {
          network: NETWORK,
          diamond: DIAMOND_ADDRESS,
          marketId,
          marketIdBytes32,
          outcome,
          numShares,
          outcomeIndex
        })

        // Encode the function call
        const data = encodeFunctionData({
          abi: PREDICTION_MARKET_ABI,
          functionName: 'buyShares',
          args: [marketIdBytes32, outcomeIndex, sharesBigInt]
        })

        // Send transaction via smart wallet
        const hash = await sendSmartWalletTransaction({
          to: DIAMOND_ADDRESS,
          data,
          chain: CHAIN,
        })

        logger.info('Buy shares transaction sent', {
          marketId,
          outcome,
          txHash: hash
        })

        return {
          txHash: hash,
          shares: numShares
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Buy shares failed'
        setError(errorMsg)
        logger.error('Buy shares on-chain failed', { error: err }, 'useOnChainBetting')
        throw new Error(errorMsg)
      } finally {
        setLoading(false)
      }
    },
    [smartWalletReady, client, sendSmartWalletTransaction]
  )

  /**
   * Sell shares on-chain with smart wallet
   */
  const sellShares = useCallback(
    async (marketId: string, outcome: 'YES' | 'NO', numShares: number): Promise<OnChainBetResult> => {
      if (!smartWalletReady || !client) {
        throw new Error('Smart wallet not ready. Please connect your wallet.')
      }

      setLoading(true)
      setError(null)

      try {
        const outcomeIndex = outcome === 'YES' ? 1 : 0
        const sharesBigInt = BigInt(Math.floor(numShares * 1e18))
        
        // Convert Snowflake ID to bytes32
        const marketIdBytes32 = marketIdToBytes32(marketId)

        logger.info('Selling shares on-chain', {
          marketId,
          marketIdBytes32,
          outcome,
          numShares
        })

        // Encode the function call
        const data = encodeFunctionData({
          abi: PREDICTION_MARKET_ABI,
          functionName: 'sellShares',
          args: [marketIdBytes32, outcomeIndex, sharesBigInt]
        })

        // Send transaction via smart wallet
        const hash = await sendSmartWalletTransaction({
          to: DIAMOND_ADDRESS,
          data,
          chain: CHAIN,
        })

        logger.info('Sell shares transaction sent', {
          marketId,
          outcome,
          txHash: hash
        })

        return {
          txHash: hash,
          shares: numShares
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Sell shares failed'
        setError(errorMsg)
        logger.error('Sell shares on-chain failed', { error: err }, 'useOnChainBetting')
        throw new Error(errorMsg)
      } finally {
        setLoading(false)
      }
    },
    [smartWalletReady, client, sendSmartWalletTransaction]
  )

  return {
    buyShares,
    sellShares,
    loading,
    error,
    smartWalletReady
  }
}

