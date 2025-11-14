#!/usr/bin/env bun
/**
 * Initialize Trending and News
 * 
 * Ensures the system has:
 * - Trending tags populated
 * - Minimum number of news articles
 * 
 * Run: bun run scripts/init-trending-and-news.ts
 */

import { prisma } from '../src/lib/prisma'
import { logger } from '../src/lib/logger'
import { generateSnowflakeId } from '../src/lib/snowflake'
import { nanoid } from 'nanoid'

const MIN_NEWS_ARTICLES = 10
const MIN_TRENDING_TAGS = 5

/**
 * Sample tags for trending
 */
const SAMPLE_TAGS = [
  { name: 'ai', displayName: 'AI', category: 'Tech' },
  { name: 'markets', displayName: 'Markets', category: 'Finance' },
  { name: 'crypto', displayName: 'Crypto', category: 'Finance' },
  { name: 'politics', displayName: 'Politics', category: 'Politics' },
  { name: 'tech', displayName: 'Tech', category: 'Tech' },
  { name: 'breaking', displayName: 'Breaking', category: 'News' },
  { name: 'startup', displayName: 'Startup', category: 'Tech' },
  { name: 'investing', displayName: 'Investing', category: 'Finance' },
  { name: 'spacex', displayName: 'SpaceX', category: 'Tech' },
  { name: 'climate', displayName: 'Climate', category: 'Politics' },
]

/**
 * Sample news articles
 */
const SAMPLE_NEWS_ARTICLES = [
  {
    title: 'AI Startups See Record Funding in Q4',
    summary: 'Venture capital firms poured billions into artificial intelligence startups, marking the highest quarterly investment in the sector.',
    category: 'Tech',
    sentiment: 'positive',
    slant: 'bullish',
    biasScore: 0.6,
  },
  {
    title: 'Federal Reserve Signals Potential Rate Changes',
    summary: 'Central bank officials hint at policy adjustments as economic indicators show mixed signals across major sectors.',
    category: 'Finance',
    sentiment: 'neutral',
    slant: 'cautious',
    biasScore: 0.0,
  },
  {
    title: 'Tech Giants Face New Regulatory Challenges',
    summary: 'Government agencies announce plans for enhanced oversight of major technology companies amid growing concerns over market dominance.',
    category: 'Politics',
    sentiment: 'negative',
    slant: 'bearish',
    biasScore: -0.4,
  },
  {
    title: 'Cryptocurrency Markets Show Renewed Volatility',
    summary: 'Digital asset prices fluctuate as investors react to new regulatory frameworks and institutional adoption announcements.',
    category: 'Finance',
    sentiment: 'neutral',
    slant: 'neutral',
    biasScore: 0.1,
  },
  {
    title: 'Climate Tech Attracts Major Corporate Investment',
    summary: 'Fortune 500 companies commit billions to clean energy and sustainability initiatives, accelerating green technology development.',
    category: 'Tech',
    sentiment: 'positive',
    slant: 'optimistic',
    biasScore: 0.5,
  },
  {
    title: 'Labor Market Remains Tight Amid Economic Shifts',
    summary: 'Employment data reveals persistent worker shortages in key industries despite broader economic uncertainty and sector-specific slowdowns.',
    category: 'Finance',
    sentiment: 'neutral',
    slant: 'mixed',
    biasScore: 0.0,
  },
  {
    title: 'Space Industry Reaches New Milestone',
    summary: 'Private space companies successfully complete record number of launches, advancing commercial space flight capabilities significantly.',
    category: 'Tech',
    sentiment: 'positive',
    slant: 'bullish',
    biasScore: 0.7,
  },
  {
    title: 'Consumer Spending Patterns Shift Post-Pandemic',
    summary: 'Retail analysts document major changes in shopping behaviors as consumers adapt to new economic realities and digital alternatives.',
    category: 'Finance',
    sentiment: 'neutral',
    slant: 'analytical',
    biasScore: 0.0,
  },
  {
    title: 'Biotech Breakthroughs Promise Medical Advances',
    summary: 'Researchers announce significant progress in gene therapy and personalized medicine, potentially revolutionizing treatment approaches.',
    category: 'Tech',
    sentiment: 'positive',
    slant: 'optimistic',
    biasScore: 0.6,
  },
  {
    title: 'Global Supply Chains Continue Restructuring',
    summary: 'Major corporations reorganize logistics networks and manufacturing locations in response to geopolitical tensions and trade policies.',
    category: 'Finance',
    sentiment: 'neutral',
    slant: 'cautious',
    biasScore: -0.1,
  },
  {
    title: 'Education Technology Adoption Accelerates',
    summary: 'Schools and universities expand digital learning platforms as remote and hybrid education models become permanent fixtures.',
    category: 'Tech',
    sentiment: 'positive',
    slant: 'progressive',
    biasScore: 0.4,
  },
  {
    title: 'Energy Sector Faces Transformation Pressure',
    summary: 'Traditional energy companies navigate transition to renewable sources while maintaining grid reliability and profitability.',
    category: 'Finance',
    sentiment: 'neutral',
    slant: 'balanced',
    biasScore: 0.0,
  },
]

async function initializeTrending() {
  logger.info('Checking trending tags...', undefined, 'InitTrendingNews')

  const existingTrending = await prisma.trendingTag.count()
  
  if (existingTrending >= MIN_TRENDING_TAGS) {
    logger.info(`✅ Trending already populated (${existingTrending} tags)`, undefined, 'InitTrendingNews')
    return
  }

  logger.info('Populating trending tags...', undefined, 'InitTrendingNews')

  // Create tags
  const createdTags = []
  for (const tagData of SAMPLE_TAGS) {
    const tag =     await prisma.tag.upsert({
      where: { name: tagData.name },
      update: {},
      create: {
        id: nanoid(),
        ...tagData,
        updatedAt: new Date(),
      },
    })
    createdTags.push(tag)
  }

  logger.info(`Created ${createdTags.length} tags`, undefined, 'InitTrendingNews')

  // Link recent posts to tags (if any posts exist)
  const recentPosts = await prisma.post.findMany({
    take: 30,
    orderBy: { timestamp: 'desc' },
    select: { id: true, content: true },
  })

  if (recentPosts.length > 0) {
    logger.info(`Linking ${recentPosts.length} posts to tags...`, undefined, 'InitTrendingNews')
    
    let linksCreated = 0
    for (const post of recentPosts) {
      const content = post.content.toLowerCase()
      const matchingTags = []

      // Keyword matching
      if (content.includes('ai') || content.includes('artificial')) matchingTags.push('ai')
      if (content.includes('market') || content.includes('stock')) matchingTags.push('markets')
      if (content.includes('crypto') || content.includes('bitcoin')) matchingTags.push('crypto')
      if (content.includes('politic') || content.includes('election')) matchingTags.push('politics')
      if (content.includes('tech') || content.includes('software')) matchingTags.push('tech')
      if (content.includes('breaking') || content.includes('news')) matchingTags.push('breaking')
      if (content.includes('startup') || content.includes('founder')) matchingTags.push('startup')
      if (content.includes('invest') || content.includes('trade')) matchingTags.push('investing')
      if (content.includes('space') || content.includes('spacex')) matchingTags.push('spacex')
      if (content.includes('climate') || content.includes('green')) matchingTags.push('climate')

      // Random tag if no matches
      if (matchingTags.length === 0) {
        const randomTag = SAMPLE_TAGS[Math.floor(Math.random() * SAMPLE_TAGS.length)]
        if (randomTag) {
          matchingTags.push(randomTag.name)
        }
      }

      // Create links
      for (const tagName of matchingTags.slice(0, 2)) {
        const tag = createdTags.find(t => t.name === tagName)
        if (tag) {
          // Check if link already exists
          const existing = await prisma.postTag.findUnique({
            where: {
              postId_tagId: {
                postId: post.id,
                tagId: tag.id,
              },
            },
          })
          
          if (!existing) {
            await prisma.postTag.create({
              data: {
                id: nanoid(),
                postId: post.id,
                tagId: tag.id,
              },
            }).catch(() => {
              // Skip if already exists (race condition)
            })
            linksCreated++
          }
        }
      }
    }

    logger.info(`Created ${linksCreated} post-tag links`, undefined, 'InitTrendingNews')
  }

  // Create trending entries
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  logger.info('Calculating trending scores...', undefined, 'InitTrendingNews')

  // Get tag counts using aggregation instead of raw SQL
  const postTags = await prisma.postTag.findMany({
    where: {
      Post: {
        timestamp: {
          gte: weekAgo,
        },
      },
    },
    include: {
      Tag: true,
    },
  })

  // Count tags manually
  const tagCountMap = new Map<string, number>()
  postTags.forEach(pt => {
    const count = tagCountMap.get(pt.tagId) || 0
    tagCountMap.set(pt.tagId, count + 1)
  })

  // Sort by count and get top 10
  const tagCounts = Array.from(tagCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tagId, count]) => ({ tagId, count: BigInt(count) }))

  let trendingCreated = 0
  for (let i = 0; i < tagCounts.length; i++) {
    const tagCount = tagCounts[i]
    if (!tagCount) continue
    
    const { tagId, count } = tagCount
    const score = Number(count) * (10 - i) * (0.5 + Math.random())
    
    const randomTag = SAMPLE_TAGS[Math.floor(Math.random() * SAMPLE_TAGS.length)]

    await prisma.trendingTag.create({
      data: {
        id: nanoid(),
        tagId,
        score,
        postCount: Number(count),
        rank: i + 1,
        windowStart: weekAgo,
        windowEnd: now,
        relatedContext: i < 3 && Math.random() > 0.5 && randomTag
          ? `Trending with ${randomTag.displayName}` 
          : null,
      },
    }).catch(() => {
      // Skip if already exists
    })
    trendingCreated++
  }

  // If we don't have enough trending from real data, create some with sample tags
  if (trendingCreated < MIN_TRENDING_TAGS) {
    logger.info('Creating sample trending entries...', undefined, 'InitTrendingNews')
    
    for (let i = trendingCreated; i < MIN_TRENDING_TAGS && i < createdTags.length; i++) {
      const tag = createdTags[i]
      if (!tag) continue
      
      const score = (MIN_TRENDING_TAGS - i) * 10 * Math.random()
      const randomTag = SAMPLE_TAGS[Math.floor(Math.random() * SAMPLE_TAGS.length)]
      
      await prisma.trendingTag.create({
        data: {
          id: nanoid(),
          tagId: tag.id,
          score,
          postCount: Math.floor(Math.random() * 20) + 5,
          rank: i + 1,
          windowStart: weekAgo,
          windowEnd: now,
          relatedContext: Math.random() > 0.6 && randomTag
            ? `Trending with ${randomTag.displayName}`
            : null,
        },
      }).catch(() => {
        // Skip if already exists
      })
      trendingCreated++
    }
  }

  logger.info(`✅ Created ${trendingCreated} trending entries`, undefined, 'InitTrendingNews')
}

async function initializeNews() {
  logger.info('Checking news articles...', undefined, 'InitTrendingNews')

  const existingArticles = await prisma.post.count({
    where: { type: 'article' },
  })

  if (existingArticles >= MIN_NEWS_ARTICLES) {
    logger.info(`✅ News already populated (${existingArticles} articles)`, undefined, 'InitTrendingNews')
    return
  }

  logger.info('Creating news articles...', undefined, 'InitTrendingNews')

  // Get news organizations
  const newsOrgs = await prisma.organization.findMany({
    where: { type: 'media' },
    take: 5,
  })

  if (newsOrgs.length === 0) {
    logger.warn('⚠️  No news organizations found. Skipping news creation.', undefined, 'InitTrendingNews')
    logger.info('💡 News will be generated automatically by game ticks', undefined, 'InitTrendingNews')
    return
  }

  const articlesToCreate = Math.min(
    SAMPLE_NEWS_ARTICLES.length,
    MIN_NEWS_ARTICLES - existingArticles
  )

  let articlesCreated = 0
  for (let i = 0; i < articlesToCreate; i++) {
    const article = SAMPLE_NEWS_ARTICLES[i]
    const org = newsOrgs[i % newsOrgs.length]
    
    // Spread timestamps over last 24 hours
    const hoursAgo = Math.floor(Math.random() * 24)
    const timestamp = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)

    if (!article || !org) continue

    await prisma.post.create({
      data: {
        id: await generateSnowflakeId(),
        type: 'article',
        content: article.summary,
        articleTitle: article.title,
        category: article.category,
        sentiment: article.sentiment,
        slant: article.slant,
        biasScore: article.biasScore,
        authorId: org.id,
        gameId: 'continuous',
        dayNumber: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
        timestamp,
      },
    })
    articlesCreated++
  }

  logger.info(`✅ Created ${articlesCreated} news articles`, undefined, 'InitTrendingNews')
}

async function main() {
  logger.info('🚀 Initializing Trending and News...', undefined, 'InitTrendingNews')

  // Initialize trending
  await initializeTrending()

  // Initialize news
  await initializeNews()

  // Show results
  const trendingCount = await prisma.trendingTag.count()
  const newsCount = await prisma.post.count({ where: { type: 'article' } })

  logger.info('', undefined, 'InitTrendingNews')
  logger.info('📊 Summary:', undefined, 'InitTrendingNews')
  logger.info(`  Trending tags: ${trendingCount}`, undefined, 'InitTrendingNews')
  logger.info(`  News articles: ${newsCount}`, undefined, 'InitTrendingNews')
  logger.info('', undefined, 'InitTrendingNews')

  if (trendingCount >= MIN_TRENDING_TAGS && newsCount >= MIN_NEWS_ARTICLES) {
    logger.info('✅ System ready! Trending and news are populated.', undefined, 'InitTrendingNews')
  } else {
    logger.warn('⚠️  Minimum thresholds not met:', undefined, 'InitTrendingNews')
    if (trendingCount < MIN_TRENDING_TAGS) {
      logger.warn(`  Trending: ${trendingCount}/${MIN_TRENDING_TAGS}`, undefined, 'InitTrendingNews')
    }
    if (newsCount < MIN_NEWS_ARTICLES) {
      logger.warn(`  News: ${newsCount}/${MIN_NEWS_ARTICLES}`, undefined, 'InitTrendingNews')
    }
    logger.info('💡 More content will be generated by game ticks', undefined, 'InitTrendingNews')
  }

  await prisma.$disconnect()
}

main()

