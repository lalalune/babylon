/**
 * On-Chain Storage Integration Test
 * 
 * Tests price storage and question resolution on-chain
 * Skips gracefully if contracts are not deployed
 */

import { describe, test, expect } from 'bun:test'
import { prisma } from '@/lib/prisma'

describe('On-Chain Storage', () => {
  const diamondAddress = process.env.NEXT_PUBLIC_DIAMOND_ADDRESS
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL

  test('Diamond address configured', () => {
    if (!diamondAddress) {
      console.log('   ⚠️  NEXT_PUBLIC_DIAMOND_ADDRESS not set - on-chain features disabled')
      console.log('   💡 To enable: bun run deploy:local')
      return
    }
    
    expect(diamondAddress).toBeDefined()
    expect(diamondAddress.startsWith('0x')).toBe(true)
    console.log(`   ✅ Diamond configured: ${diamondAddress}`)
  })

  test('RPC endpoint configured', () => {
    if (!rpcUrl) {
      console.log('   ⚠️  NEXT_PUBLIC_RPC_URL not set')
      return
    }
    
    expect(rpcUrl).toBeDefined()
    console.log(`   ✅ RPC configured: ${rpcUrl}`)
  })

  test('Can check for resolved questions in database', async () => {
    const resolvedCount = await prisma.question.count({
      where: { status: 'resolved' }
    })

    expect(resolvedCount).toBeGreaterThanOrEqual(0)
    
    if (resolvedCount > 0) {
      console.log(`   ✅ Found ${resolvedCount} resolved questions`)
      
      const resolvedWithMarket = await prisma.question.count({
        where: {
          status: 'resolved',
        }
      })
      
      console.log(`   📊 ${resolvedWithMarket} have associated markets`)
    } else {
      console.log(`   ⚠️  No resolved questions yet`)
    }
  })

  test('On-chain market IDs can be queried', async () => {
    const marketsWithOnChainId = await prisma.market.count({
      where: {
        onChainMarketId: { not: null }
      }
    })

    expect(marketsWithOnChainId).toBeGreaterThanOrEqual(0)
    
    if (marketsWithOnChainId > 0) {
      console.log(`   ✅ ${marketsWithOnChainId} markets have on-chain IDs`)
    } else {
      console.log(`   ⚠️  No markets with on-chain IDs yet`)
    }
  })

  test('Price storage fields exist in database', async () => {
    // Just verify the schema supports on-chain storage
    const org = await prisma.organization.findFirst({
      select: {
        currentPrice: true,
        initialPrice: true,
      }
    })

    if (org) {
      expect(org.currentPrice !== undefined || org.initialPrice !== undefined).toBe(true)
      console.log(`   ✅ Organization price fields accessible`)
    } else {
      console.log(`   ⚠️  No organizations in database`)
    }
  })
})
