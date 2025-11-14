/**
 * SSE Events Route
 * 
 * Server-Sent Events endpoint for real-time updates
 * Replaces WebSocket for Vercel compatibility
 * 
 * Supports multiple channels:
 * - feed: New posts and feed updates
 * - markets: Market price updates
 * - breaking-news: Breaking news events
 * - upcoming-events: New questions/events
 * - chat:{chatId}: Chat messages for specific chat
 */

import { NextRequest } from 'next/server';
import { authenticate, isAuthenticationError } from '@/lib/api/auth-middleware';
import { getEventBroadcaster, type SSEClient, type Channel } from '@/lib/sse/event-broadcaster';
import { SSEChannelsQuerySchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { ZodError } from 'zod';

// Disable buffering for SSE
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = {
      token: searchParams.get('token'),
      channels: searchParams.get('channels')
    };
    
    const validatedQuery = SSEChannelsQuerySchema.parse(queryParams);
    const token = validatedQuery.token!;

    const modifiedRequest = new NextRequest(request.url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const user = await authenticate(modifiedRequest);
    
    const channelsParam = validatedQuery.channels;
    const channels = channelsParam ? channelsParam.split(',') as Channel[] : ['feed'];

    logger.info(`SSE connection request from user ${user.userId} for channels: ${channels.join(', ')}`, { userId: user.userId, channels }, 'SSE');

    // Create SSE stream
    const encoder = new TextEncoder();
    const clientId = uuidv4();
    
    let pingIntervalId: NodeJS.Timeout | null = null;
    let isStreamClosed = false;

    const stream = new ReadableStream({
      start: async (controller) => {
        const client: SSEClient = {
          id: clientId,
          userId: user.userId,
          channels: new Set(channels),
          controller,
          lastPing: Date.now()
        };

        const broadcaster = getEventBroadcaster();
        broadcaster.addClient(client);

        for (const channel of channels) {
          broadcaster.subscribeToChannel(clientId, channel);
        }

        try {
          controller.enqueue(
            encoder.encode(`event: connected\ndata: ${JSON.stringify({ 
              clientId, 
              channels: Array.from(client.channels),
              timestamp: Date.now() 
            })}\n\n`)
          );
        } catch (error) {
          // Controller is already closed, clean up and return
          logger.warn(`Failed to send connected event, controller closed: ${clientId}`, { clientId, error }, 'SSE');
          broadcaster.removeClient(clientId);
          return;
        }

        pingIntervalId = setInterval(() => {
          if (isStreamClosed) {
            if (pingIntervalId) clearInterval(pingIntervalId);
            return;
          }

          try {
            controller.enqueue(
              encoder.encode(`:ping ${Date.now()}\n\n`)
            );
          } catch (error) {
            // Controller is closed, clean up
            isStreamClosed = true;
            if (pingIntervalId) clearInterval(pingIntervalId);
            broadcaster.removeClient(clientId);
            logger.debug(`Failed to send ping, controller closed: ${clientId}`, { clientId, error }, 'SSE');
          }
        }, 15000);

        request.signal.addEventListener('abort', () => {
          if (!isStreamClosed) {
            isStreamClosed = true;
            if (pingIntervalId) clearInterval(pingIntervalId);
            broadcaster.removeClient(clientId);
            logger.info(`SSE client disconnected (abort signal): ${clientId}`, { clientId, userId: user.userId }, 'SSE');
          }
        });
      },
      
      cancel() {
        if (!isStreamClosed) {
          isStreamClosed = true;
          if (pingIntervalId) clearInterval(pingIntervalId);
          const broadcaster = getEventBroadcaster();
          broadcaster.removeClient(clientId);
          logger.info(`SSE client disconnected (cancel): ${clientId}`, { clientId }, 'SSE');
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    if (isAuthenticationError(error)) {
      return new Response(JSON.stringify({ error: error.message || 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (error instanceof ZodError) {
      return new Response(JSON.stringify({
        error: 'Invalid SSE parameters',
        details: error.issues,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    logger.error('Failed to establish SSE connection', { error }, 'SSE');
    return new Response(JSON.stringify({ error: 'Failed to establish SSE connection' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
