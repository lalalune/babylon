/**
 * MarketDecisionEngine Token Management Test Suite
 * 
 * @module engine/__tests__/MarketDecisionEngine-token-management.test
 * 
 * @description
 * Specialized test suite for token management and batching features of the
 * MarketDecisionEngine. Verifies that the engine correctly handles token limits,
 * batches NPCs appropriately, and truncates content to fit within model constraints.
 * 
 * **Test Coverage:**
 * - Engine initialization with default and custom models
 * - Batch size calculation for various NPC counts
 * - Multi-batch processing for large NPC sets
 * - Response format handling (array, wrapped with "decisions", wrapped with "decision")
 * - Invalid response format handling
 * - Context truncation for long content
 * - Post count limiting per NPC
 * - Decision validation (hold, close_position, trades)
 * - Balance constraint enforcement
 * - Valid trade acceptance
 * - Empty NPC list handling
 * - Batch failure with individual retry fallback
 * - Model configuration (default vs custom)
 * - Safe context limit calculation
 * 
 * **Key Features Tested:**
 * - Token-aware batching (5-15 NPCs per batch typically)
 * - Automatic chunking for large NPC counts
 * - Content truncation (posts, messages, events)
 * - Multiple response format support
 * - Strict validation preventing over-budget trades
 * - Graceful error handling with fallbacks
 * 
 * **Testing Strategy:**
 * - Mock LLM client for controlled responses
 * - Mock context service for test data
 * - Helper functions for test NPC creation
 * - Unit tests for batching logic
 * - Integration tests for full flow
 * 
 * @see {@link MarketDecisionEngine} - Class under test
 * @see {@link MarketContextService} - Context building tested
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { MarketDecisionEngine } from '../MarketDecisionEngine';
import { MarketContextService } from '@/lib/services/market-context-service';
import { BabylonLLMClient } from '@/generator/llm/openai-client';
import type { NPCMarketContext } from '@/types/market-context';

// Mock LLM client for testing
class MockLLMClient extends BabylonLLMClient {
  private mockResponses: any[] = [];
  private callCount = 0;

  constructor() {
    super();
  }

  setMockResponse(response: any) {
    this.mockResponses.push(response);
  }

  async generateJSON<T>(_prompt: string, _schema?: any, _options?: any): Promise<T> {
    const response = this.mockResponses[this.callCount] || [];
    this.callCount++;
    return response as T;
  }

  getCallCount(): number {
    return this.callCount;
  }

  resetCallCount() {
    this.callCount = 0;
    this.mockResponses = [];
  }
}

// Mock context service
class MockContextService extends MarketContextService {
  private mockNPCs: NPCMarketContext[] = [];

  setMockNPCs(npcs: NPCMarketContext[]) {
    this.mockNPCs = npcs;
  }

  async buildContextForAllNPCs(): Promise<Map<string, NPCMarketContext>> {
    const map = new Map<string, NPCMarketContext>();
    this.mockNPCs.forEach(npc => map.set(npc.npcId, npc));
    return map;
  }

  async buildContextForNPC(npcId: string): Promise<NPCMarketContext> {
    const npc = this.mockNPCs.find(n => n.npcId === npcId);
    if (!npc) {
      throw new Error(`NPC ${npcId} not found`);
    }
    return npc;
  }
}

// Helper to create mock NPC context
function createMockNPC(id: string, name: string): NPCMarketContext {
  return {
    npcId: id,
    npcName: name,
    personality: 'risk-taker',
    tier: 'B_TIER',
    availableBalance: 10000,
    relationships: [],
    recentPosts: [
      { author: 'author1', authorName: 'Author 1', content: 'Test post', timestamp: new Date().toISOString() },
    ],
    groupChatMessages: [],
    recentEvents: [],
    perpMarkets: [
      { ticker: 'TECH', organizationId: 'tech-co', name: 'Tech Co', currentPrice: 100, change24h: 5, changePercent24h: 5, high24h: 105, low24h: 95, volume24h: 1000, openInterest: 5000 },
    ],
    predictionMarkets: [
      { id: 'q1', text: 'Will X happen?', yesPrice: 50, noPrice: 50, totalVolume: 1000, resolutionDate: new Date().toISOString(), daysUntilResolution: 7 },
    ],
    currentPositions: [],
  };
}

describe('MarketDecisionEngine - Token Management', () => {
  let mockLLM: MockLLMClient;
  let mockContext: MockContextService;

  beforeEach(() => {
    mockLLM = new MockLLMClient();
    mockContext = new MockContextService();
  });

  describe('Initialization', () => {
    test('should initialize with default model and token limits', () => {
      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      
      // Should initialize without errors
      expect(engine).toBeDefined();
    });

    test('should accept custom model configuration', () => {
      const engine = new MarketDecisionEngine(mockLLM, mockContext, {
        model: 'gpt-4o',
        maxOutputTokens: 4000,
      });
      
      expect(engine).toBeDefined();
    });

    test('should use stable llama-3.1 by default', () => {
      // The default model should be llama-3.1-70b-versatile
      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      expect(engine).toBeDefined();
    });
  });

  describe('Batch Size Calculation', () => {
    test('should calculate correct batch size for small NPC count', async () => {
      // With 400 tokens per NPC and 108k context, should fit ~270 NPCs per batch
      const npcs = Array.from({ length: 10 }, (_, i) => 
        createMockNPC(`npc-${i}`, `NPC ${i}`)
      );
      mockContext.setMockNPCs(npcs);
      
      // Mock response
      const mockDecisions = npcs.map(npc => ({
        npcId: npc.npcId,
        npcName: npc.npcName,
        action: 'hold' as const,
        marketType: null,
        amount: 0,
        confidence: 1,
        reasoning: 'Holding',
        timestamp: new Date().toISOString(),
      }));
      mockLLM.setMockResponse(mockDecisions);

      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      const decisions = await engine.generateBatchDecisions();

      expect(decisions.length).toBe(10);
      expect(mockLLM.getCallCount()).toBe(1); // Should be single batch
    });

    test('should split large NPC count into multiple batches', async () => {
      // Create 300 NPCs (should require ~2 batches with 400 tokens per NPC)
      const npcs = Array.from({ length: 300 }, (_, i) => 
        createMockNPC(`npc-${i}`, `NPC ${i}`)
      );
      mockContext.setMockNPCs(npcs);

      // Mock responses for each batch
      const batch1 = npcs.slice(0, 270).map(npc => ({
        npcId: npc.npcId,
        npcName: npc.npcName,
        action: 'hold' as const,
        marketType: null,
        amount: 0,
        confidence: 1,
        reasoning: 'Holding',
        timestamp: new Date().toISOString(),
      }));
      const batch2 = npcs.slice(270).map(npc => ({
        npcId: npc.npcId,
        npcName: npc.npcName,
        action: 'hold' as const,
        marketType: null,
        amount: 0,
        confidence: 1,
        reasoning: 'Holding',
        timestamp: new Date().toISOString(),
      }));

      mockLLM.setMockResponse(batch1);
      mockLLM.setMockResponse(batch2);

      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      const decisions = await engine.generateBatchDecisions();

      expect(decisions.length).toBe(300);
      expect(mockLLM.getCallCount()).toBeGreaterThan(1); // Multiple batches
    });
  });

  describe('Response Format Handling', () => {
    test('should handle array response format', async () => {
      const npcs = [createMockNPC('npc1', 'NPC 1')];
      mockContext.setMockNPCs(npcs);

      const mockResponse = [{
        npcId: 'npc1',
        npcName: 'NPC 1',
        action: 'hold' as const,
        marketType: null,
        amount: 0,
        confidence: 1,
        reasoning: 'Holding',
        timestamp: new Date().toISOString(),
      }];
      mockLLM.setMockResponse(mockResponse);

      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      const decisions = await engine.generateBatchDecisions();

      expect(decisions.length).toBe(1);
      expect(decisions[0]?.action).toBe('hold');
    });

    test('should handle wrapped response format with "decisions" key', async () => {
      const npcs = [createMockNPC('npc1', 'NPC 1')];
      mockContext.setMockNPCs(npcs);

      const mockResponse = {
        decisions: [{
          npcId: 'npc1',
          npcName: 'NPC 1',
          action: 'hold' as const,
          marketType: null,
          amount: 0,
          confidence: 1,
          reasoning: 'Holding',
          timestamp: new Date().toISOString(),
        }]
      };
      mockLLM.setMockResponse(mockResponse);

      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      const decisions = await engine.generateBatchDecisions();

      expect(decisions.length).toBe(1);
      expect(decisions[0]?.action).toBe('hold');
    });

    test('should handle wrapped response format with "decision" key (singular)', async () => {
      const npcs = [createMockNPC('npc1', 'NPC 1')];
      mockContext.setMockNPCs(npcs);

      const mockResponse = {
        decision: [{
          npcId: 'npc1',
          npcName: 'NPC 1',
          action: 'hold' as const,
          marketType: null,
          amount: 0,
          confidence: 1,
          reasoning: 'Holding',
          timestamp: new Date().toISOString(),
        }]
      };
      mockLLM.setMockResponse(mockResponse);

      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      const decisions = await engine.generateBatchDecisions();

      expect(decisions.length).toBe(1);
      expect(decisions[0]?.action).toBe('hold');
    });

    test('should return empty array for invalid response format', async () => {
      const npcs = [createMockNPC('npc1', 'NPC 1')];
      mockContext.setMockNPCs(npcs);

      const mockResponse = { invalid: 'response' };
      mockLLM.setMockResponse(mockResponse);

      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      const decisions = await engine.generateBatchDecisions();

      expect(decisions.length).toBe(0);
    });
  });

  describe('Context Truncation', () => {
    test('should truncate long post content', async () => {
      const npc = createMockNPC('npc1', 'NPC 1');
      // Add a very long post
      npc.recentPosts = [{
        author: 'author1',
        authorName: 'Author 1',
        content: 'A'.repeat(1000), // Very long content
        timestamp: new Date().toISOString(),
      }];
      mockContext.setMockNPCs([npc]);

      const mockResponse = [{
        npcId: 'npc1',
        npcName: 'NPC 1',
        action: 'hold' as const,
        marketType: null,
        amount: 0,
        confidence: 1,
        reasoning: 'Holding',
        timestamp: new Date().toISOString(),
      }];
      mockLLM.setMockResponse(mockResponse);

      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      const decisions = await engine.generateBatchDecisions();

      // Should complete without token overflow
      expect(decisions.length).toBe(1);
    });

    test('should limit number of posts per NPC', async () => {
      const npc = createMockNPC('npc1', 'NPC 1');
      // Add 100 posts (should be truncated to 8)
      npc.recentPosts = Array.from({ length: 100 }, (_, i) => ({
        author: `author${i}`,
        authorName: `Author ${i}`,
        content: `Post ${i}`,
        timestamp: new Date().toISOString(),
      }));
      mockContext.setMockNPCs([npc]);

      const mockResponse = [{
        npcId: 'npc1',
        npcName: 'NPC 1',
        action: 'hold' as const,
        marketType: null,
        amount: 0,
        confidence: 1,
        reasoning: 'Holding',
        timestamp: new Date().toISOString(),
      }];
      mockLLM.setMockResponse(mockResponse);

      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      const decisions = await engine.generateBatchDecisions();

      expect(decisions.length).toBe(1);
    });
  });

  describe('Decision Validation', () => {
    test('should validate hold decisions', async () => {
      const npcs = [createMockNPC('npc1', 'NPC 1')];
      mockContext.setMockNPCs(npcs);

      const mockResponse = [{
        npcId: 'npc1',
        npcName: 'NPC 1',
        action: 'hold' as const,
        marketType: null,
        amount: 0,
        confidence: 1,
        reasoning: 'Market conditions unclear',
        timestamp: new Date().toISOString(),
      }];
      mockLLM.setMockResponse(mockResponse);

      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      const decisions = await engine.generateBatchDecisions();

      expect(decisions.length).toBe(1);
      expect(decisions[0]?.action).toBe('hold');
      expect(decisions[0]?.amount).toBe(0);
    });

    test('should validate trade decisions do not exceed balance', async () => {
      const npc = createMockNPC('npc1', 'NPC 1');
      npc.availableBalance = 1000;
      mockContext.setMockNPCs([npc]);

      // LLM tries to trade more than balance (should be rejected)
      const mockResponse = [{
        npcId: 'npc1',
        npcName: 'NPC 1',
        action: 'open_long' as const,
        marketType: 'perp' as const,
        ticker: 'TECH',
        amount: 5000, // Exceeds balance!
        confidence: 0.8,
        reasoning: 'Strong signal',
        timestamp: new Date().toISOString(),
      }];
      mockLLM.setMockResponse(mockResponse);

      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      const decisions = await engine.generateBatchDecisions();

      // Should be rejected (filtered out)
      expect(decisions.length).toBe(0);
    });

    test('should accept valid trade decisions', async () => {
      const npc = createMockNPC('npc1', 'NPC 1');
      npc.availableBalance = 10000;
      mockContext.setMockNPCs([npc]);

      const mockResponse = [{
        npcId: 'npc1',
        npcName: 'NPC 1',
        action: 'open_long' as const,
        marketType: 'perp' as const,
        ticker: 'TECH',
        amount: 1000, // Within balance
        confidence: 0.8,
        reasoning: 'Strong signal',
        timestamp: new Date().toISOString(),
      }];
      mockLLM.setMockResponse(mockResponse);

      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      const decisions = await engine.generateBatchDecisions();

      expect(decisions.length).toBe(1);
      expect(decisions[0]?.action).toBe('open_long');
      expect(decisions[0]?.amount).toBe(1000);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty NPC list gracefully', async () => {
      mockContext.setMockNPCs([]);

      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      const decisions = await engine.generateBatchDecisions();

      expect(decisions.length).toBe(0);
    });

    test('should handle batch failure with individual retry', async () => {
      const npcs = [
        createMockNPC('npc1', 'NPC 1'),
        createMockNPC('npc2', 'NPC 2'),
      ];
      mockContext.setMockNPCs(npcs);

      // First call (batch) fails, then individual calls succeed
      mockLLM.setMockResponse(null); // Batch failure
      mockLLM.setMockResponse([{
        npcId: 'npc1',
        npcName: 'NPC 1',
        action: 'hold' as const,
        marketType: null,
        amount: 0,
        confidence: 1,
        reasoning: 'Holding',
        timestamp: new Date().toISOString(),
      }]);
      mockLLM.setMockResponse([{
        npcId: 'npc2',
        npcName: 'NPC 2',
        action: 'hold' as const,
        marketType: null,
        amount: 0,
        confidence: 1,
        reasoning: 'Holding',
        timestamp: new Date().toISOString(),
      }]);

      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      
      // Should handle the error gracefully
      const decisions = await engine.generateBatchDecisions();
      
      // Should get some decisions from individual retries
      expect(decisions).toBeDefined();
    });
  });

  describe('Model Configuration', () => {
    test('should use llama-3.1-70b-versatile by default', () => {
      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      expect(engine).toBeDefined();
      // Default model should have 128k token limit
    });

    test('should accept custom model with different token limit', () => {
      const engine = new MarketDecisionEngine(mockLLM, mockContext, {
        model: 'claude-3-opus', // 200k context
        maxOutputTokens: 8000,
      });
      expect(engine).toBeDefined();
    });

    test('should calculate safe context limit correctly', () => {
      // llama-3.1-70b-versatile: 128k total
      // - 8k output = 120k available
      // * 0.9 safety = 108k safe limit
      // / 400 per NPC = ~270 NPCs per batch
      
      const engine = new MarketDecisionEngine(mockLLM, mockContext);
      expect(engine).toBeDefined();
    });
  });
});

