/**
 * Service for creating and managing prediction markets on-chain
 */

import { createPublicClient, createWalletClient, http, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { logger } from '../logger'
import { prisma } from '../prisma'

/**
 * Create a prediction market on-chain
 * @param question The question text
 * @param endDate The resolution date
 * @param oracleAddress The oracle address authorized to resolve this market
 * @returns The on-chain market ID (bytes32)
 */
export async function createMarketOnChain(
  question: string,
  endDate: Date,
  oracleAddress?: Address
): Promise<`0x${string}` | null> {
  const diamondAddress = process.env.NEXT_PUBLIC_DIAMOND_ADDRESS as Address
  const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL

  if (!diamondAddress || !deployerPrivateKey || !rpcUrl) {
    logger.debug(
      'Skipping on-chain market creation - missing configuration',
      { hasDiamond: !!diamondAddress, hasKey: !!deployerPrivateKey, hasRpc: !!rpcUrl },
      'OnChainMarketService'
    )
    return null
  }

  try {
    const publicClient = createPublicClient({
      chain: rpcUrl.includes('localhost')
        ? { id: 31337, name: 'Local', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } }
        : baseSepolia,
      transport: http(rpcUrl),
    })

    const account = privateKeyToAccount(deployerPrivateKey)
    const walletClient = createWalletClient({
      account,
      chain: rpcUrl.includes('localhost')
        ? { id: 31337, name: 'Local', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } }
        : baseSepolia,
      transport: http(rpcUrl),
    })

    // Use deployer address as oracle if none provided
    const oracle = oracleAddress || account.address

    // Convert endDate to Unix timestamp
    const resolveAt = BigInt(Math.floor(endDate.getTime() / 1000))

    // Binary market: Yes/No outcomes
    const outcomes = ['Yes', 'No']

    logger.info(
      'Creating market on-chain',
      { question: question.substring(0, 50), resolveAt: resolveAt.toString(), oracle },
      'OnChainMarketService'
    )

    // Get oracle address - use deployer if none provided
    // In production, this should be a proper oracle contract address
    const oracleAddr = oracleAddress || account.address

    // Use object-based ABI format for viem compatibility
    const createMarketAbi = [
      {
        type: 'function',
        name: 'createMarket',
        inputs: [
          { name: '_question', type: 'string' },
          { name: '_outcomeNames', type: 'string[]' },
          { name: '_resolveAt', type: 'uint256' },
          { name: '_oracle', type: 'address' },
        ],
        outputs: [{ name: 'marketId', type: 'bytes32' }],
        stateMutability: 'nonpayable',
      },
    ] as const

    const txHash = await walletClient.writeContract({
      address: diamondAddress,
      abi: createMarketAbi,
      functionName: 'createMarket',
      args: [question, outcomes, resolveAt, oracleAddr],
    })

    logger.info('Market creation transaction sent', { txHash }, 'OnChainMarketService')

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    })

    if (receipt.status === 'success') {
      // Extract market ID from events
      // The MarketCreated event signature: MarketCreated(bytes32 indexed marketId, string question, uint8 numOutcomes, uint256 liquidity)
      // Event signature hash: keccak256("MarketCreated(bytes32,string,uint8,uint256)")
      // topics[0] = event signature hash
      // topics[1] = marketId (indexed, first parameter)
      
      // Calculate event signature hash
      const { keccak256, toBytes } = await import('viem')
      const eventSignature = 'MarketCreated(bytes32,string,uint8,uint256)'
      const eventSignatureHash = keccak256(toBytes(eventSignature))
      
      const marketCreatedEvent = receipt.logs.find((log) => {
        // Check if this log matches the MarketCreated event
        return log.topics[0]?.toLowerCase() === eventSignatureHash.toLowerCase() && log.topics.length >= 2
      })

      if (marketCreatedEvent && marketCreatedEvent.topics[1]) {
        const marketId = marketCreatedEvent.topics[1] as `0x${string}`
        logger.info(
          'Market created on-chain successfully',
          { marketId, txHash },
          'OnChainMarketService'
        )
        return marketId
      } else {
        // Fallback: try to read the return value from the transaction
        // The createMarket function returns bytes32 marketId
        try {
          // Alternative: Read from contract state by querying recent MarketCreated events
          const events = await publicClient.getLogs({
            address: diamondAddress,
            event: {
              type: 'event',
              name: 'MarketCreated',
              inputs: [
                { name: 'marketId', type: 'bytes32', indexed: true },
                { name: 'question', type: 'string', indexed: false },
                { name: 'numOutcomes', type: 'uint8', indexed: false },
                { name: 'liquidity', type: 'uint256', indexed: false },
              ],
            },
            fromBlock: receipt.blockNumber,
            toBlock: receipt.blockNumber,
          })
          
          const firstEvent = events[0]
          if (firstEvent?.args.marketId) {
            const marketId = firstEvent.args.marketId as `0x${string}`
            logger.info(
              'Market created on-chain successfully (from event logs)',
              { marketId, txHash },
              'OnChainMarketService'
            )
            return marketId
          }
        } catch (error) {
          logger.debug('Could not read market ID from events', { error }, 'OnChainMarketService')
        }
        
        logger.warn(
          'Could not extract market ID from events, will retry later',
          { txHash },
          'OnChainMarketService'
        )
        // Return null - caller can retry with getMarketIdFromTx
        return null
      }
    } else {
      logger.error('Market creation transaction failed', { txHash }, 'OnChainMarketService')
      return null
    }
  } catch (error) {
    logger.error('Failed to create market on-chain', { error, question: question.substring(0, 50) }, 'OnChainMarketService')
    return null
  }
}

/**
 * Get the on-chain market ID from a transaction hash
 * This is a fallback if we couldn't extract it from the receipt
 */
export async function getMarketIdFromTx(txHash: `0x${string}`): Promise<`0x${string}` | null> {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL
  if (!rpcUrl) return null

  try {
    const publicClient = createPublicClient({
      chain: rpcUrl.includes('localhost')
        ? { id: 31337, name: 'Local', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } }
        : baseSepolia,
      transport: http(rpcUrl),
    })

    const receipt = await publicClient.getTransactionReceipt({ hash: txHash })
    
    // Look for MarketCreated event using event signature
    const { keccak256, toBytes } = await import('viem')
    const eventSignature = 'MarketCreated(bytes32,string,uint8,uint256)'
    const eventSignatureHash = keccak256(toBytes(eventSignature))
    
    const marketCreatedEvent = receipt.logs.find((log) => {
      return log.topics[0]?.toLowerCase() === eventSignatureHash.toLowerCase() && log.topics.length >= 2
    })

    if (marketCreatedEvent && marketCreatedEvent.topics[1]) {
      return marketCreatedEvent.topics[1] as `0x${string}`
    }

    // Try reading events using getLogs
    try {
      const events = await publicClient.getLogs({
        address: receipt.to as Address,
        event: {
          type: 'event',
          name: 'MarketCreated',
          inputs: [
            { name: 'marketId', type: 'bytes32', indexed: true },
            { name: 'question', type: 'string', indexed: false },
            { name: 'numOutcomes', type: 'uint8', indexed: false },
            { name: 'liquidity', type: 'uint256', indexed: false },
          ],
        },
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      })
      
      const firstEvent = events[0]
      if (firstEvent?.args.marketId) {
        return firstEvent.args.marketId as `0x${string}`
      }
    } catch (error) {
      logger.debug('Could not read events using getLogs', { error }, 'OnChainMarketService')
    }

    return null
  } catch (error) {
    logger.error('Failed to get market ID from transaction', { error, txHash }, 'OnChainMarketService')
    return null
  }
}

/**
 * Ensure a market exists on-chain and update the database with onChainMarketId
 * This is idempotent - if the market already has an onChainMarketId, it won't create again
 */
export async function ensureMarketOnChain(marketId: string): Promise<boolean> {
  try {
    const market = await prisma.market.findUnique({
      where: { id: marketId },
    })

    if (!market) {
      logger.warn('Market not found', { marketId }, 'OnChainMarketService')
      return false
    }

    // If already has onChainMarketId, skip
    if (market.onChainMarketId) {
      logger.debug('Market already has onChainMarketId', { marketId, onChainMarketId: market.onChainMarketId }, 'OnChainMarketService')
      return true
    }

    // Create market on-chain
    const onChainMarketId = await createMarketOnChain(
      market.question,
      market.endDate,
      market.oracleAddress as Address | undefined
    )

    if (onChainMarketId) {
      // Update database with onChainMarketId
      // Get oracle address from deployer private key if not set
      let oracleAddr: string | null = market.oracleAddress
      if (!oracleAddr && process.env.DEPLOYER_PRIVATE_KEY) {
        const { privateKeyToAccount } = await import('viem/accounts')
        oracleAddr = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`).address
      }

      await prisma.market.update({
        where: { id: marketId },
        data: {
          onChainMarketId,
          oracleAddress: oracleAddr,
        },
      })

      logger.info(
        'Market linked to on-chain market',
        { marketId, onChainMarketId },
        'OnChainMarketService'
      )
      return true
    } else {
      logger.warn('Failed to create market on-chain', { marketId }, 'OnChainMarketService')
      return false
    }
  } catch (error) {
    logger.error('Failed to ensure market on-chain', { error, marketId }, 'OnChainMarketService')
    return false
  }
}

