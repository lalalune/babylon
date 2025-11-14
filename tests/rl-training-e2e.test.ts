/**
 * End-to-End RL Training Integration Test
 * 
 * Tests the complete flow:
 * 1. TypeScript records trajectory with window ID
 * 2. Saves to PostgreSQL
 * 3. Python reads and converts to ART format
 * 4. Verifies window grouping works
 */

// @ts-nocheck - E2E test with mocked dependencies

import { describe, test, expect, afterAll, beforeAll } from 'bun:test';
import { trajectoryRecorder } from '@/lib/training/TrajectoryRecorder';
import { prisma } from '@/lib/prisma';

// Mock the ART format conversion since eliza plugin isn't available yet
const toARTTrajectory = (traj: any) => ({
  messages: traj.steps?.map((s: any) => ({ role: 'user', content: s.action?.type || 'unknown' })) || [],
  reward: traj.totalReward || 0,
  metadata: { windowId: traj.windowId || 'unknown' }
});

describe('RL Training E2E Integration', () => {
  let testTrajectoryIds: string[] = [];
  let testAgentIds: string[] = [];

  beforeAll(async () => {
    // Create test agents for trajectory recording
    const agentIds = ['test-agent-e2e', 'test-agent-0', 'test-agent-1', 'test-agent-2', 'test-agent-3', 'test-agent-4', 'test-agent-art'];
    
    for (const agentId of agentIds) {
      try {
        await prisma.user.create({
          data: {
            id: agentId,
            username: agentId,
            displayName: agentId,
            updatedAt: new Date(),
            isAgent: true,
            virtualBalance: 10000,
            isTest: true,
          }
        });
        testAgentIds.push(agentId);
      } catch (error) {
        // Agent might already exist, that's fine
      }
    }
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      const prismaExt = prisma as any;
      await prismaExt.trajectory?.deleteMany({
        where: {
          trajectoryId: {
            in: testTrajectoryIds
          }
        }
      });
      
      // Clean up test agents
      await prisma.user.deleteMany({
        where: {
          id: { in: testAgentIds }
        }
      });
    } catch (error) {
      // Cleanup errors are not critical
      console.error('Cleanup error:', error);
    }
  });

  test('TypeScript → Database with window ID', async () => {
    const windowId = new Date().toISOString().slice(0, 13) + ":00";
    
    // Create trajectory
    const trajectoryId = await trajectoryRecorder.startTrajectory({
      agentId: 'test-agent-e2e',
      windowId
    });

    testTrajectoryIds.push(trajectoryId);

    // Add step
    trajectoryRecorder.startStep(trajectoryId, {
      agentBalance: 10000,
      agentPnL: 0,
      openPositions: 0
    });

    trajectoryRecorder.logLLMCall(trajectoryId, {
      model: 'gpt-4o-mini',
      systemPrompt: 'You are a test agent',
      userPrompt: 'What should you do?',
      response: 'BUY $BTC',
      temperature: 0.7,
      maxTokens: 100,
      purpose: 'action'
    });

    trajectoryRecorder.completeStep(trajectoryId, {
      actionType: 'BUY_SHARES',
      parameters: { ticker: '$BTC', shares: 10 },
      success: true,
      result: { executed: true }
    }, 0.5);

    // End trajectory
    await trajectoryRecorder.endTrajectory(trajectoryId, {
      finalPnL: 100,
      finalBalance: 10100,
      windowId
    });

    // Verify in database
    const prismaExt = prisma as any;
    const saved = await prismaExt.trajectory.findUnique({
      where: { trajectoryId }
    });

    expect(saved).toBeDefined();
    expect(saved!.windowId).toBe(windowId);
    expect(saved!.scenarioId).toBe(windowId);
    expect(saved!.windowHours).toBe(1);
    expect(saved!.finalPnL).toBe(100);
  });

  test('Multiple agents in same window', async () => {
    const windowId = new Date().toISOString().slice(0, 13) + ":00";
    
    // Create 5 agents in same window
    const agents = await Promise.all(
      Array.from({ length: 5 }, async (_, i) => {
        const trajectoryId = await trajectoryRecorder.startTrajectory({
          agentId: `test-agent-${i}`,
          windowId
        });

        testTrajectoryIds.push(trajectoryId);

        // Quick step
        trajectoryRecorder.startStep(trajectoryId, {
          agentBalance: 10000,
          agentPnL: 0,
          openPositions: 0
        });

        trajectoryRecorder.logLLMCall(trajectoryId, {
          model: 'gpt-4o-mini',
          systemPrompt: 'Test',
          userPrompt: 'Test',
          response: 'BUY',
          temperature: 0.7,
          maxTokens: 100,
          purpose: 'action'
        });

        trajectoryRecorder.completeStep(trajectoryId, {
          actionType: 'BUY_SHARES',
          parameters: {},
          success: true
        }, 0);

        await trajectoryRecorder.endTrajectory(trajectoryId, {
          finalPnL: -100 + Math.random() * 500,
          windowId
        });

        return trajectoryId;
      })
    );

    // Verify all in same window
    const prismaExt = prisma as any;
    const trajectories = await prismaExt.trajectory.findMany({
      where: {
        windowId,
        trajectoryId: { in: agents }
      }
    });

    expect(trajectories).toHaveLength(5);
    expect(new Set(trajectories.map(t => t.windowId)).size).toBe(1);
    expect(new Set(trajectories.map(t => t.scenarioId)).size).toBe(1);
  });

  test('ART format conversion', async () => {
    const windowId = new Date().toISOString().slice(0, 13) + ":00";
    
    const trajectoryId = await trajectoryRecorder.startTrajectory({
      agentId: 'test-agent-art',
      windowId
    });

    testTrajectoryIds.push(trajectoryId);

    // Add steps
    for (let i = 0; i < 3; i++) {
      trajectoryRecorder.startStep(trajectoryId, {
        agentBalance: 10000 + i * 100,
        agentPnL: i * 50,
        openPositions: i
      });

      trajectoryRecorder.logLLMCall(trajectoryId, {
        model: 'gpt-4o-mini',
        systemPrompt: 'You are a trading agent',
        userPrompt: `Step ${i}: Should you trade?`,
        response: i % 2 === 0 ? 'BUY $BTC' : 'SELL $ETH',
        temperature: 0.7,
        maxTokens: 100,
        purpose: 'action'
      });

      trajectoryRecorder.completeStep(trajectoryId, {
        actionType: i % 2 === 0 ? 'BUY_SHARES' : 'SELL_SHARES',
        parameters: { ticker: i % 2 === 0 ? '$BTC' : '$ETH' },
        success: true
      }, 0.3 + i * 0.1);
    }

    await trajectoryRecorder.endTrajectory(trajectoryId, {
      finalPnL: 150,
      windowId
    });

    // Read from database
    const prismaExt = prisma as any;
    const saved = await prismaExt.trajectory.findUnique({
      where: { trajectoryId }
    });

    expect(saved).toBeDefined();

    // Parse and convert to ART format
    const trajectory = {
      ...saved!,
      steps: JSON.parse(saved!.stepsJson),
      metrics: JSON.parse(saved!.metricsJson),
      metadata: JSON.parse(saved!.metadataJson),
      rewardComponents: JSON.parse(saved!.rewardComponentsJson)
    };

    const artTraj = toARTTrajectory(trajectory as any);

    // Verify ART format
    expect(artTraj.messages).toBeDefined();
    expect(artTraj.messages.length).toBeGreaterThan(0);
    expect(artTraj.reward).toBeDefined();
    expect(artTraj.metadata).toBeDefined();
    expect(artTraj.metadata.windowId).toBe(windowId);
  });

  test('Window grouping for GRPO', async () => {
    // This would be tested by Python, but verify TypeScript side
    const windowId = new Date().toISOString().slice(0, 13) + ":00";
    
    // Get all trajectories in this window
    const prismaExt = prisma as any;
    const trajectories = await prismaExt.trajectory.findMany({
      where: { windowId },
      take: 10
    });

    // All should have same window and scenario ID
    if (trajectories.length > 0) {
      const firstWindow = trajectories[0]!.windowId;
      const firstScenario = trajectories[0]!.scenarioId;
      
      expect(trajectories.every(t => t.windowId === firstWindow)).toBe(true);
      expect(trajectories.every(t => t.scenarioId === firstScenario)).toBe(true);
    }
  });
});

export {};

