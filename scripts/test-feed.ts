#!/usr/bin/env bun
/**
 * Test Feed - Quick diagnostic for feed issues
 */

import { prisma } from '../src/lib/prisma';
import { logger } from '../src/lib/logger';

async function main() {
  logger.info('🔍 Testing Feed System', undefined, 'Test');
  logger.info('='.repeat(60), undefined, 'Test');
  
  // 1. Check posts in database
  const totalPosts = await prisma.post.count();
  logger.info(`Total posts in database: ${totalPosts}`, undefined, 'Test');
  
  if (totalPosts === 0) {
    logger.error('❌ NO POSTS IN DATABASE!', undefined, 'Test');
    logger.info('', undefined, 'Test');
    logger.info('Possible causes:', undefined, 'Test');
    logger.info('1. Daemon not generating content (check [GAME] logs)', undefined, 'Test');
    logger.info('2. LLM API key missing (check GROQ_API_KEY or OPENAI_API_KEY)', undefined, 'Test');
    logger.info('3. Game is paused (check Game.isRunning in database)', undefined, 'Test');
    logger.info('', undefined, 'Test');
    logger.info('Quick fixes:', undefined, 'Test');
    logger.info('• Trigger manual tick: curl http://localhost:3000/api/cron/game-tick', undefined, 'Test');
    logger.info('• Check status: bun run status', undefined, 'Test');
    process.exit(1);
  }
  
  // 2. Get recent posts
  const recentPosts = await prisma.post.findMany({
    take: 10,
    orderBy: { timestamp: 'desc' },
  });
  
  logger.info(`\n📝 Last 10 posts:`, undefined, 'Test');
  recentPosts.forEach((post, i) => {
    const age = Math.floor((Date.now() - post.createdAt.getTime()) / 1000 / 60);
    logger.info(`${i + 1}. [${age}m ago] ${post.authorId}: ${post.content.substring(0, 80)}...`, undefined, 'Test');
  });
  
  // 3. Check if API returns them
  logger.info('\n🌐 Testing API endpoint...', undefined, 'Test');
  
  try {
    const response = await fetch('http://localhost:3000/api/posts?limit=5');
    
    if (!response.ok) {
      logger.error(`❌ API returned ${response.status}`, undefined, 'Test');
      const text = await response.text();
      logger.error(`Response: ${text}`, undefined, 'Test');
      process.exit(1);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      logger.error('❌ API returned success=false', data, 'Test');
      process.exit(1);
    }
    
    if (!Array.isArray(data.posts)) {
      logger.error('❌ API did not return posts array', data, 'Test');
      process.exit(1);
    }
    
    logger.info(`✅ API returned ${data.posts.length} posts`, undefined, 'Test');
    
    if (data.posts.length === 0 && totalPosts > 0) {
      logger.error('❌ DATABASE HAS POSTS BUT API RETURNS NONE!', undefined, 'Test');
      logger.info('This is a bug in the API endpoint', undefined, 'Test');
      process.exit(1);
    }
    
    logger.info(`\n📄 Sample API response:`, undefined, 'Test');
    logger.info(JSON.stringify(data.posts[0], null, 2), undefined, 'Test');
    
  } catch (error) {
    if ((error as any).code === 'ECONNREFUSED') {
      logger.error('❌ Cannot connect to http://localhost:3000', undefined, 'Test');
      logger.error('Is the web server running? Start with: bun run dev', undefined, 'Test');
    } else {
      logger.error('❌ API test failed:', error, 'Test');
    }
    process.exit(1);
  }
  
  // 4. Check actors
  const actorCount = await prisma.actor.count();
  logger.info(`\n👥 Actors in database: ${actorCount}`, undefined, 'Test');
  
  if (actorCount === 0) {
    logger.warn('⚠️  No actors! Posts might not have author names', undefined, 'Test');
    logger.info('Run: bun run db:seed', undefined, 'Test');
  }
  
  // 5. Summary
  logger.info('\n' + '='.repeat(60), undefined, 'Test');
  logger.info('✅ FEED SYSTEM TEST COMPLETE', undefined, 'Test');
  logger.info(`Posts in database: ${totalPosts}`, undefined, 'Test');
  logger.info(`API working: YES`, undefined, 'Test');
  logger.info(`Actors loaded: ${actorCount > 0 ? 'YES' : 'NO'}`, undefined, 'Test');
  logger.info('', undefined, 'Test');
  
  if (totalPosts > 0 && data.posts.length > 0) {
    logger.info('🎉 Feed should be working! If you still see empty feed:', undefined, 'Test');
    logger.info('1. Hard refresh browser (Cmd+Shift+R)', undefined, 'Test');
    logger.info('2. Clear browser cache', undefined, 'Test');
    logger.info('3. Check browser console for errors (F12)', undefined, 'Test');
  }
  
  await prisma.$disconnect();
}

main().catch((error) => {
  logger.error('Test failed:', error, 'Test');
  process.exit(1);
});

