/**
 * Backfill Recent Posts Only
 * 
 * Tags only the most recent posts (last 7 days worth)
 * This is all we need for trending - older posts won't affect trending anyway
 */

import { prisma } from '../src/lib/prisma'
import { generateTagsForPosts } from '../src/lib/services/tag-generation-service'
import { storeTagsForPost } from '../src/lib/services/tag-storage-service'
import { calculateTrendingTags } from '../src/lib/services/trending-calculation-service'

const BATCH_SIZE = 20
const DAYS_TO_BACKFILL = 7 // Only last 7 days (matches trending window)

async function backfillRecent() {
  console.log('🏷️  Backfilling Recent Posts (Last 7 Days) with Real LLM\n')
  
  try {
    const cutoffDate = new Date(Date.now() - DAYS_TO_BACKFILL * 24 * 60 * 60 * 1000)
    
    // Get recent posts without tags
    const recentPosts = await prisma.post.findMany({
      where: {
        timestamp: {
          gte: cutoffDate
        },
        postTags: {
          none: {}
        }
      },
      orderBy: { timestamp: 'desc' },
      select: {
        id: true,
        content: true,
        timestamp: true,
      },
    })
    
    console.log(`📊 Found ${recentPosts.length} recent posts without tags`)
    console.log(`   Time window: Last ${DAYS_TO_BACKFILL} days`)
    console.log(`   Est. time: ~${Math.ceil(recentPosts.length / BATCH_SIZE * 2 / 60)} minutes\n`)
    
    if (recentPosts.length === 0) {
      console.log('✅ All recent posts already tagged!')
      return
    }
    
    let processed = 0
    let tagged = 0
    let totalTags = 0
    
    // Process in batches
    for (let i = 0; i < recentPosts.length; i += BATCH_SIZE) {
      const batch = recentPosts.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(recentPosts.length / BATCH_SIZE)
      
      console.log(`📦 Batch ${batchNum}/${totalBatches}...`)
      
      try {
        const tagMap = await generateTagsForPosts(batch)
        
        for (const [postId, tags] of tagMap.entries()) {
          try {
            if (tags.length > 0) {
              await storeTagsForPost(postId, tags)
              tagged++
              totalTags += tags.length
              console.log(`   ✓ ${postId.slice(0, 8)}: ${tags.map(t => t.displayName).join(', ')}`)
            }
            processed++
          } catch (error) {
            console.error(`   ✗ Error storing tags for ${postId.slice(0, 8)}`)
            processed++
          }
        }
      } catch (error) {
        console.error(`   ✗ Batch error:`, error)
      }
      
      const progress = Math.round((i + batch.length) / recentPosts.length * 100)
      console.log(`   Progress: ${i + batch.length}/${recentPosts.length} (${progress}%)\n`)
      
      // Delay between batches
      if (i + BATCH_SIZE < recentPosts.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    console.log('─'.repeat(60))
    console.log('📊 Backfill Summary:\n')
    console.log(`   Posts processed: ${processed}`)
    console.log(`   Posts tagged: ${tagged}`)
    console.log(`   Tags created: ${totalTags}`)
    console.log(`   Avg tags/post: ${(totalTags / tagged).toFixed(1)}`)
    
    // Recalculate trending with new data
    console.log('\n🔥 Recalculating trending...')
    await calculateTrendingTags()
    
    const topTrending = await prisma.trendingTag.findMany({
      take: 5,
      orderBy: { rank: 'asc' },
      include: { tag: true },
    })
    
    console.log('\n🎯 Top 5 Trending:\n')
    topTrending.forEach(t => {
      console.log(`   ${t.rank}. ${t.tag.displayName} (${t.postCount} posts)`)
    })
    
    console.log('\n✅ Done! Trending system is now using real LLM data.')
    console.log('\n🚀 Next: Restart server and check /feed sidebar')
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

backfillRecent()

