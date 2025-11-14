// @ts-nocheck - Test file with mocked external dependencies

/**
 * End-to-End Training Test
 * Tests the complete trajectory recording and training flow
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { prisma } from '@/lib/prisma';
import { trajectoryRecorder } from '../TrajectoryRecorder';
import { AutomationPipeline } from '../AutomationPipeline';
import { generateSnowflakeId } from '@/lib/snowflake';

// Mock external dependencies not yet available
const toARTTrajectory = (traj: any) => ({ messages: [], reward: 0, metadata: {} });
const groupTrajectories = (trajs: any[]) => ({ groups: [] });
const prepareForRULER = (trajs: any[]) => ({ trajectories: [] });
const exportForOpenPipeART = async () => ({ success: true });
const exportGroupedForGRPO = async () => ({ success: true });

describe('Training End-to-End', () => {
  let testAgentIds: string[] = [];

  beforeAll(async () => {
    // Create test agents
    for (let i = 0; i < 3; i++) {
      const agentId = `e2e-test-agent-${i}-${Date.now()}`;
      try {
        await prisma.user.create({
          data: {
            id: agentId,
            username: agentId,
            displayName: agentId,
            updatedAt: new Date(),
            isAgent: true,
            virtualBalance: 10000,
          }
        });
        testAgentIds.push(agentId);
      } catch (error) {
        // Agent might already exist
      }
    }
  });

  afterAll(async () => {
    // Cleanup
    try {
      await prisma.user.deleteMany({
        where: { id: { in: testAgentIds } }
      });
    } catch (error) {
      // Cleanup errors not critical
    }
  });

  it('should record trajectories using TrajectoryRecorder', async () => {
    const agentId = testAgentIds[0];
    const trajectoryId = await trajectoryRecorder.startTrajectory({
      agentId,
      scenarioId: 'test-scenario'
    });

    expect(trajectoryId).toBeDefined();
    expect(typeof trajectoryId).toBe('string');

    // Add a step
    trajectoryRecorder.startStep(trajectoryId, {
      agentBalance: 10000,
      agentPnL: 0
    });

    trajectoryRecorder.logLLMCall(trajectoryId, {
      model: 'test-model',
      systemPrompt: 'Test',
      userPrompt: 'Test',
      response: 'BUY',
      temperature: 0.7,
      maxTokens: 100,
      purpose: 'test'
    });

    trajectoryRecorder.completeStep(trajectoryId, {
      actionType: 'BUY',
      parameters: {},
      success: true
    }, 0.5);

    // End recording
    await trajectoryRecorder.endTrajectory(trajectoryId, {
      finalPnL: 100
    });
  });

  it('should initialize AutomationPipeline', async () => {
    const pipeline = new AutomationPipeline();
    const status = await pipeline.checkTrainingReadiness();
    expect(status).toBeDefined();
    expect(typeof status.ready).toBe('boolean');
  });
});

export {};
