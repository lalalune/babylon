#!/usr/bin/env bun
/**
 * Run Eliza Agents
 *
 * This script spawns character agents to simulate
 * a live prediction market with AI traders.
 * Defaults to 1 agent, but can be configured with --max=N
 */

import { spawn, type ChildProcess } from 'child_process'
import { readdirSync } from 'fs'
import { join } from 'path'
import { logger } from '../src/lib/logger'

interface AgentProcess {
  character: string
  process: ChildProcess
  started: Date
  status: 'starting' | 'running' | 'error' | 'stopped'
}

const CHARACTERS_DIR = join(process.cwd(), 'src', 'eliza', 'characters')
const AGENT_SCRIPT = join(process.cwd(), 'src', 'eliza', 'agents', 'run-eliza-agent.ts')

// Parse command line arguments
const args = process.argv.slice(2)
const autoTrade = args.includes('--auto-trade')
const maxAgents = parseInt(args.find(arg => arg.startsWith('--max='))?.split('=')[1] || '1')
const delayMs = parseInt(args.find(arg => arg.startsWith('--delay='))?.split('=')[1] || '2000')

logger.info('Babylon Multi-Agent Runner', undefined, 'Script');
logger.info('Configuration:', {
  autoTrading: autoTrade ? 'ENABLED' : 'DISABLED',
  maxAgents,
  startupDelay: `${delayMs}ms between agents`
}, 'Script');

const agents: Map<string, AgentProcess> = new Map()
let activeCount = 0
let errorCount = 0

function getCharacterFiles(): string[] {
  try {
    const files = readdirSync(CHARACTERS_DIR)
      .filter(file => file.endsWith('.json'))
      .slice(0, maxAgents)
    return files
  } catch (error) {
    logger.error('Failed to read characters directory:', error, 'Script');
    process.exit(1)
  }
}

function startAgent(characterFile: string, index: number): Promise<void> {
  return new Promise((resolve) => {
    const characterPath = join(CHARACTERS_DIR, characterFile)
    const characterName = characterFile.replace('.json', '')

    logger.info(`[${index + 1}/${maxAgents}] Starting ${characterName}...`, undefined, 'Script');

    const args = [
      AGENT_SCRIPT,
      '--character', characterPath,
    ]

    if (autoTrade) {
      args.push('--auto-trade')
    }

    const agentProcess = spawn('bun', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        BABYLON_AGENT_ID: `babylon-agent-${characterName}`,
      }
    })

    const agentInfo: AgentProcess = {
      character: characterName,
      process: agentProcess,
      started: new Date(),
      status: 'starting'
    }

    agents.set(characterName, agentInfo)

    // Handle agent output
    agentProcess.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim())
      lines.forEach((line: string) => {
        logger.debug(`[${characterName}] ${line}`, undefined, 'Script');
      })

      // Detect when agent is ready
      if (data.toString().includes('Agent started') || data.toString().includes('initialized')) {
        agentInfo.status = 'running'
        activeCount++
        logger.info(`${characterName} is running (${activeCount}/${maxAgents} active)`, undefined, 'Script');
      }
    })

    agentProcess.stderr?.on('data', (data) => {
      logger.error(`[${characterName}] ERROR:`, data.toString(), 'Script');
    })

    agentProcess.on('error', (error) => {
      logger.error(`${characterName} failed to start:`, error, 'Script');
      agentInfo.status = 'error'
      errorCount++
    })

    agentProcess.on('exit', (code) => {
      if (code !== 0) {
        logger.warn(`${characterName} exited with code ${code}`, undefined, 'Script');
        agentInfo.status = 'stopped'
        activeCount = Math.max(0, activeCount - 1)
      }
    })

    // Give agent time to initialize before starting next one
    setTimeout(resolve, delayMs)
  })
}

async function main() {
  logger.info('Loading character files...', undefined, 'Script');

  const characterFiles = getCharacterFiles()
  logger.info(`Found ${characterFiles.length} character files:`, characterFiles.map((file, i) => `${i + 1}. ${file.replace('.json', '')}`), 'Script');

  logger.info('Starting agents...', undefined, 'Script');
  logger.info('Starting agents with 2-second delay between each', undefined, 'Script');

  // Start agents sequentially with delay
  for (let i = 0; i < characterFiles.length; i++) {
    await startAgent(characterFiles[i], i)
  }

  logger.info('All agents started!', undefined, 'Script');
  logger.info('Status:', {
    active: activeCount,
    errors: errorCount
  }, 'Script');
  logger.info('Press Ctrl+C to stop all agents', undefined, 'Script');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Stopping all agents...', undefined, 'Script');

    let stoppedCount = 0
    agents.forEach((agent, name) => {
      if (agent.status === 'running' || agent.status === 'starting') {
        agent.process.kill('SIGTERM')
        stoppedCount++
        logger.info(`Stopped ${name}`, undefined, 'Script');
      }
    })

    logger.info(`Stopped ${stoppedCount} agents`, undefined, 'Script');
    process.exit(0)
  })

  // Keep process running and show periodic status
  setInterval(() => {
    const running = Array.from(agents.values()).filter(a => a.status === 'running').length
    const starting = Array.from(agents.values()).filter(a => a.status === 'starting').length
    const errors = Array.from(agents.values()).filter(a => a.status === 'error').length
    const stopped = Array.from(agents.values()).filter(a => a.status === 'stopped').length

    logger.info(`Status Update: ${new Date().toLocaleTimeString()}`, {
      running,
      starting,
      errors,
      stopped
    }, 'Script');
  }, 60000) // Every minute
}

// Show usage if --help flag is passed
if (args.includes('--help') || args.includes('-h')) {
  logger.info(`Usage: bun run scripts/run-all-agents.ts [OPTIONS]

Options:
  --auto-trade       Enable auto-trading for all agents
  --max=N            Maximum number of agents to start (default: 1)
  --delay=MS         Delay in milliseconds between agent starts (default: 2000)
  --help, -h         Show this help message

Examples:
  # Start 1 agent in observer mode (default)
  bun run scripts/run-all-agents.ts

  # Start 1 agent with auto-trading enabled
  bun run scripts/run-all-agents.ts --auto-trade

  # Start 10 agents
  bun run scripts/run-all-agents.ts --max=10

  # Start agents with 5-second delay between each
  bun run scripts/run-all-agents.ts --delay=5000

  # Combine options
  bun run scripts/run-all-agents.ts --auto-trade --max=15 --delay=3000

Environment Variables:
  OPENAI_API_KEY              Required - OpenAI API key for all agents
  BABYLON_API_URL             Optional - Babylon API URL (default: http://localhost:3000)
  BABYLON_AGENT_SECRET        Optional - Shared secret for agent authentication

Note: Make sure the Babylon game engine is running first:
  bun run daemon
`, undefined, 'Script');
  process.exit(0)
}

main().catch((error) => {
  logger.error('Fatal error:', error, 'Script');
  process.exit(1)
})
