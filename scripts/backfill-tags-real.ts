/**
 * Backfill Tags Script - Real LLM Version
 * 
 * Generates and stores tags for ALL existing posts using real LLM
 * Processes in batches to avoid rate limits
 */

import { prisma } from '../src/lib/prisma'
import { generateTagsForPosts } from '../src/lib/services/tag-generation-service'
import { storeTagsForPost } from '../src/lib/services/tag-storage-service'

const BATCH_SIZE = 20 // Process 20 posts at a time
const DELAY_BETWEEN_BATCHES = 2000 // 2 seconds between batches

async function backfillAll() {
  console.log('🏷️  Backfilling Tags for All Posts with Real LLM\n')
  
  try {
    // Get ALL posts without tags
    const totalPosts = await prisma.post.count()
    const postsWithTags = await prisma.post.count({
      where: { postTags: { some: {} } }
    })
    const postsWithoutTags = totalPosts - postsWithTags
    
    console.log(`📊 Status:`)
    console.log(`   Total posts: ${totalPosts}`)
    console.log(`   Already tagged: ${postsWithTags} (${Math.round(postsWithTags/totalPosts*100)}%)`)
    console.log(`   Need tagging: ${postsWithoutTags} (${Math.round(postsWithoutTags/totalPosts*100)}%)\n`)
    
    if (postsWithoutTags === 0) {
      console.log('✅ All posts already have tags!')
      return
    }
    
    // Ask for confirmation if large number
    if (postsWithoutTags > 100) {
      console.log(`⚠️  This will process ${postsWithoutTags} posts.`)
      console.log(`   Estimated time: ~${Math.ceil(postsWithoutTags / BATCH_SIZE * DELAY_BETWEEN_BATCHES / 1000 / 60)} minutes`)
      console.log(`   Continue? (Ctrl+C to cancel)\n`)
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    
    console.log('🚀 Starting backfill...\n')
    
    let processed = 0
    let tagged = 0
    let totalTagsCreated = 0
    let errors = 0
    let offset = 0
    
    while (true) {
      // Fetch next batch of untagged posts
      const batch = await prisma.post.findMany({
        where: {
          postTags: {
            none: {}
          }
        },
        take: BATCH_SIZE,
        skip: offset,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          content: true,
        },
      })
      
      if (batch.length === 0) {
        break // No more posts to process
      }
      
      console.log(`📦 Batch ${Math.floor(offset / BATCH_SIZE) + 1}: Processing ${batch.length} posts...`)
      
      try {
        // Generate tags with real LLM
        const tagMap = await generateTagsForPosts(batch)
        
        // Store tags
        for (const [postId, tags] of tagMap.entries()) {
          try {
            if (tags.length > 0) {
              await storeTagsForPost(postId, tags)
              tagged++
              totalTagsCreated += tags.length
              console.log(`   ✓ ${postId.slice(0, 8)}: ${tags.map(t => t.displayName).join(', ')}`)
            } else {
              console.log(`   - ${postId.slice(0, 8)}: No tags generated`)
            }
            processed++
          } catch (error) {
            console.error(`   ✗ ${postId.slice(0, 8)}: Error storing tags`)
            errors++
          }
        }
      } catch (error) {
        console.error(`   ✗ Batch error:`, error)
        errors += batch.length
      }
      
      offset += batch.length
      
      // Progress update
      const progress = Math.round((offset / postsWithoutTags) * 100)
      console.log(`   Progress: ${offset}/${postsWithoutTags} (${progress}%)\n`)
      
      // Delay between batches
      if (batch.length === BATCH_SIZE) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
      }
    }
    
    console.log('─'.repeat(60))
    console.log('📊 Backfill Summary:\n')
    console.log(`   Posts processed: ${processed}`)
    console.log(`   Posts tagged: ${tagged}`)
    console.log(`   Total tags created: ${totalTagsCreated}`)
    console.log(`   Errors: ${errors}`)
    console.log(`   Success rate: ${Math.round(tagged/processed*100)}%`)
    console.log('\n✅ Backfill complete!')
    
  } catch (error) {
    console.error('❌ Backfill failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

backfillAll()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
