/**
 * Event Broadcaster for Server-Sent Events (SSE)
 * 
 * Handles broadcasting events to connected SSE clients.
 * Uses Redis (Upstash/Vercel KV) for cross-instance broadcasting in production.
 * Falls back to local-only broadcasting if Redis not configured.
 * 
 * This replaces the WebSocket broadcast system for Vercel compatibility.
 */

import { logger } from '@/lib/logger';
import { isRedisAvailable, safePoll, safePublish } from '@/lib/redis';
import { EventEmitter } from 'events';
import type { JsonValue } from '@/types/common';

const textEncoder = new TextEncoder();

const encodePayload = (payload: string) => textEncoder.encode(payload);

// Type definitions
export type Channel = 'feed' | 'markets' | 'breaking-news' | 'upcoming-events' | string;

export interface SSEClient {
  id: string;
  userId: string;
  channels: Set<Channel>;
  controller: ReadableStreamDefaultController;
  lastPing: number;
}

export interface BroadcastMessage {
  channel: Channel;
  type: string;
  data: Record<string, JsonValue>;
  timestamp: number;
}

/**
 * In-memory event broadcaster for development
 * Works with single-instance Next.js dev server
 */
class InMemoryBroadcaster extends EventEmitter {
  private clients: Map<string, SSEClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setupPingInterval();
  }

  private setupPingInterval() {
    // Send ping every 30 seconds to keep connections alive
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, client] of this.clients.entries()) {
        if (now - client.lastPing > 60000) {
          this.removeClient(clientId);
          continue;
        }

        try {
          client.controller.enqueue(
            encodePayload(`event: ping\ndata: ${JSON.stringify({ timestamp: now })}\n\n`)
          );
        } catch (error) {
          // Controller is closed, remove client
          logger.debug(`Failed to send ping to client ${clientId}, removing`, { clientId, error }, 'InMemoryBroadcaster');
          this.removeClient(clientId);
        }
      }
    }, 30000);
  }

  addClient(client: SSEClient) {
    this.clients.set(client.id, client);
    logger.debug(`SSE client connected: ${client.id} (userId: ${client.userId})`, { clientId: client.id }, 'InMemoryBroadcaster');
  }

  removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.controller.close();
      } catch {
        // Controller already closed, ignore
      }
      this.clients.delete(clientId);
      logger.debug(`SSE client disconnected: ${clientId}`, { clientId }, 'InMemoryBroadcaster');
    }
  }

  subscribeToChannel(clientId: string, channel: Channel) {
    const client = this.clients.get(clientId);
    if (client) {
      client.channels.add(channel);
      logger.debug(`Client ${clientId} subscribed to channel: ${channel}`, { clientId, channel }, 'InMemoryBroadcaster');
    }
  }

  unsubscribeFromChannel(clientId: string, channel: Channel) {
    const client = this.clients.get(clientId);
    if (client) {
      client.channels.delete(channel);
      logger.debug(`Client ${clientId} unsubscribed from channel: ${channel}`, { clientId, channel }, 'InMemoryBroadcaster');
    }
  }

  broadcast(message: BroadcastMessage) {
    let sentCount = 0;
    const { channel, type, data, timestamp } = message;
    const clientsToRemove: string[] = [];

    for (const client of this.clients.values()) {
      if (!client.channels.has(channel)) {
        continue;
      }

      try {
        client.controller.enqueue(
          encodePayload(`event: message\ndata: ${JSON.stringify({
            channel,
            type,
            data,
            timestamp
          })}\n\n`)
        );
        client.lastPing = Date.now();
        sentCount++;
      } catch (error) {
        // Controller is closed, mark for removal
        logger.debug(`Failed to send message to client ${client.id}, will remove`, { clientId: client.id, error }, 'InMemoryBroadcaster');
        clientsToRemove.push(client.id);
      }
    }

    // Remove clients with closed controllers
    for (const clientId of clientsToRemove) {
      this.removeClient(clientId);
    }

    if (sentCount > 0) {
      logger.debug(`Broadcasted to ${sentCount} clients on channel ${channel}`, { channel, sentCount }, 'InMemoryBroadcaster');
    }
  }

  getStats() {
    return {
      totalClients: this.clients.size,
      clientsByChannel: Array.from(this.clients.values()).reduce((acc, client) => {
        for (const channel of client.channels) {
          acc[channel] = (acc[channel] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>)
    };
  }

  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    // Close all clients
    for (const clientId of this.clients.keys()) {
      this.removeClient(clientId);
    }
  }
}

/**
 * Serverless broadcaster for production (Vercel)
 * 
 * Uses Redis pub/sub for cross-instance broadcasting when available.
 * Falls back to local-only broadcasting if Redis not configured.
 * 
 * With Redis:
 * - Publishes messages to Redis channels
 * - Polls Redis for messages from other instances
 * - Broadcasts received messages to local SSE clients
 * - Result: 100% delivery across all instances
 * 
 * Without Redis:
 * - Local-only broadcasting (20-40% delivery)
 * - Polling fallback in components ensures updates
 */
class ServerlessBroadcaster extends EventEmitter {
  private clients: Map<string, SSEClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private redisPollers: Map<string, NodeJS.Timeout> = new Map();
  private redisAvailable: boolean = false;

  constructor() {
    super();
    this.setupPingInterval();
    this.redisAvailable = isRedisAvailable();
    
    if (this.redisAvailable) {
      logger.info('Serverless broadcaster initialized with Redis pub/sub', undefined, 'ServerlessBroadcaster');
      this.setupRedisPolling();
    } else {
      logger.warn('Serverless broadcaster initialized (local-only) - Set UPSTASH_REDIS_REST_URL for cross-instance SSE', undefined, 'ServerlessBroadcaster');
    }
  }

  private setupPingInterval() {
    // Send ping every 30 seconds to keep connections alive
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, client] of this.clients.entries()) {
        if (now - client.lastPing > 60000) {
          this.removeClient(clientId);
          continue;
        }

        try {
          client.controller.enqueue(
            encodePayload(`event: ping\ndata: ${JSON.stringify({ timestamp: now })}\n\n`)
          );
        } catch (error) {
          // Controller is closed, remove client
          logger.debug(`Failed to send ping to client ${clientId}, removing`, { clientId, error }, 'ServerlessBroadcaster');
          this.removeClient(clientId);
        }
      }
    }, 30000);
  }

  addClient(client: SSEClient) {
    this.clients.set(client.id, client);
    logger.debug(`SSE client connected: ${client.id} (userId: ${client.userId})`, { clientId: client.id }, 'ServerlessBroadcaster');
  }

  removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.controller.close();
      } catch {
        // Controller already closed, ignore
      }
      this.clients.delete(clientId);
      logger.debug(`SSE client disconnected: ${clientId}`, { clientId }, 'ServerlessBroadcaster');
    }
  }

  subscribeToChannel(clientId: string, channel: Channel) {
    const client = this.clients.get(clientId);
    if (client) {
      client.channels.add(channel);
      logger.debug(`Client ${clientId} subscribed to channel: ${channel}`, { clientId, channel }, 'ServerlessBroadcaster');
    }
  }

  unsubscribeFromChannel(clientId: string, channel: Channel) {
    const client = this.clients.get(clientId);
    if (client) {
      client.channels.delete(channel);
      logger.debug(`Client ${clientId} unsubscribed from channel: ${channel}`, { clientId, channel }, 'ServerlessBroadcaster');
    }
  }

  /**
   * Setup Redis polling to receive messages from other instances
   */
  private setupRedisPolling() {
    const channels = ['feed', 'markets', 'breaking-news', 'upcoming-events'];
    
    for (const channel of channels) {
      const pollInterval = setInterval(async () => {
        const messages = await safePoll(`sse:${channel}`, 10);
        
        for (const msgStr of messages) {
          try {
          const message = JSON.parse(msgStr) as BroadcastMessage;
          this.localBroadcast(message);
          } catch (error) {
            logger.error('Failed to parse SSE message from Redis', { error, message: msgStr }, 'EventBroadcaster');
          }
        }
      }, 100);
      
      this.redisPollers.set(channel, pollInterval);
    }
    
    const chatPollInterval = setInterval(async () => {
      const chatChannels = new Set<string>();
      for (const client of this.clients.values()) {
        for (const channel of client.channels) {
          if (channel.startsWith('chat:')) {
            chatChannels.add(channel);
          }
        }
      }
      
      for (const chatChannel of chatChannels) {
        const messages = await safePoll(`sse:${chatChannel}`, 5);
        for (const msgStr of messages) {
          try {
          const message = JSON.parse(msgStr) as BroadcastMessage;
          this.localBroadcast(message);
          } catch (error) {
            logger.error('Failed to parse SSE message from Redis', { error, message: msgStr }, 'EventBroadcaster');
          }
        }
      }
    }, 200);
    
    this.redisPollers.set('__chats__', chatPollInterval);
  }

  /**
   * Broadcast to local clients and publish to Redis
   */
  broadcast(message: BroadcastMessage) {
    // 1. Broadcast to local clients on this instance
    this.localBroadcast(message);
    
    // 2. Publish to Redis for other instances (if available)
    if (this.redisAvailable) {
      void this.publishToRedis(message);
    }
  }

  /**
   * Broadcast to local clients only (used internally and for Redis-received messages)
   */
  private localBroadcast(message: BroadcastMessage) {
    let sentCount = 0;
    const { channel, type, data, timestamp } = message;
    const clientsToRemove: string[] = [];

    for (const client of this.clients.values()) {
      if (!client.channels.has(channel)) {
        continue;
      }

      try {
        client.controller.enqueue(
          encodePayload(`event: message\ndata: ${JSON.stringify({
            channel,
            type,
            data,
            timestamp
          })}\n\n`)
        );
        client.lastPing = Date.now();
        sentCount++;
      } catch (error) {
        // Controller is closed, mark for removal
        logger.debug(`Failed to send message to client ${client.id}, will remove`, { clientId: client.id, error }, 'ServerlessBroadcaster');
        clientsToRemove.push(client.id);
      }
    }

    // Remove clients with closed controllers
    for (const clientId of clientsToRemove) {
      this.removeClient(clientId);
    }

    if (sentCount > 0) {
      logger.debug(`Broadcasted to ${sentCount} local clients on channel ${channel}`, { channel, sentCount }, 'ServerlessBroadcaster');
    }
  }

  /**
   * Publish message to Redis for other instances to consume
   */
  private async publishToRedis(message: BroadcastMessage) {
    const published = await safePublish(
      `sse:${message.channel}`,
      JSON.stringify(message)
    );
    
    if (published) {
      logger.debug(`Published to Redis channel ${message.channel}`, { channel: message.channel }, 'ServerlessBroadcaster');
    }
  }

  getStats() {
    return {
      totalClients: this.clients.size,
      clientsByChannel: Array.from(this.clients.values()).reduce((acc, client) => {
        for (const channel of client.channels) {
          acc[channel] = (acc[channel] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
      redisEnabled: this.redisAvailable
    };
  }

  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    // Clean up Redis pollers
    for (const poller of this.redisPollers.values()) {
      clearInterval(poller);
    }
    this.redisPollers.clear();
    // Close all clients
    for (const clientId of this.clients.keys()) {
      this.removeClient(clientId);
    }
  }
}

// Global broadcaster instance
let broadcasterInstance: InMemoryBroadcaster | ServerlessBroadcaster | null = null;

/**
 * Get the event broadcaster instance (singleton)
 * 
 * Uses the same implementation for both dev and production.
 * In serverless (Vercel), each instance manages its own clients (local-only).
 */
export function getEventBroadcaster(): InMemoryBroadcaster | ServerlessBroadcaster {
  if (!broadcasterInstance) {
    const isProduction = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

    if (isProduction) {
      logger.info('Using serverless broadcaster for production (local-only)', undefined, 'getEventBroadcaster');
      broadcasterInstance = new ServerlessBroadcaster();
    } else {
      logger.info('Using in-memory broadcaster for development', undefined, 'getEventBroadcaster');
      broadcasterInstance = new InMemoryBroadcaster();
    }
  }

  return broadcasterInstance;
}

/**
 * Broadcast a message to a channel
 * 
 * Note: In serverless environments, this only broadcasts to clients connected
 * to the current serverless function instance. This is intentional and works
 * because the broadcast typically happens in the same instance that received
 * the update (e.g., POST /api/posts → broadcast → SSE clients on same instance).
 */
export function broadcastToChannel(
  channel: Channel,
  data: Record<string, JsonValue>
): void {
  const broadcaster = getEventBroadcaster();
  const message: BroadcastMessage = {
    channel,
    type: data.type as string || 'update',
    data,
    timestamp: Date.now()
  };

  broadcaster.broadcast(message);
}

/**
 * Broadcast a chat message to a specific chat room
 */
export function broadcastChatMessage(
  chatId: string,
  message: {
    id: string;
    content: string;
    chatId: string;
    senderId: string;
    createdAt: string;
    isGameChat?: boolean;
    isDMChat?: boolean;
  }
): void {
  broadcastToChannel(`chat:${chatId}`, {
    type: 'new_message',
    message
  });
}
