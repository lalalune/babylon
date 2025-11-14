/**
 * Server-Sent Events (SSE) API
 * 
 * @description
 * Real-time event streaming endpoint using Server-Sent Events (SSE).
 * Provides live updates for feeds, markets, chats, and news without
 * requiring WebSocket connections. Vercel-compatible alternative to
 * traditional WebSockets with automatic reconnection support.
 * 
 * **Supported Channels:**
 * - **feed:** New posts and social feed updates
 * - **markets:** Market price changes and trading activity
 * - **breaking-news:** Breaking news and important announcements
 * - **upcoming-events:** New prediction questions and events
 * - **chat:{chatId}:** Real-time chat messages for specific chat ID
 * 
 * **Features:**
 * - Multi-channel subscription (comma-separated)
 * - Automatic keepalive pings (every 15 seconds)
 * - Graceful disconnection handling
 * - Client reconnection support
 * - Per-user authentication
 * - Channel-based access control
 * 
 * **Connection Lifecycle:**
 * 1. Client connects with auth token and channels
 * 2. Server sends `connected` event with client ID
 * 3. Server broadcasts events to subscribed channels
 * 4. Server sends periodic `:ping` keepalives
 * 5. Client or server closes connection when done
 * 6. Client auto-reconnects if connection lost
 * 
 * **Vercel Compatibility:**
 * - Uses Server-Sent Events (not WebSocket)
 * - Works with serverless functions
 * - No persistent connections required
 * - Auto-reconnection on timeout
 * 
 * @openapi
 * /api/sse/events:
 *   get:
 *     tags:
 *       - Real-time
 *     summary: Subscribe to real-time events
 *     description: Opens Server-Sent Events stream for live updates (Vercel-compatible)
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Authentication token (Privy JWT)
 *       - in: query
 *         name: channels
 *         schema:
 *           type: string
 *         description: Comma-separated channels (feed,markets,breaking-news,etc)
 *         example: feed,markets
 *     responses:
 *       200:
 *         description: SSE event stream (text/event-stream)
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: Server-Sent Events stream
 *       401:
 *         description: Unauthorized
 * 
 * @example
 * ```typescript
 * // Subscribe to multiple channels
 * const eventSource = new EventSource(
 *   `/api/sse/events?token=${token}&channels=feed,markets`
 * );
 * 
 * // Handle connected event
 * eventSource.addEventListener('connected', (e) => {
 *   const { clientId, channels } = JSON.parse(e.data);
 *   console.log(`Connected as ${clientId} to: ${channels.join(', ')}`);
 * });
 * 
 * // Handle new posts
 * eventSource.addEventListener('new_post', (e) => {
 *   const post = JSON.parse(e.data);
 *   addPostToFeed(post);
 * });
 * 
 * // Handle market updates
 * eventSource.addEventListener('market_update', (e) => {
 *   const { marketId, price } = JSON.parse(e.data);
 *   updateMarketPrice(marketId, price);
 * });
 * 
 * // Handle errors and reconnection
 * eventSource.onerror = () => {
 *   console.log('Connection lost, reconnecting...');
 *   // EventSource auto-reconnects
 * };
 * 
 * // Close connection when done
 * eventSource.close();
 * ```
 * 
 * **Event Types:**
 * - `connected`: Initial connection confirmation
 * - `new_post`: New post in feed
 * - `market_update`: Market price change
 * - `chat_message`: New chat message
 * - `breaking_news`: Breaking news alert
 * - `:ping`: Keepalive ping (every 15s)
 * 
 * @see {@link /lib/sse/event-broadcaster} Event broadcaster
 * @see {@link /src/hooks/useSSE} SSE React hook
 */

import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware';
import { getEventBroadcaster, type SSEClient, type Channel } from '@/lib/sse/event-broadcaster';
import { SSEChannelsQuerySchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';
import { generateSnowflakeId } from '@/lib/snowflake';

// Vercel function configuration
export const maxDuration = 300; // 5 minutes max for SSE connections

// Disable buffering for SSE
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const queryParams = {
    token: searchParams.get('token'),
    channels: searchParams.get('channels')
  }
  
  const validatedQuery = SSEChannelsQuerySchema.parse(queryParams)
  const token = validatedQuery.token!

  const modifiedRequest = new NextRequest(request.url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  const user = await authenticate(modifiedRequest)
  
  const channelsParam = validatedQuery.channels
  const channels = channelsParam ? channelsParam.split(',') as Channel[] : ['feed']

  logger.info(`SSE connection request from user ${user.userId} for channels: ${channels.join(', ')}`, { userId: user.userId, channels }, 'SSE')

  const encoder = new TextEncoder()
  const clientId = await generateSnowflakeId()
  
  let pingIntervalId: NodeJS.Timeout | null = null
  // const isStreamClosed = false

  const stream = new ReadableStream({
    start: async (controller) => {
      const client: SSEClient = {
        id: clientId,
        userId: user.userId,
        channels: new Set(channels),
        controller,
        lastPing: Date.now()
      }

      const broadcaster = getEventBroadcaster()
      broadcaster.addClient(client)

      for (const channel of channels) {
        broadcaster.subscribeToChannel(clientId, channel)
      }

      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ 
          clientId, 
          channels: Array.from(client.channels),
          timestamp: Date.now() 
        })}\n\n`)
      )

      logger.warn(`Failed to send connected event, controller closed: ${clientId}`, { clientId }, 'SSE')
      broadcaster.removeClient(clientId)

      pingIntervalId = setInterval(() => {
        if (pingIntervalId) clearInterval(pingIntervalId)

        controller.enqueue(
          encoder.encode(`:ping ${Date.now()}\n\n`)
        )

        if (pingIntervalId) clearInterval(pingIntervalId)
        broadcaster.removeClient(clientId)
        logger.debug(`Failed to send ping, controller closed: ${clientId}`, { clientId }, 'SSE')
      }, 15000)

      request.signal.addEventListener('abort', () => {
        if (pingIntervalId) clearInterval(pingIntervalId)
        broadcaster.removeClient(clientId)
        logger.info(`SSE client disconnected (abort signal): ${clientId}`, { clientId, userId: user.userId }, 'SSE')
      })
    },
    
    cancel() {
      if (pingIntervalId) clearInterval(pingIntervalId)
      const broadcaster = getEventBroadcaster()
      broadcaster.removeClient(clientId)
      logger.info(`SSE client disconnected (cancel): ${clientId}`, { clientId }, 'SSE')
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
