#!/usr/bin/env bun

/**
 * Database Seed Script
 * 
 * Seeds the database with:
 * - All actors from split JSON structure (public/data/actors/*.json)
 * - All organizations from split JSON structure (public/data/organizations/*.json)
 * - Initial game state
 * 
 * Run: bun run prisma:seed
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../src/lib/logger';
import { generateSnowflakeId } from '../src/lib/snowflake';
import { loadActorsData } from '../src/lib/data/actors-loader';

const prisma = new PrismaClient();

import type { SeedActorsDatabase } from '../src/shared/types';
import { FollowInitializer } from '../src/lib/services/FollowInitializer';
import { CapitalAllocationService } from '../src/lib/services/capital-allocation-service';

async function main() {
  logger.info('SEEDING DATABASE', undefined, 'Script');

  // Load actors data from new split structure
  const actorsData: SeedActorsDatabase = loadActorsData();

  logger.info('Loaded:', {
    actors: actorsData.actors.length,
    organizations: actorsData.organizations.length
  }, 'Script');

  // Seed actors
  logger.info('Seeding actors...', undefined, 'Script');
  let poolActorsCount = 0;
  
  // Create actors individually (Prisma Accelerate limitation with array fields)
  for (const actor of actorsData.actors) {
    const hasPool = actor.hasPool === true;
    const imagePath = join(process.cwd(), 'public', 'images', 'actors', `${actor.id}.jpg`);
    const profileImageUrl = existsSync(imagePath) ? `/images/actors/${actor.id}.jpg` : null;
    
    if (hasPool) poolActorsCount++;
    
    await prisma.actor.create({
      data: {
        id: actor.id,
        name: actor.name,
        description: actor.description || null,
        domain: actor.domain || [],
        personality: actor.personality || null,
        tier: actor.tier || null,
        affiliations: actor.affiliations || [],
        postStyle: actor.postStyle || null,
        postExample: actor.postExample || [],
        hasPool: hasPool,
        tradingBalance: hasPool ? new Prisma.Decimal(10000) : new Prisma.Decimal(0),
        reputationPoints: hasPool ? 10000 : 0,
        profileImageUrl: profileImageUrl,
        updatedAt: new Date(),
      },
    }).catch((error: unknown) => {
      // Skip if actor already exists (P2002 = unique constraint violation)
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        return; // Skip duplicate
      }
      throw error;
    });
  }
  
  logger.info(`Seeded ${actorsData.actors.length} actors (${poolActorsCount} with trading pools)`, undefined, 'Script');

  // Seed organizations
  logger.info('Seeding organizations...', undefined, 'Script');
  
  let orgCount = 0;
  for (const org of actorsData.organizations) {
    // Skip if missing required fields
    if (!org.id || !org.name || !org.type) {
      logger.warn(`Skipping org "${org.id || 'unknown'}" - missing required fields`, undefined, 'Script');
      continue;
    }
    
    // Check if organization image exists
    const orgImagePath = join(process.cwd(), 'public', 'images', 'organizations', `${org.id}.jpg`);
    const imageUrl = existsSync(orgImagePath) ? `/images/organizations/${org.id}.jpg` : null;
    
    await prisma.organization.create({
      data: {
        id: org.id,
        name: org.name,
        description: org.description || '',
        type: org.type,
        canBeInvolved: org.canBeInvolved !== false,
        initialPrice: org.initialPrice || null,
        currentPrice: org.initialPrice || null,
        imageUrl: imageUrl,
        updatedAt: new Date(),
      },
    }).catch((error: unknown) => {
      // Skip if organization already exists (P2002 = unique constraint violation)
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        return; // Skip duplicate
      }
      throw error;
    });
    orgCount++;
  }
  
  logger.info(`Seeded ${orgCount} organizations`, undefined, 'Script');

  // Initialize game state
  logger.info('Initializing game state...', undefined, 'Script');
  const existingGame = await prisma.game.findFirst({
    where: { isContinuous: true },
  });

  if (!existingGame) {
    const now = new Date();
    await prisma.game.create({
      data: {
        id: await generateSnowflakeId(),
        isContinuous: true,
        isRunning: true, // Game starts running by default
        currentDate: now,
        currentDay: 1,
        speed: 60000,
        startedAt: now, // Set startedAt timestamp
        updatedAt: now,
      },
    });
    logger.info('✅ Game state initialized (RUNNING)', undefined, 'Script');
  } else {
    // If game exists but is paused, start it
    if (!existingGame.isRunning) {
      await prisma.game.update({
        where: { id: existingGame.id },
        data: {
          isRunning: true,
          startedAt: existingGame.startedAt || new Date(),
          pausedAt: null,
        },
      });
      logger.info('✅ Game state updated to RUNNING', undefined, 'Script');
    } else {
      logger.info('✅ Game state already exists and is RUNNING', undefined, 'Script');
    }
  }

  // Initialize pools for actors with hasPool=true WITH CAPITAL
  logger.info('Initializing trading pools with capital...', undefined, 'Script');
  
  const poolActors = await prisma.actor.findMany({
    where: { hasPool: true },
  });
  
  let poolsCreated = 0;
  let totalCapitalAllocated = 0;
  
  // Process pools in parallel batches
  await Promise.all(poolActors.map(async (actor) => {
    // Calculate realistic capital allocation
    const actorData = actorsData.actors.find(a => a.id === actor.id);
    if (!actorData) {
      logger.warn(`Actor ${actor.id} not found in actors.json`, undefined, 'Script');
      return;
    }

    const capitalAllocation = CapitalAllocationService.calculateCapital(actorData);
    
    try {
      await prisma.pool.create({
        data: {
          id: `pool-${actor.id}`,
          npcActorId: actor.id,
          name: `${actor.name}'s Pool`,
          description: `Trading pool managed by ${actor.name}`,
          totalValue: new Prisma.Decimal(capitalAllocation.initialPoolBalance),
          totalDeposits: new Prisma.Decimal(0), // No user deposits yet
          availableBalance: new Prisma.Decimal(capitalAllocation.initialPoolBalance),
          lifetimePnL: new Prisma.Decimal(0),
          performanceFeeRate: 0.05, // 5% performance fee
          totalFeesCollected: new Prisma.Decimal(0),
          isActive: true,
          updatedAt: new Date(),
        },
      });
      
      // Also update actor's trading balance
      await prisma.actor.update({
        where: { id: actor.id },
        data: {
          tradingBalance: new Prisma.Decimal(capitalAllocation.tradingBalance),
          reputationPoints: capitalAllocation.reputationPoints,
        },
      });
      
      poolsCreated++;
      totalCapitalAllocated += capitalAllocation.initialPoolBalance;
      
      logger.info(`✅ Created pool for ${actor.name} with $${capitalAllocation.initialPoolBalance.toLocaleString()}`, {
        actorId: actor.id,
        capital: capitalAllocation.initialPoolBalance,
      }, 'Script');
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        // Pool already exists - handled below
      } else {
        throw error;
      }
      
      // Pool already exists - update with capital if needed
      const existingPool = await prisma.pool.findFirst({ where: { npcActorId: actor.id } });
      if (!existingPool) {
        poolsCreated++;
        return;
      }

      const currentBalance = Number(existingPool.availableBalance);
      
      // Always update to ensure proper capital allocation
      await prisma.pool.update({
        where: { id: existingPool.id },
        data: {
          totalValue: new Prisma.Decimal(capitalAllocation.initialPoolBalance),
          availableBalance: new Prisma.Decimal(capitalAllocation.initialPoolBalance),
        },
      });
      
      await prisma.actor.update({
        where: { id: actor.id },
        data: {
          tradingBalance: new Prisma.Decimal(capitalAllocation.tradingBalance),
          reputationPoints: capitalAllocation.reputationPoints,
        },
      });
      
      totalCapitalAllocated += capitalAllocation.initialPoolBalance;
      poolsCreated++;
      
      logger.info(`✅ Updated pool for ${actor.name}: $${currentBalance.toFixed(0)} → $${capitalAllocation.initialPoolBalance.toLocaleString()}`, {
        actorId: actor.id,
        oldBalance: currentBalance,
        newBalance: capitalAllocation.initialPoolBalance,
      }, 'Script');
    }
  }));
  
  logger.info(`Initialized ${poolsCreated} pools with $${totalCapitalAllocated.toLocaleString()} total capital`, undefined, 'Script');

  // Seed relationships from actors data
  logger.info('Seeding actor relationships...', undefined, 'Script');
  
  if (actorsData.relationships && actorsData.relationships.length > 0) {
    logger.info(`Found ${actorsData.relationships.length} relationships in actors data`, { count: actorsData.relationships.length }, 'Script');
    
    try {
      await FollowInitializer.importRelationships(actorsData.relationships);
      logger.info('✅ Relationships imported', undefined, 'Script');
      
      await FollowInitializer.createFollows(actorsData.relationships);
      logger.info('✅ Follows created from relationships', undefined, 'Script');
    } catch (error) {
      logger.error('Failed to seed relationships', { error }, 'Script');
    }
  } else {
    logger.warn('No relationships in actors data', undefined, 'Script');
    logger.warn('Generate: npx tsx scripts/init-actor-relationships.ts', undefined, 'Script');
    logger.warn('This updates the actors data structure with relationship data', undefined, 'Script');
  }
  
  // Initialize NPC-to-NPC follows if they don't exist
  logger.info('Checking NPC-to-NPC follow relationships...', undefined, 'Script');
  const existingFollows = await prisma.actorFollow.count();
  
  if (existingFollows === 0) {
    logger.info('No NPC follows found, initializing...', undefined, 'Script');
    
    try {
      await FollowInitializer.initializeActorFollows();
      logger.info('✅ NPC follow relationships initialized', undefined, 'Script');
    } catch (error) {
      logger.error('Failed to initialize NPC follows', { error }, 'Script');
    }
  } else {
    logger.info(`Found ${existingFollows} existing NPC follow relationships`, { count: existingFollows }, 'Script');
  }

  // Seed default real users for DM testing
  logger.info('Seeding default real users for DM testing...', undefined, 'Script');
  
  const defaultUsers = [
    {
      id: 'demo-user-babylon-support',
      privyId: 'did:privy:babylon-support-demo',
      username: 'babylon-support',
      displayName: 'Babylon Support',
      bio: 'Official Babylon support account. Send us a message if you need help!',
      profileImageUrl: '/assets/user-profiles/profile-1.jpg',
      isActor: false,
      profileComplete: true,
      hasUsername: true,
      hasBio: true,
      hasProfileImage: true,
      reputationPoints: 5000,
      updatedAt: new Date(),
    },
    {
      id: 'demo-user-welcome-bot',
      privyId: 'did:privy:babylon-welcome-bot',
      username: 'welcome-bot',
      displayName: 'Welcome Bot',
      bio: 'New to Babylon? Message me to learn how to play!',
      profileImageUrl: '/assets/user-profiles/profile-2.jpg',
      isActor: false,
      profileComplete: true,
      hasUsername: true,
      hasBio: true,
      hasProfileImage: true,
      reputationPoints: 3000,
      updatedAt: new Date(),
    },
  ];

  let usersCreated = 0;
  for (const userData of defaultUsers) {
    await prisma.user.upsert({
      where: { id: userData.id },
      update: {
        username: userData.username,
        displayName: userData.displayName,
        bio: userData.bio,
        profileImageUrl: userData.profileImageUrl,
        profileComplete: userData.profileComplete,
        hasUsername: userData.hasUsername,
        hasBio: userData.hasBio,
        hasProfileImage: userData.hasProfileImage,
        reputationPoints: userData.reputationPoints,
      },
      create: userData,
    });
    usersCreated++;
  }

  logger.info(`Created/updated ${usersCreated} default real users for DM testing`, undefined, 'Script');

  // Seed WorldFacts
  logger.info('Seeding world facts...', undefined, 'Script');
  
  const worldFacts = [
    {
      category: 'crypto',
      key: 'bitcoin_price',
      label: 'Bitcoin Price',
      value: '$45,000',
      source: 'initial_seed',
      priority: 10,
    },
    {
      category: 'crypto',
      key: 'ethereum_price',
      label: 'Ethereum Price',
      value: '$2,400',
      source: 'initial_seed',
      priority: 9,
    },
    {
      category: 'crypto',
      key: 'market_trend',
      label: 'Market Trend',
      value: 'Bullish momentum across major cryptocurrencies',
      source: 'initial_seed',
      priority: 8,
    },
    {
      category: 'technology',
      key: 'ai_development',
      label: 'AI Development',
      value: 'LLMs continue to advance with multimodal capabilities',
      source: 'initial_seed',
      priority: 7,
    },
    {
      category: 'technology',
      key: 'blockchain_adoption',
      label: 'Blockchain Adoption',
      value: 'Enterprise blockchain solutions gaining traction',
      source: 'initial_seed',
      priority: 6,
    },
    {
      category: 'economy',
      key: 'market_sentiment',
      label: 'Market Sentiment',
      value: 'Cautiously optimistic amid global uncertainty',
      source: 'initial_seed',
      priority: 5,
    },
    {
      category: 'politics',
      key: 'regulation_status',
      label: 'Crypto Regulation',
      value: 'Multiple jurisdictions working on comprehensive frameworks',
      source: 'initial_seed',
      priority: 4,
    },
    {
      category: 'general',
      key: 'babylon_status',
      label: 'Babylon Game Status',
      value: 'Live and operational',
      source: 'initial_seed',
      priority: 10,
    },
  ];

  let worldFactsCreated = 0;
  for (const fact of worldFacts) {
    await prisma.worldFact.upsert({
      where: {
        category_key: {
          category: fact.category,
          key: fact.key,
        },
      },
      update: {
        label: fact.label,
        value: fact.value,
        source: fact.source,
        priority: fact.priority,
        lastUpdated: new Date(),
      },
      create: {
        id: await generateSnowflakeId(),
        category: fact.category,
        key: fact.key,
        label: fact.label,
        value: fact.value,
        source: fact.source,
        priority: fact.priority,
        lastUpdated: new Date(),
      },
    });
    worldFactsCreated++;
  }

  logger.info(`Seeded ${worldFactsCreated} world facts`, undefined, 'Script');

  // Stats
  const stats = {
    actors: await prisma.actor.count(),
    poolActors: await prisma.actor.count({ where: { hasPool: true } }),
    pools: await prisma.pool.count(),
    organizations: await prisma.organization.count(),
    companies: await prisma.organization.count({ where: { type: 'company' } }),
    relationships: await prisma.actorRelationship.count(),
    actorFollows: await prisma.actorFollow.count(),
    userActorFollows: await prisma.userActorFollow.count(),
    userFollows: await prisma.follow.count(),
    posts: await prisma.post.count(),
    realUsers: await prisma.user.count({ where: { isActor: false } }),
    worldFacts: await prisma.worldFact.count(),
  };

  logger.info('Database Summary:', {
    actors: `${stats.actors} (${stats.poolActors} traders with pools)`,
    pools: stats.pools,
    organizations: `${stats.organizations} (${stats.companies} companies)`,
    relationships: stats.relationships,
    npcFollows: `${stats.actorFollows} (NPC-to-NPC)`,
    userActorFollows: `${stats.userActorFollows} (User-to-NPC)`,
    userFollows: `${stats.userFollows} (User-to-User)`,
    posts: stats.posts,
    realUsers: stats.realUsers,
    worldFacts: stats.worldFacts,
  }, 'Script');

  logger.info('SEED COMPLETE', undefined, 'Script');
}

main()
  .then(() => {
    logger.info('✅ Seed completed successfully', undefined, 'Script');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Seed failed', { error }, 'Script');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
