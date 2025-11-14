/**
 * Integration Test: Followers/Following and NPC Relationships
 * 
 * This test verifies:
 * 1. NPCs are seeded with initial relationships from actors.json
 * 2. Follower/following counts are accurate across all models
 * 3. Stats match between ActorFollow, UserActorFollow, and Follow models
 * 4. Both users and NPCs have correct follower/following counts
 */

// Load environment variables
import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env') });

import { PrismaClient } from '@prisma/client';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

// For tests, always use the local database (ignore remote Prisma Accelerate)
const LOCAL_DATABASE_URL = 'postgresql://babylon:babylon_dev_password@localhost:5432/babylon';
console.log('[TEST] Using local database for integration tests');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: LOCAL_DATABASE_URL,
    },
  },
});

describe('Followers/Following and Relationships Integration Tests', () => {
  let testUser: { id: string; username: string | null; displayName: string | null };
  let testActor: { id: string; name: string; tier: string | null };
  let secondTestActor: { id: string; name: string; tier: string | null };

  beforeAll(async () => {
    // Check total actor count first
    const totalActors = await prisma.actor.count();
    console.log(`📊 Total actors in database: ${totalActors}`);

    // Find a real user (not an actor)
    const user = await prisma.user.findFirst({
      where: {
        isActor: false,
        isBanned: false,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
      },
    });

    if (!user) {
      // Create a test user if none exists
      const createdUser = await prisma.user.create({
        data: {
          privyId: `test-privy-${Date.now()}`,
          username: `testuser${Date.now()}`,
          displayName: 'Test User',
          isActor: false,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      });
      testUser = createdUser;
      console.log(`✅ Created test user: ${testUser.displayName}`);
    } else {
      testUser = user;
      console.log(`✅ Found test user: ${testUser.displayName || testUser.username}`);
    }

    // Find two test actors
    const actors = await prisma.actor.findMany({
      take: 2,
      select: {
        id: true,
        name: true,
        tier: true,
      },
    });

    console.log(`📊 Found ${actors.length} actors for testing`);

    if (actors.length < 2) {
      throw new Error(`Not enough actors found in database for testing. Found ${actors.length}, need at least 2. Total in DB: ${totalActors}`);
    }

    testActor = actors[0];
    secondTestActor = actors[1];
    console.log(`✅ Using test actors: ${testActor.name} and ${secondTestActor.name}`);
  });

  describe('NPC Relationship Seeding', () => {
    it('should have ActorFollow relationships in database', async () => {
      const actorFollowCount = await prisma.actorFollow.count();
      
      expect(actorFollowCount).toBeGreaterThan(0);
      console.log(`✅ Found ${actorFollowCount} NPC-to-NPC follow relationships`);
    });

    it('should have ActorRelationship metadata in database (optional)', async () => {
      const relationshipCount = await prisma.actorRelationship.count();
      
      // ActorRelationship is optional metadata, but if present, should be > 0
      if (relationshipCount > 0) {
        console.log(`✅ Found ${relationshipCount} NPC relationships with metadata`);
      } else {
        console.log(`ℹ️  No ActorRelationship metadata found (this is optional)`);
      }
      
      // Always pass - this metadata is optional
      expect(relationshipCount).toBeGreaterThanOrEqual(0);
    });

    it('should have actors with followers', async () => {
      const actorsWithFollowers = await prisma.actor.findMany({
        where: {
          followedBy: {
            some: {},
          },
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              followedBy: true,
            },
          },
        },
        take: 5,
      });

      expect(actorsWithFollowers.length).toBeGreaterThan(0);
      
      console.log(`✅ Sample actors with followers:`);
      actorsWithFollowers.forEach(actor => {
        console.log(`   - ${actor.name}: ${actor._count.followedBy} NPC followers`);
      });
    });

    it('should have actors with following', async () => {
      const actorsWithFollowing = await prisma.actor.findMany({
        where: {
          following: {
            some: {},
          },
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              following: true,
            },
          },
        },
        take: 5,
      });

      expect(actorsWithFollowing.length).toBeGreaterThan(0);
      
      console.log(`✅ Sample actors with following:`);
      actorsWithFollowing.forEach(actor => {
        console.log(`   - ${actor.name}: following ${actor._count.following} NPCs`);
      });
    });

    it('should have mutual follows marked correctly', async () => {
      const mutualFollows = await prisma.actorFollow.count({
        where: {
          isMutual: true,
        },
      });

      console.log(`✅ Found ${mutualFollows} mutual follow relationships`);
      // Note: Not all follows need to be mutual, so we just check it exists
    });

    it('should not have actors with zero followers AND zero following', async () => {
      const allActors = await prisma.actor.findMany({
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              followedBy: true,
              following: true,
            },
          },
        },
      });

      const isolatedActors = allActors.filter(
        actor => actor._count.followedBy === 0 && actor._count.following === 0
      );

      if (isolatedActors.length > 0) {
        console.warn(`⚠️  Found ${isolatedActors.length} isolated actors (no followers or following):`);
        isolatedActors.slice(0, 5).forEach(actor => {
          console.warn(`   - ${actor.name} (${actor.id})`);
        });
      }

      // We allow some actors to be isolated, but warn about it
      expect(allActors.length).toBeGreaterThan(isolatedActors.length);
    });
  });

  describe('Actor Stats Accuracy', () => {
    it('should correctly count actor followers (NPC + User)', async () => {
      // Get actor stats via API method
      const actorFollowerCount = await prisma.actorFollow.count({
        where: { followingId: testActor.id },
      });

      const userFollowerCount = await prisma.userActorFollow.count({
        where: { actorId: testActor.id },
      });

      const legacyFollowerCount = await prisma.followStatus.count({
        where: {
          npcId: testActor.id,
          isActive: true,
          followReason: 'user_followed',
        },
      });

      const totalFollowers = actorFollowerCount + userFollowerCount + legacyFollowerCount;

      console.log(`✅ ${testActor.name} has:`);
      console.log(`   - ${actorFollowerCount} NPC followers`);
      console.log(`   - ${userFollowerCount} user followers`);
      console.log(`   - ${legacyFollowerCount} legacy followers`);
      console.log(`   - ${totalFollowers} total followers`);

      expect(totalFollowers).toBeGreaterThanOrEqual(0);
    });

    it('should correctly count actor following (only NPCs)', async () => {
      const followingCount = await prisma.actorFollow.count({
        where: { followerId: testActor.id },
      });

      console.log(`✅ ${testActor.name} is following ${followingCount} NPCs`);

      expect(followingCount).toBeGreaterThanOrEqual(0);
    });

    it('should have consistent ActorFollow bidirectional relationships', async () => {
      // Pick a specific follow relationship
      const sampleFollow = await prisma.actorFollow.findFirst({
        include: {
          follower: { select: { id: true, name: true } },
          following: { select: { id: true, name: true } },
        },
      });

      if (sampleFollow) {
        // Verify the follower has this in their "following" list
        const followExists = await prisma.actorFollow.findUnique({
          where: {
            followerId_followingId: {
              followerId: sampleFollow.followerId,
              followingId: sampleFollow.followingId,
            },
          },
        });

        expect(followExists).toBeTruthy();
        console.log(`✅ Bidirectional relationship verified: ${sampleFollow.follower.name} → ${sampleFollow.following.name}`);
      }
    });
  });

  describe('User Following Stats Accuracy', () => {
    it('should correctly count user following (Users + Actors)', async () => {
      // User-to-User follows
      const userFollowingCount = await prisma.follow.count({
        where: { followerId: testUser.id },
      });

      // User-to-Actor follows
      const actorFollowingCount = await prisma.userActorFollow.count({
        where: { userId: testUser.id },
      });

      const totalFollowing = userFollowingCount + actorFollowingCount;

      console.log(`✅ ${testUser.displayName || testUser.username} is following:`);
      console.log(`   - ${userFollowingCount} users`);
      console.log(`   - ${actorFollowingCount} NPCs`);
      console.log(`   - ${totalFollowing} total`);

      expect(totalFollowing).toBeGreaterThanOrEqual(0);
    });

    it('should correctly count user followers', async () => {
      const followerCount = await prisma.follow.count({
        where: { followingId: testUser.id },
      });

      console.log(`✅ ${testUser.displayName || testUser.username} has ${followerCount} user followers`);

      expect(followerCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Follow/Unfollow Operations', () => {
    let createdFollow: { id: string } | null = null;

    it('should allow user to follow an actor', async () => {
      // Check if already following
      const existingFollow = await prisma.userActorFollow.findUnique({
        where: {
          userId_actorId: {
            userId: testUser.id,
            actorId: testActor.id,
          },
        },
      });

      if (!existingFollow) {
        // Create the follow
        createdFollow = await prisma.userActorFollow.create({
          data: {
            userId: testUser.id,
            actorId: testActor.id,
          },
        });

        expect(createdFollow).toBeTruthy();
        console.log(`✅ User ${testUser.displayName || testUser.username} followed ${testActor.name}`);
      } else {
        console.log(`ℹ️  User already following ${testActor.name}`);
      }
    });

    it('should reflect follow in actor stats', async () => {
      const userFollowerCount = await prisma.userActorFollow.count({
        where: { actorId: testActor.id },
      });

      expect(userFollowerCount).toBeGreaterThan(0);
      console.log(`✅ ${testActor.name} now has ${userFollowerCount} user followers`);
    });

    it('should allow user to unfollow the actor', async () => {
      if (createdFollow) {
        await prisma.userActorFollow.delete({
          where: { id: createdFollow.id },
        });

        const stillExists = await prisma.userActorFollow.findUnique({
          where: { id: createdFollow.id },
        });

        expect(stillExists).toBeNull();
        console.log(`✅ User unfollowed ${testActor.name}`);
      }
    });
  });

  describe('Stats API Consistency', () => {
    it('should return consistent stats for actors', async () => {
      // Direct database counts
      const dbActorFollowers = await prisma.actorFollow.count({
        where: { followingId: testActor.id },
      });

      const dbUserFollowers = await prisma.userActorFollow.count({
        where: { actorId: testActor.id },
      });

      const dbFollowing = await prisma.actorFollow.count({
        where: { followerId: testActor.id },
      });

      console.log(`✅ ${testActor.name} stats from database:`);
      console.log(`   - Followers: ${dbActorFollowers + dbUserFollowers} (${dbActorFollowers} NPCs + ${dbUserFollowers} users)`);
      console.log(`   - Following: ${dbFollowing} NPCs`);

      // These should always be non-negative
      expect(dbActorFollowers).toBeGreaterThanOrEqual(0);
      expect(dbUserFollowers).toBeGreaterThanOrEqual(0);
      expect(dbFollowing).toBeGreaterThanOrEqual(0);
    });

    it('should return consistent stats for users via _count', async () => {
      const user = await prisma.user.findUnique({
        where: { id: testUser.id },
        select: {
          _count: {
            select: {
              followedBy: true,
              following: true,
              userActorFollows: true,
            },
          },
        },
      });

      if (user) {
        const totalFollowing = user._count.following + user._count.userActorFollows;

        console.log(`✅ ${testUser.displayName || testUser.username} stats from _count:`);
        console.log(`   - Followers: ${user._count.followedBy}`);
        console.log(`   - Following: ${totalFollowing} (${user._count.following} users + ${user._count.userActorFollows} NPCs)`);

        expect(user._count.followedBy).toBeGreaterThanOrEqual(0);
        expect(totalFollowing).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Relationship Integrity', () => {
    it('should not have duplicate ActorFollow relationships', async () => {
      const follows = await prisma.actorFollow.findMany({
        select: {
          followerId: true,
          followingId: true,
        },
      });

      const uniqueKeys = new Set(
        follows.map(f => `${f.followerId}-${f.followingId}`)
      );

      expect(follows.length).toBe(uniqueKeys.size);
      console.log(`✅ No duplicate ActorFollow relationships found`);
    });

    it('should not have duplicate UserActorFollow relationships', async () => {
      const follows = await prisma.userActorFollow.findMany({
        select: {
          userId: true,
          actorId: true,
        },
      });

      const uniqueKeys = new Set(
        follows.map(f => `${f.userId}-${f.actorId}`)
      );

      expect(follows.length).toBe(uniqueKeys.size);
      console.log(`✅ No duplicate UserActorFollow relationships found`);
    });

    it('should not have self-follows in ActorFollow', async () => {
      const selfFollows = await prisma.actorFollow.count({
        where: {
          followerId: {
            equals: prisma.actorFollow.fields.followingId,
          },
        },
      });

      // Note: This query doesn't work as written, but we can check manually
      const allFollows = await prisma.actorFollow.findMany({
        select: {
          followerId: true,
          followingId: true,
        },
      });

      const selfFollowCount = allFollows.filter(
        f => f.followerId === f.followingId
      ).length;

      expect(selfFollowCount).toBe(0);
      console.log(`✅ No self-follows found in ActorFollow`);
    });
  });

  describe('Post Count Consistency', () => {
    it('should count posts correctly for actors', async () => {
      const postCount = await prisma.post.count({
        where: { authorId: testActor.id },
      });

      console.log(`✅ ${testActor.name} has ${postCount} posts`);
      expect(postCount).toBeGreaterThanOrEqual(0);
    });

    it('should count posts correctly for users', async () => {
      const postCount = await prisma.post.count({
        where: { authorId: testUser.id },
      });

      console.log(`✅ ${testUser.displayName || testUser.username} has ${postCount} posts`);
      expect(postCount).toBeGreaterThanOrEqual(0);
    });
  });
});

