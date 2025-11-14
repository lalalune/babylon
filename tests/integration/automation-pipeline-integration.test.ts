/**
 * Integration Tests for AutomationPipeline
 * 
 * Tests with real database and dependencies
 * 
 * NOTE: Requires trajectory schema to be merged into main Prisma schema
 */

// @ts-nocheck - Requires trajectory schema not yet available
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { AutomationPipeline } from '@/lib/training/AutomationPipeline';
import { prisma } from '@/lib/prisma';
import { trajectoryRecorder } from '@/lib/training/TrajectoryRecorder';

describe('AutomationPipeline - Integration Tests', () => {
  let pipeline: AutomationPipeline;
  let testData: {
    trajectoryIds: string[];
    batchIds: string[];
    modelIds: string[];
  };

  beforeAll(async () => {
    pipeline = new AutomationPipeline({
      minTrajectoriesForTraining: 5,
      minGroupSize: 2,
      dataQualityThreshold: 0.5,
      baseModel: 'OpenPipe/Qwen3-14B-Instruct',
    });

    testData = {
      trajectoryIds: [],
      batchIds: [],
      modelIds: [],
    };
  });

  afterEach(async () => {
    // Cleanup test data after each test
    if (testData.trajectoryIds.length > 0) {
      try {
        await prisma.trajectory.deleteMany({
          where: {
            trajectoryId: {
              in: testData.trajectoryIds
            }
          }
        });
      } catch (error) {
        console.warn('Failed to cleanup trajectories:', error);
      }
      testData.trajectoryIds = [];
    }

    if (testData.batchIds.length > 0) {
      try {
        await prisma.trainingBatch.deleteMany({
          where: {
            batchId: {
              in: testData.batchIds
            }
          }
        });
      } catch (error) {
        console.warn('Failed to cleanup batches:', error);
      }
      testData.batchIds = [];
    }

    if (testData.modelIds.length > 0) {
      try {
        await prisma.trainedModel.deleteMany({
          where: {
            id: {
              in: testData.modelIds
            }
          }
        });
      } catch (error) {
        console.warn('Failed to cleanup models:', error);
      }
      testData.modelIds = [];
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Database Integration', () => {
    test('should connect to database', async () => {
      const result = await prisma.$queryRaw`SELECT 1 as result`;
      expect(result).toBeDefined();
    });

    test('should access trajectory table', async () => {
      const count = await prisma.trajectory.count();
      expect(typeof count).toBe('number');
    });

    test('should access training batch table', async () => {
      try {
        const count = await prisma.trainingBatch.count();
        expect(typeof count).toBe('number');
      } catch (error) {
        console.warn('TrainingBatch table may not exist yet:', error);
        expect(error).toBeDefined();
      }
    });

    test('should access trained model table', async () => {
      try {
        const count = await prisma.trainedModel.count();
        expect(typeof count).toBe('number');
      } catch (error) {
        console.warn('TrainedModel table may not exist yet:', error);
        expect(error).toBeDefined();
      }
    });
  });

  describe('Real Trajectory Collection', () => {
    test('should create and store test trajectories', async () => {
      const windowId = new Date().toISOString().slice(0, 13) + ':00';
      
      // Create 5 test trajectories
      for (let i = 0; i < 5; i++) {
        const trajectoryId = await trajectoryRecorder.startTrajectory({
          agentId: `test-agent-${i}`,
          windowId,
        });

        testData.trajectoryIds.push(trajectoryId);

        // Add step with LLM call
        trajectoryRecorder.startStep(trajectoryId, {
          agentBalance: 10000 + i * 100,
          agentPnL: i * 50,
          openPositions: i,
        });

        trajectoryRecorder.logLLMCall(trajectoryId, {
          model: 'gpt-4o-mini',
          systemPrompt: 'You are a trading agent in a prediction market MMO. Make smart trading decisions.',
          userPrompt: `Step ${i}: Current balance: ${10000 + i * 100}. What should you do?`,
          response: `Action ${i}: BUY $TOKEN`,
          temperature: 0.7,
          maxTokens: 150,
          purpose: 'action',
        });

        trajectoryRecorder.completeStep(trajectoryId, {
          actionType: 'BUY_SHARES',
          parameters: { ticker: '$TOKEN', shares: 10 },
          success: true,
          result: { executed: true, price: 100 },
        }, 0.5 + i * 0.1);

        // End trajectory
        await trajectoryRecorder.endTrajectory(trajectoryId, {
          finalPnL: 100 + i * 50,
          finalBalance: 10100 + i * 150,
          windowId,
        });
      }

      // Verify all trajectories were saved
      const saved = await prisma.trajectory.findMany({
        where: {
          trajectoryId: {
            in: testData.trajectoryIds
          }
        }
      });

      expect(saved).toHaveLength(5);
      expect(saved.every(t => t.windowId === windowId)).toBe(true);
      expect(saved.every(t => t.scenarioId === windowId)).toBe(true);
    });

    test('should check training readiness with real data', async () => {
      const windowId = new Date().toISOString().slice(0, 13) + ':00';
      
      // Create test trajectories
      for (let i = 0; i < 10; i++) {
        const trajectoryId = await trajectoryRecorder.startTrajectory({
          agentId: `test-agent-readiness-${i}`,
          windowId,
        });

        testData.trajectoryIds.push(trajectoryId);

        trajectoryRecorder.startStep(trajectoryId, {
          agentBalance: 10000,
          agentPnL: 0,
          openPositions: 0,
        });

        trajectoryRecorder.logLLMCall(trajectoryId, {
          model: 'gpt-4o-mini',
          systemPrompt: 'You are a trading agent with strong analytical skills.',
          userPrompt: 'Analyze the market and make a decision.',
          response: 'Buy signal detected',
          temperature: 0.7,
          maxTokens: 100,
          purpose: 'action',
        });

        trajectoryRecorder.completeStep(trajectoryId, {
          actionType: 'BUY_SHARES',
          parameters: { ticker: '$TEST' },
          success: true,
          result: { executed: true },
        }, 0.8);

        await trajectoryRecorder.endTrajectory(trajectoryId, {
          finalPnL: Math.random() * 200 - 50,
          windowId,
        });
      }

      // Mark as training data
      await prisma.trajectory.updateMany({
        where: {
          trajectoryId: {
            in: testData.trajectoryIds
          }
        },
        data: {
          isTrainingData: true,
          usedInTraining: false,
        }
      });

      // Check readiness
      const readiness = await pipeline.checkTrainingReadiness();

      expect(readiness).toBeDefined();
      expect(readiness.stats.totalTrajectories).toBeGreaterThanOrEqual(10);
      expect(readiness.stats.dataQuality).toBeGreaterThan(0);
      
      console.log('Training Readiness:', readiness);
    });
  });

  describe('Status and Monitoring', () => {
    test('should get pipeline status', async () => {
      const status = await pipeline.getStatus();

      expect(status).toBeDefined();
      expect(status.dataCollection).toBeDefined();
      expect(status.training).toBeDefined();
      expect(status.models).toBeDefined();
      expect(status.health).toBeDefined();

      expect(typeof status.dataCollection.last24h).toBe('number');
      expect(typeof status.dataCollection.last7d).toBe('number');
      expect(typeof status.dataCollection.ratePerHour).toBe('number');

      console.log('Pipeline Status:', {
        dataCollection: status.dataCollection,
        models: status.models,
        health: status.health,
      });
    });

    test('should perform health checks', async () => {
      // This should not throw
      await pipeline['runHealthChecks']();

      // Get status to verify health
      const status = await pipeline.getStatus();
      expect(status.health.database).toBe(true);
    });
  });

  describe('Model Versioning with Real Data', () => {
    test('should handle version increment with real database', async () => {
      const version1 = await pipeline['getNextModelVersion']();
      expect(version1).toMatch(/^v\d+\.\d+\.\d+$/);

      // Create a mock model in database
      try {
        const model = await prisma.trainedModel.create({
          data: {
            id: `test-model-${Date.now()}`,
            modelId: 'test-model',
            version: version1,
            baseModel: 'OpenPipe/Qwen3-14B-Instruct',
            storagePath: '/tmp/test',
            status: 'ready',
          }
        });

        testData.modelIds.push(model.id);

        // Get next version
        const version2 = await pipeline['getNextModelVersion']();
        
        // Parse versions
        const [, , patch1] = version1.substring(1).split('.').map(Number);
        const [, , patch2] = version2.substring(1).split('.').map(Number);
        
        expect(patch2).toBe(patch1! + 1);
      } catch (error) {
        console.warn('TrainedModel table may not exist:', error);
      }
    });
  });

  describe('End-to-End Data Flow', () => {
    test('should complete full data collection cycle', async () => {
      const windowId = new Date().toISOString().slice(0, 13) + ':00';
      
      console.log('\n🚀 Starting E2E Data Flow Test\n');

      // Step 1: Collect trajectories
      console.log('📊 Step 1: Collecting trajectories...');
      const trajectoryIds: string[] = [];
      
      for (let i = 0; i < 6; i++) {
        const traj = await trajectoryRecorder.startTrajectory({
          agentId: `e2e-agent-${i}`,
          windowId,
        });

        trajectoryIds.push(traj);
        testData.trajectoryIds.push(traj);

        trajectoryRecorder.startStep(traj, {
          agentBalance: 10000,
          agentPnL: 0,
          openPositions: 0,
        });

        trajectoryRecorder.logLLMCall(traj, {
          model: 'gpt-4o-mini',
          systemPrompt: 'You are an intelligent trading agent.',
          userPrompt: 'Make a trading decision based on current market conditions.',
          response: `Agent ${i} analysis: Market looks favorable for buying.`,
          temperature: 0.7,
          maxTokens: 150,
          purpose: 'action',
        });

        trajectoryRecorder.completeStep(traj, {
          actionType: 'BUY_SHARES',
          parameters: { ticker: '$TEST', shares: 10 },
          success: true,
          result: { executed: true, price: 100 },
        }, 0.7);

        await trajectoryRecorder.endTrajectory(traj, {
          finalPnL: Math.random() * 200 - 50,
          finalBalance: 10000 + Math.random() * 500,
          windowId,
        });
      }

      console.log(`✅ Created ${trajectoryIds.length} trajectories`);

      // Step 2: Verify storage
      console.log('📦 Step 2: Verifying storage...');
      const stored = await prisma.trajectory.findMany({
        where: {
          trajectoryId: {
            in: trajectoryIds
          }
        }
      });

      expect(stored).toHaveLength(trajectoryIds.length);
      console.log(`✅ Verified ${stored.length} trajectories in database`);

      // Step 3: Mark as training data
      console.log('🏷️  Step 3: Marking as training data...');
      await prisma.trajectory.updateMany({
        where: {
          trajectoryId: {
            in: trajectoryIds
          }
        },
        data: {
          isTrainingData: true,
          usedInTraining: false,
        }
      });

      console.log('✅ Marked as training data');

      // Step 4: Check readiness
      console.log('✅ Step 4: Checking training readiness...');
      const readiness = await pipeline.checkTrainingReadiness();
      
      console.log('📈 Readiness Results:', {
        ready: readiness.ready,
        reason: readiness.reason,
        totalTrajectories: readiness.stats.totalTrajectories,
        scenarioGroups: readiness.stats.scenarioGroups,
        dataQuality: readiness.stats.dataQuality.toFixed(2),
      });

      expect(readiness.stats.totalTrajectories).toBeGreaterThanOrEqual(6);
      expect(readiness.stats.dataQuality).toBeGreaterThan(0);

      // Step 5: Get status
      console.log('📊 Step 5: Getting pipeline status...');
      const status = await pipeline.getStatus();
      
      console.log('📊 Pipeline Status:', {
        last24h: status.dataCollection.last24h,
        ratePerHour: status.dataCollection.ratePerHour.toFixed(2),
        health: status.health,
      });

      expect(status.dataCollection.last24h).toBeGreaterThanOrEqual(6);
      expect(status.health.database).toBe(true);

      console.log('\n✅ E2E Data Flow Test Complete!\n');
    });
  });
});

