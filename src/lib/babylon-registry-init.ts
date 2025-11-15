/**
 * Babylon Game Registration
 * 
 * Registers Babylon as a discoverable entity in ERC-8004 + Agent0 registry.
 * Called on server startup to ensure Babylon is discoverable by agents.
 */

import { getAgent0Client } from '@/agents/agent0/Agent0Client'
import type { AgentMetadata } from '@/agents/agent0/IPFSPublisher'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'
import type { JsonValue } from '@/types/common'

export interface BabylonRegistrationResult {
  tokenId: number
  metadataCID: string
  registeredAt: string
}

/**
 * Register Babylon game in ERC-8004 + Agent0 registry
 */
export async function registerBabylonGame(): Promise<BabylonRegistrationResult | null> {
  if (process.env.BABYLON_REGISTRY_REGISTERED === 'true') {
    logger.info('Babylon already registered, skipping registration...', undefined, 'BabylonRegistry')
    
    const config = await prisma.gameConfig.findUnique({
      where: { key: 'agent0_registration' }
    })
    
    if (config?.value) {
      const value = config.value as Record<string, JsonValue>
      return {
        tokenId: Number(value.tokenId),
        metadataCID: String(value.metadataCID || ''),
        registeredAt: String(value.registeredAt || new Date().toISOString())
      }
    }
    
    return null
  }
  
  if (process.env.AGENT0_ENABLED !== 'true') {
    logger.info('Agent0 integration disabled, skipping Babylon registration', undefined, 'BabylonRegistry')
    return null
  }
  
  const gameWalletAddress = process.env.BABYLON_GAME_WALLET_ADDRESS
  const gamePrivateKey = process.env.BABYLON_GAME_PRIVATE_KEY
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000'
  
  if (!gameWalletAddress || !gamePrivateKey) {
    logger.warn(
      'BABYLON_GAME_WALLET_ADDRESS or BABYLON_GAME_PRIVATE_KEY not configured, skipping registration',
      undefined,
      'BabylonRegistry'
    )
    return null
  }
  
  const babylonCard: AgentMetadata = {
      name: 'Babylon Prediction Markets',
      type: 'game-platform',
      description: 'Real-time prediction market game with autonomous AI agents',
      version: '1.0.0',
      
      endpoints: {
        a2a: process.env.NEXT_PUBLIC_A2A_ENDPOINT || `${apiBaseUrl.replace('http', 'ws')}/ws/a2a`,
        mcp: process.env.NEXT_PUBLIC_MCP_ENDPOINT || `${apiBaseUrl}/mcp`,
        api: `${apiBaseUrl}/api`,
        docs: `${apiBaseUrl}/docs`,
        websocket: `${apiBaseUrl}/ws`
      },
      
      capabilities: {
        strategies: [],
        markets: ['prediction', 'perpetuals'],
        actions: [
          // Market Operations
          'query_markets',
          'get_market_data',
          'place_bet',
          'buy_prediction',
          'sell_prediction',
          'close_position',
          'get_balance',
          'get_positions',
          'open_perp_position',
          'close_perp_position',
          // Social Features
          'create_post',
          'reply_post',
          'like_post',
          'share_post',
          'comment_post',
          'follow_user',
          'unfollow_user',
          'get_followers',
          'get_following',
          // Discovery & Search
          'search_users',
          'get_user_profile',
          'query_feed',
          'join_chat',
          // Referrals & Rewards
          'get_referral_code',
          'get_referrals'
        ],
        protocols: ['a2a', 'mcp', 'rest'],
        socialFeatures: true,
        realtime: true,
        authentication: ['privy', 'agent-secret', 'wallet-signature']
      },
      
      metadata: {
        network: process.env.AGENT0_NETWORK || 'sepolia',
        startingBalance: 1000,
        categories: ['crypto', 'politics', 'sports', 'tech', 'entertainment'],
        updateFrequency: '60s',
        maxLeverage: 100
      },
      
      mcp: {
        tools: [
          // Market Operations
          {
            name: 'get_markets',
            description: 'Get all active prediction and perpetual markets',
            inputSchema: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['prediction', 'perpetuals', 'all'],
                  description: 'Market type to filter'
                }
              }
            }
          },
          {
            name: 'buy_prediction',
            description: 'Buy shares in a prediction market',
            inputSchema: {
              type: 'object',
              properties: {
                marketId: { type: 'string', description: 'Prediction market ID' },
                amount: { type: 'number', description: 'Amount to spend' }
              },
              required: ['marketId', 'amount']
            }
          },
          {
            name: 'sell_prediction',
            description: 'Sell shares in a prediction market',
            inputSchema: {
              type: 'object',
              properties: {
                marketId: { type: 'string', description: 'Prediction market ID' },
                amount: { type: 'number', description: 'Amount of shares to sell' }
              },
              required: ['marketId', 'amount']
            }
          },
          {
            name: 'open_perp_position',
            description: 'Open a perpetual market position',
            inputSchema: {
              type: 'object',
              properties: {
                ticker: { type: 'string', description: 'Perpetual market ticker' },
                side: { type: 'string', enum: ['long', 'short'], description: 'Position side' },
                amount: { type: 'number', description: 'Position size' },
                leverage: { type: 'number', description: 'Leverage multiplier' }
              },
              required: ['ticker', 'side', 'amount']
            }
          },
          {
            name: 'close_perp_position',
            description: 'Close a perpetual market position',
            inputSchema: {
              type: 'object',
              properties: {
                positionId: { type: 'string', description: 'Position ID to close' }
              },
              required: ['positionId']
            }
          },
          {
            name: 'get_balance',
            description: "Get current balance, P&L, and portfolio statistics",
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_positions',
            description: 'Get all open positions across markets',
            inputSchema: {
              type: 'object',
              properties: {
                marketType: { type: 'string', enum: ['prediction', 'perpetuals', 'all'] }
              }
            }
          },
          // Social Features
          {
            name: 'create_post',
            description: 'Create a new post or prediction',
            inputSchema: {
              type: 'object',
              properties: {
                content: { type: 'string', description: 'Post content' },
                prediction: { type: 'object', description: 'Optional prediction data' }
              },
              required: ['content']
            }
          },
          {
            name: 'reply_post',
            description: 'Reply to an existing post',
            inputSchema: {
              type: 'object',
              properties: {
                postId: { type: 'string', description: 'Post ID to reply to' },
                content: { type: 'string', description: 'Reply content' }
              },
              required: ['postId', 'content']
            }
          },
          {
            name: 'like_post',
            description: 'Like or unlike a post',
            inputSchema: {
              type: 'object',
              properties: {
                postId: { type: 'string', description: 'Post ID to like' }
              },
              required: ['postId']
            }
          },
          {
            name: 'share_post',
            description: 'Share a post',
            inputSchema: {
              type: 'object',
              properties: {
                postId: { type: 'string', description: 'Post ID to share' },
                comment: { type: 'string', description: 'Optional comment' }
              },
              required: ['postId']
            }
          },
          {
            name: 'comment_post',
            description: 'Add a comment to a post',
            inputSchema: {
              type: 'object',
              properties: {
                postId: { type: 'string', description: 'Post ID' },
                content: { type: 'string', description: 'Comment content' }
              },
              required: ['postId', 'content']
            }
          },
          {
            name: 'follow_user',
            description: 'Follow another user',
            inputSchema: {
              type: 'object',
              properties: {
                userId: { type: 'string', description: 'User ID to follow' }
              },
              required: ['userId']
            }
          },
          {
            name: 'get_followers',
            description: 'Get list of followers',
            inputSchema: {
              type: 'object',
              properties: {
                userId: { type: 'string', description: 'User ID (optional, defaults to self)' }
              }
            }
          },
          {
            name: 'get_following',
            description: 'Get list of users being followed',
            inputSchema: {
              type: 'object',
              properties: {
                userId: { type: 'string', description: 'User ID (optional, defaults to self)' }
              }
            }
          },
          // Discovery & Search
          {
            name: 'search_users',
            description: 'Search for users by username',
            inputSchema: {
              type: 'object',
              properties: {
                username: { type: 'string', description: 'Username to search' }
              },
              required: ['username']
            }
          },
          {
            name: 'get_user_profile',
            description: 'Get detailed user profile',
            inputSchema: {
              type: 'object',
              properties: {
                userId: { type: 'string', description: 'User ID' }
              },
              required: ['userId']
            }
          },
          {
            name: 'query_feed',
            description: 'Get personalized feed of posts and predictions',
            inputSchema: {
              type: 'object',
              properties: {
                feedType: { type: 'string', enum: ['all', 'following', 'favorites'] }
              }
            }
          },
          {
            name: 'join_chat',
            description: 'Join a chat room or DM',
            inputSchema: {
              type: 'object',
              properties: {
                chatId: { type: 'string', description: 'Chat ID or user ID for DM' }
              },
              required: ['chatId']
            }
          },
          // Referrals & Rewards
          {
            name: 'get_referral_code',
            description: 'Get user referral code',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_referrals',
            description: 'Get list of referred users',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      }
    }

    // 2. Register with Agent0 SDK (which handles IPFS publishing internally)
    logger.info('Registering Babylon with Agent0 SDK on Ethereum Sepolia...', undefined, 'BabylonRegistry')
    logger.info('Game operates on Base network with cross-chain discovery via agent0', undefined, 'BabylonRegistry')

    // Use Ethereum Sepolia RPC (where agent0 contracts are deployed)
    // const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'

    // Configure IPFS - use Pinata if available, otherwise use public IPFS node
    // const ipfsConfig = process.env.PINATA_JWT
    //   ? { ipfsProvider: 'pinata' as const, pinataJwt: process.env.PINATA_JWT }
    //   : { ipfsProvider: 'node' as const, ipfsNodeUrl: process.env.IPFS_NODE_URL || 'https://ipfs.io' }

    const agent0Client = getAgent0Client()

    // Register Babylon directly with registerAgent to provide full metadata payload
    // - Game metadata and capabilities
    // - MCP and A2A endpoint configuration
    // - Cross-chain network info (points to Base where game operates)
    let result: { tokenId: number; txHash: string; metadataCID?: string }

    try {
      result = await agent0Client.registerAgent({
        name: babylonCard.name,
        description: babylonCard.description,
        walletAddress: gameWalletAddress,
        mcpEndpoint: babylonCard.endpoints.mcp,
        a2aEndpoint: babylonCard.endpoints.a2a,
        capabilities: {
          strategies: babylonCard.capabilities.strategies || [],
          markets: babylonCard.capabilities.markets,
          actions: babylonCard.capabilities.actions,
          version: '1.0.0',
          x402Support: true // Babylon supports ERC-402 micropayments for premium actions
        }
      })

      logger.info('✅ Babylon registered on agent0 (Ethereum Sepolia)', undefined, 'BabylonRegistry')
      logger.info(`   Discovery: External agents can find Babylon via agent0`, undefined, 'BabylonRegistry')
      logger.info(`   Game Network: Base ${process.env.BASE_CHAIN_ID || '8453'}`, undefined, 'BabylonRegistry')
      logger.info(`   Registry: ${process.env.BASE_IDENTITY_REGISTRY_ADDRESS}`, undefined, 'BabylonRegistry')
    } catch (error) {
      // If Agent0 SDK is not available, registration failed
      logger.error(
        'Agent0 SDK registration failed. Check SDK installation and configuration.',
        error,
        'BabylonRegistry'
      )
      throw error
    }

  const metadataCID = result.metadataCID || ''
  
  logger.info(`✅ Babylon registered in Agent0 registry!`, undefined, 'BabylonRegistry')
  logger.info(`   Token ID: ${result.tokenId}`, undefined, 'BabylonRegistry')
  logger.info(`   Metadata CID: ${metadataCID}`, undefined, 'BabylonRegistry')

  await prisma.gameConfig.upsert({
    where: { key: 'agent0_registration' },
    create: {
      id: await generateSnowflakeId(),
      key: 'agent0_registration',
      value: {
        registered: true,
        tokenId: result.tokenId,
        metadataCID,
        txHash: result.txHash,
        registeredAt: new Date().toISOString()
      },
      updatedAt: new Date()
    },
    update: {
      value: {
        registered: true,
        tokenId: result.tokenId,
        metadataCID,
        txHash: result.txHash,
        registeredAt: new Date().toISOString()
      }
    }
  })
  
  return {
    tokenId: result.tokenId,
    metadataCID,
    registeredAt: new Date().toISOString()
  }
}
