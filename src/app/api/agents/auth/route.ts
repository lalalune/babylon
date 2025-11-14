/**
 * Agent Authentication API
 *
 * Provides authentication for Babylon agents without requiring user Privy tokens.
 * Uses internal agent credentials stored securely in environment variables.
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
