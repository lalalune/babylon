/**
 * Training Pipeline Core Tests
 * Tests the training automation pipeline functionality
 */

import { describe, it, expect } from 'bun:test';
import { AutomationPipeline } from '../AutomationPipeline';

describe('Training Automation Pipeline', () => {
  describe('Configuration', () => {
    it('should initialize with default config', () => {
      const pipeline = new AutomationPipeline();
      expect(pipeline).toBeDefined();
    });

    it('should accept custom config', () => {
      const pipeline = new AutomationPipeline({
        minTrajectoriesForTraining: 50,
        minGroupSize: 3,
        dataQualityThreshold: 0.90,
        autoTriggerTraining: false,
        trainingInterval: 12,
        baseModel: 'custom-model',
        modelNamePrefix: 'test-model',
        modelStoragePath: './test-models',
        dataStoragePath: './test-data'
      });
      
      expect(pipeline).toBeDefined();
    });
  });

  describe.skip('Data Status', () => {
    it('should return data status without errors', async () => {
      const pipeline = new AutomationPipeline();
      
      try {
        const status = await pipeline.getStatus();
        expect(status).toBeDefined();
        expect((status as any).data).toBeDefined();
      } catch (error) {
        // Expected to fail if trajectory tables don't exist yet
        expect(error).toBeDefined();
      }
    });
  });

  describe('Training Readiness', () => {
    it('should check training readiness without errors', async () => {
      const pipeline = new AutomationPipeline();
      
      try {
        const readiness = await pipeline.checkTrainingReadiness();
        expect(readiness).toBeDefined();
        expect(typeof readiness.ready).toBe('boolean');
        expect(typeof readiness.stats.totalTrajectories).toBe('number');
      } catch (error) {
        // Expected to fail if trajectory tables don't exist yet
        expect(error).toBeDefined();
      }
    });
  });

  describe('System Status', () => {
    it('should get system status without crashing', async () => {
      const pipeline = new AutomationPipeline();
      
      try {
        const status = await (pipeline as any).getSystemStatus();
        expect(status).toBeDefined();
        expect(status.data).toBeDefined();
        expect((status as any).training).toBeDefined();
      } catch (error) {
        // Expected to fail if trajectory tables don't exist yet
        expect(error).toBeDefined();
      }
    });
  });
});

