/**
 * Agent Authentication API
 * 
 * @route POST /api/agents/auth
 * @access Public (with credentials)
 * 
 * @description
 * Secure authentication endpoint for autonomous Babylon agents. Provides
 * session-based authentication without requiring user Privy tokens. Agent
 * credentials are validated against environment variables, and successful
 * authentication returns a time-limited session token.
 * 
 * **Authentication Flow:**
 * 1. Agent provides agentId and agentSecret
 * 2. Credentials verified against environment configuration
 * 3. Session token generated and stored
 * 4. Expired sessions automatically cleaned up
 * 5. Token used for subsequent authenticated requests
 * 
 * **Security Features:**
 * - Secure credential validation via environment variables
 * - Time-limited session tokens (configurable expiration)
 * - Automatic cleanup of expired sessions
 * - Cryptographically secure token generation
 * - Rate limiting and abuse prevention
 * 
 * **POST /api/agents/auth - Authenticate Agent**
 * 
 * @param {string} agentId - Agent identifier (required)
 * @param {string} agentSecret - Agent secret key (required)
 * 
 * @returns {object} Authentication response
 * @property {boolean} success - Authentication success status
 * @property {string} sessionToken - Session token for authenticated requests
 * @property {string} expiresAt - ISO timestamp of session expiration
 * @property {number} expiresIn - Seconds until session expires
 * 
 * @throws {400} Bad Request - Invalid request format
 * @throws {401} Unauthorized - Invalid credentials
 * @throws {500} Internal Server Error
 * 
 * @example
 * ```typescript
 * // Authenticate agent
 * const response = await fetch('/api/agents/auth', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     agentId: 'my-agent-id',
 *     agentSecret: process.env.AGENT_SECRET
 *   })
 * });
 * 
 * const { sessionToken, expiresIn } = await response.json();
 * 
 * // Use token for authenticated requests
 * await fetch('/api/some-endpoint', {
 *   headers: { 'Authorization': `Bearer ${sessionToken}` }
 * });
 * ```
 * 
 * @see {@link /lib/auth/agent-auth} Agent authentication implementation
 * @see {@link /examples/babylon-typescript-agent} Example agent usage
 */

import type { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { AuthorizationError } from '@/lib/errors';
import { AgentAuthSchema } from '@/lib/validation/schemas/agent';
import { logger } from '@/lib/logger';
import {
  verifyAgentCredentials,
  cleanupExpiredSessions,
  createAgentSession,
  getSessionDuration,
} from '@/lib/auth/agent-auth';

/**
 * POST /api/agents/auth
 * Authenticate agent and receive session token
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json();

  // Check if body is empty or not an object
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object containing agentId and agentSecret fields.');
  }

  const { agentId, agentSecret } = AgentAuthSchema.parse(body);

  // Verify agent credentials
  if (!verifyAgentCredentials(agentId, agentSecret)) {
    throw new AuthorizationError('Invalid agent credentials', 'agent', 'authenticate');
  }

  // Clean up old sessions
  cleanupExpiredSessions();

  // Generate session token
  const sessionToken = randomBytes(32).toString('hex');

  // Create session
  const session = await createAgentSession(agentId, sessionToken);

  logger.info(`Agent ${agentId} authenticated successfully`, undefined, 'POST /api/agents/auth');

  return successResponse({
    success: true,
    sessionToken,
    expiresAt: session.expiresAt,
    expiresIn: getSessionDuration() / 1000, // seconds
  });
});
