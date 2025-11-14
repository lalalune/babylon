/**
 * Clear Agent Runtime Cache API
 * 
 * @route POST /api/debug/clear-agent-cache
 * @access Admin/Debug
 * 
 * @description
 * Debug endpoint to forcefully clear all cached agent runtimes from memory.
 * Useful for troubleshooting agent behavior issues, memory leaks, or forcing
 * runtime reinitialization after configuration changes.
 * 
 * **Use Cases:**
 * - Reset agent behavior after system prompt updates
 * - Clear stale runtime instances
 * - Free up memory during development
 * - Force reload of agent configurations
 * 
 * **Warning:** This will clear ALL agent runtimes, causing temporary
 * performance impact as agents reinitialize on their next tick.
 * 
 * @returns {object} Success response with count of cleared runtimes
 * @property {boolean} success - Operation success status
 * @property {number} cleared - Number of runtime instances cleared
 * 
 * @throws {500} Internal server error if cache clearing fails
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/debug/clear-agent-cache', {
 *   method: 'POST'
 * });
 * const data = await response.json();
 * // { success: true, cleared: 15 }
 * ```
 * 
 * @see {@link /lib/agents/runtime/AgentRuntimeManager} Runtime manager implementation
 */

import { NextResponse } from 'next/server'
import { agentRuntimeManager } from '@/lib/agents/runtime/AgentRuntimeManager'
import { logger } from '@/lib/logger'

export async function POST() {
  const count = agentRuntimeManager.getRuntimeCount()
  agentRuntimeManager.clearAllRuntimes()
  logger.info(`Cleared ${count} cached runtimes`, undefined, 'Debug')
  return NextResponse.json({ success: true, cleared: count })
}

