/**
 * Agent Logs and Activity History API
 * 
 * @route GET /api/agents/[agentId]/logs
 * @access Authenticated (owner only)
 * 
 * @description
 * Retrieve comprehensive activity logs for an agent, including all autonomous
 * actions, AI model interactions, trading decisions, and system events. Supports
 * filtering by log type and severity level for debugging and monitoring.
 * 
 * **Log Types:**
 * - `chat` - Chat interactions with users
 * - `trade` - Trading actions and decisions
 * - `post` - Social posts created by agent
 * - `comment` - Comments on posts
 * - `dm` - Direct messages sent/received
 * - `error` - Error events
 * - `system` - System-level events
 * 
 * **Log Levels:**
 * - `debug` - Detailed debugging information
 * - `info` - Informational messages
 * - `warn` - Warning messages
 * - `error` - Error messages
 * 
 * **GET /api/agents/[agentId]/logs - Retrieve Logs**
 * 
 * @param {string} agentId - Agent user ID (path parameter)
 * @query {string} [type] - Filter by log type (chat|trade|post|comment|dm|error|system)
 * @query {string} [level] - Filter by severity (debug|info|warn|error)
 * @query {number} [limit=100] - Maximum number of logs to return
 * 
 * @returns {object} Logs response
 * @property {boolean} success - Operation success status
 * @property {array} logs - Array of log entries
 * @property {string} logs[].id - Log entry ID
 * @property {string} logs[].type - Log type
 * @property {string} logs[].level - Severity level
 * @property {string} logs[].message - Log message
 * @property {string} [logs[].prompt] - AI prompt (if applicable)
 * @property {string} [logs[].completion] - AI completion (if applicable)
 * @property {string} [logs[].thinking] - Agent reasoning (if applicable)
 * @property {object} logs[].metadata - Additional context data
 * @property {string} logs[].createdAt - ISO timestamp
 * 
 * @throws {401} Unauthorized - Not authenticated
 * @throws {403} Forbidden - Not the agent owner
 * @throws {404} Not Found - Agent doesn't exist
 * @throws {500} Internal Server Error
 * 
 * @example
 * ```typescript
 * // Get all logs
 * const logs = await fetch('/api/agents/agent-123/logs')
 *   .then(r => r.json());
 * 
 * // Filter by type and level
 * const errorLogs = await fetch(
 *   '/api/agents/agent-123/logs?type=error&level=error&limit=50'
 * ).then(r => r.json());
 * 
 * // Get recent trading activity
 * const tradeLogs = await fetch(
 *   '/api/agents/agent-123/logs?type=trade&limit=20'
 * ).then(r => r.json());
 * ```
 * 
 * @see {@link /lib/agents/services/AgentService} Log service
 * @see {@link /src/app/agents/[agentId]/page.tsx} Logs UI
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { agentService } from '@/lib/agents/services/AgentService'
import { authenticateUser } from '@/lib/server-auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const user = await authenticateUser(req)
  const { agentId } = await params

  await agentService.getAgent(agentId, user.id)

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || undefined
  const level = searchParams.get('level') || undefined
  const limit = parseInt(searchParams.get('limit')!)

  const logs = await agentService.getLogs(agentId, {
    type,
    level,
    limit
  })

  return NextResponse.json({
    success: true,
    logs: logs.map(log => ({
      id: log.id,
      type: log.type,
      level: log.level,
      message: log.message,
      prompt: log.prompt,
      completion: log.completion,
      thinking: log.thinking,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString()
    }))
  })
}

