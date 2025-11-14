/**
 * Unit Tests: WaitlistService
 * 
 * Tests core waitlist service methods and logic
 */

import { describe, it, expect, afterEach, beforeAll } from 'bun:test'
import { db } from '@/lib/database-service'
import { generateSnowflakeId } from '@/lib/snowflake'

const prisma = db.prisma
const shouldSkipWaitlistTests = process.env.CI === 'true' || process.env.SKIP_WAITLIST_TESTS === 'true'
const describeWaitlist = shouldSkipWaitlistTests ? describe.skip : describe

type WaitlistServiceModule = typeof import('@/lib/services/waitlist-service')

describeWaitlist('WaitlistService', () => {
  // Test data cleanup
  const testUserIds: string[] = []
  let WaitlistService: WaitlistServiceModule['WaitlistService']

  beforeAll(async () => {
    ({ WaitlistService } = await import('@/lib/services/waitlist-service'))
  })

  afterEach(async () => {
    // Clean up test users
    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      })
      testUserIds.length = 0
    }
  })

    describe('generateInviteCode', () => {
      it('should generate unique 8-character uppercase code', () => {
        // Generate multiple codes to test uniqueness
        const codes = Array.from({ length: 10 }, () => WaitlistService.generateInviteCode())
        
        // All should be 8 characters
        codes.forEach(code => {
          expect(code).toHaveLength(8)
          expect(code).toMatch(/^[A-Z0-9_-]{8}$/)
        })
        
        // At least some should be unique (nanoid has tiny collision probability)
        const uniqueCodes = new Set(codes)
        expect(uniqueCodes.size).toBeGreaterThan(1)
      })
    })

    describe('markAsWaitlisted', () => {
      it('should mark an existing user as waitlisted', async () => {
        // Create a test user first
        const user = await prisma.user.create({
          data: {
            id: await generateSnowflakeId(),
            privyId: `test-privy-${Date.now()}`,
            username: `testuser${Date.now()}`,
            displayName: 'Test User',
            reputationPoints: 100,
            profileComplete: true,
            isTest: true,
            updatedAt: new Date(),
          },
        })
        testUserIds.push(user.id)

        // Mark as waitlisted
        const result = await WaitlistService.markAsWaitlisted(user.id)

        expect(result.success).toBe(true)
        expect(result.waitlistPosition).toBeGreaterThan(0)
        expect(result.inviteCode).toHaveLength(8)
        expect(result.points).toBe(100)

        // Verify in database
        const updatedUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            isWaitlistActive: true,
            waitlistPosition: true,
            referralCode: true,
          },
        })

        expect(updatedUser?.isWaitlistActive).toBe(true)
        expect(updatedUser?.waitlistPosition).toBeGreaterThan(0)
        expect(updatedUser?.referralCode).toBeTruthy()
      })

      it('should prevent self-referral', async () => {
        const user = await prisma.user.create({
          data: {
            id: await generateSnowflakeId(),
            privyId: `test-privy-${Date.now()}`,
            username: `testuser${Date.now()}`,
            displayName: 'Test User',
            reputationPoints: 100,
            profileComplete: true,
            referralCode: 'SELFREF1',
            isTest: true,
            updatedAt: new Date(),
          },
        })
        testUserIds.push(user.id)

        // Try to use own referral code
        const result = await WaitlistService.markAsWaitlisted(user.id, 'SELFREF1')

        expect(result.success).toBe(true)
        expect(result.referrerRewarded).toBe(false) // Should not reward self

        // Verify no invite points awarded
        const updatedUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { invitePoints: true },
        })

        expect(updatedUser?.invitePoints).toBe(0)
      })

      it('should prevent double-referral', async () => {
        // Create referrer
        const referrer = await prisma.user.create({
          data: {
            id: await generateSnowflakeId(),
            privyId: `test-privy-ref-${Date.now()}`,
            username: `referrer${Date.now()}`,
            displayName: 'Referrer',
            reputationPoints: 100,
            profileComplete: true,
            referralCode: 'REF12345',
            isTest: true,
            updatedAt: new Date(),
          },
        })
        testUserIds.push(referrer.id)

        // Create user already referred by someone else
        const user = await prisma.user.create({
          data: {
            id: await generateSnowflakeId(),
            privyId: `test-privy-${Date.now()}`,
            username: `testuser${Date.now()}`,
            displayName: 'Test User',
            reputationPoints: 100,
            profileComplete: true,
            referredBy: 'someone-else-id',
            isTest: true,
            updatedAt: new Date(),
          },
        })
        testUserIds.push(user.id)

        // Try to refer again with different code
        const result = await WaitlistService.markAsWaitlisted(user.id, 'REF12345')

        expect(result.success).toBe(true)
        expect(result.referrerRewarded).toBe(false) // Should not reward (already referred)

        // Referrer should not get points
        const updatedReferrer = await prisma.user.findUnique({
          where: { id: referrer.id },
          select: { invitePoints: true, referralCount: true },
        })

        expect(updatedReferrer?.invitePoints).toBe(0)
        expect(updatedReferrer?.referralCount).toBe(0)
      })

      it('should award +50 points to referrer on valid referral', async () => {
        // Create referrer
        const referrer = await prisma.user.create({
          data: {
            id: await generateSnowflakeId(),
            privyId: `test-privy-ref-${Date.now()}`,
            username: `referrer${Date.now()}`,
            displayName: 'Referrer',
            reputationPoints: 100,
            profileComplete: true,
            referralCode: 'VALIDREF',
            isTest: true,
            updatedAt: new Date(),
          },
        })
        testUserIds.push(referrer.id)

        // Create new user
        const user = await prisma.user.create({
          data: {
            id: await generateSnowflakeId(),
            privyId: `test-privy-${Date.now()}`,
            username: `testuser${Date.now()}`,
            displayName: 'Test User',
            reputationPoints: 100,
            profileComplete: true,
            isTest: true,
            updatedAt: new Date(),
          },
        })
        testUserIds.push(user.id)

        // Mark as waitlisted with referral code
        const result = await WaitlistService.markAsWaitlisted(user.id, 'VALIDREF')

        expect(result.success).toBe(true)
        expect(result.referrerRewarded).toBe(true)

        // Verify referrer got +50 points
        const updatedReferrer = await prisma.user.findUnique({
          where: { id: referrer.id },
          select: {
            invitePoints: true,
            reputationPoints: true,
            referralCount: true,
          },
        })

        expect(updatedReferrer?.invitePoints).toBe(50)
        expect(updatedReferrer?.reputationPoints).toBe(150) // 100 + 50
        expect(updatedReferrer?.referralCount).toBe(1)
      })
    })

    describe('getWaitlistPosition', () => {
      it('should calculate dynamic leaderboard rank based on invite points', async () => {
        // Create users with different invite points
        const userA = await prisma.user.create({
          data: {
            id: await generateSnowflakeId(),
            privyId: `test-a-${Date.now()}`,
            username: `usera${Date.now()}`,
            displayName: 'User A',
            reputationPoints: 100,
            invitePoints: 0, // No invites
            isWaitlistActive: true,
            waitlistPosition: 1, // Signed up first
            waitlistJoinedAt: new Date(Date.now() - 10000),
            isTest: true,
            updatedAt: new Date(),
          },
        })
        testUserIds.push(userA.id)

        const userB = await prisma.user.create({
          data: {
            id: await generateSnowflakeId(),
            privyId: `test-b-${Date.now()}`,
            username: `userb${Date.now()}`,
            displayName: 'User B',
            reputationPoints: 150,
            invitePoints: 50, // 1 invite
            isWaitlistActive: true,
            waitlistPosition: 2, // Signed up second
            waitlistJoinedAt: new Date(Date.now() - 5000),
            isTest: true,
            updatedAt: new Date(),
          },
        })
        testUserIds.push(userB.id)

        // Get positions
        const positionA = await WaitlistService.getWaitlistPosition(userA.id)
        const positionB = await WaitlistService.getWaitlistPosition(userB.id)

        // User B should rank higher than User A (more invite points)
        expect(positionB?.leaderboardRank).toBeLessThan(positionA!.leaderboardRank!)
        expect(positionB?.invitePoints).toBe(50)
        expect(positionA?.invitePoints).toBe(0)

        // Verify historical positions are different
        expect(positionA?.waitlistPosition).toBe(1)
        expect(positionB?.waitlistPosition).toBe(2)

        console.log('✅ Dynamic ranking works: User with more invites ranks higher!')
      })

      it('should handle tie-breaking by signup date', async () => {
        const now = Date.now()

        // Create two users with same invite points
        const user1 = await prisma.user.create({
          data: {
            id: await generateSnowflakeId(),
            privyId: `test-1-${now}`,
            username: `user1${now}`,
            displayName: 'User 1',
            invitePoints: 100,
            isWaitlistActive: true,
            waitlistPosition: 1,
            waitlistJoinedAt: new Date(now - 10000), // Earlier
            isTest: true,
            updatedAt: new Date(),
          },
        })
        testUserIds.push(user1.id)

        const user2 = await prisma.user.create({
          data: {
            id: await generateSnowflakeId(),
            privyId: `test-2-${now}`,
            username: `user2${now}`,
            displayName: 'User 2',
            invitePoints: 100, // Same points
            isWaitlistActive: true,
            waitlistPosition: 2,
            waitlistJoinedAt: new Date(now - 5000), // Later
            isTest: true,
            updatedAt: new Date(),
          },
        })
        testUserIds.push(user2.id)

        const position1 = await WaitlistService.getWaitlistPosition(user1.id)
        const position2 = await WaitlistService.getWaitlistPosition(user2.id)

        // User 1 should rank higher than User 2 (joined earlier with same points)
        expect(position1?.leaderboardRank).toBeLessThan(position2!.leaderboardRank!)
        expect(position1?.invitePoints).toBe(position2?.invitePoints) // Same points
        // Tie-breaking by signup date is handled internally - verify rankings are different
        expect(position1?.waitlistPosition).not.toBe(position2?.waitlistPosition)

        console.log('✅ Tie-breaking works: Earlier signup wins!')
      })

      it('should calculate percentile correctly', async () => {
        const user = await prisma.user.create({
          data: {
            id: await generateSnowflakeId(),
            privyId: `test-perc-${Date.now()}`,
            username: `userperc${Date.now()}`,
            displayName: 'User Percentile',
            invitePoints: 100,
            isWaitlistActive: true,
            waitlistPosition: 1,
            isTest: true,
            updatedAt: new Date(),
          },
        })
        testUserIds.push(user.id)

        const position = await WaitlistService.getWaitlistPosition(user.id)

        expect(position?.percentile).toBeGreaterThanOrEqual(0)
        expect(position?.percentile).toBeLessThanOrEqual(100)
        expect(position?.totalCount).toBeGreaterThan(0)

        console.log(`User is in top ${position?.percentile}%`)
      })
    })

    describe('bonuses', () => {
      it('should award email bonus only once', async () => {
        const user = await prisma.user.create({
          data: {
            id: await generateSnowflakeId(),
            privyId: `test-email-${Date.now()}`,
            username: `useremail${Date.now()}`,
            displayName: 'Test Email User',
            reputationPoints: 100,
            bonusPoints: 0,
            isTest: true,
            updatedAt: new Date(),
          },
        })
        testUserIds.push(user.id)

        // Award first time
        const awarded1 = await WaitlistService.awardEmailBonus(user.id, 'test@example.com')
        expect(awarded1).toBe(true)

        // Try to award again
        const awarded2 = await WaitlistService.awardEmailBonus(user.id, 'test2@example.com')
        expect(awarded2).toBe(false) // Should not award twice

        // Verify only 25 points awarded
        const updatedUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { bonusPoints: true, reputationPoints: true },
        })

        expect(updatedUser?.bonusPoints).toBe(25)
        expect(updatedUser?.reputationPoints).toBe(125) // 100 + 25
      })

      it('should award wallet bonus only once', async () => {
        const user = await prisma.user.create({
          data: {
            id: await generateSnowflakeId(),
            privyId: `test-wallet-${Date.now()}`,
            username: `userwallet${Date.now()}`,
            displayName: 'Test Wallet User',
            reputationPoints: 100,
            bonusPoints: 0,
            isTest: true,
            updatedAt: new Date(),
          },
        })
        testUserIds.push(user.id)

        // Award first time
        const awarded1 = await WaitlistService.awardWalletBonus(user.id, '0x1234')
        expect(awarded1).toBe(true)

        // Try to award again
        const awarded2 = await WaitlistService.awardWalletBonus(user.id, '0x5678')
        expect(awarded2).toBe(false) // Should not award twice

        // Verify only 25 points awarded
        const updatedUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { bonusPoints: true, reputationPoints: true },
        })

        expect(updatedUser?.bonusPoints).toBe(25)
        expect(updatedUser?.reputationPoints).toBe(125)
      })
    })

    describe('getTopWaitlistUsers', () => {
      it('should return users sorted by invite points', async () => {
        // Create users with different invite points
        const users = await Promise.all([
          prisma.user.create({
            data: {
              id: await generateSnowflakeId(),
              privyId: `test-top1-${Date.now()}`,
              username: `top1${Date.now()}`,
              displayName: 'Top 1',
              invitePoints: 150, // Most invites
              isWaitlistActive: true,
              isTest: true,

              updatedAt: new Date(),
            },
          }),
          prisma.user.create({
            data: {
              id: await generateSnowflakeId(),
              privyId: `test-top2-${Date.now()}`,
              username: `top2${Date.now()}`,
              displayName: 'Top 2',
              invitePoints: 100,
              isWaitlistActive: true,
              isTest: true,

              updatedAt: new Date(),
            },
          }),
          prisma.user.create({
            data: {
              id: await generateSnowflakeId(),
              privyId: `test-top3-${Date.now()}`,
              username: `top3${Date.now()}`,
              displayName: 'Top 3',
              invitePoints: 50,
              isWaitlistActive: true,
              isTest: true,

              updatedAt: new Date(),
            },
          }),
        ])
        testUserIds.push(...users.map(u => u.id))

        const topUsers = await WaitlistService.getTopWaitlistUsers(10) // Get more users to ensure ours are included

        expect(topUsers.length).toBeGreaterThanOrEqual(3)
        
        // Verify sorting is correct (descending by invite points)
        for (let i = 0; i < topUsers.length - 1; i++) {
          expect(topUsers[i]!.invitePoints).toBeGreaterThanOrEqual(topUsers[i + 1]!.invitePoints)
        }
        
        // Verify ranks are sequential
        for (let i = 0; i < Math.min(3, topUsers.length); i++) {
          expect(topUsers[i]!.rank).toBe(i + 1)
        }
        
        // Find our test users and verify their relative ordering
        const testUser150 = topUsers.find(u => u.invitePoints === 150 && testUserIds.includes(u.id))
        const testUser100 = topUsers.find(u => u.invitePoints === 100 && testUserIds.includes(u.id))
        const testUser50 = topUsers.find(u => u.invitePoints === 50 && testUserIds.includes(u.id))
        
        if (testUser150 && testUser100) {
          expect(testUser150.rank).toBeLessThan(testUser100.rank)
        }
        if (testUser100 && testUser50) {
          expect(testUser100.rank).toBeLessThan(testUser50.rank)
        }
      })
    })
  })

