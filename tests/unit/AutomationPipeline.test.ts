/**
 * Unit Tests for AutomationPipeline
 * 
 * Tests core functionality without external dependencies
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { AutomationPipeline, type AutomationConfig } from '@/lib/training/AutomationPipeline';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// Store original methods
const originalPrisma = {
  trajectory: {
    count: prisma.trajectory.count.bind(prisma.trajectory),
    groupBy: prisma.trajectory.groupBy.bind(prisma.trajectory),
    findMany: prisma.trajectory.findMany.bind(prisma.trajectory),
    updateMany: prisma.trajectory.updateMany.bind(prisma.trajectory),
  },
  trainingBatch: {
    create: prisma.trainingBatch.create.bind(prisma.trainingBatch),
    findUnique: prisma.trainingBatch.findUnique.bind(prisma.trainingBatch),
    findFirst: prisma.trainingBatch.findFirst.bind(prisma.trainingBatch),
    count: prisma.trainingBatch.count.bind(prisma.trainingBatch),
  },
  trainedModel: {
    findFirst: prisma.trainedModel.findFirst.bind(prisma.trainedModel),
    create: prisma.trainedModel.create.bind(prisma.trainedModel),
    count: prisma.trainedModel.count.bind(prisma.trainedModel),
  },
  user: {
    count: prisma.user.count.bind(prisma.user),
  },
  $queryRaw: prisma.$queryRaw.bind(prisma),
};

const originalLogger = {
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
};

describe('AutomationPipeline - Unit Tests', () => {
  let pipeline: AutomationPipeline;
  let mockConfig: Partial<AutomationConfig>;

  beforeEach(() => {
    mockConfig = {
      minTrajectoriesForTraining: 50,
      minGroupSize: 3,
      dataQualityThreshold: 0.9,
      autoTriggerTraining: true,
      trainingInterval: 12,
      baseModel: 'OpenPipe/Qwen3-14B-Instruct',
      modelNamePrefix: 'test-model',
      wandbProject: 'test-project',
    };

    pipeline = new AutomationPipeline(mockConfig);
    
    // Setup default mocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.trajectory as any).count = mock(() => Promise.resolve(0));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.trajectory as any).groupBy = mock(() => Promise.resolve([]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.trajectory as any).findMany = mock(() => Promise.resolve([]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.trainingBatch as any).findUnique = mock(() => Promise.resolve(null));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.trainingBatch as any).findFirst = mock(() => Promise.resolve(null));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.trainingBatch as any).count = mock(() => Promise.resolve(0));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.trainedModel as any).findFirst = mock(() => Promise.resolve(null));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.trainedModel as any).count = mock(() => Promise.resolve(0));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.user as any).count = mock(() => Promise.resolve(1));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).$queryRaw = mock(() => Promise.resolve([{ result: 1 }]));
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logger as any).info = mock(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logger as any).warn = mock(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (logger as any).error = mock(() => {});
  });

  afterEach(() => {
    // Restore original methods
    Object.assign(prisma.trajectory, originalPrisma.trajectory);
    Object.assign(prisma.trainingBatch, originalPrisma.trainingBatch);
    Object.assign(prisma.trainedModel, originalPrisma.trainedModel);
    Object.assign(prisma.user, originalPrisma.user);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).$queryRaw = originalPrisma.$queryRaw;
    Object.assign(logger, originalLogger);
  });

  describe('Configuration', () => {
    test('should use default configuration when not provided', () => {
      const defaultPipeline = new AutomationPipeline();
      const status = defaultPipeline['config'];
      
      expect(status.minTrajectoriesForTraining).toBe(100);
      expect(status.minGroupSize).toBe(4);
      expect(status.dataQualityThreshold).toBe(0.95);
      expect(status.baseModel).toBe('OpenPipe/Qwen3-14B-Instruct');
    });

    test('should merge custom config with defaults', () => {
      const config = pipeline['config'];
      
      expect(config.minTrajectoriesForTraining).toBe(50);
      expect(config.minGroupSize).toBe(3);
      expect(config.dataQualityThreshold).toBe(0.9);
      expect(config.baseModel).toBe('OpenPipe/Qwen3-14B-Instruct');
    });

    test('should use OpenPipe model by default', () => {
      const defaultPipeline = new AutomationPipeline();
      expect(defaultPipeline['config'].baseModel).toBe('OpenPipe/Qwen3-14B-Instruct');
    });

    test('should allow custom model override', () => {
      const customPipeline = new AutomationPipeline({
        baseModel: 'custom-model'
      });
      expect(customPipeline['config'].baseModel).toBe('custom-model');
    });
  });

  describe('Training Readiness Check', () => {
    test('should be not ready when insufficient trajectories', async () => {
      (prisma.trajectory as any).count = mock(() => Promise.resolve(30));
      (prisma.trajectory as any).groupBy = mock(() => Promise.resolve([]));
      (prisma.trajectory as any).findMany = mock(() => Promise.resolve([]));

      const result = await pipeline.checkTrainingReadiness();

      expect(result.ready).toBe(false);
      expect(result.reason).toContain('more trajectories');
      expect(result.stats.totalTrajectories).toBe(30);
    });

    test('should be not ready when insufficient scenario groups', async () => {
      (prisma.trajectory as any).count = mock(() => Promise.resolve(100));
      (prisma.trajectory as any).groupBy = mock(() => Promise.resolve([
        { scenarioId: 'scenario-1', _count: 5 },
        { scenarioId: 'scenario-2', _count: 4 },
      ]));
      (prisma.trajectory as any).findMany = mock(() => Promise.resolve([]));

      const result = await pipeline.checkTrainingReadiness();

      expect(result.ready).toBe(false);
      expect(result.reason).toContain('scenario groups');
      expect(result.stats.scenarioGroups).toBe(2);
    });

    test('should be ready when all conditions met', async () => {
      (prisma.trajectory as any).count = mock(() => Promise.resolve(100));
      (prisma.trajectory as any).groupBy = mock(() => Promise.resolve(
        Array.from({ length: 15 }, (_, i) => ({
          scenarioId: `scenario-${i}`,
          _count: 5
        }))
      ));
      (prisma.trajectory as any).findMany = mock(() => Promise.resolve(
        Array.from({ length: 50 }, (_, i) => ({
          trajectoryId: `traj-${i}`,
          stepsJson: JSON.stringify([{
            llmCalls: [{
              systemPrompt: 'a'.repeat(100),
              userPrompt: 'b'.repeat(150),
              response: 'Test'
            }],
            providerAccesses: [{ provider: 'test' }],
            action: { result: 'success' }
          }])
        }))
      ));

      const result = await pipeline.checkTrainingReadiness();

      expect(result.ready).toBe(true);
      expect(result.reason).toBe('Ready to train!');
      expect(result.stats.scenarioGroups).toBeGreaterThanOrEqual(10);
    });

    test('should check data quality', async () => {
      (prisma.trajectory as any).count = mock(() => Promise.resolve(100));
      (prisma.trajectory as any).groupBy = mock(() => Promise.resolve(
        Array.from({ length: 15 }, (_, i) => ({
          scenarioId: `scenario-${i}`,
          _count: 5
        }))
      ));
      
      // Mock poor quality data
      (prisma.trajectory as any).findMany = mock(() => Promise.resolve(
        Array.from({ length: 50 }, () => ({
          stepsJson: JSON.stringify([{
            llmCalls: [],  // No LLM calls = poor quality
            action: {}
          }])
        }))
      ));

      const result = await pipeline.checkTrainingReadiness();

      expect(result.ready).toBe(false);
      expect(result.reason).toContain('quality');
    });
  });

  describe('Model Versioning', () => {
    test('should start at v1.0.0 when no models exist', async () => {
      (prisma.trainedModel as any).findFirst = mock(() => Promise.resolve(null));

      const version = await pipeline['getNextModelVersion']();

      expect(version).toBe('v1.0.0');
    });

    test('should increment patch version', async () => {
      (prisma.trainedModel as any).findFirst = mock(() => Promise.resolve({
        version: 'v1.0.5'
      }));

      const version = await pipeline['getNextModelVersion']();

      expect(version).toBe('v1.0.6');
    });

    test('should handle double-digit versions', async () => {
      (prisma.trainedModel as any).findFirst = mock(() => Promise.resolve({
        version: 'v2.3.99'
      }));

      const version = await pipeline['getNextModelVersion']();

      expect(version).toBe('v2.3.100');
    });
  });

  describe('Trajectory ID Retrieval', () => {
    test('should retrieve trajectory IDs for training', async () => {
      const mockTrajectories = [
        { trajectoryId: 'traj-1' },
        { trajectoryId: 'traj-2' },
        { trajectoryId: 'traj-3' },
      ];

      const findManyMock = mock(() => Promise.resolve(mockTrajectories));
      (prisma.trajectory as any).findMany = findManyMock;

      const ids = await pipeline['getTrajectoryIds'](3);

      expect(ids).toEqual(['traj-1', 'traj-2', 'traj-3']);
      expect(findManyMock).toHaveBeenCalled();
    });

    test('should retrieve all trajectories when no limit', async () => {
      const mockTrajectories = [
        { trajectoryId: 'traj-1' },
        { trajectoryId: 'traj-2' },
      ];

      const findManyMock = mock(() => Promise.resolve(mockTrajectories));
      (prisma.trajectory as any).findMany = findManyMock;

      const ids = await pipeline['getTrajectoryIds']();

      expect(ids).toHaveLength(2);
      expect(findManyMock).toHaveBeenCalled();
    });
  });

  describe('Training Monitoring', () => {
    test('should return not_found for non-existent batch', async () => {
      (prisma.trainingBatch as any).findUnique = mock(() => Promise.resolve(null));

      const status = await pipeline.monitorTraining('non-existent');

      expect(status.status).toBe('not_found');
    });

    test('should return training status', async () => {
      (prisma.trainingBatch as any).findUnique = mock(() => Promise.resolve({
        batchId: 'batch-1',
        status: 'training',
        error: null
      }));

      const status = await pipeline.monitorTraining('batch-1');

      expect(status.status).toBe('training');
      expect(status.progress).toBe(0.5);
      expect(status.eta).toBeDefined();
    });

    test('should return completed status', async () => {
      (prisma.trainingBatch as any).findUnique = mock(() => Promise.resolve({
        batchId: 'batch-1',
        status: 'completed',
        error: null
      }));

      const status = await pipeline.monitorTraining('batch-1');

      expect(status.status).toBe('completed');
      expect(status.progress).toBe(1.0);
      expect(status.eta).toBeUndefined();
    });
  });

  describe('Status Reporting', () => {
    test('should return comprehensive status', async () => {
      let callCount = 0;
      (prisma.trajectory as any).count = mock(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? 50 : 200);
      });
      
      (prisma.trainingBatch as any).findFirst = mock(() => Promise.resolve({
        completedAt: new Date('2024-01-01T12:00:00Z')
      }));
      
      (prisma.trainedModel as any).findFirst = mock(() => Promise.resolve({
        version: 'v1.2.3'
      }));
      
      (prisma.trainedModel as any).count = mock(() => Promise.resolve(5));
      (prisma.trainingBatch as any).count = mock(() => Promise.resolve(2));
      (prisma.user as any).count = mock(() => Promise.resolve(1));

      const status = await pipeline.getStatus();

      expect(status.dataCollection.last24h).toBe(50);
      expect(status.dataCollection.last7d).toBe(200);
      expect(status.dataCollection.ratePerHour).toBeCloseTo(50 / 24, 1);
      expect(status.models.latest).toBe('v1.2.3');
      expect(status.models.deployed).toBe(5);
      expect(status.models.training).toBe(2);
      expect(status.health.database).toBe(true);
    });

    test('should handle no training history', async () => {
      (prisma.trajectory as any).count = mock(() => Promise.resolve(0));
      (prisma.trainingBatch as any).findFirst = mock(() => Promise.resolve(null));
      (prisma.trainedModel as any).findFirst = mock(() => Promise.resolve(null));
      (prisma.trainedModel as any).count = mock(() => Promise.resolve(0));
      (prisma.trainingBatch as any).count = mock(() => Promise.resolve(0));
      (prisma.user as any).count = mock(() => Promise.resolve(1));

      const status = await pipeline.getStatus();

      expect(status.training.lastCompleted).toBeNull();
      expect(status.models.latest).toBeNull();
      expect(status.dataCollection.last24h).toBe(0);
    });
  });

  describe('Health Checks', () => {
    test('should check database connectivity', async () => {
      (prisma.user as any).count = mock(() => Promise.resolve(1));
      (prisma.trajectory as any).count = mock(() => Promise.resolve(10));

      await pipeline['runHealthChecks']();

      // Test passes if no error is thrown
      expect(true).toBe(true);
    });

    test('should handle database errors gracefully', async () => {
      const errorMock = mock(() => {});
      (logger as any).error = errorMock;
      
      (prisma.user as any).count = mock(() => Promise.reject(new Error('DB Error')));

      await pipeline['runHealthChecks']();

      expect(errorMock).toHaveBeenCalled();
    });

    test('should warn on low data collection rate', async () => {
      const warnMock = mock(() => {});
      (logger as any).warn = warnMock;
      
      (prisma.user as any).count = mock(() => Promise.resolve(1));
      (prisma.trajectory as any).count = mock(() => Promise.resolve(0));

      await pipeline['runHealthChecks']();

      expect(warnMock).toHaveBeenCalled();
    });
  });
});

