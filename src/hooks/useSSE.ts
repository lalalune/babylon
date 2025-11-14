/**
 * useSSE Hook
 * 
 * Replaces useWebSocket for Server-Sent Events (SSE)
 * Provides automatic reconnection and channel subscription
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { logger } from '@/lib/logger';

export type Channel = 'feed' | 'markets' | 'breaking-news' | 'upcoming-events' | string;

export interface SSEMessage {
  channel: Channel;
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface SSEHookOptions {
  channels?: Channel[];
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

interface SSEHookReturn {
  isConnected: boolean;
  error: string | null;
  subscribe: (channel: Channel, callback: (message: SSEMessage) => void) => void;
  unsubscribe: (channel: Channel) => void;
  reconnect: () => void;
}

// Global EventSource to avoid multiple connections
interface GlobalSSEType {
  __babylon_sse_source__?: EventSource | null;
  __babylon_sse_subscribers__?: number;
}
const getGlobal = (): GlobalSSEType => (globalThis as typeof globalThis & GlobalSSEType);

export function useSSE(options: SSEHookOptions = {}): SSEHookReturn {
  const {
    channels = [],
    autoReconnect = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5
  } = options;

  const { getAccessToken } = usePrivy();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const subscriptionsRef = useRef<Map<Channel, Set<(message: SSEMessage) => void>>>(new Map());
  const channelsRef = useRef<Set<Channel>>(new Set(channels));

  const connect = useCallback(async () => {
    // Skip if not in browser environment
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    // Check if already connected
    const g = getGlobal();
    const existing = g.__babylon_sse_source__;
    if (existing && existing.readyState === EventSource.OPEN) {
      eventSourceRef.current = existing;
      setIsConnected(true);
      setError(null);
      g.__babylon_sse_subscribers__ = (g.__babylon_sse_subscribers__ || 0) + 1;
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setError(null); // Not an error, user just not authenticated
      return;
    }

    // Build SSE URL with channels and token
    // Note: EventSource doesn't support custom headers, so we pass token as query param
    const channelsList = Array.from(channelsRef.current).join(',');
    const sseUrl = `${window.location.origin}/api/sse/events?channels=${encodeURIComponent(channelsList)}&token=${encodeURIComponent(token)}`;

    logger.debug('Connecting to SSE endpoint...', { channels: channelsList }, 'useSSE');

    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      logger.info('SSE connected', undefined, 'useSSE');
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
    };

    eventSource.addEventListener('connected', (event) => {
      const data = JSON.parse(event.data);
      logger.debug('SSE connection confirmed:', data, 'useSSE');
    });

    eventSource.addEventListener('message', (event) => {
      const message: SSEMessage = JSON.parse(event.data);
      
      // Dispatch to channel subscribers
      const subscribers = subscriptionsRef.current.get(message.channel);
      if (subscribers) {
        subscribers.forEach(callback => {
          callback(message);
        });
      }
    });

    eventSource.onerror = () => {
      setIsConnected(false);

      if (eventSource.readyState === EventSource.CLOSED) {
        logger.warn('SSE connection closed', undefined, 'useSSE');

        // Attempt to reconnect with exponential backoff and jitter
        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          // Exponential backoff: base * 2^attempts
          const exponentialDelay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          // Add jitter (±25%) to prevent thundering herd
          const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
          const delay = Math.min(exponentialDelay + jitter, 30000);
          
          logger.debug(`Reconnecting SSE in ${Math.round(delay)}ms... (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`, undefined, 'useSSE');

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError('Unable to connect to real-time updates. Please refresh the page.');
          logger.error('SSE: Max reconnection attempts reached', undefined, 'useSSE');
        }
      }
    };

    eventSourceRef.current = eventSource;
    
    // Store globally
    g.__babylon_sse_source__ = eventSource;
    g.__babylon_sse_subscribers__ = (g.__babylon_sse_subscribers__ || 0) + 1;
  }, [getAccessToken, autoReconnect, reconnectDelay, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const g = getGlobal();
    g.__babylon_sse_subscribers__ = Math.max(0, (g.__babylon_sse_subscribers__ || 0) - 1);

    // Close the connection immediately if this is the last subscriber
    // This prevents navigation blocking
    if (g.__babylon_sse_subscribers__ === 0 && g.__babylon_sse_source__) {
      try {
        g.__babylon_sse_source__.close();
      } catch (err) {
        // Ignore errors during close
        logger.debug('Error closing SSE connection', { error: err }, 'useSSE');
      }
      g.__babylon_sse_source__ = null;
      logger.debug('SSE connection closed (no more subscribers)', undefined, 'useSSE');
    }

    // Clear local reference immediately
    if (eventSourceRef.current) {
      eventSourceRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const subscribe = useCallback((channel: Channel, callback: (message: SSEMessage) => void) => {
    if (!subscriptionsRef.current.has(channel)) {
      subscriptionsRef.current.set(channel, new Set());
    }
    subscriptionsRef.current.get(channel)!.add(callback);
    channelsRef.current.add(channel);
    
    logger.debug(`Subscribed to channel: ${channel}`, { channel }, 'useSSE');
  }, []);

  const unsubscribe = useCallback((channel: Channel) => {
    const subscribers = subscriptionsRef.current.get(channel);
    if (subscribers) {
      subscribers.clear();
      subscriptionsRef.current.delete(channel);
    }
    channelsRef.current.delete(channel);
    
    logger.debug(`Unsubscribed from channel: ${channel}`, { channel }, 'useSSE');
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect, disconnect]);

  // Auto-connect on mount
  useEffect(() => {
    let mounted = true;
    let cleanup = false;
    
    getAccessToken()
      .then(token => {
        if (token && mounted && !cleanup) {
          connect();
        }
      })
      .catch(() => {
        // Silently fail if not authenticated
      });

    // Cleanup function
    return () => {
      mounted = false;
      cleanup = true;
      
      // Force immediate disconnect to prevent blocking navigation
      // Note: NavigationManager also handles this proactively during route changes
      disconnect();
      
      // Clear any pending reconnect attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect, disconnect, getAccessToken]); // Only run once on mount

  return {
    isConnected,
    error,
    subscribe,
    unsubscribe,
    reconnect
  };
}

/**
 * Hook for subscribing to a specific channel
 */
export function useSSEChannel(
  channel: Channel | null,
  onMessage: (data: Record<string, unknown>) => void
) {
  const { isConnected, subscribe, unsubscribe } = useSSE({
    channels: channel ? [channel] : []
  });

  const onMessageRef = useRef(onMessage);
  const callbackRef = useRef<((message: SSEMessage) => void) | null>(null);
  
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!channel) return;

    const callback = (message: SSEMessage) => {
      if (message.channel === channel) {
        onMessageRef.current(message.data);
      }
    };

    callbackRef.current = callback;
    subscribe(channel, callback);

    return () => {
      if (callbackRef.current) {
        unsubscribe(channel);
        callbackRef.current = null;
      }
    };
  }, [channel, subscribe, unsubscribe]); // Only re-subscribe when channel changes

  return { isConnected };
}

