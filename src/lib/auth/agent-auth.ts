/**
 * Agent Authentication Utilities
 *
 * Provides session management and verification for Babylon agents
 */

import { logger } from '@/lib/logger';
import { redis, redisClientType, isRedisAvailable } from '@/lib/redis';
import type { Redis as UpstashRedis } from '@upstash/redis';
import type IORedis from 'ioredis';

export interface AgentSession {
  sessionToken: string;
  agentId: string;
  expiresAt: number;
}

// In-memory session storage (in production, use Redis or database)
const agentSessions = new Map<string, AgentSession>();

// Session duration: 24 hours
const SESSION_DURATION = 24 * 60 * 60 * 1000;
const SESSION_PREFIX = 'agent:session:';
const useRedis = isRedisAvailable() && redis !== null;

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): void {
  if (useRedis) {
    // Redis gère la péremption via TTL, rien à faire ici.
    return;
  }

  const now = Date.now();
  const tokensToDelete: string[] = [];

  agentSessions.forEach((session, token) => {
    if (now > session.expiresAt) {
      tokensToDelete.push(token);
    }
  });

  tokensToDelete.forEach(token => agentSessions.delete(token));
}

/**
 * Verify agent credentials against environment configuration
 */
export function verifyAgentCredentials(agentId: string, agentSecret: string): boolean {
  // Get configured agent credentials from environment
  const configuredAgentId = process.env.BABYLON_AGENT_ID || 'babylon-agent-alice';
  const configuredAgentSecret = process.env.BABYLON_AGENT_SECRET;

  if (!configuredAgentSecret) {
    logger.error('BABYLON_AGENT_SECRET not configured in environment', undefined, 'AgentAuth');
    return false;
  }

  return agentId === configuredAgentId && agentSecret === configuredAgentSecret;
}

/**
 * Create a new agent session
 */
export async function createAgentSession(agentId: string, sessionToken: string): Promise<AgentSession> {
  const expiresAt = Date.now() + SESSION_DURATION;
  const session: AgentSession = {
    sessionToken,
    agentId,
    expiresAt,
  };

  if (useRedis && redis) {
    try {
      const key = `${SESSION_PREFIX}${sessionToken}`;

      if (redisClientType === 'upstash') {
        await (redis as UpstashRedis).set(key, JSON.stringify(session), {
          ex: Math.ceil(SESSION_DURATION / 1000),
        });
      } else if (redisClientType === 'standard') {
        await (redis as IORedis).set(key, JSON.stringify(session), 'PX', SESSION_DURATION);
      } else {
        agentSessions.set(sessionToken, session);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to persist agent session in Redis', { error: errorMessage }, 'AgentAuth');
      agentSessions.set(sessionToken, session);
    }
  } else {
    agentSessions.set(sessionToken, session);
  }

  return session;
}

/**
 * Verify agent session token
 */
export async function verifyAgentSession(sessionToken: string): Promise<{ agentId: string } | null> {
  if (useRedis && redis) {
    try {
      const key = `${SESSION_PREFIX}${sessionToken}`;
      let stored: unknown = null;

      if (redisClientType === 'upstash') {
        stored = await (redis as UpstashRedis).get<string | null>(key);
      } else if (redisClientType === 'standard') {
        stored = await (redis as IORedis).get(key);
      }

      if (typeof stored === 'string') {
        const session = JSON.parse(stored) as AgentSession;
        if (Date.now() <= session.expiresAt) {
          return { agentId: session.agentId };
        }
        // Session expirée : suppression best-effort
        try {
          if (redisClientType === 'upstash') {
            await (redis as UpstashRedis).del(key);
          } else if (redisClientType === 'standard') {
            await (redis as IORedis).del(key);
          }
        } catch {
          // Ignore cleanup errors
        }
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to read agent session from Redis', { error: errorMessage }, 'AgentAuth');
      // Fallback en mémoire
    }
  }

  const session = agentSessions.get(sessionToken);

  if (!session) {
    return null;
  }

  if (Date.now() > session.expiresAt) {
    agentSessions.delete(sessionToken);
    return null;
  }

  return { agentId: session.agentId };
}

/**
 * Get session duration in milliseconds
 */
export function getSessionDuration(): number {
  return SESSION_DURATION;
}
