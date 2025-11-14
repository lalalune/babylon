/**
 * Verify First Tick Content Generation
 * 
 * Tests that the first game tick properly generates:
 * - Initial questions
 * - Baseline posts and articles
 * - Trending data
 * 
 * Run: npx tsx scripts/verify-first-tick.ts
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

async function verifyFirstTick() {
  console.log('🔍 Verifying first tick content generation...\n');
  
  // 1. Check questions
  const questions = await prisma.question.findMany({
    where: { status: 'active' },
    take: 10,
  });
  
  console.log(`✓ Active Questions: ${questions.length}`);
  if (questions.length > 0) {
    console.log(`  Sample: "${questions[0]!.text}"`);
  } else {
    console.log(`  ⚠️  No questions found - game tick should generate some`);
  }
  
  // 2. Check posts (general)
  const posts = await prisma.post.findMany({
    orderBy: { timestamp: 'desc' },
    take: 10,
  });
  
  console.log(`\n✓ Total Posts: ${posts.length}`);
  if (posts.length > 0) {
    console.log(`  Sample: "${posts[0]!.content?.substring(0, 80)}..."`);
  } else {
    console.log(`  ⚠️  No posts found - game tick should generate some`);
  }
  
  // 3. Check articles specifically
  const articles = await prisma.post.findMany({
    where: { type: 'article' },
    orderBy: { timestamp: 'desc' },
    take: 10,
  });
  
  console.log(`\n✓ Articles (type='article'): ${articles.length}`);
  if (articles.length > 0) {
    const sample = articles[0]!;
    console.log(`  Title: "${sample.articleTitle}"`);
    console.log(`  Summary: "${sample.content?.substring(0, 80)}..."`);
    console.log(`  Author: ${sample.authorId}`);
  } else {
    console.log(`  ⚠️  No articles found - Latest News panel will be empty`);
  }
  
  // 4. Check trending tags
  const trendingTags = await prisma.trendingTag.findMany({
    orderBy: { rank: 'asc' },
    take: 5,
    include: {
      tag: true,
    },
  });
  
  console.log(`\n✓ Trending Tags: ${trendingTags.length}`);
  if (trendingTags.length > 0) {
    trendingTags.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.tag.displayName} (${t.postCount} posts, score: ${t.score.toFixed(2)})`);
    });
  } else {
    console.log(`  ⚠️  No trending tags found - Trending panel will be empty`);
  }
  
  // 5. Check tags on posts
  const tagsCount = await prisma.postTag.count();
  console.log(`\n✓ Post Tags: ${tagsCount} tag assignments`);
  
  // 6. Check organizations
  const newsOrgs = await prisma.organization.findMany({
    where: { type: 'media' },
    take: 5,
  });
  
  console.log(`\n✓ News Organizations: ${newsOrgs.length}`);
  if (newsOrgs.length > 0) {
    newsOrgs.forEach(org => {
      console.log(`  - ${org.name}`);
    });
  } else {
    console.log(`  ⚠️  No news organizations found - articles can't be generated`);
  }
  
  // 7. Check actors
  const actors = await prisma.actor.findMany({
    take: 5,
  });
  
  console.log(`\n✓ Actors: ${actors.length}`);
  if (actors.length > 0) {
    console.log(`  Sample: ${actors[0]!.name}`);
  } else {
    console.log(`  ⚠️  No actors found - posts can't be generated`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY:');
  console.log('='.repeat(60));
  
  const hasContent = articles.length > 0 && trendingTags.length > 0;
  
  if (hasContent) {
    console.log('✅ First tick content is ready!');
    console.log('   - Latest News panel will show articles');
    console.log('   - Trending panel will show trending topics');
  } else {
    console.log('⚠️  Missing content:');
    if (articles.length === 0) console.log('   - No articles (Latest News will be empty)');
    if (trendingTags.length === 0) console.log('   - No trending tags (Trending will be empty)');
    console.log('\nTo fix:');
    console.log('1. Trigger game tick: POST /api/cron/game-tick');
    console.log('2. Wait 3-5 seconds for tags to be generated');
    console.log('3. Refresh the feed pages');
  }
  
  console.log('='.repeat(60));
}

verifyFirstTick()
  .then(() => {
    logger.info('Verification complete', undefined, 'VerifyFirstTick');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Verification failed', { error }, 'VerifyFirstTick');
    process.exit(1);
  });

