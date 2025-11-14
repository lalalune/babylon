/**
 * Leaderboard API Integration Tests
 * 
 * Tests for GET /api/leaderboard with pointsType filtering
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '@/lib/database-service'
import { generateSnowflakeId } from '@/lib/snowflake'
import { Prisma } from '@prisma/client'

interface LeaderboardEntry {
  id: string
  rank: number
  username: string | null
  displayName: string | null
  profileImageUrl: string | null
  allPoints: number
  earnedPoints: number
  invitePoints: number
  bonusPoints: number
  referralCount: number
  balance: number
  lifetimePnL: number
  isActor: boolean
  tier: string | null
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[]
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
  minPoints: number
  pointsCategory: 'all' | 'earned' | 'referral'
}

// No defensive programming - let tests fail if server is not running

describe('Leaderboard API', () => {
  let testUserId: string

  beforeAll(async () => {
    // Create a test user with points
    testUserId = await generateSnowflakeId()
    
    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { id: testUserId } })
    if (existing) {
      await prisma.user.delete({ where: { id: testUserId } })
    }
    
    await prisma.user.create({
      data: {
        id: testUserId,
        privyId: `test-privy-${testUserId}`,
        username: `testuser-${testUserId.slice(-8)}`,
        displayName: 'Test User',
        email: `test-${testUserId}@example.com`,
        reputationPoints: 1500, // Base 100 + 500 invite + 400 earned + 500 bonus
        invitePoints: 500,
        earnedPoints: 400,
        bonusPoints: 500,
        referralCount: 2,
        virtualBalance: new Prisma.Decimal(10000),
        lifetimePnL: new Prisma.Decimal(4000), // $4000 P&L = 400 earned points
          isTest: true,
        updatedAt: new Date(),
        isActor: false, // Explicitly set as real user
      },
    })
  })

  afterAll(async () => {
    await prisma.user.delete({ where: { id: testUserId } })
  })

  describe('GET /api/leaderboard', () => {
    it('should return leaderboard with default "all" points type', async () => {
      const response = await fetch('http://localhost:3000/api/leaderboard?page=1&pageSize=100&minPoints=500')
      
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.leaderboard).toBeDefined()
      expect(Array.isArray(data.leaderboard)).toBe(true)
      expect(data.pagination).toBeDefined()
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.pageSize).toBe(100)
      expect(data.pointsCategory).toBe('all')
    })

    it('should filter by "earned" points type', async () => {
      const response = await fetch('http://localhost:3000/api/leaderboard?page=1&pageSize=100&pointsType=earned')
      
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.pointsCategory).toBe('earned')
      expect(Array.isArray(data.leaderboard)).toBe(true)

      // All entries should be sorted by earnedPoints
      if (data.leaderboard.length > 1) {
        for (let i = 0; i < data.leaderboard.length - 1; i++) {
          const current = data.leaderboard[i].earnedPoints
          const next = data.leaderboard[i + 1].earnedPoints
          expect(current).toBeGreaterThanOrEqual(next)
        }
      }
    })

    it('should filter by "referral" points type', async () => {
      const response = await fetch('http://localhost:3000/api/leaderboard?page=1&pageSize=100&pointsType=referral')
      
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.pointsCategory).toBe('referral')
      expect(Array.isArray(data.leaderboard)).toBe(true)

      // All entries should be sorted by invitePoints
      if (data.leaderboard.length > 1) {
        for (let i = 0; i < data.leaderboard.length - 1; i++) {
          const current = data.leaderboard[i].invitePoints
          const next = data.leaderboard[i + 1].invitePoints
          expect(current).toBeGreaterThanOrEqual(next)
        }
      }
    })

    it('should include all expected fields in leaderboard entries', async () => {
      const response = await fetch('http://localhost:3000/api/leaderboard?page=1&pageSize=10&pointsType=all')
      
      expect(response.status).toBe(200)

      const data = await response.json()
      
      if (data.leaderboard.length > 0) {
        const entry = data.leaderboard[0]
        
        // Verify all expected fields are present
        expect(entry.id).toBeDefined()
        expect(entry.rank).toBeDefined()
        expect(entry.allPoints).toBeDefined()
        expect(entry.invitePoints).toBeDefined()
        expect(entry.earnedPoints).toBeDefined()
        expect(entry.bonusPoints).toBeDefined()
        expect(entry.referralCount).toBeDefined()
        expect(entry.balance).toBeDefined()
        expect(entry.lifetimePnL).toBeDefined()
      }
    })

    it('should respect minPoints parameter for "all" type', async () => {
      const minPoints = 1000
      const response = await fetch(`http://localhost:3000/api/leaderboard?page=1&pageSize=100&minPoints=${minPoints}&pointsType=all`)
      
      expect(response.status).toBe(200)

      const data = await response.json()
      
      // All entries should have at least minPoints
      for (const entry of data.leaderboard) {
        expect(entry.allPoints).toBeGreaterThanOrEqual(minPoints)
      }
    })

    it('should not apply minPoints for "earned" type', async () => {
      const response = await fetch('http://localhost:3000/api/leaderboard?page=1&pageSize=100&minPoints=500&pointsType=earned')
      
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.minPoints).toBe(0) // Should be 0 for earned type
    })

    it('should not apply minPoints for "referral" type', async () => {
      const response = await fetch('http://localhost:3000/api/leaderboard?page=1&pageSize=100&minPoints=500&pointsType=referral')
      
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.minPoints).toBe(0) // Should be 0 for referral type
    })

    it('should handle pagination correctly', async () => {
      const response1 = await fetch('http://localhost:3000/api/leaderboard?page=1&pageSize=10&pointsType=all')
      const data1 = await response1.json()

      if (data1.pagination.totalPages > 1) {
        const response2 = await fetch('http://localhost:3000/api/leaderboard?page=2&pageSize=10&pointsType=all')
        const data2 = await response2.json()

        expect(data2.pagination.page).toBe(2)
        
        // Entries should be different between pages
        const ids1 = (data1 as LeaderboardResponse).leaderboard.map((e) => e.id)
        const ids2 = (data2 as LeaderboardResponse).leaderboard.map((e) => e.id)
        
        const overlap = ids1.filter((id: string) => ids2.includes(id))
        expect(overlap.length).toBe(0) // No overlap between pages
      }
    })

    it('should return 400 for invalid pointsType', async () => {
      const response = await fetch('http://localhost:3000/api/leaderboard?page=1&pageSize=100&pointsType=invalid')
      
      expect(response.status).toBe(400)
    })

    it('should return 400 for invalid page number', async () => {
      const response = await fetch('http://localhost:3000/api/leaderboard?page=0&pageSize=100')
      
      expect(response.status).toBe(400)
    })

    it('should return 400 for invalid pageSize', async () => {
      const response = await fetch('http://localhost:3000/api/leaderboard?page=1&pageSize=0')
      
      expect(response.status).toBe(400)
    })

    it('should cap pageSize at 100', async () => {
      const response = await fetch('http://localhost:3000/api/leaderboard?page=1&pageSize=200')
      expect(response.status).toBe(400) // Should reject pageSize > 100
    })

    it('should exclude NPCs from "earned" leaderboard', async () => {
      const response = await fetch('http://localhost:3000/api/leaderboard?page=1&pageSize=100&pointsType=earned')
      expect(response.status).toBe(200)

      const data = await response.json() as LeaderboardResponse
      
      // No NPCs should be in earned leaderboard
      const npcCount = data.leaderboard.filter((entry) => entry.isActor).length
      expect(npcCount).toBe(0)
    })

    it('should exclude NPCs from "referral" leaderboard', async () => {
      const response = await fetch('http://localhost:3000/api/leaderboard?page=1&pageSize=100&pointsType=referral')
      expect(response.status).toBe(200)

      const data = await response.json() as LeaderboardResponse
      
      // No NPCs should be in referral leaderboard
      const npcCount = data.leaderboard.filter((entry) => entry.isActor).length
      expect(npcCount).toBe(0)
    })

    it('should include our test user in appropriate leaderboards', async () => {
      // Verify test user exists in database
      const testUser = await prisma.user.findUnique({ where: { id: testUserId } })
      expect(testUser).toBeTruthy()
      expect(testUser?.reputationPoints).toBe(1500)
      expect(testUser?.earnedPoints).toBe(400)
      expect(testUser?.invitePoints).toBe(500)
      expect(testUser?.isActor).toBe(false)

      // Helper function to fetch all pages
      async function fetchAllPages(pointsType: 'all' | 'earned' | 'referral', minPointsFilter: number = 0): Promise<LeaderboardEntry[]> {
        const allEntries: LeaderboardEntry[] = []
        let page = 1
        let hasMore = true
        
        while (hasMore && page <= 20) { // Limit to 20 pages to prevent infinite loops
          const url = minPointsFilter > 0
            ? `http://localhost:3000/api/leaderboard?page=${page}&pageSize=100&minPoints=${minPointsFilter}&pointsType=${pointsType}`
            : `http://localhost:3000/api/leaderboard?page=${page}&pageSize=100&pointsType=${pointsType}`
          const response = await fetch(url)
          if (!response) return allEntries // Server not available
          
          const data = await response.json() as LeaderboardResponse
          
          allEntries.push(...data.leaderboard)
          hasMore = page < data.pagination.totalPages
          page++
        }
        
        return allEntries
      }

      // Check "all" leaderboard (fetch all pages to find user)
      const allEntries = await fetchAllPages('all', 500)
      const inAllLeaderboard = allEntries.some((entry) => entry.id === testUserId)
      expect(inAllLeaderboard).toBe(true)

      // Check "earned" leaderboard (has 400 earned points)
      const earnedEntries = await fetchAllPages('earned')
      const inEarnedLeaderboard = earnedEntries.some((entry) => entry.id === testUserId)
      expect(inEarnedLeaderboard).toBe(true)

      // Check "referral" leaderboard (has 500 invite points)
      const referralEntries = await fetchAllPages('referral')
      const inReferralLeaderboard = referralEntries.some((entry) => entry.id === testUserId)
      expect(inReferralLeaderboard).toBe(true)
    })
  })
})

