/**
 * A2A Client Integration for Eliza Agents
 * 
 * Uses @a2a-js/sdk client for A2A communication
 */

import { A2AClient } from '@a2a-js/sdk/client'
import type { AgentCard, Task, Message } from '@a2a-js/sdk'
import type { IAgentRuntime } from '@elizaos/core'
import { logger } from '@/lib/logger'

export interface BabylonA2ARuntime extends IAgentRuntime {
  babylonA2AClient?: A2AClient
  babylonAgentCard?: AgentCard
}

/**
 * Initialize A2A client for Babylon
 */
export async function initializeA2AClient(
  endpoint?: string
): Promise<A2AClient> {
  const babylonEndpoint = endpoint || 
    process.env.BABYLON_A2A_ENDPOINT ||
    process.env.NEXT_PUBLIC_APP_URL + '/.well-known/agent-card.json' ||
    'http://localhost:3000/.well-known/agent-card.json'
  
  logger.info('Initializing A2A client for Babylon', { endpoint: babylonEndpoint })
  
  try {
    // Use SDK to create client from agent card
    const client = await A2AClient.fromCardUrl(babylonEndpoint)
    
    // Validate Babylon capabilities
    const card = await client.getAgentCard()
    
    if (card.protocolVersion !== '0.3.0') {
      logger.warn('Babylon using non-standard A2A protocol version', {
        expected: '0.3.0',
        actual: card.protocolVersion
      })
    }
    
    logger.info('A2A client initialized successfully', {
      name: card.name,
      skills: card.skills.length,
      transport: card.preferredTransport,
      protocolVersion: card.protocolVersion
    })
    
    return client
    
  } catch (error) {
    logger.error('Failed to initialize A2A client', { error, endpoint: babylonEndpoint })
    throw new Error(`Could not initialize A2A client: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Execute a Babylon skill via A2A protocol
 * 
 * @param client - A2AClient instance
 * @param skillId - Babylon skill ID (e.g., 'prediction-market-trader')
 * @param message - Natural language message or structured JSON
 * @returns Task or Message response
 */
export async function executeBabylonSkill(
  client: A2AClient,
  skillId: string,
  message: string
): Promise<Task | Message> {
  logger.info('Executing Babylon skill via A2A', { skillId, messageLength: message.length })
  
  try {
    const response = await client.sendMessage({
      message: {
        kind: 'message',
        messageId: crypto.randomUUID(),
        role: 'user',
        parts: [{
          kind: 'text',
          text: message,
          metadata: {
            skillId  // Hint which skill to use
          }
        }]
      }
    })
    
    // Handle SendMessageResponse - extract Task or Message from result
    let result: Task | Message
    if ('result' in response && response.result) {
      result = response.result as unknown as Task | Message
    } else if ('kind' in response) {
      result = response as unknown as Task | Message
    } else {
      throw new Error('Unexpected response format from sendMessage')
    }
    
    logger.info('Skill execution response received', {
      skillId,
      responseType: 'kind' in result ? result.kind : 'unknown'
    })
    
    return result
    
  } catch (error) {
    logger.error('Skill execution failed', { error, skillId })
    throw error
  }
}

/**
 * Wait for task to complete (with polling)
 * 
 * @param client - A2AClient instance
 * @param taskId - Task ID to poll
 * @param maxAttempts - Maximum polling attempts (default: 30)
 * @param intervalMs - Polling interval in ms (default: 1000)
 * @returns Completed task
 */
export async function waitForTaskCompletion(
  client: A2AClient,
  taskId: string,
  maxAttempts: number = 30,
  intervalMs: number = 1000
): Promise<Task> {
  logger.info('Waiting for task completion', { taskId, maxAttempts })
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await client.getTask({ id: taskId })
    
    // Handle GetTaskResponse which has result.task
    const task = 'result' in response && response.result && 'task' in response.result
      ? (response.result as { task: Task }).task
      : response as unknown as Task
    
    const terminalStates = ['completed', 'failed', 'canceled', 'rejected']
    
    if (task.status && 'state' in task.status && terminalStates.includes(task.status.state as string)) {
      logger.info('Task reached terminal state', {
        taskId,
        state: task.status.state,
        attempts: attempt + 1
      })
      return task
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  
  logger.warn('Task did not complete within timeout', { taskId, maxAttempts })
  
  // Return last known state
  const response = await client.getTask({ id: taskId })
  return 'result' in response && response.result && 'task' in response.result
    ? (response.result as { task: Task }).task
    : response as unknown as Task
}

/**
 * Execute skill and wait for result
 * 
 * Convenience method that executes a skill and waits for completion
 */
export async function executeAndWait(
  client: A2AClient,
  skillId: string,
  message: string
): Promise<Task> {
  const response = await executeBabylonSkill(client, skillId, message)
  
  if ('kind' in response && response.kind === 'task') {
    const task = response as Task
    return await waitForTaskCompletion(client, task.id)
  }
  
  // If direct message response, wrap it
  throw new Error('Expected task response, got direct message')
}

/**
 * Get available Babylon skills from AgentCard
 */
export async function getBabylonSkills(
  client: A2AClient
): Promise<Array<{ id: string; name: string; description: string; examples: string[] }>> {
  const card = await client.getAgentCard()
  
  return card.skills.map(skill => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    examples: skill.examples || []
  }))
}

