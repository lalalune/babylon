/**
 * Test Agent Creation Utility
 * 
 * Creates test agents for benchmarking and RL training.
 * Ensures agents exist with proper configuration.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateSnowflakeId } from '@/lib/snowflake';
import { ethers } from 'ethers';

export interface TestAgentConfig {
  username?: string;
  displayName?: string;
  virtualBalance?: number;
  agentPointsBalance?: number;
  autonomousTrading?: boolean;
  autonomousPosting?: boolean;
  autonomousCommenting?: boolean;
  autonomousDMs?: boolean;
  autonomousGroupChats?: boolean;
  agentSystem?: string;
  agentModelTier?: 'lite' | 'standard' | 'pro';
}

export interface CreateTestAgentResult {
  agentId: string;
  created: boolean;
  agent: {
    id: string;
    username: string;
    displayName: string | null;
    isAgent: boolean;
  };
}

/**
 * Create or get test agent
 */
export async function createTestAgent(
  prefix: string = 'test-agent',
  config: TestAgentConfig = {}
): Promise<CreateTestAgentResult> {
  const {
    username,
    displayName = `${prefix} ${Date.now().toString().slice(-6)}`,
    virtualBalance = 10000,
    agentPointsBalance = 1000,
    autonomousTrading = true,
    autonomousPosting = true,
    autonomousCommenting = true,
    autonomousDMs = false,
    autonomousGroupChats = false,
    agentSystem = 'You are an autonomous trading agent on Babylon prediction markets. Make smart trading decisions based on market analysis.',
    agentModelTier = 'lite'
  } = config;
  
  // Try to find existing agent with same prefix
  let agent = await prisma.user.findFirst({
    where: {
      isAgent: true,
      username: username ? { equals: username } : { startsWith: prefix }
    }
  });
  
  if (agent) {
    logger.info('Using existing test agent', { agentId: agent.id, username: agent.username });
    return {
      agentId: agent.id,
      created: false,
      agent: {
        id: agent.id,
        username: agent.username || 'unknown',
        displayName: agent.displayName,
        isAgent: agent.isAgent
      }
    };
  }
  
  // Create new agent
  const agentId = await generateSnowflakeId();
  const finalUsername = username || `${prefix}-${agentId.slice(-6)}`;
  
  agent = await prisma.user.create({
    data: {
      id: agentId,
      privyId: `did:privy:${prefix}-${agentId}`,
      username: finalUsername,
      displayName,
      walletAddress: ethers.Wallet.createRandom().address,
      isAgent: true,
      autonomousTrading,
      autonomousPosting,
      autonomousCommenting,
      autonomousDMs,
      autonomousGroupChats,
      agentSystem,
      agentModelTier,
      virtualBalance,
      reputationPoints: 1000,
      agentPointsBalance,
      isTest: true,
      updatedAt: new Date()
    }
  });
  
  logger.info('Created test agent', {
    agentId: agent.id,
    username: agent.username,
    displayName: agent.displayName
  });
  
  return {
    agentId: agent.id,
    created: true,
    agent: {
      id: agent.id,
      username: agent.username || 'unknown',
      displayName: agent.displayName,
      isAgent: agent.isAgent
    }
  };
}

/**
 * Create multiple test agents
 */
export async function createTestAgents(
  count: number,
  prefix: string = 'test-agent',
  config: TestAgentConfig = {}
): Promise<CreateTestAgentResult[]> {
  const results: CreateTestAgentResult[] = [];
  
  for (let i = 0; i < count; i++) {
    const result = await createTestAgent(`${prefix}-${i}`, {
      ...config,
      displayName: config.displayName || `${prefix} ${i + 1}`
    });
    results.push(result);
    
    // Small delay between creations
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

/**
 * Ensure test agents exist (idempotent)
 */
export async function ensureTestAgents(
  count: number,
  prefix: string = 'test-agent',
  config: TestAgentConfig = {}
): Promise<string[]> {
  const results = await createTestAgents(count, prefix, config);
  return results.map(r => r.agentId);
}

