#!/usr/bin/env tsx

/**
 * Initialize Actor Relationships Script
 * 
 * This script generates relationships between actors based on:
 * - Tier proximity (S-tier actors follow each other)
 * - Domain overlap (actors in same domain follow each other)
 * - Random follows to ensure network connectivity
 * 
 * Run: bun scripts/init-actor-relationships.ts
 */

// Load environment variables BEFORE importing Prisma
import { config } from 'dotenv';
import { join } from 'path';
const result = config({ path: join(process.cwd(), '.env') });

// Log loaded env vars for debugging
if (result.parsed) {
  console.log('[ENV] Loaded .env file successfully');
} else {
  console.warn('[ENV] Could not load .env file');
}

import { PrismaClient } from '@prisma/client';
import { logger } from '../src/lib/logger';

// Create Prisma client with explicit connection
const prisma = new PrismaClient();

interface ActorForRelationships {
  id: string;
  name: string;
  tier: string | null;
  domain: string[];
}

const TIER_WEIGHTS = {
  S_TIER: 5,
  A_TIER: 4,
  B_TIER: 3,
  C_TIER: 2,
  D_TIER: 1,
};

async function initializeActorRelationships() {
  logger.info('Initializing actor relationships...', undefined, 'Script');

  // Get all actors
  const actors = await prisma.actor.findMany({
    select: {
      id: true,
      name: true,
      tier: true,
      domain: true,
    },
  });

  logger.info(`Found ${actors.length} actors`, undefined, 'Script');

  if (actors.length === 0) {
    logger.error('No actors found. Please run seed first.', undefined, 'Script');
    return;
  }

  let followsCreated = 0;
  const actorMap = new Map(actors.map(a => [a.id, a]));

  // Helper function to calculate relationship strength
  function calculateStrength(actor1: ActorForRelationships, actor2: ActorForRelationships): number {
    let strength = 0;

    // Same tier = higher strength
    if (actor1.tier === actor2.tier) {
      strength += 0.3;
    }

    // Adjacent tier = medium strength
    const tier1Weight = TIER_WEIGHTS[actor1.tier as keyof typeof TIER_WEIGHTS] || 0;
    const tier2Weight = TIER_WEIGHTS[actor2.tier as keyof typeof TIER_WEIGHTS] || 0;
    if (Math.abs(tier1Weight - tier2Weight) === 1) {
      strength += 0.2;
    }

    // Shared domains = higher strength
    const sharedDomains = actor1.domain.filter(d => actor2.domain.includes(d));
    strength += sharedDomains.length * 0.15;

    return Math.min(strength, 1.0);
  }

  // Create follows based on relationships
  for (const actor of actors) {
    // S-tier actors follow other S-tier and A-tier
    // A-tier follow S-tier, A-tier, and some B-tier
    // Everyone follows some higher-tier actors

    const potentialFollows: Array<{ target: ActorForRelationships; score: number }> = [];

    for (const other of actors) {
      if (actor.id === other.id) continue;

      const strength = calculateStrength(actor, other);
      
      // Add some randomness
      const randomBoost = Math.random() * 0.3;
      const score = strength + randomBoost;

      potentialFollows.push({ target: other, score });
    }

    // Sort by score and take top candidates
    potentialFollows.sort((a, b) => b.score - a.score);

    // Determine how many to follow based on tier
    const tierWeight = TIER_WEIGHTS[actor.tier as keyof typeof TIER_WEIGHTS] || 1;
    const followCount = Math.min(
      Math.floor(5 + tierWeight * 2), // 7-15 follows based on tier
      Math.floor(potentialFollows.length * 0.3) // Max 30% of all actors
    );

    const toFollow = potentialFollows.slice(0, followCount);

    // Create follows
    for (const { target, score } of toFollow) {
      const shouldBeMutual = score > 0.6; // High-score relationships are mutual

      try {
        // Check if already exists
        const existing = await prisma.actorFollow.findUnique({
          where: {
            followerId_followingId: {
              followerId: actor.id,
              followingId: target.id,
            },
          },
        });

        if (!existing) {
          await prisma.actorFollow.create({
            data: {
              followerId: actor.id,
              followingId: target.id,
              isMutual: shouldBeMutual,
            },
          });
          followsCreated++;
        }

        // Create reverse follow if mutual
        if (shouldBeMutual) {
          const reverseExists = await prisma.actorFollow.findUnique({
            where: {
              followerId_followingId: {
                followerId: target.id,
                followingId: actor.id,
              },
            },
          });

          if (!reverseExists) {
            await prisma.actorFollow.create({
              data: {
                followerId: target.id,
                followingId: actor.id,
                isMutual: true,
              },
            });
            followsCreated++;
          }
        }
      } catch (error: any) {
        // Skip duplicate errors
        if (error.code !== 'P2002') {
          console.error(`Error creating follow ${actor.name} -> ${target.name}:`, error.message);
        }
      }
    }
  }

  logger.info(`✅ Created ${followsCreated} actor follow relationships`, undefined, 'Script');

  // Verify no isolated actors
  const isolatedActors = await prisma.actor.findMany({
    where: {
      AND: [
        { followedBy: { none: {} } },
        { following: { none: {} } },
      ],
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (isolatedActors.length > 0) {
    logger.warn(`Found ${isolatedActors.length} isolated actors (no connections)`, undefined, 'Script');
    
    // Connect isolated actors to some random actors
    for (const isolated of isolatedActors) {
      const randomActors = actors
        .filter(a => a.id !== isolated.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      for (const target of randomActors) {
        try {
          await prisma.actorFollow.create({
            data: {
              followerId: isolated.id,
              followingId: target.id,
              isMutual: false,
            },
          });
          followsCreated++;
        } catch (error: any) {
          if (error.code !== 'P2002') {
            console.error(`Error fixing isolated actor ${isolated.name}:`, error.message);
          }
        }
      }
    }

    logger.info(`✅ Connected ${isolatedActors.length} isolated actors`, undefined, 'Script');
  }

  // Print statistics
  const stats = await prisma.actorFollow.groupBy({
    by: ['isMutual'],
    _count: true,
  });

  const mutualCount = stats.find(s => s.isMutual)?._count || 0;
  const oneWayCount = stats.find(s => !s.isMutual)?._count || 0;

  logger.info('Relationship Statistics:', {
    total: followsCreated,
    mutual: mutualCount,
    oneWay: oneWayCount,
  }, 'Script');

  await prisma.$disconnect();
}

initializeActorRelationships().catch((error) => {
  logger.error('Error initializing relationships:', error, 'Script');
  process.exit(1);
});

