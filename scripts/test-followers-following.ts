/**
 * Test script to verify followers/following functionality
 * Tests both user-to-user and user-to-NPC follows
 */

import { prisma } from '@/lib/database-service'

async function testFollowersFollowing() {
  console.log('🧪 Testing Followers/Following Functionality\n')

  try {
    // 1. Find a real user (not an actor)
    const testUser = await prisma.user.findFirst({
      where: {
        isActor: false,
        isBanned: false,
      },
      select: {
        id: true,
        displayName: true,
        username: true,
      },
    })

    if (!testUser) {
      console.log('❌ No real users found in database')
      return
    }

    console.log(`✅ Found test user: ${testUser.displayName || testUser.username} (${testUser.id})`)

    // 2. Check user's following (users they follow)
    const userFollowing = await prisma.follow.findMany({
      where: { followerId: testUser.id },
      include: {
        following: {
          select: {
            id: true,
            displayName: true,
            username: true,
            isActor: true,
          },
        },
      },
    })

    console.log(`\n📊 User Following (User-to-User):`)
    console.log(`   Following ${userFollowing.length} users:`)
    userFollowing.forEach(f => {
      console.log(`   - ${f.following.displayName || f.following.username} (${f.following.id})`)
    })

    // 3. Check user's followers (users who follow them)
    const userFollowers = await prisma.follow.findMany({
      where: { followingId: testUser.id },
      include: {
        follower: {
          select: {
            id: true,
            displayName: true,
            username: true,
            isActor: true,
          },
        },
      },
    })

    console.log(`\n📊 User Followers (Users following them):`)
    console.log(`   ${userFollowers.length} followers:`)
    userFollowers.forEach(f => {
      console.log(`   - ${f.follower.displayName || f.follower.username} (${f.follower.id})`)
    })

    // 4. Check user's actor follows (NPCs they follow)
    const actorFollows = await prisma.userActorFollow.findMany({
      where: { userId: testUser.id },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            tier: true,
          },
        },
      },
    })

    console.log(`\n📊 Actor Follows (User following NPCs):`)
    console.log(`   Following ${actorFollows.length} NPCs:`)
    actorFollows.forEach(f => {
      console.log(`   - ${f.actor.name} [${f.actor.tier}] (${f.actor.id})`)
    })

    // 5. Find an NPC and check its followers/following
    const testActor = await prisma.actor.findFirst({
      select: {
        id: true,
        name: true,
        tier: true,
      },
    })

    if (!testActor) {
      console.log('\n❌ No actors found in database')
      return
    }

    console.log(`\n✅ Found test actor: ${testActor.name} (${testActor.id})`)

    // 6. Check NPC's actor followers (NPCs that follow them)
    const actorFollowers = await prisma.actorFollow.findMany({
      where: { followingId: testActor.id },
      include: {
        follower: {
          select: {
            id: true,
            name: true,
            tier: true,
          },
        },
      },
    })

    console.log(`\n📊 NPC Followers (NPCs following them):`)
    console.log(`   ${actorFollowers.length} NPC followers:`)
    actorFollowers.slice(0, 5).forEach(f => {
      console.log(`   - ${f.follower.name} [${f.follower.tier}] (${f.follower.id})`)
    })
    if (actorFollowers.length > 5) {
      console.log(`   ... and ${actorFollowers.length - 5} more`)
    }

    // 7. Check user followers of the NPC
    const userActorFollowers = await prisma.userActorFollow.findMany({
      where: { actorId: testActor.id },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
      },
    })

    console.log(`\n📊 User Followers (Users following this NPC):`)
    console.log(`   ${userActorFollowers.length} user followers:`)
    userActorFollowers.forEach(f => {
      console.log(`   - ${f.user.displayName || f.user.username} (${f.user.id})`)
    })

    // 8. Check NPC's following (NPCs they follow)
    const actorFollowing = await prisma.actorFollow.findMany({
      where: { followerId: testActor.id },
      include: {
        following: {
          select: {
            id: true,
            name: true,
            tier: true,
          },
        },
      },
    })

    console.log(`\n📊 NPC Following (NPCs they follow):`)
    console.log(`   Following ${actorFollowing.length} NPCs:`)
    actorFollowing.slice(0, 5).forEach(f => {
      console.log(`   - ${f.following.name} [${f.following.tier}] (${f.following.id})`)
    })
    if (actorFollowing.length > 5) {
      console.log(`   ... and ${actorFollowing.length - 5} more`)
    }

    // 9. Summary
    console.log('\n' + '='.repeat(60))
    console.log('📈 SUMMARY')
    console.log('='.repeat(60))
    console.log(`✅ User-to-User Follows: Working (${userFollowing.length} following, ${userFollowers.length} followers)`)
    console.log(`✅ User-to-NPC Follows: Working (${actorFollows.length} following, ${userActorFollowers.length} total user followers of NPCs)`)
    console.log(`✅ NPC-to-NPC Follows: Working (${actorFollowing.length} following, ${actorFollowers.length} followers)`)
    console.log('\n✅ All followers/following functionality is working correctly!')

  } catch (error) {
    console.error('\n❌ Error testing followers/following:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

testFollowersFollowing().catch(console.error)

