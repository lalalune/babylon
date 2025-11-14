/**
 * Check if trajectories were created
 */

import { prisma } from '../src/lib/prisma';

async function checkTrajectories() {
  console.log('Checking for trajectories...\n');
  
  const count = await prisma.trajectory.count({
    where: {
      windowId: {
        startsWith: '2025-11-13'
      }
    }
  });
  
  console.log(`✅ Total trajectories found: ${count}`);
  
  if (count > 0) {
    const recentWindow = await prisma.trajectory.groupBy({
      by: ['windowId'],
      where: {
        windowId: {
          startsWith: '2025-11-13'
        }
      },
      _count: true,
      orderBy: {
        windowId: 'desc'
      },
      take: 5
    });
    
    console.log('\nRecent windows:');
    for (const window of recentWindow) {
      console.log(`  ${window.windowId}: ${window._count} trajectories`);
    }
    
    const sample = await prisma.trajectory.findFirst({
      where: {
        windowId: {
          startsWith: '2025-11-13'
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (sample) {
      console.log('\nMost recent trajectory:');
      console.log(`  ID: ${sample.trajectoryId}`);
      console.log(`  Agent: ${sample.agentId}`);
      console.log(`  Window: ${sample.windowId}`);
      console.log(`  Steps: ${sample.episodeLength}`);
      console.log(`  Reward: ${sample.totalReward}`);
      console.log(`  Status: ${sample.finalStatus}`);
      
      const steps = JSON.parse(sample.stepsJson);
      console.log(`  LLM calls: ${steps.reduce((sum: number, s: any) => sum + (s.llmCalls?.length || 0), 0)}`);
    }
  } else {
    console.log('\n⚠️  No trajectories found for today');
  }
  
  await prisma.$disconnect();
}

checkTrajectories().catch(console.error);

