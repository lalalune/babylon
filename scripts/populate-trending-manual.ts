/**
 * Manually Populate Trending Script
 * 
 * Creates sample tags and trending data for testing without needing API keys
 */

import { prisma } from '../src/lib/prisma'
import { Prisma } from '@prisma/client'

async function populateManual() {
  console.log('🏷️  Manually populating trending system...\n')

  try {
    // Sample tags based on common topics
    const sampleTags = [
      { name: 'spacex', displayName: 'SpaceX', category: 'Tech' },
      { name: 'elon-musk', displayName: 'Elon Musk', category: 'Tech' },
      { name: 'ai', displayName: 'AI', category: 'Tech' },
      { name: 'crypto', displayName: 'Crypto', category: 'Finance' },
      { name: 'markets', displayName: 'Markets', category: 'Finance' },
      { name: 'politics', displayName: 'Politics', category: 'Politics' },
      { name: 'breaking', displayName: 'Breaking', category: 'News' },
      { name: 'tech', displayName: 'Tech', category: 'Tech' },
      { name: 'startup', displayName: 'Startup', category: 'Tech' },
      { name: 'investing', displayName: 'Investing', category: 'Finance' },
    ]

    // Create tags
    console.log('Creating tags...')
    const createdTags = []
    for (const tagData of sampleTags) {
      const tag = await prisma.tag.upsert({
        where: { name: tagData.name },
        update: {},
        create: tagData,
      })
      createdTags.push(tag)
      console.log(`  ✓ ${tag.displayName}`)
    }

    // Get recent posts (last 20)
    const recentPosts = await prisma.post.findMany({
      take: 20,
      orderBy: { timestamp: 'desc' },
      select: { id: true, content: true },
    })

    console.log(`\nLinking ${recentPosts.length} recent posts to tags...`)

    // Link posts to tags based on content keywords
    let linksCreated = 0
    for (const post of recentPosts) {
      const content = post.content.toLowerCase()
      const matchingTags = []

      // Simple keyword matching
      if (content.includes('spacex') || content.includes('space')) matchingTags.push('spacex')
      if (content.includes('elon') || content.includes('musk')) matchingTags.push('elon-musk')
      if (content.includes('ai') || content.includes('artificial')) matchingTags.push('ai')
      if (content.includes('crypto') || content.includes('bitcoin') || content.includes('husk')) matchingTags.push('crypto')
      if (content.includes('market') || content.includes('stock')) matchingTags.push('markets')
      if (content.includes('politic') || content.includes('trump') || content.includes('election')) matchingTags.push('politics')
      if (content.includes('breaking') || content.includes('news')) matchingTags.push('breaking')
      if (content.includes('tech') || content.includes('software')) matchingTags.push('tech')
      if (content.includes('startup') || content.includes('founder')) matchingTags.push('startup')
      if (content.includes('invest') || content.includes('trade')) matchingTags.push('investing')

      // If no matches, add a random tag
      if (matchingTags.length === 0) {
        matchingTags.push(sampleTags[Math.floor(Math.random() * sampleTags.length)].name)
      }

      // Create links
      for (const tagName of matchingTags.slice(0, 3)) { // Max 3 tags per post
        const tag = createdTags.find(t => t.name === tagName)
        if (tag) {
          await prisma.postTag.upsert({
            where: {
              postId_tagId: {
                postId: post.id,
                tagId: tag.id,
              },
            },
            update: {},
            create: {
              postId: post.id,
              tagId: tag.id,
            },
          })
          linksCreated++
        }
      }
    }

    console.log(`  ✓ Created ${linksCreated} post-tag links`)

    // Calculate trending
    console.log('\nCalculating trending scores...')
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Convert dates to ISO strings for Prisma Accelerate compatibility
    const weekAgoStr = weekAgo.toISOString()

    // Get tag counts
    const tagCounts = await prisma.$queryRaw<Array<{
      tagId: string
      count: bigint
    }>>(Prisma.sql`
      SELECT 
        "tagId",
        COUNT(*) as count
      FROM "PostTag" pt
      INNER JOIN "Post" p ON p.id = pt."postId"
      WHERE p.timestamp >= ${weekAgoStr}::timestamp
      GROUP BY "tagId"
      ORDER BY count DESC
      LIMIT 10
    `)

    // Create trending entries
    for (let i = 0; i < tagCounts.length; i++) {
      const { tagId, count } = tagCounts[i]
      const score = Number(count) * (10 - i) * Math.random() * 2 // Add some randomness

      await prisma.trendingTag.create({
        data: {
          tagId,
          score,
          postCount: Number(count),
          rank: i + 1,
          windowStart: weekAgo,
          windowEnd: now,
          relatedContext: i < 3 && Math.random() > 0.5 ? `Trending with ${sampleTags[Math.floor(Math.random() * sampleTags.length)].displayName}` : null,
        },
      })
    }

    console.log(`  ✓ Created ${tagCounts.length} trending entries`)

    // Show results
    const topTrending = await prisma.trendingTag.findMany({
      take: 5,
      orderBy: { rank: 'asc' },
      include: { tag: true },
    })

    console.log('\n🎯 Top 5 Trending:')
    topTrending.forEach(t => {
      console.log(`  ${t.rank}. ${t.tag.displayName} (${t.postCount} posts, score: ${t.score.toFixed(2)})`)
    })

    console.log('\n✅ Done! Refresh your browser to see trending topics.')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

populateManual()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })


