import { Prisma } from '@prisma/client'
import { createWalletClient, createPublicClient, http, parseEther, decodeEventLog, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import { BusinessLogicError, ValidationError, InternalServerError, ConflictError } from '@/lib/errors'
import { PointsService } from '@/lib/services/points-service'
import { notifyNewAccount } from '@/lib/services/notification-service'
import { Agent0Client } from '@/agents/agent0/Agent0Client'
import type { AgentCapabilities } from '@/a2a/types'
import type { AuthenticatedUser } from '@/lib/api/auth-middleware'
import { extractErrorMessage } from '@/lib/api/auth-middleware'
import { syncAfterAgent0Registration } from '@/lib/reputation/agent0-reputation-sync'

// Use Base Sepolia for contract deployments (chain ID: 84532)
export const IDENTITY_REGISTRY = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_BASE_SEPOLIA as Address
export const REPUTATION_SYSTEM = process.env.NEXT_PUBLIC_REPUTATION_SYSTEM_BASE_SEPOLIA as Address
export const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`

const IDENTITY_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'registerAgent',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'capabilitiesHash', type: 'bytes32' },
      { name: 'metadataURI', type: 'string' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isRegistered',
    inputs: [{ name: '_address', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTokenId',
    inputs: [{ name: '_address', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AgentRegistered',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'endpoint', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentUpdated',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'endpoint', type: 'string', indexed: false },
      { name: 'capabilitiesHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'getAgentProfile',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'endpoint', type: 'string' },
      { name: 'capabilitiesHash', type: 'bytes32' },
      { name: 'name', type: 'string' },
      { name: 'registered', type: 'uint256' },
      { name: 'metadataURI', type: 'string' },
    ],
    stateMutability: 'view',
  },
] as const

const REPUTATION_SYSTEM_ABI = [
  {
    type: 'function',
    name: 'recordBet',
    inputs: [
      { name: '_tokenId', type: 'uint256' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recordWin',
    inputs: [
      { name: '_tokenId', type: 'uint256' },
      { name: '_profit', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

export interface OnchainRegistrationInput {
  user: AuthenticatedUser
  walletAddress?: string | null
  username?: string | null
  displayName?: string | null
  bio?: string | null
  profileImageUrl?: string | null
  coverImageUrl?: string | null
  endpoint?: string | null
  referralCode?: string | null
  txHash?: string | null
}

export interface OnchainRegistrationResult {
  message: string
  tokenId?: number
  txHash?: string
  pointsAwarded?: number
  alreadyRegistered: boolean
  userId: string
}

export async function processOnchainRegistration({
  user,
  walletAddress,
  username,
  displayName,
  bio,
  profileImageUrl,
  coverImageUrl,
  endpoint,
  referralCode,
  txHash,
}: OnchainRegistrationInput): Promise<OnchainRegistrationResult> {
  if (!user.isAgent && !walletAddress) {
    throw new BusinessLogicError('Wallet address is required for non-agent users', 'WALLET_REQUIRED')
  }

  const finalUsername = username || `user_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36).substring(2, 6)}`

  if (walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw new ValidationError('Invalid wallet address format', ['walletAddress'], [{ field: 'walletAddress', message: 'Must be a valid Ethereum address (0x...)' }])
  }

  let submittedTxHash: `0x${string}` | undefined
  if (txHash) {
    if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      throw new ValidationError('Invalid transaction hash format', ['txHash'], [
        { field: 'txHash', message: 'Must be a 0x-prefixed 64 character hash' },
      ])
    }
    submittedTxHash = txHash as `0x${string}`
  }

  let referrerId: string | null = null
  if (referralCode) {
    const referrer = await prisma.user.findUnique({
      where: { username: referralCode },
      select: { id: true },
    })

    if (referrer) {
      referrerId = referrer.id
      logger.info('Valid referral code (username) found', { referralCode, referrerId }, 'OnboardingOnchain')
    } else {
      const referral = await prisma.referral.findUnique({
        where: { referralCode },
        include: { referrer: true },
      })

      if (referral && referral.status === 'pending') {
        referrerId = referral.referrerId
        logger.info('Valid referral code (legacy) found', { referralCode, referrerId }, 'OnboardingOnchain')
      }
    }
  }

  let dbUser: {
    id: string
    username: string | null
    walletAddress: string | null
    onChainRegistered: boolean
    nftTokenId: number | null
    referredBy: string | null
  } | null = null

  if (user.isAgent) {
    dbUser = await prisma.user.findUnique({
      where: { username: user.userId },
      select: {
        id: true,
        username: true,
        walletAddress: true,
        onChainRegistered: true,
        nftTokenId: true,
        referredBy: true,
      },
    })

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          privyId: user.userId,
          username: user.userId,
          displayName: displayName || username || user.userId,
          bio: bio || `Autonomous AI agent: ${user.userId}`,
          profileImageUrl: profileImageUrl || null,
          coverImageUrl: coverImageUrl || null,
          isActor: false,
          virtualBalance: 10000,
          totalDeposited: 10000,
        },
        select: {
          id: true,
          username: true,
          walletAddress: true,
          onChainRegistered: true,
          nftTokenId: true,
          referredBy: true,
        },
      })
    }
  } else {
    dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        username: true,
        walletAddress: true,
        onChainRegistered: true,
        nftTokenId: true,
        referredBy: true,
      },
    })

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          id: user.userId,
          privyId: user.privyId ?? user.userId,
          walletAddress: walletAddress?.toLowerCase() ?? null,
          username: finalUsername,
          displayName: displayName || finalUsername,
          bio: bio || '',
          profileImageUrl: profileImageUrl || null,
          coverImageUrl: coverImageUrl || null,
          isActor: false,
          virtualBalance: 0,
          totalDeposited: 0,
          referredBy: referrerId,
        },
        select: {
          id: true,
          username: true,
          walletAddress: true,
          onChainRegistered: true,
          nftTokenId: true,
          referredBy: true,
        },
      })
    } else {
      const fullUser = await prisma.user.findUnique({ where: { id: dbUser.id } })
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          walletAddress: walletAddress?.toLowerCase() ?? dbUser.walletAddress,
          username: finalUsername || dbUser.username,
          displayName: displayName || finalUsername || fullUser?.displayName,
          bio: bio || fullUser?.bio,
          profileImageUrl: profileImageUrl ?? fullUser?.profileImageUrl,
          coverImageUrl: coverImageUrl ?? fullUser?.coverImageUrl,
          referredBy: referrerId ?? dbUser.referredBy ?? undefined,
        },
        select: {
          id: true,
          username: true,
          walletAddress: true,
          onChainRegistered: true,
          nftTokenId: true,
          referredBy: true,
        },
      })
    }
  }

  if (!dbUser) {
    throw new InternalServerError('Failed to create or retrieve user record')
  }

  if (!referrerId && dbUser.referredBy) {
    referrerId = dbUser.referredBy
  }

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
  })

  let isRegistered = false
  let tokenId: number | null = dbUser.nftTokenId

  if (user.isAgent) {
    isRegistered = dbUser.onChainRegistered && dbUser.nftTokenId !== null
  } else {
    const address = walletAddress! as Address

    // Try to check onchain status, but gracefully handle contract unavailability
    try {
      isRegistered = await publicClient.readContract({
        address: IDENTITY_REGISTRY,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'isRegistered',
        args: [address],
      })

      if (isRegistered && !tokenId) {
        tokenId = Number(await publicClient.readContract({
          address: IDENTITY_REGISTRY,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: 'getTokenId',
          args: [address],
        }))
      }
    } catch (contractError) {
      // Contract not available or not deployed - fall back to database state
      logger.warn('Unable to check onchain registration status, using database state', {
        error: extractErrorMessage(contractError),
        address,
        IDENTITY_REGISTRY
      }, 'OnboardingOnchain')
      isRegistered = dbUser.onChainRegistered && dbUser.nftTokenId !== null
    }
  }

  if (isRegistered && tokenId) {
    // User is already registered on-chain, sync the DB if needed
    if (!dbUser.onChainRegistered || dbUser.nftTokenId !== tokenId) {
      try {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            onChainRegistered: true,
            nftTokenId: tokenId,
          },
        })
        logger.info(
          'Synced on-chain registration status to database',
          { userId: dbUser.id, tokenId, wasRegistered: dbUser.onChainRegistered },
          'processOnchainRegistration'
        )
      } catch (updateError) {
        // If update fails due to unique constraint on nftTokenId, another user might have this tokenId
        // This shouldn't happen in normal flow, but handle it gracefully
        logger.warn(
          'Failed to sync nftTokenId - may already be assigned to another user',
          { userId: dbUser.id, tokenId, error: updateError },
          'processOnchainRegistration'
        )
        // Still return success since the user IS registered on-chain
      }
    }

    const hasWelcomeBonus = await prisma.balanceTransaction.findFirst({
      where: {
        userId: dbUser.id,
        description: 'Welcome bonus - initial signup',
      },
    })

    logger.info(
      'User already registered on-chain, returning existing registration',
      { userId: dbUser.id, tokenId, alreadyRegistered: true },
      'processOnchainRegistration'
    )

    return {
      message: 'Already registered on-chain',
      tokenId,
      alreadyRegistered: true,
      userId: dbUser.id,
      pointsAwarded: hasWelcomeBonus ? 1000 : 0,
    }
  }

  // Validate deployer private key format
  const deployerConfigured = Boolean(DEPLOYER_PRIVATE_KEY) &&
    typeof DEPLOYER_PRIVATE_KEY === 'string' &&
    /^0x[0-9a-fA-F]{64}$/.test(DEPLOYER_PRIVATE_KEY)

  let deployerAccount = null
  let walletClient = null

  if (deployerConfigured) {
    try {
      deployerAccount = privateKeyToAccount(DEPLOYER_PRIVATE_KEY!)
      walletClient = createWalletClient({
        account: deployerAccount,
        chain: baseSepolia,
        transport: http(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
      })
    } catch (keyError) {
      logger.error('Invalid deployer private key format', { error: extractErrorMessage(keyError) }, 'OnboardingOnchain')
    }
  }

  if (!submittedTxHash && !deployerConfigured) {
    throw new InternalServerError('Server wallet not configured for gas payments', { missing: 'DEPLOYER_PRIVATE_KEY' })
  }

  const name = username || (user.isAgent ? user.userId : finalUsername)
  let registrationAddress: Address
  let agentEndpoint: string

  if (user.isAgent) {
    if (!deployerAccount) {
      throw new InternalServerError('Server wallet required for agent registration', { missing: 'DEPLOYER_PRIVATE_KEY' })
    }
    registrationAddress = deployerAccount.address
    const baseEndpoint = endpoint || `https://babylon.game/agent/${user.userId}`
    agentEndpoint = `${baseEndpoint}?agentId=${user.userId}`
  } else {
    registrationAddress = walletAddress! as Address
    agentEndpoint = endpoint || `https://babylon.game/agent/${walletAddress!.toLowerCase()}`
  }

  const capabilitiesHash = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`
  const metadataURI = JSON.stringify({
    name,
    bio: bio || '',
    type: user.isAgent ? 'elizaos-agent' : 'user',
    registered: new Date().toISOString(),
  })

  logger.info(
    'Registering on-chain',
    { isAgent: user.isAgent, address: registrationAddress, name, endpoint: agentEndpoint },
    'OnboardingOnchain'
  )

  let registrationTxHash: `0x${string}` | undefined = submittedTxHash
  let receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>> | null = null

  if (submittedTxHash) {
    logger.info(
      'Validating submitted registration transaction',
      { txHash: submittedTxHash },
      'OnboardingOnchain'
    )

    receipt = await publicClient.waitForTransactionReceipt({
      hash: submittedTxHash,
      confirmations: 1,
    })

    if (receipt.status !== 'success') {
      throw new BusinessLogicError(
        'Submitted blockchain registration transaction failed',
        'REGISTRATION_TX_FAILED',
        { txHash: submittedTxHash, receipt: receipt.status }
      )
    }
  } else if (walletClient) {
    try {
      registrationTxHash = await walletClient.writeContract({
        address: IDENTITY_REGISTRY,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'registerAgent',
        args: [name, agentEndpoint, capabilitiesHash, metadataURI],
      })
    } catch (registrationError) {
      const message = extractErrorMessage(registrationError).toLowerCase()
      if (message.includes('already registered')) {
        try {
          const onChainStatus = await publicClient.readContract({
            address: IDENTITY_REGISTRY,
            abi: IDENTITY_REGISTRY_ABI,
            functionName: 'isRegistered',
            args: [registrationAddress],
          })

          if (onChainStatus) {
            const tokenOnChain = Number(
              await publicClient.readContract({
                address: IDENTITY_REGISTRY,
                abi: IDENTITY_REGISTRY_ABI,
                functionName: 'getTokenId',
                args: [registrationAddress],
              })
            )

          await prisma.user.update({
            where: { id: dbUser.id },
            data: {
              onChainRegistered: true,
              nftTokenId: tokenOnChain,
            },
          })

          const hasWelcomeBonus = await prisma.balanceTransaction.findFirst({
            where: {
              userId: dbUser.id,
              description: 'Welcome bonus - initial signup',
            },
          })

          logger.info(
            'Detected prior registration for wallet during server signer attempt',
            { address: registrationAddress, tokenId: tokenOnChain },
            'OnboardingOnchain'
          )

          return {
            message: 'Already registered on-chain',
            tokenId: tokenOnChain,
            alreadyRegistered: true,
            userId: dbUser.id,
            pointsAwarded: hasWelcomeBonus ? 1000 : 0,
          }
        }
        } catch (contractCheckError) {
          logger.warn(
            'Unable to verify onchain registration status, falling back to server signer unsupported error',
            { error: extractErrorMessage(contractCheckError) },
            'OnboardingOnchain'
          )
        }

        logger.warn(
          'Server signer rejected registration due to existing owner',
          { signer: deployerAccount?.address, registrationAddress },
          'OnboardingOnchain'
        )
        throw new BusinessLogicError('SERVER_SIGNER_UNSUPPORTED', 'SERVER_SIGNER_UNSUPPORTED')
      }

      throw registrationError
    }

    logger.info('Registration transaction sent', { txHash: registrationTxHash }, 'OnboardingOnchain')

    receipt = await publicClient.waitForTransactionReceipt({
      hash: registrationTxHash,
      confirmations: 2,
    })

    if (receipt.status !== 'success') {
      throw new BusinessLogicError('Blockchain registration transaction failed', 'REGISTRATION_TX_FAILED', {
        txHash: registrationTxHash,
        receipt: receipt.status,
      })
    }
  } else {
    throw new InternalServerError('Unable to determine registration transaction result', {
      hasSubmittedTx: Boolean(submittedTxHash),
      deployerConfigured,
    })
  }

  const finalizedReceipt = receipt
  if (!finalizedReceipt) {
    throw new InternalServerError('Registration transaction receipt missing after processing')
  }

  // Filter logs by contract address first to avoid decoding errors on Transfer events
  const contractLogs = finalizedReceipt.logs.filter(log =>
    log.address.toLowerCase() === IDENTITY_REGISTRY.toLowerCase()
  )

  const agentRegisteredLog = contractLogs.find((log) => {
    try {
      const decodedLog = decodeEventLog({ abi: IDENTITY_REGISTRY_ABI, data: log.data, topics: log.topics })
      return decodedLog.eventName === 'AgentRegistered'
    } catch {
      return false
    }
  })

  if (!agentRegisteredLog) {
    throw new InternalServerError('AgentRegistered event not found in receipt', {
      txHash: registrationTxHash ?? submittedTxHash,
    })
  }

  const decodedLog = decodeEventLog({
    abi: IDENTITY_REGISTRY_ABI,
    data: agentRegisteredLog.data,
    topics: agentRegisteredLog.topics,
  })

  tokenId = Number(decodedLog.args.tokenId)
  logger.info('Registered with token ID', { tokenId }, 'OnboardingOnchain')
  if (walletClient) {
    logger.info('Setting initial reputation to 70...', undefined, 'OnboardingOnchain')

    for (let i = 0; i < 10; i++) {
      await walletClient.writeContract({
        address: REPUTATION_SYSTEM,
        abi: REPUTATION_SYSTEM_ABI,
        functionName: 'recordBet',
        args: [BigInt(tokenId), parseEther('100')],
      })
    }

    for (let i = 0; i < 7; i++) {
      const winTxHash = await walletClient.writeContract({
        address: REPUTATION_SYSTEM,
        abi: REPUTATION_SYSTEM_ABI,
        functionName: 'recordWin',
        args: [BigInt(tokenId), parseEther('100')],
      })
      await publicClient.waitForTransactionReceipt({ hash: winTxHash, confirmations: 1 })
    }

    logger.info('Initial reputation set to 70 (7 wins out of 10 bets)', undefined, 'OnboardingOnchain')
  } else {
    logger.warn(
      'Skipping reputation bootstrap because deployer wallet is not configured',
      { userId: dbUser.id },
      'OnboardingOnchain'
    )
  }

  try {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        onChainRegistered: true,
        nftTokenId: tokenId,
        registrationTxHash: registrationTxHash ?? submittedTxHash ?? null,
        // Store registration blockchain metadata
        registrationBlockNumber: finalizedReceipt.blockNumber,
        registrationGasUsed: finalizedReceipt.gasUsed,
        registrationTimestamp: new Date(),
        username: user.isAgent ? user.userId : (username || dbUser.username),
        displayName: displayName || username || dbUser.username || user.userId,
        bio: bio || (user.isAgent ? `Autonomous AI agent: ${user.userId}` : undefined) || dbUser.username || null,
        profileImageUrl: profileImageUrl ?? undefined,
        coverImageUrl: coverImageUrl ?? undefined,
      },
    })
  } catch (dbError) {
    // Check if this is a duplicate nftTokenId error
    if (dbError && typeof dbError === 'object' && 'code' in dbError) {
      const prismaError = dbError as { code?: string; meta?: { target?: string[] } }
      if (prismaError.code === 'P2002' && prismaError.meta?.target?.includes('nftTokenId')) {
        // This user was already registered with this tokenId, likely a race condition
        logger.warn(
          'User registration completed but nftTokenId already exists in database',
          { userId: dbUser.id, tokenId, existingNftTokenId: dbUser.nftTokenId },
          'processOnchainRegistration'
        )
        // Verify the existing tokenId matches
        const existingUser = await prisma.user.findUnique({
          where: { id: dbUser.id },
          select: { nftTokenId: true, onChainRegistered: true },
        })
        if (existingUser?.nftTokenId === tokenId) {
          // Same tokenId, this is fine - the user is already registered
          logger.info('User already has this nftTokenId, continuing', { userId: dbUser.id, tokenId }, 'processOnchainRegistration')
        } else {
          // Different tokenId is assigned to another user - this is a serious error
          throw new ConflictError(
            'This NFT token ID is already assigned to another user. Please contact support.',
            'nftTokenId'
          )
        }
      } else {
        throw dbError
      }
    } else {
      throw dbError
    }
  }

  if (user.isAgent) {
    const agent0Client = new Agent0Client({
      network: (process.env.AGENT0_NETWORK as 'sepolia' | 'mainnet') || 'sepolia',
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_RPC_URL || '',
      privateKey: DEPLOYER_PRIVATE_KEY,
    })

    const agent0Result = await agent0Client.registerAgent({
      name: username || dbUser.username || user.userId,
      description: bio || `Autonomous AI agent: ${user.userId}`,
      imageUrl: profileImageUrl ?? undefined,
      walletAddress: registrationAddress,
      a2aEndpoint: agentEndpoint,
      capabilities: {
        strategies: ['momentum'],
        markets: ['prediction'],
        actions: ['analyze'],
        version: '1.0.0',
      } as AgentCapabilities,
    })

    // Store Agent0 registration metadata
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        agent0TokenId: agent0Result.tokenId,
        agent0MetadataCID: agent0Result.metadataCID ?? null,
        agent0RegisteredAt: new Date(),
      },
    })

    logger.info('Agent registered with Agent0', {
      agentId: user.userId,
      agent0TokenId: agent0Result.tokenId,
      metadataCID: agent0Result.metadataCID
    }, 'OnboardingOnchain')

    // Sync on-chain reputation to local database
    try {
      await syncAfterAgent0Registration(dbUser.id, agent0Result.tokenId)
      logger.info('Agent0 reputation synced successfully', {
        userId: dbUser.id,
        agent0TokenId: agent0Result.tokenId
      }, 'OnboardingOnchain')
    } catch (syncError) {
      // Log error but don't fail registration
      logger.error('Failed to sync Agent0 reputation after registration', {
        userId: dbUser.id,
        agent0TokenId: agent0Result.tokenId,
        error: syncError
      }, 'OnboardingOnchain')
    }
  }

  const userWithBalance = await prisma.user.findUnique({
    where: { id: dbUser.id },
    select: { virtualBalance: true },
  })

  const balanceBefore = userWithBalance?.virtualBalance ?? new Prisma.Decimal(0)
  const amountDecimal = new Prisma.Decimal(1000)
  const balanceAfter = balanceBefore.plus(amountDecimal)

  await prisma.balanceTransaction.create({
    data: {
      userId: dbUser.id,
      type: 'deposit',
      amount: amountDecimal,
      balanceBefore,
      balanceAfter,
      description: 'Welcome bonus - initial signup',
    },
  })

  await prisma.user.update({
    where: { id: dbUser.id },
    data: {
      virtualBalance: { increment: 1000 },
      totalDeposited: { increment: 1000 },
    },
  })

  logger.info('Successfully awarded 1,000 points to user', undefined, 'OnboardingOnchain')

  await notifyNewAccount(dbUser.id)
  logger.info('Welcome notification sent to new user', { userId: dbUser.id }, 'OnboardingOnchain')

  if (referrerId) {
    const referralResult = await PointsService.awardReferralSignup(referrerId, dbUser.id)

    if (referralCode) {
      await prisma.referral.upsert({
        where: { referralCode },
        update: {
          status: 'completed',
          referredUserId: dbUser.id,
          completedAt: new Date(),
        },
        create: {
          referrerId,
          referralCode,
          referredUserId: dbUser.id,
          status: 'completed',
          completedAt: new Date(),
        },
      })
    }

    await prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: referrerId,
          followingId: dbUser.id,
        },
      },
      update: {},
      create: {
        followerId: referrerId,
        followingId: dbUser.id,
      },
    })

    logger.info('Referrer auto-followed new user', { referrerId, referredUserId: dbUser.id }, 'OnboardingOnchain')
    logger.info('Awarded referral points', { referrerId, referredUserId: dbUser.id, points: referralResult.pointsAwarded }, 'OnboardingOnchain')
  }

  return {
    message: `Successfully registered ${user.isAgent ? 'agent' : 'user'} on-chain`,
    tokenId,
    txHash: registrationTxHash ?? submittedTxHash,
    alreadyRegistered: false,
    pointsAwarded: 1000,
    userId: dbUser.id,
  }
}

export interface OnchainRegistrationStatus {
  isRegistered: boolean
  tokenId: number | null
  walletAddress: string | null
  txHash: string | null
  dbRegistered: boolean
}

export interface ConfirmOnchainProfileUpdateInput {
  userId: string
  walletAddress: string
  txHash: `0x${string}`
}

export interface ConfirmOnchainProfileUpdateResult {
  tokenId: number
  endpoint: string
  capabilitiesHash: `0x${string}`
  metadata: Record<string, unknown> | null
}

export async function confirmOnchainProfileUpdate({
  userId,
  walletAddress,
  txHash,
}: ConfirmOnchainProfileUpdateInput): Promise<ConfirmOnchainProfileUpdateResult> {
  if (!walletAddress) {
    throw new BusinessLogicError('Wallet address required for profile update confirmation', 'WALLET_REQUIRED')
  }

  const lowerWallet = walletAddress.toLowerCase()
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
  })

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  })

  if (receipt.status !== 'success') {
    throw new BusinessLogicError(
      'Blockchain profile update transaction failed',
      'PROFILE_UPDATE_TX_FAILED',
      { txHash, userId, receipt: receipt.status }
    )
  }

  if (!receipt.from || receipt.from.toLowerCase() !== lowerWallet) {
    throw new BusinessLogicError(
      'Profile update transaction must originate from the registered wallet',
      'PROFILE_UPDATE_UNAUTHORIZED',
      { txHash, txFrom: receipt.from, walletAddress: lowerWallet }
    )
  }

  let tokenId: number | null = null
  let endpoint = ''
  let capabilitiesHash = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: IDENTITY_REGISTRY_ABI,
        data: log.data,
        topics: log.topics,
      })

      if (decoded.eventName === 'AgentUpdated') {
        tokenId = Number(decoded.args.tokenId)
        endpoint = decoded.args.endpoint
        capabilitiesHash = decoded.args.capabilitiesHash as `0x${string}`
        break
      }
    } catch {
      // Ignore logs that do not match the identity registry ABI
      continue
    }
  }

  if (!tokenId) {
    tokenId = Number(
      await publicClient.readContract({
        address: IDENTITY_REGISTRY,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'getTokenId',
        args: [walletAddress as Address],
      })
    )
  }

  if (!tokenId || Number.isNaN(tokenId)) {
    throw new InternalServerError('Unable to determine token ID from profile update transaction', { txHash })
  }

  const profile = await publicClient.readContract({
    address: IDENTITY_REGISTRY,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'getAgentProfile',
    args: [BigInt(tokenId)],
  })

  endpoint = endpoint || (profile[1] as string)
  capabilitiesHash = profile[2] as `0x${string}`
  const rawMetadata = profile[5] as string

  let metadata: Record<string, unknown> | null = null
  if (typeof rawMetadata === 'string' && rawMetadata.trim().length > 0) {
    try {
      metadata = JSON.parse(rawMetadata) as Record<string, unknown>
    } catch (error) {
      logger.warn(
        'Failed to parse on-chain metadata JSON during profile update confirmation',
        { error, userId, txHash },
        'OnboardingOnchain'
      )
      metadata = null
    }
  }

  return {
    tokenId,
    endpoint,
    capabilitiesHash,
    metadata,
  }
}

export async function getOnchainRegistrationStatus(user: AuthenticatedUser): Promise<OnchainRegistrationStatus> {
  const userRecord = user.isAgent
    ? await prisma.user.findUnique({
        where: { username: user.userId },
        select: {
          walletAddress: true,
          onChainRegistered: true,
          nftTokenId: true,
          registrationTxHash: true,
        },
      })
    : await prisma.user.findUnique({
        where: { id: user.userId },
        select: {
          walletAddress: true,
          onChainRegistered: true,
          nftTokenId: true,
          registrationTxHash: true,
        },
      })

  if (!userRecord) {
    logger.info('Registration status checked (no user record)', { userId: user.userId }, 'OnboardingOnchain')
    return {
      isRegistered: false,
      tokenId: null,
      walletAddress: null,
      txHash: null,
      dbRegistered: false,
    }
  }

  let tokenId = userRecord.nftTokenId
  let isRegistered = Boolean(userRecord.onChainRegistered && tokenId !== null)

  if (!user.isAgent && userRecord.walletAddress) {
    try {
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(process.env.NEXT_PUBLIC_RPC_URL),
      })

      const onchainRegistered = await publicClient.readContract({
        address: IDENTITY_REGISTRY,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'isRegistered',
        args: [userRecord.walletAddress as Address],
      })

      if (onchainRegistered && !tokenId) {
        const queriedTokenId = await publicClient.readContract({
          address: IDENTITY_REGISTRY,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: 'getTokenId',
          args: [userRecord.walletAddress as Address],
        })
        tokenId = Number(queriedTokenId)
      }

      isRegistered = onchainRegistered
    } catch (error) {
      logger.warn('Failed to query on-chain registration status', { userId: user.userId, error }, 'OnboardingOnchain')
    }
  }

  logger.info(
    'Registration status checked',
    { userId: user.userId, isRegistered, tokenId, dbRegistered: userRecord.onChainRegistered },
    'OnboardingOnchain'
  )

  return {
    isRegistered,
    tokenId: tokenId ?? null,
    walletAddress: userRecord.walletAddress ?? null,
    txHash: userRecord.registrationTxHash ?? null,
    dbRegistered: userRecord.onChainRegistered,
  }
}
