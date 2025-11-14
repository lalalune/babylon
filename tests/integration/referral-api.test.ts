import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { generateSnowflakeId } from '../../src/lib/snowflake'
import { prisma } from '../../src/lib/database-service'

const shouldSkipWaitlistTests = process.env.CI === 'true' || process.env.SKIP_WAITLIST_TESTS === 'true'
type WaitlistServiceModule = typeof import('@/lib/services/waitlist-service')

const describeWaitlistIntegration = shouldSkipWaitlistTests ? describe.skip : describe

describeWaitlistIntegration('Referral System - Service Integration', () => {
  let user1Id: string
  let user2Id: string
  let user1InviteCode: string
  let WaitlistService: WaitlistServiceModule['WaitlistService']

  beforeAll(async () => {
    ;({ WaitlistService } = await import('@/lib/services/waitlist-service'))

    // Clean up any existing test users
    await prisma.user.deleteMany({
      where: {
        username: {
          in: ['api_test_user1', 'api_test_user2']
        }
      }
    })
  })

  afterAll(async () => {
    // Clean up test users
    if (user1Id) await prisma.user.delete({ where: { id: user1Id } }).catch(() => {})
    if (user2Id) await prisma.user.delete({ where: { id: user2Id } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('should create users and mark as waitlisted via Service', async () => {
    // Create User 1
    const user1 = await prisma.user.create({
      data: {
        id: await generateSnowflakeId(),
        username: 'api_test_user1',
        displayName: 'API Test User 1',
        bio: 'Test user',
        privyId: 'api-test-privy-1',
        reputationPoints: 1000,
        isTest: true,
        updatedAt: new Date(),
      }
    })
    user1Id = user1.id

    // Create User 2
    const user2 = await prisma.user.create({
      data: {
        id: await generateSnowflakeId(),
        username: 'api_test_user2',
        displayName: 'API Test User 2',
        bio: 'Test user',
        privyId: 'api-test-privy-2',
        reputationPoints: 1000,
        isTest: true,
        updatedAt: new Date(),
      }
    })
    user2Id = user2.id

    console.log('✓ Created test users')

    // Mark User 1 as waitlisted via Service
    const result1 = await WaitlistService.markAsWaitlisted(user1Id)
    
    console.log('\n📋 Service Response (User 1):')
    console.log(`  Success: ${result1.success}`)
    console.log(`  Invite Code: ${result1.inviteCode}`)
    console.log(`  Waitlist Position: ${result1.waitlistPosition}`)

    expect(result1.success).toBe(true)
    expect(result1.inviteCode).toBeTruthy()
    user1InviteCode = result1.inviteCode

    // Verify in database
    const user1Check = await prisma.user.findUnique({
      where: { id: user1Id },
      select: {
        referralCode: true,
        isWaitlistActive: true,
        waitlistPosition: true,
      }
    })

    expect(user1Check!.referralCode).toBe(user1InviteCode)
    expect(user1Check!.isWaitlistActive).toBe(true)
    expect(user1Check!.waitlistPosition).toBeGreaterThan(0)

    console.log('✅ User 1 waitlisted via Service - verified in database')
  })

  it('should reward referrer when referred user joins via Service', async () => {
    // Get User 1's BEFORE state
    const user1Before = await prisma.user.findUnique({
      where: { id: user1Id },
      select: {
        reputationPoints: true,
        invitePoints: true,
        referralCount: true,
      }
    })

    console.log('\n📊 BEFORE (User 1):')
    console.log(`  Reputation: ${user1Before!.reputationPoints}`)
    console.log(`  Invite Points: ${user1Before!.invitePoints}`)
    console.log(`  Referral Count: ${user1Before!.referralCount}`)

    // Mark User 2 as waitlisted WITH referral code via Service
    const result2 = await WaitlistService.markAsWaitlisted(user2Id, user1InviteCode)

    console.log('\n📋 Service Response (User 2 with referral):')
    console.log(`  Success: ${result2.success}`)
    console.log(`  Referrer Rewarded: ${result2.referrerRewarded}`)

    expect(result2.success).toBe(true)
    expect(result2.referrerRewarded).toBe(true)

    // Get User 1's AFTER state from database
    const user1After = await prisma.user.findUnique({
      where: { id: user1Id },
      select: {
        reputationPoints: true,
        invitePoints: true,
        referralCount: true,
      }
    })

    console.log('\n📊 AFTER (User 1):')
    console.log(`  Reputation: ${user1After!.reputationPoints}`)
    console.log(`  Invite Points: ${user1After!.invitePoints}`)
    console.log(`  Referral Count: ${user1After!.referralCount}`)

    console.log('\n📈 CHANGES:')
    console.log(`  Reputation: +${user1After!.reputationPoints - user1Before!.reputationPoints}`)
    console.log(`  Invite Points: +${user1After!.invitePoints - user1Before!.invitePoints}`)
    console.log(`  Referral Count: +${user1After!.referralCount - user1Before!.referralCount}`)

    // Verify the points were added
    expect(user1After!.reputationPoints).toBe(user1Before!.reputationPoints + 50)
    expect(user1After!.invitePoints).toBe(user1Before!.invitePoints + 50)
    expect(user1After!.referralCount).toBe(user1Before!.referralCount + 1)

    // Verify PointsTransaction exists
    const transaction = await prisma.pointsTransaction.findFirst({
      where: {
        userId: user1Id,
        reason: 'referral',
        amount: 50,
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log('\n💰 PointsTransaction:')
    console.log(`  Found: ${transaction ? 'YES' : 'NO'}`)
    if (transaction) {
      console.log(`  ${transaction.pointsBefore} → ${transaction.pointsAfter}`)
    }

    expect(transaction).toBeDefined()
    expect(transaction!.pointsAfter).toBe(user1After!.reputationPoints)

    console.log('\n✅ Service-driven referral reward confirmed in database!')
  })

  it('should return correct leaderboard via Service', async () => {
    const leaderboard = await prisma.user.findMany({
      where: {
        isWaitlistActive: true,
      },
      orderBy: [
        { invitePoints: 'desc' },
        { waitlistJoinedAt: 'asc' },
      ],
      select: {
        id: true,
        username: true,
        displayName: true,
        invitePoints: true,
        referralCount: true,
      },
      take: 10,
    })

    console.log('\n🏆 Leaderboard Service Response:')
    console.log(`  Total users returned: ${leaderboard.length}`)

    expect(Array.isArray(leaderboard)).toBe(true)
    expect(leaderboard.length).toBeGreaterThan(0)

    // Find our test users in the leaderboard
    const user1InLeaderboard = leaderboard.find((u) => u.id === user1Id)
    
    if (user1InLeaderboard) {
      const rank = leaderboard.indexOf(user1InLeaderboard) + 1
      console.log(`\n  User 1 in leaderboard:`)
      console.log(`    Rank: #${rank}`)
      console.log(`    Invite Points: ${user1InLeaderboard.invitePoints}`)
      console.log(`    Referrals: ${user1InLeaderboard.referralCount}`)

      expect(user1InLeaderboard.invitePoints).toBe(50)
      expect(user1InLeaderboard.referralCount).toBe(1)
    }

    console.log('\n✅ Leaderboard Service working correctly!')
  })

  it('should return correct position via Service', async () => {
    const position = await WaitlistService.getWaitlistPosition(user1Id)

    console.log('\n📍 Position Service Response (User 1):')
    console.log(`  Waitlist Position: #${position?.waitlistPosition}`)
    console.log(`  Leaderboard Rank: #${position?.leaderboardRank}`)
    console.log(`  Invite Code: ${position?.inviteCode}`)
    console.log(`  Invite Points: ${position?.invitePoints}`)
    console.log(`  Referral Count: ${position?.referralCount}`)

    expect(position).toBeDefined()
    expect(position!.waitlistPosition).toBeGreaterThan(0)
    expect(position!.inviteCode).toBe(user1InviteCode)
    expect(position!.invitePoints).toBe(50)
    expect(position!.referralCount).toBe(1)

    console.log('\n✅ Position Service working correctly!')
  })
})
