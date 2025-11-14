/**
 * ART Format Validation Tests
 * 
 * Validates that our trajectories convert correctly to ART/GRPO format.
 * Based on actual ART tic-tac-toe example structure.
 * 
 * Critical: These tests ensure our data works with OpenPipe ART!
 * 
 * NOTE: Requires trajectory schema and TrajectoryLoggerService
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { TrajectoryLoggerService } from '../TrajectoryLoggerService';
import { 
  toARTMessages, 
  toARTTrajectory, 
  groupTrajectories,
  extractSharedPrefix,
  prepareForRULER,
  validateARTCompatibility 
} from '../art-format';
import { exportForOpenPipeART, exportGroupedForGRPO } from '../export';
import type { Trajectory } from '../types';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('ART Format Validation', () => {
  let mockRuntime: any;
  const testTrajectoryIds: string[] = [];

  beforeAll(() => {
    mockRuntime = {
      agentId: 'art-test-agent',
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {}
      }
    };
  });

  afterAll(async () => {
    // Cleanup
    if (testTrajectoryIds.length > 0) {
      const { prisma } = await import('@/lib/prisma');
      await prisma.trajectory.deleteMany({
        where: { trajectoryId: { in: testTrajectoryIds } }
      });
      await (prisma as any).llmCallLog.deleteMany({
        where: { trajectoryId: { in: testTrajectoryIds } }
      });
    }
  });

  describe('Message Array Conversion', () => {
    it('should convert trajectory to OpenAI message array format', () => {
      const logger = new TrajectoryLoggerService();
      
      const trajId = logger.startTrajectory(mockRuntime.agentId);
      const stepId = logger.startStep(trajId, {
        timestamp: Date.now(),
        agentBalance: 1000,
        agentPoints: 0,
        agentPnL: 0,
        openPositions: 0
      });

      logger.logLLMCall(stepId, {
        model: 'llama-3.1-8b',
        systemPrompt: 'You are a trading agent with momentum strategy.',
        userPrompt: 'Current balance: $1000. BTC at 50%. Should you trade?',
        response: 'I will buy YES shares in BTC because momentum is strong.',
        temperature: 0.8,
        maxTokens: 200,
        purpose: 'action',
        actionType: 'BUY_SHARES'
      });

      logger.completeStep(trajId, stepId, {
        actionType: 'BUY_SHARES',
        actionName: 'BUY_SHARES',
        parameters: {},
        success: true
      });

      const trajectory = logger.getActiveTrajectory(trajId)!;
      const messages = toARTMessages(trajectory);

      // Validate message structure matches ART format
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);

      // Should have system message
      const systemMsg = messages.find(m => m.role === 'system');
      expect(systemMsg).toBeDefined();
      expect(systemMsg!.content).toContain('trading agent');

      // Should have user message (observation)
      const userMsg = messages.find(m => m.role === 'user');
      expect(userMsg).toBeDefined();
      expect(userMsg!.content).toContain('$1000');
      expect(userMsg!.content).toContain('BTC');

      // Should have assistant message (action)
      const assistantMsg = messages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg!.content).toContain('buy');

      console.log('✅ Converts to valid message array');
    });

    it('should handle multi-turn conversations', () => {
      const logger = new TrajectoryLoggerService();
      
      const trajId = logger.startTrajectory(mockRuntime.agentId);

      // Turn 1: Analyze market
      const step1 = logger.startStep(trajId, {
        timestamp: Date.now(),
        agentBalance: 1000,
        agentPoints: 0,
        agentPnL: 0,
        openPositions: 0
      });

      logger.logLLMCall(step1, {
        model: 'llama-3.1-8b',
        systemPrompt: 'You are a trading agent.',
        userPrompt: 'Market state: BTC at 50%, ETH at 60%. Analyze.',
        response: 'BTC looks undervalued compared to ETH.',
        temperature: 0.8,
        maxTokens: 100,
        purpose: 'reasoning'
      });

      logger.completeStep(trajId, step1, {
        actionType: 'ANALYZE',
        actionName: 'ANALYZE',
        parameters: {},
        success: true
      });

      // Turn 2: Make decision
      const step2 = logger.startStep(trajId, {
        timestamp: Date.now(),
        agentBalance: 1000,
        agentPoints: 0,
        agentPnL: 0,
        openPositions: 0
      });

      logger.logLLMCall(step2, {
        model: 'llama-3.1-8b',
        systemPrompt: 'You are a trading agent.',
        userPrompt: 'Based on analysis, which should you buy?',
        response: 'I will buy BTC YES shares for $100.',
        temperature: 0.8,
        maxTokens: 100,
        purpose: 'action',
        actionType: 'BUY_SHARES'
      });

      logger.completeStep(trajId, step2, {
        actionType: 'BUY_SHARES',
        actionName: 'BUY_SHARES',
        parameters: {},
        success: true
      });

      const trajectory = logger.getActiveTrajectory(trajId)!;
      const messages = toARTMessages(trajectory);

      // Should have alternating user/assistant pattern
      expect(messages.length).toBeGreaterThanOrEqual(5); // system + 2 turns

      // Check pattern: system, user, assistant, user, assistant
      expect(messages[0]!.role).toBe('system');
      expect(messages[1]!.role).toBe('user');
      expect(messages[2]!.role).toBe('assistant');
      expect(messages[3]!.role).toBe('user');
      expect(messages[4]!.role).toBe('assistant');

      console.log('✅ Multi-turn conversation preserved');
    });
  });

  describe('ART Trajectory Format', () => {
    it('should convert to exact ART format (matches tic-tac-toe example)', () => {
      const logger = new TrajectoryLoggerService();
      
      const trajId = logger.startTrajectory(mockRuntime.agentId, {
        scenarioId: 'trading-test-1',
        metadata: {
          agentModel: 'llama-3.1-8b',
          goalDescription: 'maximize profit while managing risk'
        }
      });

      const stepId = logger.startStep(trajId, {
        timestamp: Date.now(),
        agentBalance: 1000,
        agentPoints: 0,
        agentPnL: 0,
        openPositions: 0
      });

      logger.logLLMCall(stepId, {
        model: 'llama-3.1-8b',
        systemPrompt: 'You are a trading agent.',
        userPrompt: 'BTC at 50%. Trade?',
        response: 'Buy YES $100',
        temperature: 0.8,
        maxTokens: 100,
        purpose: 'action',
        actionType: 'BUY_SHARES'
      });

      logger.completeStep(trajId, stepId, {
        actionType: 'BUY_SHARES',
        actionName: 'BUY_SHARES',
        parameters: { marketId: 'btc', amount: 100 },
        success: true,
        result: { shares: 95 }
      }, {
        reward: 1.5
      });

      const trajectory = logger.getActiveTrajectory(trajId)!;
      const artTraj = toARTTrajectory(trajectory);

      // Match ART structure from tic-tac-toe example
      expect(artTraj).toHaveProperty('messages');
      expect(artTraj).toHaveProperty('reward');
      expect(artTraj).toHaveProperty('metadata');
      expect(artTraj).toHaveProperty('metrics');

      // Messages should be array of {role, content}
      expect(Array.isArray(artTraj.messages)).toBe(true);
      expect(artTraj.messages.length).toBeGreaterThan(0);
      
      for (const msg of artTraj.messages) {
        expect(msg).toHaveProperty('role');
        expect(msg).toHaveProperty('content');
        expect(['system', 'user', 'assistant']).toContain(msg.role);
        expect(typeof msg.content).toBe('string');
      }

      // Reward should be single number
      expect(typeof artTraj.reward).toBe('number');
      expect(isNaN(artTraj.reward)).toBe(false);

      // Metadata should have context for RULER
      expect(artTraj.metadata.trajectoryId).toBeDefined();
      expect(artTraj.metadata.scenarioId).toBe('trading-test-1');
      expect(artTraj.metadata.environmentContext).toBeDefined();

      console.log('✅ Matches ART format exactly');
    });

    it('should include environment context for RULER judge', () => {
      const logger = new TrajectoryLoggerService();
      
      const trajId = logger.startTrajectory(mockRuntime.agentId, {
        metadata: {
          goalDescription: 'make profitable trades'
        }
      });

      const stepId = logger.startStep(trajId, {
        timestamp: Date.now(),
        agentBalance: 1000,
        agentPoints: 500,
        agentPnL: 50,
        openPositions: 2
      });

      logger.logLLMCall(stepId, {
        model: 'test',
        systemPrompt: 'System',
        userPrompt: 'User',
        response: 'Response',
        temperature: 0.8,
        maxTokens: 100,
        purpose: 'action'
      });

      logger.completeStep(trajId, stepId, {
        actionType: 'TEST',
        actionName: 'TEST',
        parameters: {},
        success: true
      });

      // Update to final state
      const trajectory = logger.getActiveTrajectory(trajId)!;
      trajectory.metrics.finalBalance = 950;
      trajectory.metrics.finalPnL = 55;

      const artTraj = toARTTrajectory(trajectory);

      // RULER needs this context to rank trajectories!
      expect(artTraj.metadata.environmentContext).toBeDefined();
      expect(artTraj.metadata.environmentContext!.initialBalance).toBe(1000);
      expect(artTraj.metadata.environmentContext!.finalBalance).toBe(950);
      expect(artTraj.metadata.environmentContext!.initialPnL).toBe(50);
      expect(artTraj.metadata.environmentContext!.finalPnL).toBe(55);
      expect(Array.isArray(artTraj.metadata.environmentContext!.actionsTaken)).toBe(true);

      console.log('✅ Environment context available for RULER');
    });

    it('should include game knowledge for RULER judge', () => {
      const logger = new TrajectoryLoggerService();
      
      const trajId = logger.startTrajectory(mockRuntime.agentId, {
        metadata: {
          // Game master knowledge!
          trueProbabilities: {
            'btc-100k': 0.75  // Agent doesn't know this, but we do!
          },
          futureOutcomes: {
            'btc-100k': 'YES',  // We know the future!
            'btc-price-1h': 0.65  // We know what price will be!
          },
          hiddenVariables: {
            'momentum': 'bullish',
            'whaleActivity': 'accumulating'
          }
        }
      });

      const stepId = logger.startStep(trajId, {
        timestamp: Date.now(),
        agentBalance: 1000,
        agentPoints: 0,
        agentPnL: 0,
        openPositions: 0
      });

      logger.logLLMCall(stepId, {
        model: 'test',
        systemPrompt: 'System',
        userPrompt: 'User',
        response: 'Response',
        temperature: 0.8,
        maxTokens: 100,
        purpose: 'action'
      });

      logger.completeStep(trajId, stepId, {
        actionType: 'BUY_SHARES',
        actionName: 'BUY_SHARES',
        parameters: { marketId: 'btc-100k', side: 'YES' },
        success: true
      });

      const trajectory = logger.getActiveTrajectory(trajId)!;
      const artTraj = toARTTrajectory(trajectory);

      // RULER can use this to judge decision quality!
      expect(artTraj.metadata.gameKnowledge).toBeDefined();
      expect(artTraj.metadata.gameKnowledge!.trueProbabilities).toEqual({
        'btc-100k': 0.75
      });
      expect(artTraj.metadata.gameKnowledge!.actualOutcomes).toEqual({
        'btc-100k': 'YES',
        'btc-price-1h': 0.65
      });

      console.log('✅ Game knowledge available for RULER');
    });
  });

  describe('GRPO Grouping', () => {
    it('should group trajectories by scenario', async () => {
      const logger = new TrajectoryLoggerService();
      
      // Create 4 trajectories with same scenario (like ART does!)
      const scenarioId = 'test-scenario-001';
      const trajectories: Trajectory[] = [];

      for (let i = 0; i < 4; i++) {
        const trajId = logger.startTrajectory(mockRuntime.agentId, {
          scenarioId,
          metadata: {
            groupIndex: i
          }
        });
        testTrajectoryIds.push(trajId);

        const stepId = logger.startStep(trajId, {
          timestamp: Date.now() + i * 1000,
          agentBalance: 1000,
          agentPoints: 0,
          agentPnL: 0,
          openPositions: 0
        });

        logger.logLLMCall(stepId, {
          model: 'llama-3.1-8b',
          systemPrompt: 'You are a trading agent.',  // Same system prompt
          userPrompt: 'BTC at 50%. Trade?',  // Same user prompt
          response: i === 0 ? 'Buy $100' : i === 1 ? 'Buy $50' : i === 2 ? 'Skip' : 'Sell',  // Different responses!
          temperature: 0.8,
          maxTokens: 100,
          purpose: 'action'
        });

        logger.completeStep(trajId, stepId, {
          actionType: 'TEST',
          actionName: 'TEST',
          parameters: {},
          success: true
        }, {
          reward: i * 0.5  // Different rewards
        });

        await logger.endTrajectory(trajId, 'completed');
        
        const traj = logger.getActiveTrajectory(trajId);
        if (!traj) {
          const { prisma } = await import('@/lib/prisma');
          const fromDB = await prisma.trajectory.findUnique({ where: { trajectoryId: trajId } });
          const steps = JSON.parse(fromDB!.stepsJson);
          trajectories.push({
            ...fromDB!,
            trajectoryId: fromDB!.trajectoryId as any,
            agentId: fromDB!.agentId as any,
            startTime: fromDB!.startTime.getTime(),
            endTime: fromDB!.endTime.getTime(),
            steps,
            rewardComponents: JSON.parse(fromDB!.rewardComponentsJson),
            metrics: JSON.parse(fromDB!.metricsJson),
            metadata: JSON.parse(fromDB!.metadataJson)
          } as Trajectory);
        } else {
          trajectories.push(traj);
        }
      }

      // Group trajectories (like gather_trajectory_groups_by_index)
      const groups = groupTrajectories(trajectories);

      expect(groups).toHaveLength(1);  // One scenario
      expect(groups[0]!.trajectories).toHaveLength(4);  // 4 parallel rollouts
      expect(groups[0]!.scenarioId).toBe(scenarioId);

      console.log('✅ Groups trajectories by scenario');
    });

    it('should extract shared prefix from trajectory group', () => {
      const logger = new TrajectoryLoggerService();
      const trajectories: Trajectory[] = [];

      // Create 3 trajectories with same start, different endings
      for (let i = 0; i < 3; i++) {
        const trajId = logger.startTrajectory(mockRuntime.agentId, {
          scenarioId: 'same-start-test'
        });

        const stepId = logger.startStep(trajId, {
          timestamp: Date.now(),
          agentBalance: 1000,
          agentPoints: 0,
          agentPnL: 0,
          openPositions: 0
        });

        logger.logLLMCall(stepId, {
          model: 'llama-3.1-8b',
          systemPrompt: 'You are a trading agent.',  // SAME
          userPrompt: 'BTC at 50%. What do you do?',  // SAME
          response: i === 0 ? 'Buy' : i === 1 ? 'Hold' : 'Sell',  // DIFFERENT
          temperature: 0.8,
          maxTokens: 100,
          purpose: 'action'
        });

        logger.completeStep(trajId, stepId, {
          actionType: 'TEST',
          actionName: 'TEST',
          parameters: {},
          success: true
        });

        trajectories.push(logger.getActiveTrajectory(trajId)!);
      }

      // Extract shared prefix (RULER optimization!)
      const sharedPrefix = extractSharedPrefix(trajectories);

      // Should extract system + user messages (same across all 3)
      expect(sharedPrefix.length).toBeGreaterThanOrEqual(2);
      expect(sharedPrefix[0]!.role).toBe('system');
      expect(sharedPrefix[0]!.content).toBe('You are a trading agent.');
      expect(sharedPrefix[1]!.role).toBe('user');
      expect(sharedPrefix[1]!.content).toBe('BTC at 50%. What do you do?');

      console.log('✅ Shared prefix extracted (saves tokens for RULER!)');
    });

    it('should prepare trajectory group for RULER ranking', () => {
      const logger = new TrajectoryLoggerService();
      const trajectories: Trajectory[] = [];

      // Create trajectory group (N=4, like ART examples)
      for (let i = 0; i < 4; i++) {
        const trajId = logger.startTrajectory(mockRuntime.agentId, {
          scenarioId: 'ruler-test',
          metadata: {
            groupIndex: i,
            initialBalance: 1000
          }
        });

        const stepId = logger.startStep(trajId, {
          timestamp: Date.now(),
          agentBalance: 1000,
          agentPoints: 0,
          agentPnL: 0,
          openPositions: 0
        });

        logger.logLLMCall(stepId, {
          model: 'llama-3.1-8b',
          systemPrompt: 'You are a trading agent.',
          userPrompt: 'BTC at 50%, balance $1000. Trade?',
          response: `Buy $${100 + i * 50}`,  // Different amounts
          temperature: 0.8,
          maxTokens: 100,
          purpose: 'action'
        });

        logger.completeStep(trajId, stepId, {
          actionType: 'BUY_SHARES',
          actionName: 'BUY_SHARES',
          parameters: { amount: 100 + i * 50 },
          success: true
        }, {
          reward: i * 0.3
        });

        const traj = logger.getActiveTrajectory(trajId)!;
        traj.metrics.finalBalance = 1000 - (100 + i * 50);
        traj.metrics.finalPnL = i * 5;
        trajectories.push(traj);
      }

      const groups = groupTrajectories(trajectories);
      const rulerInput = prepareForRULER(groups[0]!);

      // Validate RULER input structure
      expect(rulerInput.sharedPrefix).toBeDefined();
      expect(rulerInput.suffixes).toHaveLength(4);
      expect(rulerInput.metadata).toHaveLength(4);

      // Shared prefix should have system + user (same for all)
      expect(rulerInput.sharedPrefix.length).toBeGreaterThan(0);
      expect(rulerInput.sharedPrefix[0]!.role).toBe('system');

      // Suffixes should have different responses
      expect(rulerInput.suffixes[0]![0]!.content).toContain('$100');
      expect(rulerInput.suffixes[1]![0]!.content).toContain('$150');
      expect(rulerInput.suffixes[2]![0]!.content).toContain('$200');
      expect(rulerInput.suffixes[3]![0]!.content).toContain('$250');

      // Metadata should have environment context for judging
      for (const meta of rulerInput.metadata) {
        expect(meta.environmentContext).toBeDefined();
        expect(meta.environmentContext!.finalBalance).toBeDefined();
        expect(meta.environmentContext!.finalPnL).toBeDefined();
      }

      console.log('✅ RULER input format correct');
    });
  });

  describe('Export Validation', () => {
    it('should export in ART-compatible JSONL format', async () => {
      const logger = new TrajectoryLoggerService();
      
      const trajId = await createCompleteARTTrajectory(logger);
      testTrajectoryIds.push(trajId);

      const result = await exportForOpenPipeART({
        datasetName: 'art-format-test',
        agentIds: [mockRuntime.agentId],
        maxTrajectories: 10
      });

      expect(result.success).toBe(true);

      // Read exported file
      const exportPath = path.resolve(process.cwd(), 'exports/openpipe-art/trajectories.jsonl');
      const content = await fs.readFile(exportPath, 'utf-8');
      const lines = content.trim().split('\n');
      const exported = JSON.parse(lines[0]!);

      // Validate matches ART format
      expect(exported).toHaveProperty('messages');
      expect(exported).toHaveProperty('reward');
      expect(exported).toHaveProperty('metadata');

      // Validate message array
      expect(Array.isArray(exported.messages)).toBe(true);
      for (const msg of exported.messages) {
        expect(msg.role).toMatch(/^(system|user|assistant)$/);
        expect(typeof msg.content).toBe('string');
        expect(msg.content.length).toBeGreaterThan(0);
      }

      console.log('✅ ART export format valid');
    });

    it('should export grouped trajectories for GRPO', async () => {
      const logger = new TrajectoryLoggerService();
      const scenarioId = `grpo-test-${Date.now()}`;

      // Create 5 trajectories for same scenario (GRPO group)
      for (let i = 0; i < 5; i++) {
        const trajId = await createCompleteARTTrajectory(logger, {
          scenarioId,
          groupIndex: i
        });
        testTrajectoryIds.push(trajId);
      }

      const result = await exportGroupedForGRPO({
        datasetName: 'grpo-groups-test',
        scenarioIds: [scenarioId],
        maxTrajectories: 100
      });

      expect(result.success).toBe(true);

      // Read grouped export
      const exportPath = path.resolve(process.cwd(), `exports/grpo-groups/group-${scenarioId}.jsonl`);
      const content = await fs.readFile(exportPath, 'utf-8');
      const group = JSON.parse(content.trim());

      // Validate GRPO group structure
      expect(group).toHaveProperty('groupId');
      expect(group).toHaveProperty('scenarioId');
      expect(group).toHaveProperty('sharedPrefix');
      expect(group).toHaveProperty('trajectories');

      expect(Array.isArray(group.sharedPrefix)).toBe(true);
      expect(Array.isArray(group.trajectories)).toBe(true);
      expect(group.trajectories).toHaveLength(5);

      // All trajectories should be in ART format
      for (const traj of group.trajectories) {
        expect(traj).toHaveProperty('messages');
        expect(traj).toHaveProperty('reward');
        expect(traj).toHaveProperty('metadata');
      }

      console.log('✅ GRPO group export correct');
    });
  });

  describe('Compatibility Validation', () => {
    it('should validate trajectory is ART-compatible', () => {
      const logger = new TrajectoryLoggerService();
      
      const trajId = logger.startTrajectory(mockRuntime.agentId);
      const stepId = logger.startStep(trajId, {
        timestamp: Date.now(),
        agentBalance: 1000,
        agentPoints: 0,
        agentPnL: 0,
        openPositions: 0
      });

      logger.logLLMCall(stepId, {
        model: 'llama-3.1-8b',
        systemPrompt: 'You are a trading agent.',
        userPrompt: 'Current state: $1000 balance, BTC at 50%. What should you do?',
        response: 'I will buy YES shares in BTC for $100 because momentum is strong.',
        temperature: 0.8,
        maxTokens: 200,
        purpose: 'action',
        actionType: 'BUY_SHARES'
      });

      logger.completeStep(trajId, stepId, {
        actionType: 'BUY_SHARES',
        actionName: 'BUY_SHARES',
        parameters: {},
        success: true
      }, {
        reward: 1.5
      });

      const trajectory = logger.getActiveTrajectory(trajId)!;
      const validation = validateARTCompatibility(trajectory);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      console.log('✅ Trajectory is ART-compatible');
    });

    it('should detect incompatible trajectories', () => {
      const logger = new TrajectoryLoggerService();
      
      const trajId = logger.startTrajectory(mockRuntime.agentId);
      const stepId = logger.startStep(trajId, {
        timestamp: Date.now(),
        agentBalance: 0,
        agentPoints: 0,
        agentPnL: 0,
        openPositions: 0
      });

      // No LLM calls! (incompatible!)
      logger.completeStep(trajId, stepId, {
        actionType: 'TEST',
        actionName: 'TEST',
        parameters: {},
        success: true
      });

      const trajectory = logger.getActiveTrajectory(trajId)!;
      const validation = validateARTCompatibility(trajectory);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('no LLM calls');

      console.log('✅ Detects incompatible data');
    });

    it('should validate message array structure', () => {
      const logger = new TrajectoryLoggerService();
      
      const trajId = logger.startTrajectory(mockRuntime.agentId);
      const stepId = logger.startStep(trajId, {
        timestamp: Date.now(),
        agentBalance: 1000,
        agentPoints: 0,
        agentPnL: 0,
        openPositions: 0
      });

      logger.logLLMCall(stepId, {
        model: 'llama-3.1-8b',
        systemPrompt: 'You are a trading agent with sophisticated risk management.',
        userPrompt: 'Portfolio: $1000, 2 open positions. BTC at 50%, ETH at 60%. Liquidity: BTC $1000, ETH $500. Recent: +$50 P&L. Should you make a trade? If yes, which market and how much?',
        response: 'I will buy YES shares in BTC for $100. Reasoning: BTC is undervalued at 50% based on momentum indicators and recent volume increase.',
        temperature: 0.8,
        maxTokens: 200,
        purpose: 'action',
        actionType: 'BUY_SHARES'
      });

      logger.completeStep(trajId, stepId, {
        actionType: 'BUY_SHARES',
        actionName: 'BUY_SHARES',
        parameters: {},
        success: true
      });

      const trajectory = logger.getActiveTrajectory(trajId)!;
      const messages = toARTMessages(trajectory);

      // Validate each message
      for (const msg of messages) {
        // Must have role
        expect(msg.role).toBeDefined();
        expect(['system', 'user', 'assistant']).toContain(msg.role);

        // Must have content
        expect(msg.content).toBeDefined();
        expect(typeof msg.content).toBe('string');
        expect(msg.content.length).toBeGreaterThan(0);

        // No undefined or null values
        expect(msg.content).not.toBe('undefined');
        expect(msg.content).not.toBe('null');
      }

      // System message should establish identity
      const systemMsg = messages.find(m => m.role === 'system')!;
      expect(systemMsg.content.length).toBeGreaterThan(20);

      // User message should have context
      const userMsg = messages.find(m => m.role === 'user')!;
      expect(userMsg.content.length).toBeGreaterThan(50);
      expect(userMsg.content).toContain('$1000');

      // Assistant message should have decision
      const assistantMsg = messages.find(m => m.role === 'assistant')!;
      expect(assistantMsg.content.length).toBeGreaterThan(20);
      expect(assistantMsg.content.toLowerCase()).toContain('buy');

      console.log('✅ Message array structure valid');
    });
  });
});

/**
 * Helper: Create complete ART-compatible trajectory
 */
async function createCompleteARTTrajectory(
  logger: TrajectoryLoggerService,
  options: {
    scenarioId?: string;
    groupIndex?: number;
  } = {}
): Promise<string> {
  const trajId = logger.startTrajectory('test-agent-id', {
    scenarioId: options.scenarioId || 'test-scenario',
    metadata: {
      groupIndex: options.groupIndex,
      agentModel: 'llama-3.1-8b',
      goalDescription: 'maximize profit'
    }
  });

  const stepId = logger.startStep(trajId, {
    timestamp: Date.now(),
    agentBalance: 1000,
    agentPoints: 500,
    agentPnL: 50,
    openPositions: 1
  });

  logger.logProviderAccess(stepId, {
    providerName: 'MARKETS',
    data: {
      markets: [
        { id: 'btc', price: 0.5, liquidity: 1000 }
      ]
    },
    purpose: 'Get markets'
  });

  logger.logLLMCall(stepId, {
    model: 'llama-3.1-8b',
    systemPrompt: 'You are a trading agent with momentum strategy.',
    userPrompt: 'Balance: $1000. BTC at 50%. Trade?',
    response: 'Buy BTC YES $100',
    temperature: 0.8,
    maxTokens: 100,
    purpose: 'action',
    actionType: 'BUY_SHARES'
  });

  logger.completeStep(trajId, stepId, {
    actionType: 'BUY_SHARES',
    actionName: 'BUY_SHARES',
    parameters: { marketId: 'btc', amount: 100 },
    success: true,
    result: { shares: 95 }
  }, {
    reward: 1.0
  });

  await logger.endTrajectory(trajId, 'completed', {
    finalBalance: 900,
    finalPnL: 55
  });

  return trajId;
}

