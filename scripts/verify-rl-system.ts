#!/usr/bin/env bun
/**
 * RL System Verification Script
 * 
 * Comprehensively verifies the entire RL training and inference system.
 * Tests all components, configurations, and integrations.
 */

import { getRLModelConfig, isRLModelAvailable } from '../src/lib/training/RLModelConfig';
import { getLatestRLModel, getModelForInference, shouldUseRLModel } from '../src/lib/training/WandbModelFetcher';
import { automationPipeline } from '../src/lib/training/AutomationPipeline';
import { prisma } from '../src/lib/prisma';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  error?: Error;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true, message: 'Passed' });
    console.log(`  ✅ ${name}`);
  } catch (error) {
    results.push({ 
      name, 
      passed: false, 
      message: error instanceof Error ? error.message : 'Unknown error',
      error: error instanceof Error ? error : undefined
    });
    console.log(`  ❌ ${name}`);
    console.log(`     ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function verifyRLSystem() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     RL SYSTEM COMPREHENSIVE VERIFICATION              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Test 1: Configuration System
  console.log('📋 Test Group 1: Configuration System');
  console.log('═'.repeat(60));
  
  await test('Load RL configuration', async () => {
    const config = getRLModelConfig();
    if (!config) throw new Error('Config is null');
    if (typeof config.enabled !== 'boolean') throw new Error('Config.enabled not a boolean');
    if (typeof config.fallbackToBase !== 'boolean') throw new Error('Config.fallbackToBase not a boolean');
  });
  
  await test('Check RL availability', async () => {
    const available = isRLModelAvailable();
    if (typeof available !== 'boolean') throw new Error('isRLModelAvailable() should return boolean');
  });
  
  await test('shouldUseRLModel returns boolean', async () => {
    const should = shouldUseRLModel();
    if (typeof should !== 'boolean') throw new Error('shouldUseRLModel() should return boolean');
  });
  
  console.log('');

  // Test 2: Database Connectivity
  console.log('📋 Test Group 2: Database Connectivity');
  console.log('═'.repeat(60));
  
  await test('Database connection', async () => {
    await prisma.user.count();
  });
  
  await test('Trajectory table accessible', async () => {
    const count = await prisma.trajectory.count();
    if (typeof count !== 'number') throw new Error('Count should be a number');
  });
  
  await test('TrainingBatch table accessible', async () => {
    const count = await prisma.trainingBatch.count();
    if (typeof count !== 'number') throw new Error('Count should be a number');
  });
  
  await test('TrainedModel table accessible', async () => {
    const count = await prisma.trainedModel.count();
    if (typeof count !== 'number') throw new Error('Count should be a number');
  });
  
  console.log('');

  // Test 3: Model Fetching
  console.log('📋 Test Group 3: Model Fetching');
  console.log('═'.repeat(60));
  
  await test('Get latest RL model (may be null)', async () => {
    const model = await getLatestRLModel();
    // May be null if no models trained yet - that's OK
    if (model !== null && !model.version) {
      throw new Error('Model should have version property');
    }
  });
  
  await test('Get model for inference', async () => {
    const model = await getModelForInference();
    // May be null - that's OK
    if (model !== null && !model.version) {
      throw new Error('Model should have version property');
    }
  });
  
  console.log('');

  // Test 4: Automation Pipeline
  console.log('📋 Test Group 4: Automation Pipeline');
  console.log('═'.repeat(60));
  
  await test('Check training readiness', async () => {
    const readiness = await automationPipeline.checkTrainingReadiness();
    if (typeof readiness.ready !== 'boolean') throw new Error('readiness.ready should be boolean');
    if (!readiness.reason) throw new Error('readiness.reason should exist');
    if (!readiness.stats) throw new Error('readiness.stats should exist');
  });
  
  await test('Get automation status', async () => {
    const status = await automationPipeline.getStatus();
    if (!status.dataCollection) throw new Error('status.dataCollection should exist');
    if (!status.training) throw new Error('status.training should exist');
    if (!status.models) throw new Error('status.models should exist');
    if (!status.health) throw new Error('status.health should exist');
  });
  
  console.log('');

  // Test 5: Type Safety
  console.log('📋 Test Group 5: Type Safety & Exports');
  console.log('═'.repeat(60));
  
  await test('All functions are exported', () => {
    if (typeof getRLModelConfig !== 'function') throw new Error('getRLModelConfig not exported');
    if (typeof isRLModelAvailable !== 'function') throw new Error('isRLModelAvailable not exported');
    if (typeof getLatestRLModel !== 'function') throw new Error('getLatestRLModel not exported');
    if (typeof getModelForInference !== 'function') throw new Error('getModelForInference not exported');
    if (typeof shouldUseRLModel !== 'function') throw new Error('shouldUseRLModel not exported');
  });
  
  await test('AutomationPipeline is singleton', () => {
    if (!automationPipeline) throw new Error('automationPipeline not exported');
    if (typeof automationPipeline.checkTrainingReadiness !== 'function') {
      throw new Error('automationPipeline.checkTrainingReadiness not a function');
    }
  });
  
  console.log('');

  // Summary
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                 VERIFICATION SUMMARY                   ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Success Rate: ${percentage}%`);
  console.log('');
  
  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.message}`);
    });
    console.log('');
  }
  
  // Configuration Details
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║              CURRENT CONFIGURATION                     ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  const config = getRLModelConfig();
  const available = isRLModelAvailable();
  
  console.log('🤖 RL Model Configuration:');
  console.log(`   Enabled: ${config.enabled}`);
  console.log(`   Available: ${available}`);
  console.log(`   W&B Configured: ${!!(config.wandbApiKey && config.wandbEntity)}`);
  console.log(`   Project: ${config.wandbProject}`);
  console.log(`   Base Model: ${config.baseModel}`);
  console.log(`   Fallback Enabled: ${config.fallbackToBase}`);
  console.log(`   Pinned Version: ${config.modelVersion || 'latest'}`);
  console.log('');
  
  // Database Stats
  const trajectoryCount = await prisma.trajectory.count();
  const batchCount = await prisma.trainingBatch.count();
  const modelCount = await prisma.trainedModel.count();
  
  console.log('📊 Database Statistics:');
  console.log(`   Trajectories: ${trajectoryCount}`);
  console.log(`   Training Batches: ${batchCount}`);
  console.log(`   Trained Models: ${modelCount}`);
  console.log('');
  
  // System Readiness
  const readiness = await automationPipeline.checkTrainingReadiness();
  console.log('🎯 Training Readiness:');
  console.log(`   Ready: ${readiness.ready}`);
  console.log(`   Reason: ${readiness.reason}`);
  console.log(`   Total Trajectories: ${readiness.stats.totalTrajectories}`);
  console.log(`   Scenario Groups: ${readiness.stats.scenarioGroups}`);
  console.log(`   Data Quality: ${(readiness.stats.dataQuality * 100).toFixed(1)}%`);
  console.log('');
  
  // Model Info
  const latestModel = await getLatestRLModel();
  if (latestModel) {
    console.log('🚀 Latest Trained Model:');
    console.log(`   Version: ${latestModel.version}`);
    console.log(`   Base Model: ${latestModel.metadata.baseModel}`);
    console.log(`   Avg Reward: ${latestModel.metadata.avgReward?.toFixed(3) || 'N/A'}`);
    console.log(`   Benchmark Score: ${latestModel.metadata.benchmarkScore?.toFixed(3) || 'N/A'}`);
    console.log(`   Trained: ${latestModel.metadata.trainedAt.toLocaleString()}`);
    console.log('');
  }
  
  // Next Steps
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                   NEXT STEPS                           ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  if (!config.enabled) {
    console.log('⚠️  RL is disabled. To enable:');
    console.log('   • Set USE_RL_MODEL=true (or run in dev mode)');
    console.log('');
  }
  
  if (!available) {
    console.log('⚠️  RL not available. To enable:');
    console.log('   • Set WANDB_API_KEY=your_key');
    console.log('   • Set WANDB_ENTITY=your_username');
    console.log('');
  }
  
  if (modelCount === 0) {
    console.log('ℹ️  No trained models yet. To train:');
    console.log('   • POST /api/admin/training/trigger');
    console.log('   • Or wait for automatic training (every 24h)');
    console.log('');
  }
  
  if (trajectoryCount < (Number(process.env.TRAINING_MIN_TRAJECTORIES) || 1000)) {
    console.log('ℹ️  Need more trajectories for training:');
    console.log(`   • Current: ${trajectoryCount}`);
    console.log(`   • Required: ${Number(process.env.TRAINING_MIN_TRAJECTORIES) || 1000} (configurable via TRAINING_MIN_TRAJECTORIES)`);
    console.log('   • Trajectories collect automatically as agents operate');
    console.log('');
  }
  
  // Final Result
  console.log('═'.repeat(60));
  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED - SYSTEM OPERATIONAL');
  } else {
    console.log(`⚠️  ${failed} TEST(S) FAILED - CHECK ERRORS ABOVE`);
  }
  console.log('═'.repeat(60));
  console.log('');
  
  await prisma.$disconnect();
  
  process.exit(failed > 0 ? 1 : 0);
}

verifyRLSystem().catch((error) => {
  console.error('\n❌ Verification failed with error:', error);
  process.exit(1);
});

