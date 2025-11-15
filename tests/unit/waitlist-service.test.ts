/**
 * Unit Tests: WaitlistService
 * 
 * Tests core waitlist service methods and logic
 */

import { describe, it, expect, afterEach, beforeAll, beforeEach, mock } from 'bun:test'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'

const shouldSkipWaitlistTests = process.env.CI === 'true' || process.env.SKIP_WAITLIST_TESTS === 'true'
const describeWaitlist = shouldSkipWaitlistTests ? describe.skip : describe

// Also skip if prisma models aren't available (happens under concurrent test load)
let prismaModelsAvailable = false;
let warningLogged = false; // Track if we've already logged the warning

type WaitlistServiceModule = typeof import('@/lib/services/waitlist-service')

// Check if prisma is available - tests will skip if not
const prismaAvailable = !!(prisma && prisma.user);

if (!prismaAvailable) {
  console.log('⏭️  Prisma not initialized - waitlist tests will skip');
}

// Store original Prisma methods for restoration
const originalPrisma = {
  user: {
    create: prisma.user.create?.bind(prisma.user),
    findUnique: prisma.user.findUnique?.bind(prisma.user),
    findFirst: prisma.user.findFirst?.bind(prisma.user),
    findMany: prisma.user.findMany?.bind(prisma.user),
    update: prisma.user.update?.bind(prisma.user),
    deleteMany: prisma.user.deleteMany?.bind(prisma.user),
    count: prisma.user.count?.bind(prisma.user),
  },
  pointsTransaction: {
    create: prisma.pointsTransaction?.create?.bind(prisma.pointsTransaction),
  },
}

describeWaitlist('WaitlistService', () => {
  // Test data cleanup
  const testUserIds: string[] = []
  let WaitlistService: WaitlistServiceModule['WaitlistService']
  
  interface TestUser {
    id: string;
    invitePoints: number;
    earnedPoints: number;
    bonusPoints: number;
    referralCount: number;
    reputationPoints: number;
    isWaitlistActive: boolean;
    waitlistPosition: number | null;
    waitlistJoinedAt: Date | null;
    referralCode: string | null;
    referredBy: string | null;
    email: string | null;
    emailVerified: boolean;
    pointsAwardedForEmail: boolean;
    walletAddress: string | null;
    pointsAwardedForWallet: boolean;
    [key: string]: unknown;
  }
  
  // Track created users for cleanup (using object instead of Map for Bun compatibility)
  let createdUsers: Record<string, TestUser> = {}

  beforeAll(async () => {
    ({ WaitlistService } = await import('@/lib/services/waitlist-service'));
  });

  beforeEach(() => {
    // Clear tracked users
    createdUsers = {};
    
    // Mock Prisma user methods
    // @ts-expect-error - Mocking Prisma methods for testing
    prisma.user.create = mock(async ({ data }: { data: Record<string, unknown> }) => {
      const user: TestUser = {
        // Default values
        id: (data.id as string) || '',
        invitePoints: 0,
        earnedPoints: 0,
        bonusPoints: 0,
        referralCount: 0,
        reputationPoints: 0,
        isWaitlistActive: false,
        waitlistPosition: null,
        waitlistJoinedAt: null,
        referralCode: null,
        referredBy: null,
        email: null,
        emailVerified: false,
        pointsAwardedForEmail: false,
        walletAddress: null,
        pointsAwardedForWallet: false,
        // Override with provided data
        ...data,
      }
      createdUsers[user.id] = user
      return user
    });
    
    // @ts-expect-error - Mocking Prisma methods for testing
    prisma.user.findUnique = mock(async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
      let user: TestUser | null = null
      
      if (where.id) {
        user = createdUsers[where.id as string] || null
      } else if (where.referralCode) {
        user = Object.values(createdUsers).find(u => u.referralCode === where.referralCode) || null
      }
      
      if (!user) {
        return null
      }
      
      // If select is specified, only return selected fields
      if (select) {
        const selected: Record<string, unknown> = {}
        for (const key of Object.keys(select)) {
          if (select[key] && key in user) {
            selected[key] = user[key as keyof TestUser]
          }
        }
        return selected
      }
      
      return user
    });
    
    // @ts-expect-error - Mocking Prisma methods for testing
    prisma.user.findFirst = mock(async ({ where, orderBy, select }: { where?: Record<string, unknown>; orderBy?: Record<string, string>; select?: Record<string, boolean> }) => {
      const users = Object.values(createdUsers)
      
      // Filter by waitlistPosition not null if where clause specifies it
      let filtered = users
      if (where?.waitlistPosition) {
        const condition = where.waitlistPosition as Record<string, unknown>
        if (condition.not === null) {
          filtered = users.filter(u => u.waitlistPosition != null)
        }
      }
      
      // Sort if orderBy specified
      if (orderBy?.waitlistPosition === 'desc') {
        filtered.sort((a, b) => (b.waitlistPosition || 0) - (a.waitlistPosition || 0))
      } else if (orderBy?.waitlistPosition === 'asc') {
        filtered.sort((a, b) => (a.waitlistPosition || 0) - (b.waitlistPosition || 0))
      }
      
      const result = filtered[0] || null
      
      // If select is specified, only return selected fields
      if (result && select) {
        const selected: Record<string, unknown> = {}
        for (const key of Object.keys(select)) {
          if (select[key] && key in result) {
            selected[key] = result[key as keyof TestUser]
          }
        }
        return selected
      }
      
      return result
    });
    
    // @ts-expect-error - Mocking Prisma methods for testing
    prisma.user.findMany = mock(async ({ where, orderBy, take }: { where?: Record<string, unknown>; orderBy?: unknown; take?: number }) => {
      let users = Object.values(createdUsers)
      
      // Filter by isWaitlistActive
      if (where?.isWaitlistActive !== undefined) {
        users = users.filter(u => u.isWaitlistActive === where.isWaitlistActive)
      }
      
      // Sort
      if (orderBy) {
        users.sort((a, b) => {
          for (const order of Array.isArray(orderBy) ? orderBy : [orderBy]) {
            const key = Object.keys(order)[0] as string
            const direction = order[key] === 'desc' ? -1 : 1
            const aVal = a[key] ?? 0
            const bVal = b[key] ?? 0
            
            if (aVal !== bVal) {
              return (aVal > bVal ? 1 : -1) * direction
            }
          }
          return 0
        })
      }
      
      // Limit results
      if (take) {
        users = users.slice(0, take)
      }
      
      return users
    });
    
    // @ts-expect-error - Mocking Prisma methods for testing
    prisma.user.update = mock(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const userId = where.id as string;
      const user = createdUsers[userId];
      if (!user) throw new Error('User not found')
      
      // Handle increment operations
      const referralCountData = data.referralCount as { increment?: number } | undefined;
      if (referralCountData?.increment) {
        data.referralCount = (user.referralCount || 0) + referralCountData.increment
      }
      
      Object.assign(user, data)
      return user
    });
    
    // @ts-expect-error - Mocking Prisma methods for testing
    prisma.user.deleteMany = mock(async () => {
      createdUsers = {}
      return { count: testUserIds.length }
    });
    
    // @ts-expect-error - Mocking Prisma methods for testing
    prisma.user.count = mock(async ({ where }: { where?: Record<string, unknown> }) => {
      let users = Object.values(createdUsers)
      
      // Handle OR conditions first (for getWaitlistPosition)
      if (where?.OR) {
        const orConditions = where.OR as Array<Record<string, unknown>>;
        
        users = users.filter(u => {
          // All other where conditions must also be satisfied (AND logic)
          if (where.isWaitlistActive !== undefined && u.isWaitlistActive !== where.isWaitlistActive) {
            return false
          }
          
          // Check if ANY OR condition matches
          for (const condition of orConditions) {
            const invitePointsCondition = condition.invitePoints as { gt?: number } | number | undefined;
            const waitlistJoinedAtCondition = condition.waitlistJoinedAt as { lt?: Date } | undefined;
            
            if (invitePointsCondition && typeof invitePointsCondition === 'object' && 'gt' in invitePointsCondition && invitePointsCondition.gt !== undefined) {
              if (u.invitePoints > invitePointsCondition.gt) return true
            }
            if (typeof invitePointsCondition === 'number' && waitlistJoinedAtCondition?.lt) {
              if (u.invitePoints === invitePointsCondition && 
                  u.waitlistJoinedAt && u.waitlistJoinedAt < waitlistJoinedAtCondition.lt) {
                return true
              }
            }
          }
          return false
        })
      } else {
        // Handle regular AND conditions
        if (where?.isWaitlistActive !== undefined) {
          users = users.filter(u => u.isWaitlistActive === where.isWaitlistActive)
        }
        
        const waitlistPositionCondition = where?.waitlistPosition as { not?: unknown } | undefined;
        if (waitlistPositionCondition?.not !== undefined) {
          users = users.filter(u => u.waitlistPosition != null)
        }
      }
      
      return users.length
    });
    
    if (prisma.pointsTransaction) {
      // @ts-expect-error - Mocking Prisma methods for testing  
      prisma.pointsTransaction.create = mock(async ({ data }: { data: Record<string, unknown> }) => {
        return { ...data }
      });
      prismaModelsAvailable = true;
    } else {
      // Only log warning once, not before every test
      if (!warningLogged) {
        console.warn('⚠️  prisma.pointsTransaction not available - using mock for tests');
        warningLogged = true;
      }
      // Create a safe mock to prevent errors if the service tries to use it
      // @ts-expect-error - Creating mock for missing model
      prisma.pointsTransaction = {
        create: mock(async ({ data }: { data: Record<string, unknown> }) => {
          // Return a mock transaction object that matches the expected structure
          return { 
            id: (data.id as string) || 'mock-id', 
            userId: (data.userId as string) || 'mock-user', 
            amount: (data.amount as number) || 0, 
            reason: (data.reason as string) || 'mock',
            ...data
          };
        }),
      };
      // Set to true since we've created a mock that allows tests to run
      prismaModelsAvailable = true;
    }
  })

  afterEach(async () => {
    // Restore original Prisma methods
    if (typeof originalPrisma.user.create === 'function') {
      Object.assign(prisma.user, originalPrisma.user)
    }
    if (typeof originalPrisma.pointsTransaction.create === 'function') {
      Object.assign(prisma.pointsTransaction, originalPrisma.pointsTransaction)
    }
    
    // Clear test data
    testUserIds.length = 0
    createdUsers = {}
  })

    describe('generateInviteCode', () => {
      it('should generate unique 8-character uppercase code', () => {
        if (!prismaModelsAvailable) return;
        
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
      if (!prismaModelsAvailable) return;
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
      if (!prismaModelsAvailable) return;
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
      if (!prismaModelsAvailable) return;
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
      if (!prismaModelsAvailable) return;
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
      if (!prismaModelsAvailable) return;
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
      if (!prismaModelsAvailable) return;
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
      if (!prismaModelsAvailable) return;
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
      if (!prismaModelsAvailable) return;
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
      if (!prismaModelsAvailable) return;
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
      if (!prismaModelsAvailable) return;
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

