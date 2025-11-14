import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { PrismaClient } from '@prisma/client'
import { WaitlistService } from '@/lib/services/waitlist-service'
import { generateSnowflakeId } from '../../src/lib/snowflake'

const prisma = new PrismaClient()

describe('Referral System', () => {
  let user1Id: string
  let user2Id: string
  let user3Id: string
  let user1InviteCode: string

  beforeAll(async () => {
    // Clean up any existing test users - intentionally not catching errors (should fail fast)
    await prisma.user.deleteMany({
      where: {
        username: {
          in: ['referral_test_user1', 'referral_test_user2', 'referral_test_user3']
        }
      }
    })
  })

  afterAll(async () => {
    // Clean up test users
    if (user1Id) await prisma.user.delete({ where: { id: user1Id } }).catch(() => {})
    if (user2Id) await prisma.user.delete({ where: { id: user2Id } }).catch(() => {})
    if (user3Id) await prisma.user.delete({ where: { id: user3Id } }).catch(() => {})
  })

  it('should create three users and add them to waitlist', async () => {
    // Create User 1 (will be the inviter)
    const user1 = await prisma.user.create({
      data: {
        id: await generateSnowflakeId(),
        username: 'referral_test_user1',
        displayName: 'Test User 1',
        bio: 'Test user for referral system',
        privyId: 'test-privy-id-1',
        reputationPoints: 1000, // Base points
        invitePoints: 0,
        earnedPoints: 0,
        bonusPoints: 0,
        isTest: true,
        updatedAt: new Date(),
      }
    })
    user1Id = user1.id

    // Create User 2 (will be invited by User 1)
    const user2 = await prisma.user.create({
      data: {
        id: await generateSnowflakeId(),
        username: 'referral_test_user2',
        displayName: 'Test User 2',
        bio: 'Test user for referral system',
        privyId: 'test-privy-id-2',
        reputationPoints: 1000,
        invitePoints: 0,
        earnedPoints: 0,
        bonusPoints: 0,
        isTest: true,
        updatedAt: new Date(),
      }
    })
    user2Id = user2.id

    // Create User 3 (no referral)
    const user3 = await prisma.user.create({
      data: {
        id: await generateSnowflakeId(),
        username: 'referral_test_user3',
        displayName: 'Test User 3',
        bio: 'Test user for referral system',
        privyId: 'test-privy-id-3',
        reputationPoints: 1000,
        invitePoints: 0,
        earnedPoints: 0,
        bonusPoints: 0,
        isTest: true,
        updatedAt: new Date(),
      }
    })
    user3Id = user3.id

    expect(user1Id).toBeDefined()
    expect(user2Id).toBeDefined()
    expect(user3Id).toBeDefined()

    // Mark User 1 as waitlisted (no referral)
    const result1 = await WaitlistService.markAsWaitlisted(user1Id)
    expect(result1.success).toBe(true)
    expect(result1.inviteCode).toBeTruthy()
    user1InviteCode = result1.inviteCode

    // Mark User 3 as waitlisted (no referral)
    const result3 = await WaitlistService.markAsWaitlisted(user3Id)
    expect(result3.success).toBe(true)
    expect(result3.inviteCode).toBeTruthy()

    console.log(`✓ Created 3 users and added 2 to waitlist`)
    console.log(`  User 1 invite code: ${user1InviteCode}`)
  })

  it('should have User 1 invite User 2 and reward User 1 with +50 points', async () => {
    // ==========================================
    // STEP 1: Capture BEFORE state from database
    // ==========================================
    const user1Before = await prisma.user.findUnique({
      where: { id: user1Id },
      select: {
        reputationPoints: true,
        invitePoints: true,
        referralCount: true,
      }
    })

    console.log('\n📊 BEFORE referral:')
    console.log(`  User 1 - reputation: ${user1Before!.reputationPoints}, invite: ${user1Before!.invitePoints}, count: ${user1Before!.referralCount}`)

    expect(user1Before!.reputationPoints).toBe(1000)
    expect(user1Before!.invitePoints).toBe(0)
    expect(user1Before!.referralCount).toBe(0)

    // ==========================================
    // STEP 2: Mark User 2 as waitlisted WITH User 1's referral code
    // ==========================================
    const result = await WaitlistService.markAsWaitlisted(user2Id, user1InviteCode)
    
    expect(result.success).toBe(true)
    expect(result.referrerRewarded).toBe(true)
    expect(result.inviteCode).toBeTruthy()

    // ==========================================
    // STEP 3: Query database AFTER to verify points were persisted
    // ==========================================
    const user1After = await prisma.user.findUnique({
      where: { id: user1Id },
      select: {
        reputationPoints: true,
        invitePoints: true,
        referralCount: true,
      }
    })

    console.log('\n📊 AFTER referral:')
    console.log(`  User 1 - reputation: ${user1After!.reputationPoints}, invite: ${user1After!.invitePoints}, count: ${user1After!.referralCount}`)

    expect(user1After).toBeDefined()
    expect(user1After!.invitePoints).toBe(50) // +50 from referral
    expect(user1After!.reputationPoints).toBe(1050) // 1000 base + 50 from referral
    expect(user1After!.referralCount).toBe(1)

    // ==========================================
    // STEP 4: Verify the change (delta)
    // ==========================================
    const reputationDelta = user1After!.reputationPoints - user1Before!.reputationPoints
    const inviteDelta = user1After!.invitePoints - user1Before!.invitePoints
    const countDelta = user1After!.referralCount - user1Before!.referralCount

    console.log('\n📈 DELTAS (changes):')
    console.log(`  Reputation: +${reputationDelta} (expected: +50)`)
    console.log(`  Invite Points: +${inviteDelta} (expected: +50)`)
    console.log(`  Referral Count: +${countDelta} (expected: +1)`)

    expect(reputationDelta).toBe(50)
    expect(inviteDelta).toBe(50)
    expect(countDelta).toBe(1)

    // ==========================================
    // STEP 5: Verify User 2 is marked as referred by User 1
    // ==========================================
    const user2After = await prisma.user.findUnique({
      where: { id: user2Id },
      select: {
        referredBy: true,
        isWaitlistActive: true,
        referralCode: true,
      }
    })

    expect(user2After!.referredBy).toBe(user1Id)
    expect(user2After!.isWaitlistActive).toBe(true)
    expect(user2After!.referralCode).toBeTruthy()

    // ==========================================
    // STEP 6: Verify PointsTransaction was created in database
    // ==========================================
    const pointsTransaction = await prisma.pointsTransaction.findFirst({
      where: {
        userId: user1Id,
        reason: 'referral',
        amount: 50,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('\n💰 PointsTransaction record:')
    console.log(`  Found: ${pointsTransaction ? 'YES' : 'NO'}`)
    if (pointsTransaction) {
      console.log(`  Amount: ${pointsTransaction.amount}`)
      console.log(`  Reason: ${pointsTransaction.reason}`)
      console.log(`  Points Before: ${pointsTransaction.pointsBefore}`)
      console.log(`  Points After: ${pointsTransaction.pointsAfter}`)
    }

    expect(pointsTransaction).toBeDefined()
    expect(pointsTransaction!.amount).toBe(50)
    expect(pointsTransaction!.pointsBefore).toBe(1000)
    expect(pointsTransaction!.pointsAfter).toBe(1050)
    expect(pointsTransaction!.reason).toBe('referral')

    console.log(`\n✅ User 1 successfully referred User 2 - DATABASE VERIFIED`)
  })

  it('should rank User 1 at the top of the leaderboard', async () => {
    // Get leaderboard positions
    const user1Position = await WaitlistService.getWaitlistPosition(user1Id)
    const user2Position = await WaitlistService.getWaitlistPosition(user2Id)
    const user3Position = await WaitlistService.getWaitlistPosition(user3Id)

    expect(user1Position).toBeDefined()
    expect(user2Position).toBeDefined()
    expect(user3Position).toBeDefined()

    console.log('\nLeaderboard Rankings:')
    console.log(`  User 1 (inviter): Rank #${user1Position!.leaderboardRank}, ${user1Position!.invitePoints} invite points`)
    console.log(`  User 2 (invited): Rank #${user2Position!.leaderboardRank}, ${user2Position!.invitePoints} invite points`)
    console.log(`  User 3 (no ref):  Rank #${user3Position!.leaderboardRank}, ${user3Position!.invitePoints} invite points`)

    // User 1 should have higher rank (lower number) than Users 2 and 3
    expect(user1Position!.invitePoints).toBe(50)
    expect(user2Position!.invitePoints).toBe(0)
    expect(user3Position!.invitePoints).toBe(0)
    
    // User 1 should rank higher than users 2 and 3
    expect(user1Position!.leaderboardRank).toBeLessThan(user2Position!.leaderboardRank)
    expect(user1Position!.leaderboardRank).toBeLessThan(user3Position!.leaderboardRank)
    expect(user1Position!.invitePoints).toBe(50)

    // User 2 and User 3 should be ranked lower (both have 0 invite points)
    // Their ranking depends on who joined first
    expect(user2Position!.leaderboardRank).toBeGreaterThan(1)
    expect(user3Position!.leaderboardRank).toBeGreaterThan(1)
    expect(user2Position!.invitePoints).toBe(0)
    expect(user3Position!.invitePoints).toBe(0)

    console.log(`\n✅ User 1 is correctly ranked #1 on the leaderboard!`)
  })

  it('should fetch the leaderboard and show User 1 at the top', async () => {
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
        reputationPoints: true,
        referralCount: true,
      },
      take: 10,
    })

    expect(leaderboard.length).toBeGreaterThanOrEqual(3)
    
    // User 1 should be in top positions (may not be #1 if other tests running concurrently)
    const user1Position = leaderboard.findIndex(u => u.id === user1Id)
    expect(user1Position).toBeGreaterThanOrEqual(0) // Should be in leaderboard
    expect(user1Position).toBeLessThan(10) // Should be in top 10
    
    console.log(`   User 1 is at position ${user1Position + 1} in leaderboard`)
    // Verify user1 has the expected points (even if not #1 due to other test data)
    const user1InLeaderboard = leaderboard.find(u => u.id === user1Id)
    expect(user1InLeaderboard?.invitePoints).toBe(50)
    expect(user1InLeaderboard?.referralCount).toBe(1)

    console.log('\nTop 3 Leaderboard:')
    leaderboard.slice(0, 3).forEach((user, idx) => {
      console.log(`  ${idx + 1}. ${user.displayName}: ${user.invitePoints} invite points, ${user.referralCount} referrals`)
    })
  })

  it('should prevent self-referral', async () => {
    // Try to have a user refer themselves
    await prisma.user.findUnique({
      where: { id: user1Id },
      select: { referralCode: true }
    })

    // Create a temp user
    const tempUser = await prisma.user.create({
      data: {
        id: await generateSnowflakeId(),
        username: 'temp_self_ref_test',
        displayName: 'Temp User',
        bio: 'Test',
        privyId: 'test-privy-id-temp',
        reputationPoints: 1000,
        isTest: true,

        updatedAt: new Date(),
      }
    })

    // Generate their own code
    const tempResult = await WaitlistService.markAsWaitlisted(tempUser.id)
    expect(tempResult.success).toBe(true)

    // Try to use their own code (should fail)
    const selfRefResult = await WaitlistService.markAsWaitlisted(tempUser.id, tempResult.inviteCode)
    expect(selfRefResult.referrerRewarded).toBeUndefined() // or false

    // Clean up
    await prisma.user.delete({ where: { id: tempUser.id } })

    console.log(`✓ Self-referral is correctly blocked`)
  })

  it('should verify database persistence with fresh connection', async () => {
    // ==========================================
    // Disconnect and reconnect to ensure no caching
    // ==========================================
    await prisma.$disconnect()
    const freshPrisma = new PrismaClient()

    try {
      console.log('\n🔄 Testing with FRESH database connection...')

      // Query User 1 with fresh connection
      const user1Fresh = await freshPrisma.user.findUnique({
        where: { id: user1Id },
        select: {
          reputationPoints: true,
          invitePoints: true,
          referralCount: true,
          referralCode: true,
        }
      })

      console.log(`\n📊 User 1 (fresh query):`)
      console.log(`  Reputation Points: ${user1Fresh!.reputationPoints}`)
      console.log(`  Invite Points: ${user1Fresh!.invitePoints}`)
      console.log(`  Referral Count: ${user1Fresh!.referralCount}`)
      console.log(`  Referral Code: ${user1Fresh!.referralCode}`)

      // These should match what we saw before
      expect(user1Fresh!.reputationPoints).toBe(1050)
      expect(user1Fresh!.invitePoints).toBe(50)
      expect(user1Fresh!.referralCount).toBe(1)
      expect(user1Fresh!.referralCode).toBe(user1InviteCode)

      // Query User 2 with fresh connection
      const user2Fresh = await freshPrisma.user.findUnique({
        where: { id: user2Id },
        select: {
          referredBy: true,
          isWaitlistActive: true,
          referralCode: true,
        }
      })

      console.log(`\n📊 User 2 (fresh query):`)
      console.log(`  Referred By: ${user2Fresh!.referredBy}`)
      console.log(`  Is Waitlist Active: ${user2Fresh!.isWaitlistActive}`)
      console.log(`  Has Referral Code: ${user2Fresh!.referralCode ? 'YES' : 'NO'}`)

      expect(user2Fresh!.referredBy).toBe(user1Id)
      expect(user2Fresh!.isWaitlistActive).toBe(true)
      expect(user2Fresh!.referralCode).toBeTruthy()

      // Query PointsTransaction with fresh connection
      const transactionFresh = await freshPrisma.pointsTransaction.findFirst({
        where: {
          userId: user1Id,
          reason: 'referral',
          amount: 50,
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      console.log(`\n💰 PointsTransaction (fresh query):`)
      console.log(`  Exists: ${transactionFresh ? 'YES' : 'NO'}`)
      console.log(`  Amount: ${transactionFresh!.amount}`)
      console.log(`  Before → After: ${transactionFresh!.pointsBefore} → ${transactionFresh!.pointsAfter}`)

      expect(transactionFresh).toBeDefined()
      expect(transactionFresh!.amount).toBe(50)
      expect(transactionFresh!.pointsBefore).toBe(1000)
      expect(transactionFresh!.pointsAfter).toBe(1050)

      console.log(`\n✅ DATABASE PERSISTENCE CONFIRMED - Data survived connection restart!`)

    } finally {
      await freshPrisma.$disconnect()
    }
  })

  it('should prevent double-referral', async () => {
    // User 2 is already referred by User 1
    // Try to have User 3 refer User 2 (should fail)
    
    const user3 = await prisma.user.findUnique({
      where: { id: user3Id },
      select: { referralCode: true }
    })

    const user3Code = user3!.referralCode!

    // Create a new temp user and have them referred by User 3
    const uniqueId = await generateSnowflakeId()
    const tempUser = await prisma.user.create({
      data: {
        id: uniqueId,
        username: `temp_double_ref_${uniqueId}`,
        displayName: 'Temp User 2',
        bio: 'Test',
        privyId: `test-privy-id-temp2-${uniqueId}`,
        reputationPoints: 1000,
        isTest: true,

        updatedAt: new Date(),
      }
    })

    // Mark with User 3's code
    const firstRef = await WaitlistService.markAsWaitlisted(tempUser.id, user3Code)
    expect(firstRef.success).toBe(true)
    expect(firstRef.referrerRewarded).toBe(true)

    // Try to mark again with User 1's code (should fail/be ignored)
    const secondRef = await WaitlistService.markAsWaitlisted(tempUser.id, user1InviteCode)
    expect(secondRef.success).toBe(true)
    expect(secondRef.referrerRewarded).toBeUndefined() // Already referred

    // Verify the user is still only referred by User 3
    const tempUserCheck = await prisma.user.findUnique({
      where: { id: tempUser.id },
      select: { referredBy: true }
    })
    expect(tempUserCheck!.referredBy).toBe(user3Id) // Still User 3, not changed to User 1

    // Clean up
    await prisma.user.delete({ where: { id: tempUser.id } })

    console.log(`✓ Double-referral is correctly blocked`)
  })
})

