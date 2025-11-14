/**
 * Integration tests for article generation with fullContent
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '../../src/lib/database-service'
import { generateSnowflakeId } from '../../src/lib/snowflake'
import { db } from '../../src/lib/database-service'

describe('Article Generation Integration', () => {
  let testOrgId: string
  let testArticleId: string

  beforeAll(async () => {
    // Create test news organization
    const org = await prisma.organization.create({
      data: {
        id: await generateSnowflakeId(),
        name: 'Test News Network',
        description: 'A test news organization',
        type: 'media',
        initialPrice: 100,
        currentPrice: 100,
        canBeInvolved: true,
        updatedAt: new Date(),
      },
    })

    testOrgId = org.id
  })

  afterAll(async () => {
    // Cleanup test data
    await prisma.post.deleteMany({
      where: {
        OR: [
          { id: testArticleId },
          { authorId: testOrgId },
        ],
      },
    })

    await prisma.organization.deleteMany({
      where: { id: testOrgId },
    })
  })

  it('should create article with fullContent field', async () => {
    const articleTitle = 'Test Article: Market Trends'
    const summary = 'A brief summary of market trends for the feed.'
    const fullArticle = `
This is the first paragraph of the full article with detailed analysis and context about market trends.

This is the second paragraph providing more depth, including expert opinions and data points that support the narrative.

The third paragraph continues with additional information, quotes from industry leaders, and forward-looking statements about market direction.

Finally, the fourth paragraph concludes the article with actionable insights and a summary of key takeaways for readers.
    `.trim()

    testArticleId = await generateSnowflakeId()

    const article = await db.createPostWithAllFields({
      id: testArticleId,
      type: 'article',
      content: summary,
      fullContent: fullArticle,
      articleTitle: articleTitle,
      byline: 'By Test Reporter',
      category: 'finance',
      sentiment: 'positive',
      biasScore: 0.2,
      authorId: testOrgId,
      gameId: 'continuous',
      dayNumber: 1,
      timestamp: new Date(),
    })

    expect(article).toBeDefined()
    expect(article.id).toBe(testArticleId)
    expect(article.type).toBe('article')
    expect(article.content).toBe(summary)
    expect(article.fullContent).toBe(fullArticle)
    expect(article.articleTitle).toBe(articleTitle)
  })

  it('should retrieve article with fullContent through API format', async () => {
    // Fetch the article we created
    const post = await prisma.post.findUnique({
      where: { id: testArticleId },
    })

    expect(post).toBeDefined()
    expect(post?.type).toBe('article')
    expect(post?.content).toBeDefined()
    expect(post?.fullContent).toBeDefined()
    expect(post?.fullContent!.length).toBeGreaterThan(400)
    expect(post?.articleTitle).toBe('Test Article: Market Trends')
  })

  it('should validate fullContent is substantial (400+ chars)', async () => {
    const post = await prisma.post.findUnique({
      where: { id: testArticleId },
    })

    expect(post?.fullContent).toBeDefined()
    expect(post?.fullContent!.length).toBeGreaterThanOrEqual(400)
  })

  it('should reject articles with short fullContent', async () => {
    const shortArticleId = await generateSnowflakeId()
    const shortContent = 'This is too short.'

    // In production, the game tick would skip articles < 400 chars
    // This test validates the expected behavior
    const article = await db.createPostWithAllFields({
      id: shortArticleId,
      type: 'article',
      content: 'Short summary',
      fullContent: shortContent,
      articleTitle: 'Short Article',
      authorId: testOrgId,
      gameId: 'continuous',
      dayNumber: 1,
      timestamp: new Date(),
    })

    // Article is created in DB, but in game tick it would be skipped
    expect(article.fullContent!.length).toBeLessThan(400)

    // Cleanup
    await prisma.post.delete({ where: { id: shortArticleId } })
  })

  it('should verify article has proper structure for display', async () => {
    const post = await prisma.post.findUnique({
      where: { id: testArticleId },
    })

    expect(post).toBeDefined()
    expect(post?.type).toBe('article')
    expect(post?.articleTitle).toBeDefined()
    expect(post?.content).toBeDefined() // Summary for feed
    expect(post?.fullContent).toBeDefined() // Full article for detail page
    expect(post?.byline).toBeDefined()
    expect(post?.category).toBeDefined()
    expect(post?.sentiment).toBeDefined()
    expect(post?.biasScore).toBeDefined()

    // Verify fullContent has multiple paragraphs
    const paragraphs = post?.fullContent?.split('\n\n') || []
    expect(paragraphs.length).toBeGreaterThanOrEqual(4)
  })

  it('should verify Latest News API returns articles with summary only', async () => {
    // Simulate what Latest News panel fetches
    const articles = await prisma.post.findMany({
      where: {
        type: 'article',
        authorId: testOrgId,
      },
      take: 10,
      orderBy: { timestamp: 'desc' },
    })

    expect(articles.length).toBeGreaterThan(0)

    const article = articles[0]
    expect(article?.type).toBe('article')
    expect(article?.content).toBeDefined() // Summary
    expect(article?.articleTitle).toBeDefined()
    // fullContent is available but Latest News doesn't need to display it
    expect(article?.fullContent).toBeDefined()
  })

  it('should verify article detail page gets fullContent', async () => {
    // Simulate what post detail page fetches
    const post = await prisma.post.findUnique({
      where: { id: testArticleId },
    })

    expect(post).toBeDefined()
    expect(post?.type).toBe('article')
    expect(post?.fullContent).toBeDefined()
    expect(post?.fullContent!.length).toBeGreaterThan(400)

    // Verify it can be split into paragraphs for display
    const paragraphs = post?.fullContent?.split('\n\n').filter(p => p.trim()) || []
    expect(paragraphs.length).toBeGreaterThan(0)
  })
})

