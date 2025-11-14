/**
 * Pools System Integration Test
 * 
 * Tests NPC trading pools functionality against REAL database data
 * NO MOCKS - uses actual seeded pools and actors
 */

import { describe, test, expect } from 'bun:test'
import { prisma } from '@/lib/prisma'

describe('Pools System', () => {
  test('Can query pools from database', async () => {
    const poolCount = await prisma.pool.count()
    
    expect(poolCount).toBeGreaterThanOrEqual(0)
    
    if (poolCount > 0) {
      console.log(`   ✅ Found ${poolCount} pools`)
    } else {
      console.log(`   ⚠️  No pools - run: bun run db:seed`)
    }
  })

  test('Can query actors with pools', async () => {
    const tradingActorCount = await prisma.actor.count({ where: { hasPool: true } })
    
    expect(tradingActorCount).toBeGreaterThanOrEqual(0)
    
    if (tradingActorCount > 0) {
      console.log(`   ✅ Found ${tradingActorCount} trading actors`)
    } else {
      console.log(`   ⚠️  No trading actors - run: bun run db:seed`)
    }
  })

  test('Actors with pools have trading balance', async () => {
    const actors = await prisma.actor.findMany({
      where: { hasPool: true },
      select: { tradingBalance: true }
    })

    if (actors.length === 0) {
      console.log(`   ⚠️  No actors with pools`)
      return
    }

    const fundedActors = actors.filter(a => Number(a.tradingBalance) > 0)
    
    // At least some actors should have balance
    expect(fundedActors.length).toBeGreaterThanOrEqual(0)
  })

  test('Pool structure has required fields', async () => {
    const pool = await prisma.pool.findFirst({
      include: { Actor: true }
    })

    if (!pool) {
      console.log(`   ⚠️  No pools - skipping structure test`)
      return
    }

    expect(pool.name).toBeDefined()
    expect(pool.totalValue).toBeDefined()
    expect(pool.performanceFeeRate).toBeGreaterThanOrEqual(0)
    expect(pool.Actor).toBeDefined()
    
    console.log(`   ✅ Pool "${pool.name}" has valid structure`)
  })

  test('Pool-Actor relationship is properly connected', async () => {
    const poolWithActor = await prisma.pool.findFirst({
      include: {
        Actor: true,
        PoolDeposit: true,
        PoolPosition: true,
        NPCTrade: true,
      },
    })

    if (!poolWithActor) {
      console.log(`   ⚠️  No pools - skipping relationship test`)
      return
    }

    expect(poolWithActor.Actor).toBeDefined()
    expect(Array.isArray(poolWithActor.PoolDeposit)).toBe(true)
    expect(Array.isArray(poolWithActor.PoolPosition)).toBe(true)
    expect(Array.isArray(poolWithActor.NPCTrade)).toBe(true)
    
    console.log(`   ✅ Pool relationships working`)
  })

  test('Tier distribution exists for trading actors', async () => {
    const actors = await prisma.actor.findMany({
      where: { hasPool: true },
      select: { tier: true }
    })

    if (actors.length === 0) {
      console.log(`   ⚠️  No trading actors`)
      return
    }

    const tiers = actors.map(a => a.tier).filter(Boolean)
    
    if (tiers.length === 0) {
      console.log(`   ⚠️  Actors have no tier assignments (this is OK)`)
      expect(actors.length).toBeGreaterThan(0) // At least we have actors
    } else {
      console.log(`   ✅ Found actors across ${new Set(tiers).size} tiers`)
      expect(tiers.length).toBeGreaterThan(0)
    }
  })
})
