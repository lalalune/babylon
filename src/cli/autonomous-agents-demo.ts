#!/usr/bin/env bun

/**
 * Autonomous Agents Demo
 *
 * Demonstrates autonomous agents connecting to Babylon game via A2A protocol.
 * Run this alongside the daemon to see agents analyze markets and coordinate.
 *
 * Usage:
 *   bun run agents              (start 3 demo agents)
 *   bun run agents --count 5    (start 5 agents)
 */

import { AutonomousAgent, type AgentConfig, type AgentAnalysisResult } from '../agents/AutonomousAgent';
import { AgentRegistry } from '../agents/AgentRegistry';
import type { Question } from '@/shared/types';
import type { CoalitionProposal } from '../a2a/types';
import { logger } from '@/lib/logger';
import type { JsonValue } from '@/types/common';

interface CLIOptions {
  count?: number;
  endpoint?: string;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    count: 3,
    endpoint: 'ws://localhost:8081'
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--count' && args[i + 1]) {
      options.count = parseInt(args[i + 1]!);
      i++;
    } else if (args[i] === '--endpoint' && args[i + 1]) {
      options.endpoint = args[i + 1]!;
      i++;
    }
  }

  return options;
}

// Define agent personalities
const agentTemplates: Omit<AgentConfig, 'a2aEndpoint'>[] = [
  {
    name: 'Alice (Momentum Trader)',
    personality: 'Aggressive momentum trader who looks for rapidly changing markets and high volume',
    strategies: ['momentum', 'volume-analysis'],
    riskTolerance: 0.8,
    analysisDepth: 'quick'
  },
  {
    name: 'Bob (Fundamental Analyst)',
    personality: 'Conservative fundamental analyst who thoroughly researches questions',
    strategies: ['fundamental', 'research'],
    riskTolerance: 0.3,
    analysisDepth: 'deep'
  },
  {
    name: 'Charlie (Contrarian)',
    personality: 'Contrarian who looks for mispriced markets and crowd psychology errors',
    strategies: ['contrarian', 'arbitrage'],
    riskTolerance: 0.6,
    analysisDepth: 'moderate'
  },
  {
    name: 'Diana (News Trader)',
    personality: 'News-driven trader who reacts quickly to events and information',
    strategies: ['event-driven', 'news'],
    riskTolerance: 0.7,
    analysisDepth: 'quick'
  },
  {
    name: 'Eve (Quant)',
    personality: 'Quantitative analyst using statistical models and data analysis',
    strategies: ['quantitative', 'statistical'],
    riskTolerance: 0.5,
    analysisDepth: 'deep'
  }
];

async function main() {
  const options = parseArgs();

  logger.info('AUTONOMOUS AGENTS DEMO', undefined, 'CLI');
  logger.info('========================', undefined, 'CLI');
  logger.info(`Connecting ${options.count} agents to ${options.endpoint}`, undefined, 'CLI');

  // Create agent registry
  const registry = new AgentRegistry();

  registry.on('agentRegistered', (data) => {
    logger.info(`Agent registered: ${data.agentId}`, undefined, 'CLI');
  });

  registry.on('performanceUpdated', (data) => {
    logger.info(`Performance updated for ${data.agentId}`, undefined, 'CLI');
  });

  // Create agents
  const agents: AutonomousAgent[] = [];
  for (let i = 0; i < options.count!; i++) {
    const template = agentTemplates[i % agentTemplates.length];
    const config = {
      ...template,
      a2aEndpoint: options.endpoint!
    } as AgentConfig;

    const agent = new AutonomousAgent(config);
    agents.push(agent);

    // Setup event listeners with proper types
    agent.on('connected', (data: { agentId: string }) => {
      logger.info(`${config.name} connected`, { agentId: data.agentId }, 'CLI');
    });

    agent.on('marketUpdate', (data: { questions: Question[]; priceUpdates?: Array<Record<string, JsonValue>>; timestamp?: number }) => {
      logger.info(`${config.name} received market update`, { activeQuestions: data.questions.length }, 'CLI');
    });

    agent.on('analysisComplete', (analysis: AgentAnalysisResult) => {
      logger.info(`${config.name} completed analysis`, {
        questionId: analysis.questionId,
        prediction: analysis.prediction ? 'YES' : 'NO',
        confidence: `${(analysis.confidence * 100).toFixed(1)}%`,
        reasoning: analysis.reasoning.substring(0, 100)
      }, 'CLI');
    });

    agent.on('coalitionJoined', (invite: CoalitionProposal) => {
      logger.info(`${config.name} joined coalition: ${invite.name || invite.coalitionId}`, undefined, 'CLI');
    });

    agent.on('error', (error: Error) => {
      logger.error(`${config.name} error:`, error.message, 'CLI');
    });
  }

  // Connect all agents
  logger.info('Connecting agents...', undefined, 'CLI');
  await Promise.all(agents.map(agent => agent.connect()));
  logger.info('All agents connected successfully!', undefined, 'CLI');

  // Register agents with registry
  logger.info('Registering agents with registry...', undefined, 'CLI');
  for (const agent of agents) {
    registry.register(agent);
  }

  // Display registry stats
  const stats = registry.getStats();
  logger.info('Registry Statistics:', {
    totalAgents: stats.totalAgents,
    activeAgents: stats.activeAgents,
    strategies: Object.fromEntries(stats.strategies)
  }, 'CLI');

  // After 10 seconds, demonstrate agent discovery and coalition formation
  setTimeout(async () => {
    logger.info('Demonstrating agent discovery...', undefined, 'CLI');

    if (agents.length >= 2) {
      const leader = agents[0]!;
      const leaderStatus = leader.getStatus();

      // Find coalition partners using registry
      logger.info(`${leaderStatus.name} searching for momentum traders...`, undefined, 'CLI');
      const partners = registry.findByStrategy('momentum');
      logger.info(`Found ${partners.length} momentum traders:`, partners.map(p => ({
        agentId: p.profile.agentId,
        reputation: p.profile.reputation,
        predictions: p.performance.totalPredictions
      })), 'CLI');

      // Form coalition
      logger.info('Forming coalition...', undefined, 'CLI');
      const coalitionId = await leader.proposeCoalition(
        'Momentum Coalition',
        'question-1',
        2,
        5
      );

      if (coalitionId) {
        logger.info(`Coalition created: ${coalitionId}`, undefined, 'CLI');
      }
    }
  }, 10000);

  // Status report every 30 seconds
  setInterval(() => {
    logger.info('AGENT STATUS REPORT', undefined, 'CLI');
    logger.info('====================', undefined, 'CLI');

    for (const agent of agents) {
      const status = agent.getStatus();
      logger.info(`${status.name}:`, {
        connected: status.connected,
        questionsTracked: status.questionsTracked,
        analysesComplete: status.analysesComplete,
        coalitions: status.coalitions
      }, 'CLI');
    }
  }, 30000);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Final Agent Statistics:', undefined, 'CLI');
    logger.info('=========================', undefined, 'CLI');

    for (const agent of agents) {
      const status = agent.getStatus();
      const analyses = agent.getAllAnalyses();

      logger.info(`${status.name}:`, {
        totalAnalyses: analyses.length,
        averageConfidence: analyses.length > 0
          ? `${(analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length * 100).toFixed(1)}%`
          : 'N/A',
        coalitionsJoined: status.coalitions
      }, 'CLI');
    }

    logger.info('Disconnecting agents...', undefined, 'CLI');
    await Promise.all(agents.map(agent => agent.disconnect()));
    logger.info('All agents disconnected', undefined, 'CLI');

    process.exit(0);
  });

  // Keep process alive
  logger.info('Agents are now running. Press Ctrl+C to stop.', undefined, 'CLI');
  logger.info('Monitoring agent activity...', undefined, 'CLI');
  await new Promise(() => {});
}

// Run if called directly
if (import.meta.main) {
  main()
}

export { main };
