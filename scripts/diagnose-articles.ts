/**
 * Diagnose Article Generation Issues
 * 
 * Checks why articles might not be appearing in Latest News
 * 
 * Run: npx tsx scripts/diagnose-articles.ts
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

async function diagnose() {
  console.log('🔍 Diagnosing Article Generation\n');
  console.log('='.repeat(70));
  
  // 1. Check database for articles
  console.log('\n1️⃣  CHECKING DATABASE FOR ARTICLES...\n');
  
  const totalPosts = await prisma.post.count();
  const articlesCount = await prisma.post.count({ where: { type: 'article' } });
  const newsCount = await prisma.post.count({ where: { type: 'news' } });
  const regularCount = await prisma.post.count({ where: { type: 'post' } });
  
  console.log(`Total posts: ${totalPosts}`);
  console.log(`  ├─ type='article': ${articlesCount}`);
  console.log(`  ├─ type='news': ${newsCount}`);
  console.log(`  └─ type='post': ${regularCount}`);
  
  if (articlesCount === 0) {
    console.log('\n  ⚠️  NO ARTICLES FOUND - This is the problem!');
  } else {
    console.log('\n  ✓ Articles exist in database');
  }
  
  // 2. Check posts with articleTitle (should be articles)
  console.log('\n2️⃣  CHECKING POSTS WITH ARTICLE TITLES...\n');
  
  const postsWithTitles = await prisma.post.findMany({
    where: { articleTitle: { not: null } },
    select: {
      id: true,
      type: true,
      articleTitle: true,
      authorId: true,
      timestamp: true,
    },
    orderBy: { timestamp: 'desc' },
    take: 10,
  });
  
  console.log(`Posts with articleTitle: ${postsWithTitles.length}`);
  
  if (postsWithTitles.length > 0) {
    console.log('\nSamples:');
    postsWithTitles.forEach((p, i) => {
      console.log(`  ${i + 1}. [${p.type}] "${p.articleTitle}" by ${p.authorId}`);
    });
    
    const withWrongType = postsWithTitles.filter(p => p.type !== 'article');
    if (withWrongType.length > 0) {
      console.log(`\n  ⚠️  ${withWrongType.length} posts have articleTitle but type != 'article'`);
      console.log('  This is a bug - these should have type="article"');
    }
  }
  
  // 3. Check news organization posts
  console.log('\n3️⃣  CHECKING NEWS ORGANIZATION POSTS...\n');
  
  const newsOrgs = await prisma.organization.findMany({
    where: { type: 'media' },
    select: { id: true, name: true },
    take: 10,
  });
  
  console.log(`News organizations: ${newsOrgs.length}`);
  
  for (const org of newsOrgs.slice(0, 5)) {
    const orgPosts = await prisma.post.count({
      where: { authorId: org.id },
    });
    const orgArticles = await prisma.post.count({
      where: { authorId: org.id, type: 'article' },
    });
    
    console.log(`  • ${org.name}: ${orgPosts} posts (${orgArticles} articles)`);
  }
  
  // 4. Check recent game tick logs
  console.log('\n4️⃣  CHECKING GAME TICK HISTORY...\n');
  
  const gameState = await prisma.game.findFirst({
    where: { isContinuous: true },
    select: {
      lastTickAt: true,
      isRunning: true,
    },
  });
  
  if (gameState) {
    console.log(`  Last tick: ${gameState.lastTickAt?.toISOString() || 'Never'}`);
    console.log(`  Game running: ${gameState.isRunning ? 'YES' : 'NO'}`);
    
    if (!gameState.isRunning) {
      console.log('\n  ⚠️  GAME IS PAUSED - No content will be generated');
      console.log('  To start: Update Game.isRunning = true in database');
    }
  } else {
    console.log('  ⚠️  No game state found');
  }
  
  // 5. Check trending tags
  console.log('\n5️⃣  CHECKING TRENDING CALCULATION...\n');
  
  const latestTrending = await prisma.trendingTag.findFirst({
    orderBy: { calculatedAt: 'desc' },
    select: {
      calculatedAt: true,
      rank: true,
      postCount: true,
      tag: {
        select: { displayName: true }
      }
    },
  });
  
  if (latestTrending) {
    const ageMinutes = Math.floor((Date.now() - latestTrending.calculatedAt.getTime()) / 60000);
    console.log(`  Last calculated: ${ageMinutes} minutes ago`);
    console.log(`  Top tag: "${latestTrending.tag.displayName}" (${latestTrending.postCount} posts)`);
  } else {
    console.log('  ⚠️  Never calculated - will be forced on next tick with articles');
  }
  
  // 6. Check tags on posts
  console.log('\n6️⃣  CHECKING POST TAGGING...\n');
  
  const totalTags = await prisma.tag.count();
  const totalPostTags = await prisma.postTag.count();
  
  console.log(`  Tags in database: ${totalTags}`);
  console.log(`  Post-tag assignments: ${totalPostTags}`);
  
  if (totalPostTags === 0 && totalPosts > 0) {
    console.log('\n  ⚠️  Posts exist but no tags - tagging might be disabled');
    console.log('  Check GROQ_API_KEY or OPENAI_API_KEY environment variable');
  }
  
  // FINAL DIAGNOSIS
  console.log('\n' + '='.repeat(70));
  console.log('🎯 DIAGNOSIS');
  console.log('='.repeat(70) + '\n');
  
  const issues: string[] = [];
  const fixes: string[] = [];
  
  if (articlesCount === 0) {
    issues.push('No articles exist with type="article"');
    fixes.push('Trigger a game tick to generate articles');
  }
  
  const trendingCount = await prisma.trendingTag.count();
  if (trendingCount === 0) {
    issues.push('No trending data calculated');
    fixes.push('Will be auto-calculated after articles are generated');
  }
  
  if (gameState && !gameState.isRunning) {
    issues.push('Game is paused');
    fixes.push('Set Game.isRunning = true in database');
  }
  
  if (newsOrgs.length === 0) {
    issues.push('No news organizations in database');
    fixes.push('Run: npx tsx scripts/init-game-content.ts');
  }
  
  if (issues.length === 0) {
    console.log('✅ No issues detected!');
    console.log('\nIf Latest News and Trending are still empty:');
    console.log('  1. Trigger a game tick (see command above)');
    console.log('  2. Wait 5 seconds');
    console.log('  3. Refresh the page');
  } else {
    console.log('❌ Issues Found:\n');
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
    
    console.log('\n🔧 Recommended Fixes:\n');
    fixes.forEach((fix, i) => {
      console.log(`  ${i + 1}. ${fix}`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
  
  return issues.length === 0;
}

diagnose()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });

