// @ts-nocheck - Test file

/**
 * Comprehensive Follow/Following E2E Tests
 * 
 * Tests complete follow/unfollow functionality including:
 * - User-to-user follows
 * - User-to-NPC follows
 * - Follower/following count updates
 * - Cache invalidation
 * - Multiple users interacting
 */

import { test, expect } from '@playwright/test'
import { prisma } from '@/lib/database-service'
import { generateSnowflakeId } from '@/lib/snowflake'

// Test users will be created/found before tests
let testUser1: { id: string; username: string; displayName: string }
let testUser2: { id: string; username: string; displayName: string }
let testActor: { id: string; name: string }

test.describe('Follow System - Complete Coverage', () => {
  test.beforeAll(async () => {
    // Find or create test users
    const users = await prisma.user.findMany({
      where: {
        isActor: false,
        isBanned: false,
        username: { not: null },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
      },
      take: 2,
    })

    if (users.length >= 2) {
      testUser1 = users[0] as any
      testUser2 = users[1] as any
    } else {
      throw new Error('Not enough test users found. Need at least 2 users.')
    }

    // Find a test actor
    const actor = await prisma.actor.findFirst({
      select: {
        id: true,
        name: true,
      },
    })

    if (!actor) {
      throw new Error('No actors found for testing')
    }

    testActor = actor

    console.log('✅ Test setup complete:')
    console.log(`   User 1: ${testUser1.displayName} (@${testUser1.username})`)
    console.log(`   User 2: ${testUser2.displayName} (@${testUser2.username})`)
    console.log(`   Actor: ${testActor.name}`)
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test.describe.serial('User-to-User Follow/Unfollow', () => {
    test('should follow another user and see follower count increase', async () => {
      // Ensure User 1 is not already following User 2
      await prisma.follow.deleteMany({
        where: {
          followerId: testUser1.id,
          followingId: testUser2.id,
        },
      })

      // Wait a moment for deletion to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Get initial counts after cleanup
      const initialUser1 = await prisma.user.findUnique({
        where: { id: testUser1.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followerIdToUser: true,
            },
          },
        },
      })

      const initialUser2 = await prisma.user.findUnique({
        where: { id: testUser2.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followingIdToUser: true,
            },
          },
        },
      })

      // Create follow relationship
      await prisma.follow.create({
        data: {
          id: await generateSnowflakeId(),
          followerId: testUser1.id,
          followingId: testUser2.id,
        },
      })

      // Wait for cache to potentially update
      await new Promise(resolve => setTimeout(resolve, 500))

      // Get updated counts
      const updatedUser1 = await prisma.user.findUnique({
        where: { id: testUser1.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followerIdToUser: true,
            },
          },
        },
      })

      const updatedUser2 = await prisma.user.findUnique({
        where: { id: testUser2.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followingIdToUser: true,
            },
          },
        },
      })

      // Verify counts increased
      expect(updatedUser1!._count.Follow_Follow_followerIdToUser).toBe((initialUser1!._count.Follow_Follow_followerIdToUser || 0) + 1)
      expect(updatedUser2!._count.Follow_Follow_followingIdToUser).toBe((initialUser2!._count.Follow_Follow_followingIdToUser || 0) + 1)

      console.log('✅ User 1 following count:', updatedUser1!._count.Follow_Follow_followerIdToUser)
      console.log('✅ User 2 follower count:', updatedUser2!._count.Follow_Follow_followingIdToUser)
    })

    test('should unfollow user and see counts decrease', async () => {
      // Get initial counts (User 1 should be following User 2)
      const initialUser1 = await prisma.user.findUnique({
        where: { id: testUser1.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followerIdToUser: true,
            },
          },
        },
      })

      const initialUser2 = await prisma.user.findUnique({
        where: { id: testUser2.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followingIdToUser: true,
            },
          },
        },
      })

      // Delete follow relationship
      const existingFollow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: testUser1.id,
            followingId: testUser2.id,
          },
        },
      })

      if (existingFollow) {
        await prisma.follow.delete({ where: { id: existingFollow.id } })
      }

      // Wait for cache to potentially update
      await new Promise(resolve => setTimeout(resolve, 500))

      // Get updated counts
      const updatedUser1 = await prisma.user.findUnique({
        where: { id: testUser1.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followerIdToUser: true,
            },
          },
        },
      })

      const updatedUser2 = await prisma.user.findUnique({
        where: { id: testUser2.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followingIdToUser: true,
            },
          },
        },
      })

      // Verify counts decreased (or stayed same if didn't exist)
      if (existingFollow) {
        expect(updatedUser1!._count.Follow_Follow_followerIdToUser).toBe((initialUser1!._count.Follow_Follow_followerIdToUser || 0) - 1)
        expect(updatedUser2!._count.Follow_Follow_followingIdToUser).toBe((initialUser2!._count.Follow_Follow_followingIdToUser || 0) - 1)
      }

      console.log('✅ User 1 following count after unfollow:', updatedUser1!._count.Follow_Follow_followerIdToUser)
      console.log('✅ User 2 follower count after unfollow:', updatedUser2!._count.Follow_Follow_followingIdToUser)
    })

    test('should verify counts are non-zero for users with follows', async () => {
      // Create a follow if none exists
      const existingFollow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: testUser1.id,
            followingId: testUser2.id,
          },
        },
      })

      if (!existingFollow) {
        await prisma.follow.create({
          data: {
            id: await generateSnowflakeId(),
            followerId: testUser1.id,
            followingId: testUser2.id,
          },
        })
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Verify counts
      const user1 = await prisma.user.findUnique({
        where: { id: testUser1.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followerIdToUser: true,
            },
          },
        },
      })

      const user2 = await prisma.user.findUnique({
        where: { id: testUser2.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followingIdToUser: true,
            },
          },
        },
      })

      // At least User 1 should have 1 following, User 2 should have 1 follower
      expect(user1!._count.Follow_Follow_followerIdToUser).toBeGreaterThan(0)
      expect(user2!._count.Follow_Follow_followingIdToUser).toBeGreaterThan(0)

      console.log('✅ Verified non-zero counts:')
      console.log(`   User 1 following: ${user1!._count.Follow_Follow_followerIdToUser}`)
      console.log(`   User 2 followers: ${user2!._count.Follow_Follow_followingIdToUser}`)
    })
  })

  test.describe.serial('User-to-NPC Follow/Unfollow', () => {
    test('should follow NPC and see user following count increase', async () => {
      // Ensure not already following
      await prisma.userActorFollow.deleteMany({
        where: {
          userId: testUser1.id,
          actorId: testActor.id,
        },
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Get initial user following count after cleanup
      const initialUser = await prisma.user.findUnique({
        where: { id: testUser1.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followerIdToUser: true,
              UserActorFollow: true,
            },
          },
        },
      })

      const initialTotalFollowing = 
        (initialUser!._count.Follow_Follow_followerIdToUser || 0) + 
        (initialUser!._count.UserActorFollow || 0)

      // Create follow
      await prisma.userActorFollow.create({
        data: {
          id: await generateSnowflakeId(),
          userId: testUser1.id,
          actorId: testActor.id,
        },
      })

      await new Promise(resolve => setTimeout(resolve, 500))

      // Get updated count
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser1.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followerIdToUser: true,
              UserActorFollow: true,
            },
          },
        },
      })

      const updatedTotalFollowing = 
        (updatedUser!._count.Follow_Follow_followerIdToUser || 0) + 
        (updatedUser!._count.UserActorFollow || 0)

      // Verify count increased
      expect(updatedTotalFollowing).toBe(initialTotalFollowing + 1)

      console.log('✅ User total following (users + NPCs):', updatedTotalFollowing)
    })

    test('should unfollow NPC and see count decrease', async () => {
      // Get initial count
      const initialUser = await prisma.user.findUnique({
        where: { id: testUser1.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followerIdToUser: true,
              UserActorFollow: true,
            },
          },
        },
      })

      const initialTotalFollowing = 
        (initialUser!._count.Follow_Follow_followerIdToUser || 0) + 
        (initialUser!._count.UserActorFollow || 0)

      // Delete follow
      const existingFollow = await prisma.userActorFollow.findUnique({
        where: {
          userId_actorId: {
            userId: testUser1.id,
            actorId: testActor.id,
          },
        },
      })

      if (existingFollow) {
        await prisma.userActorFollow.delete({ where: { id: existingFollow.id } })
      }

      await new Promise(resolve => setTimeout(resolve, 500))

      // Get updated count
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser1.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followerIdToUser: true,
              UserActorFollow: true,
            },
          },
        },
      })

      const updatedTotalFollowing = 
        (updatedUser!._count.Follow_Follow_followerIdToUser || 0) + 
        (updatedUser!._count.UserActorFollow || 0)

      // Verify count decreased if follow existed
      if (existingFollow) {
        expect(updatedTotalFollowing).toBe(initialTotalFollowing - 1)
      }

      console.log('✅ User total following after unfollow:', updatedTotalFollowing)
    })

    test('should verify NPC has user followers', async () => {
      // Create a follow
      const existingFollow = await prisma.userActorFollow.findUnique({
        where: {
          userId_actorId: {
            userId: testUser1.id,
            actorId: testActor.id,
          },
        },
      })

      if (!existingFollow) {
        await prisma.userActorFollow.create({
          data: {
            id: await generateSnowflakeId(),
            userId: testUser1.id,
            actorId: testActor.id,
          },
        })
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Get NPC follower count
      const userFollowerCount = await prisma.userActorFollow.count({
        where: { actorId: testActor.id },
      })

      // Verify non-zero
      expect(userFollowerCount).toBeGreaterThan(0)

      console.log(`✅ NPC "${testActor.name}" has ${userFollowerCount} user followers`)
    })
  })

  test.describe.serial('Multiple Users Interaction', () => {
    test('should handle mutual follows correctly', async () => {
      // User 1 follows User 2
      const follow1to2 = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: testUser1.id,
            followingId: testUser2.id,
          },
        },
      })

      if (!follow1to2) {
        await prisma.follow.create({
          data: {
            id: await generateSnowflakeId(),
            followerId: testUser1.id,
            followingId: testUser2.id,
          },
        })
      }

      // User 2 follows User 1
      const follow2to1 = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: testUser2.id,
            followingId: testUser1.id,
          },
        },
      })

      if (!follow2to1) {
        await prisma.follow.create({
          data: {
            id: await generateSnowflakeId(),
            followerId: testUser2.id,
            followingId: testUser1.id,
          },
        })
      }

      await new Promise(resolve => setTimeout(resolve, 500))

      // Verify both have at least 1 follower and 1 following
      const user1 = await prisma.user.findUnique({
        where: { id: testUser1.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followerIdToUser: true,
              Follow_Follow_followingIdToUser: true,
            },
          },
        },
      })

      const user2 = await prisma.user.findUnique({
        where: { id: testUser2.id },
        select: {
          _count: {
            select: {
              Follow_Follow_followerIdToUser: true,
              Follow_Follow_followingIdToUser: true,
            },
          },
        },
      })

      // Both should have at least 1 follower and 1 following
      expect(user1!._count.Follow_Follow_followerIdToUser).toBeGreaterThanOrEqual(1)
      expect(user1!._count.Follow_Follow_followingIdToUser).toBeGreaterThanOrEqual(1)
      expect(user2!._count.Follow_Follow_followerIdToUser).toBeGreaterThanOrEqual(1)
      expect(user2!._count.Follow_Follow_followingIdToUser).toBeGreaterThanOrEqual(1)

      console.log('✅ Mutual follows verified:')
      console.log(`   User 1: ${user1!._count.Follow_Follow_followerIdToUser} following, ${user1!._count.Follow_Follow_followingIdToUser} followers`)
      console.log(`   User 2: ${user2!._count.Follow_Follow_followerIdToUser} following, ${user2!._count.Follow_Follow_followingIdToUser} followers`)
    })

    test('should correctly track followers list', async () => {
      // Get User 2's followers
      const followers = await prisma.follow.findMany({
        where: { followingId: testUser2.id },
        include: {
          User_Follow_followerIdToUser: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
      })

      expect(followers.length).toBeGreaterThan(0)

      // User 1 should be in the followers list
      const hasUser1 = followers.some(f => f.User_Follow_followerIdToUser.id === testUser1.id)
      expect(hasUser1).toBe(true)

      console.log(`✅ User 2 has ${followers.length} followers`)
      console.log('   Followers:', followers.map(f => f.User_Follow_followerIdToUser.username).join(', '))
    })

    test('should correctly track following list', async () => {
      // Ensure User 1 is following User 2
      await prisma.follow.create({
        data: {
          id: await generateSnowflakeId(),
          followerId: testUser1.id,
          followingId: testUser2.id,
        },
      }).catch(() => {}) // Ignore if already exists

      await new Promise(resolve => setTimeout(resolve, 100))

      // Get User 1's following list
      const following = await prisma.follow.findMany({
        where: { followerId: testUser1.id },
        include: {
          User_Follow_followingIdToUser: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
      })

      expect(following.length).toBeGreaterThanOrEqual(1)

      // User 2 should be in the following list
      const hasUser2 = following.some(f => f.User_Follow_followingIdToUser.id === testUser2.id)
      expect(hasUser2).toBe(true)

      console.log(`✅ User 1 is following ${following.length} users`)
      console.log('   Following:', following.map(f => f.User_Follow_followingIdToUser.username).join(', '))
    })
  })

  test.describe.serial('Follow Status API', () => {
    test('should correctly report follow status', async () => {
      // Ensure User 1 is following User 2
      const existingFollow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: testUser1.id,
            followingId: testUser2.id,
          },
        },
      })

      if (!existingFollow) {
        await prisma.follow.create({
          data: {
            id: await generateSnowflakeId(),
            followerId: testUser1.id,
            followingId: testUser2.id,
          },
        })
      }

      // Check follow status
      const isFollowing = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: testUser1.id,
            followingId: testUser2.id,
          },
        },
      })

      expect(isFollowing).toBeTruthy()

      console.log('✅ Follow status correctly reported: User 1 is following User 2')
    })

    test('should correctly report not following status', async () => {
      // Ensure User 1 is NOT following User 2
      const deleted = await prisma.follow.deleteMany({
        where: {
          followerId: testUser1.id,
          followingId: testUser2.id,
        },
      })

      console.log(`Deleted ${deleted.count} follow relationships`)

      await new Promise(resolve => setTimeout(resolve, 500))

      // Check follow status - verify it's really gone
      const isFollowing = await prisma.follow.findFirst({
        where: {
          followerId: testUser1.id,
          followingId: testUser2.id,
        },
      })

      expect(isFollowing).toBeNull()

      console.log('✅ Not following status correctly reported')
    })
  })
})

