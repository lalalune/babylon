/**
 * Continuous RL Loop Runner
 * 
 * Runs the complete continuous RL learning loop locally:
 * 1. Agents run and generate trajectories
 * 2. Trajectories are collected and saved
 * 3. When enough data, training is triggered
 * 4. Model is trained and saved to W&B
 * 5. Model is deployed (marked ready)
 * 6. Trajectories are marked as used (epoch)
 * 7. Agents use the latest model
 * 8. Loop repeats
 * 
 * This is the ACTUAL continuous loop that runs forever.
 * 
 * Usage:
 *   npx ts-node scripts/run-continuous-rl-loop.ts [--check-interval 60]
 */

import { prisma } from '@/lib/prisma';
import { AutomationPipeline } from '@/lib/training/AutomationPipeline';
import { agentRuntimeManager } from '@/lib/agents/runtime/AgentRuntimeManager';
import { getLatestRLModel } from '@/lib/training/WandbModelFetcher';
import { ModelUsageVerifier } from '@/lib/training/ModelUsageVerifier';
import { ensureTestAgents } from '@/lib/agents/utils/createTestAgent';
import type { IAgentRuntime } from '@elizaos/core';

interface LoopStats {
  cycle: number;
  trajectoriesGenerated: number;
  trainingTriggered: boolean;
  modelsTrained: number;
  agentsUsingTrainedModel: number;
  lastModelVersion: string | null;
}

class ContinuousRLLoop {
  private pipeline: AutomationPipeline;
  private checkIntervalMinutes: number;
  private agentIds: string[] = [];
  private stats: LoopStats = {
    cycle: 0,
    trajectoriesGenerated: 0,
    trainingTriggered: false,
    modelsTrained: 0,
    agentsUsingTrainedModel: 0,
    lastModelVersion: null,
  };
  
  constructor(checkIntervalMinutes: number = 60) {
    this.checkIntervalMinutes = checkIntervalMinutes;
    this.pipeline = new AutomationPipeline({
      minTrajectoriesForTraining: 10, // Low threshold for testing
      minGroupSize: 2,
      autoTriggerTraining: true,
      trainingInterval: 1, // Check every hour
    });
  }
  
  /**
   * Initialize agents
   */
  async initialize(): Promise<void> {
    console.log('\n🚀 Initializing Continuous RL Loop\n');
    
    // Create or get test agents
    this.agentIds = await ensureTestAgents(3, 'continuous-rl-agent', {
      autonomousTrading: true,
      autonomousPosting: true,
      autonomousCommenting: true,
    });
    
    console.log(`  ✅ Initialized ${this.agentIds.length} agents\n`);
    
    // Check current model status
    const latestModel = await getLatestRLModel();
    if (latestModel) {
      this.stats.lastModelVersion = latestModel.version;
      console.log(`  📊 Current model: ${latestModel.modelPath} (v${latestModel.version})\n`);
    } else {
      console.log(`  📊 No trained model yet - will use base model\n`);
    }
  }
  
  /**
   * Run one cycle of the loop
   */
  async runCycle(): Promise<void> {
    this.stats.cycle++;
    
    console.log('\n' + '='.repeat(60));
    console.log(`🔄 CYCLE ${this.stats.cycle}`);
    console.log('='.repeat(60) + '\n');
    
    // Step 1: Run automation pipeline (checks readiness, triggers training, deploys models)
    console.log('📋 Step 1: Running Automation Pipeline\n');
    
    try {
      await this.pipeline.runAutomationCycle();
      console.log('  ✅ Automation cycle completed\n');
    } catch (error) {
      console.error('  ❌ Automation cycle error:', error);
      console.log('  ⏭️  Continuing to next cycle...\n');
    }
    
    // Step 2: Check training status
    console.log('📋 Step 2: Checking Training Status\n');
    
    const readiness = await this.pipeline.checkTrainingReadiness();
    console.log(`  📊 Readiness: ${readiness.ready ? '✅ READY' : '⏳ NOT READY'}`);
    console.log(`     Trajectories: ${readiness.stats.totalTrajectories}`);
    console.log(`     Groups: ${readiness.stats.scenarioGroups}\n`);
    
    // Step 3: Check for new models
    console.log('📋 Step 3: Checking for New Models\n');
    
    const latestModel = await getLatestRLModel();
    if (latestModel && latestModel.version !== this.stats.lastModelVersion) {
      console.log(`  🎉 NEW MODEL AVAILABLE!`);
      console.log(`     Model: ${latestModel.modelPath}`);
      console.log(`     Version: ${latestModel.version}`);
      console.log(`     Avg Reward: ${latestModel.metadata.avgReward?.toFixed(2) || 'N/A'}\n`);
      
      this.stats.lastModelVersion = latestModel.version;
      this.stats.modelsTrained++;
      
      // Clear agent runtimes so they pick up new model
      for (const agentId of this.agentIds) {
        agentRuntimeManager.clearRuntime(agentId);
      }
      console.log(`  ✅ Cleared agent runtimes - will load new model on next use\n`);
    } else if (latestModel) {
      console.log(`  📊 Current model: ${latestModel.modelPath} (v${latestModel.version})\n`);
    } else {
      console.log(`  ⚠️  No trained model available yet\n`);
    }
    
    // Step 4: Verify agents are using trained model
    console.log('📋 Step 4: Verifying Agent Model Usage\n');
    
    const runtimes = new Map<string, IAgentRuntime>();
    for (const agentId of this.agentIds) {
      const runtime = await agentRuntimeManager.getRuntime(agentId);
      runtimes.set(agentId, runtime);
    }
    
    const verification = await ModelUsageVerifier.verifyMultipleAgents(
      this.agentIds,
      runtimes
    );
    
    console.log(`  📊 Model Usage:`);
    console.log(`     Agents checked: ${verification.agentsChecked}`);
    console.log(`     Using trained model: ${verification.agentsUsingTrainedModel}`);
    console.log(`     Using base model: ${verification.agentsUsingBaseModel}\n`);
    
    this.stats.agentsUsingTrainedModel = verification.agentsUsingTrainedModel;
    
    // Log details
    verification.details.forEach(detail => {
      const icon = detail.isTrainedModel ? '✅' : '❌';
      console.log(`     ${icon} Agent ${detail.agentId.substring(0, 12)}: ${detail.modelUsed} (${detail.isTrainedModel ? 'TRAINED' : 'BASE'})`);
    });
    console.log();
    
    // Step 5: Count trajectories
    const trajectoryCount = await prisma.trajectory.count({
      where: {
        agentId: { in: this.agentIds },
        usedInTraining: false,
      },
    });
    
    console.log(`📊 Statistics:`);
    console.log(`   Cycle: ${this.stats.cycle}`);
    console.log(`   Unused trajectories: ${trajectoryCount}`);
    console.log(`   Models trained: ${this.stats.modelsTrained}`);
    console.log(`   Agents using trained model: ${this.stats.agentsUsingTrainedModel}/${this.agentIds.length}\n`);
    
    // Step 6: Check if we should run agents (generate more data)
    if (trajectoryCount < 20) {
      console.log('📋 Step 5: Running Agents to Generate More Data\n');
      console.log(`  ⚠️  Low trajectory count (${trajectoryCount}) - agents should run more\n`);
      console.log(`  💡 In production, agents run automatically via cron\n`);
      console.log(`  💡 For testing, run: npx ts-node scripts/run-full-rl-pipeline.ts\n`);
    }
  }
  
  /**
   * Run the continuous loop
   */
  async run(): Promise<void> {
    console.log('\n🔄 CONTINUOUS RL LOOP\n');
    console.log('='.repeat(60));
    console.log(`Check interval: ${this.checkIntervalMinutes} minutes`);
    console.log('='.repeat(60) + '\n');
    
    await this.initialize();
    
    // Run first cycle immediately
    await this.runCycle();
    
    // Then run on interval
    const intervalMs = this.checkIntervalMinutes * 60 * 1000;
    
    console.log(`\n⏰ Will check every ${this.checkIntervalMinutes} minutes...\n`);
    console.log('Press Ctrl+C to stop\n');
    
    const interval = setInterval(async () => {
      try {
        await this.runCycle();
      } catch (error) {
        console.error('Cycle error:', error);
      }
    }, intervalMs);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Stopping continuous loop...\n');
      clearInterval(interval);
      prisma.$disconnect().then(() => {
        console.log('✅ Disconnected from database\n');
        process.exit(0);
      });
    });
    
    // Keep process alive
    await new Promise(() => {
      // Run forever
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const checkInterval = parseInt(
    args.find(a => a.startsWith('--check-interval'))?.split('=')[1] || 
    args.find(a => a.startsWith('--check-interval='))?.split('=')[1] ||
    '60'
  );
  
  const loop = new ContinuousRLLoop(checkInterval);
  await loop.run();
}

main().catch((error) => {
  console.error('Loop failed:', error);
  process.exit(1);
});

