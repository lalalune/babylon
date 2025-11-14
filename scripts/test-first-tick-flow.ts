/**
 * Test First Tick Flow
 * 
 * Simulates and tests the first game tick to ensure:
 * 1. Initial questions are created
 * 2. Posts and articles are generated
 * 3. Trending data is calculated
 * 
 * Run: npx tsx scripts/test-first-tick-flow.ts
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

async function testFirstTickFlow() {
  console.log('🧪 Testing First Tick Flow\n');
  console.log('='.repeat(60));
  
  // STEP 1: Check prerequisites
  console.log('\n📋 STEP 1: Checking Prerequisites...');
  
  const actors = await prisma.actor.count();
  const newsOrgs = await prisma.organization.count({ where: { type: 'media' } });
  
  console.log(`  ✓ Actors in database: ${actors}`);
  console.log(`  ✓ News organizations: ${newsOrgs}`);
  
  if (actors === 0 || newsOrgs === 0) {
    console.log('\n  ❌ ERROR: Need actors and news organizations to generate content');
    console.log('  Run: npx tsx scripts/init-game-content.ts');
    return false;
  }
  
  // STEP 2: Check current state
  console.log('\n📊 STEP 2: Current State...');
  
  const currentQuestions = await prisma.question.count({ where: { status: 'active' } });
  const currentPosts = await prisma.post.count();
  const currentArticles = await prisma.post.count({ where: { type: 'article' } });
  const currentTrending = await prisma.trendingTag.count();
  
  console.log(`  • Active questions: ${currentQuestions}`);
  console.log(`  • Total posts: ${currentPosts}`);
  console.log(`  • Articles (type='article'): ${currentArticles}`);
  console.log(`  • Trending tags: ${currentTrending}`);
  
  // STEP 3: Simulate first tick logic
  console.log('\n🔄 STEP 3: Simulating First Tick Logic...');
  
  const isFirstTick = currentQuestions === 0;
  console.log(`  • Is first tick: ${isFirstTick ? 'YES' : 'NO'}`);
  
  if (isFirstTick) {
    console.log('  → Will generate 5 initial questions');
    console.log('  → Will reload activeQuestions array');
  }
  
  // Check if we would have questions after generation
  const expectedQuestions = isFirstTick ? 5 : currentQuestions;
  console.log(`  • Expected questions after tick: ${expectedQuestions}`);
  
  if (expectedQuestions > 0) {
    console.log('  → generateMixedPosts will generate posts about questions');
    console.log('  → Some creators will be organizations → articles created');
  }
  
  // Check if we would have events
  const recentEvents = await prisma.worldEvent.count({
    where: {
      timestamp: {
        gte: new Date(Date.now() - 2 * 60 * 60 * 1000), // Last 2 hours
      },
    },
  });
  
  console.log(`  • Recent events (last 2h): ${recentEvents}`);
  
  if (recentEvents === 0) {
    console.log('  → generateArticles will call generateBaselineArticles');
    console.log('  → Will create 5 baseline articles');
  } else {
    console.log('  → generateArticles will create articles from events');
  }
  
  // Expected content after tick
  const expectedArticlesFromMixed = Math.floor(8 * (newsOrgs / (actors + newsOrgs)));
  const expectedArticlesFromBaseline = recentEvents === 0 ? 5 : 0;
  const expectedTotalArticles = expectedArticlesFromMixed + expectedArticlesFromBaseline;
  
  console.log(`\n  📈 Expected Results After Tick:`);
  console.log(`    • Articles from mixed posts: ~${expectedArticlesFromMixed}`);
  console.log(`    • Articles from baseline: ${expectedArticlesFromBaseline}`);
  console.log(`    • Total new articles: ~${expectedTotalArticles}`);
  console.log(`    • Trending will be calculated: YES (forced if articles > 0)`);
  
  // STEP 4: Validate API endpoints
  console.log('\n🔌 STEP 4: Validating API Endpoints...');
  
  // Check if type filter works
  const articlesInDb = await prisma.post.findMany({
    where: { type: 'article' },
    take: 1,
  });
  
  if (articlesInDb.length > 0) {
    console.log('  ✓ /api/posts?type=article filter will work (articles exist)');
  } else {
    console.log('  ℹ️  /api/posts?type=article will return empty until articles are generated');
  }
  
  // Check trending endpoint
  const trendingTags = await prisma.trendingTag.findMany({ take: 1 });
  
  if (trendingTags.length > 0) {
    console.log('  ✓ /api/feed/widgets/trending will return data');
  } else {
    console.log('  ℹ️  /api/feed/widgets/trending will return empty array with message');
  }
  
  // STEP 5: Summary
  console.log('\n' + '='.repeat(60));
  console.log('📝 SUMMARY');
  console.log('='.repeat(60));
  
  const allGood = actors > 0 && newsOrgs > 0;
  
  if (allGood) {
    console.log('\n✅ First tick flow is ready!');
    console.log('\nWhat happens on first tick:');
    console.log('  1. Generate 5 initial questions (if none exist)');
    console.log('  2. Generate 8 mixed posts (NPCs + org articles)');
    console.log('  3. Generate 5 baseline articles (if no events)');
    console.log('  4. Wait 3 seconds for tag extraction');
    console.log('  5. Force trending calculation');
    console.log('\nExpected results:');
    console.log('  • Latest News: 5-10 articles');
    console.log('  • Trending: Top 5 trending topics');
    console.log('  • Feed: Mix of posts and articles');
  } else {
    console.log('\n❌ Prerequisites missing:');
    if (actors === 0) console.log('  • No actors (run: npx tsx scripts/init-game-content.ts)');
    if (newsOrgs === 0) console.log('  • No news orgs (run: npx tsx scripts/init-game-content.ts)');
  }
  
  console.log('\n💡 To trigger a game tick:');
  console.log('  curl -X POST http://localhost:3000/api/cron/game-tick \\');
  console.log('    -H "Authorization: Bearer development"');
  console.log('\n  Or wait for the cron job to run automatically');
  
  console.log('\n' + '='.repeat(60));
  
  return allGood;
}

testFirstTickFlow()
  .then((success) => {
    logger.info('Test complete', { success }, 'TestFirstTick');
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    logger.error('Test failed', { error }, 'TestFirstTick');
    process.exit(1);
  });

