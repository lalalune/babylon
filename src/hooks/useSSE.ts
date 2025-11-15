/**
 * useSSE Hook
 *
 * Replaces useWebSocket for Server-Sent Events (SSE)
 * Provides automatic reconnection and channel subscription
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { usePrivy } from '@privy-io/react-auth';

import { logger } from '@/lib/logger';

export type Channel =
  | 'feed'
  | 'markets'
  | 'breaking-news'
  | 'upcoming-events'
  | string;

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
  subscribe: (
    channel: Channel,
    callback: (message: SSEMessage) => void
  ) => void;
  unsubscribe: (channel: Channel) => void;
  reconnect: () => void;
}

type SSECallback = (message: SSEMessage) => void;
type ConnectionListener = (connected: boolean, error: string | null) => void;

const channelSubscribers = new Map<Channel, Set<SSECallback>>();
const requestedChannels = new Set<Channel>();
let connectedChannels = new Set<Channel>();
let globalEventSource: EventSource | null = null;
let connecting = false;
let reconnectAttempts = 0;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let lastConnectionError: string | null = null;
let pendingTokenRetry: ReturnType<typeof setTimeout> | null = null;
const connectionListeners = new Set<ConnectionListener>();
let getAccessTokenRef: (() => Promise<string | null>) | null = null;
let authenticatedRef = false;
let autoReconnectRef = true;
let reconnectDelayRef = 3000;
let maxReconnectAttemptsRef = 5;

const hasBrowserEnv = () =>
  typeof window !== 'undefined' && typeof EventSource !== 'undefined';

const notifyConnectionStatus = (connected: boolean, error: string | null) => {
  lastConnectionError = error;
  connectionListeners.forEach((listener) => {
    listener(connected, error);
  });
};

const closeEventSource = () => {
  if (pendingTokenRetry) {
    clearTimeout(pendingTokenRetry);
    pendingTokenRetry = null;
  }

  if (globalEventSource) {
    globalEventSource.close();
    globalEventSource = null;
  }

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  connectedChannels.clear();
  connecting = false;
};

const scheduleTokenRetry = () => {
  if (pendingTokenRetry || !authenticatedRef) {
    return;
  }

  const delay = Math.min(reconnectDelayRef, 1000);
  pendingTokenRetry = setTimeout(() => {
    pendingTokenRetry = null;
    void ensureConnection();
  }, delay);
};

const channelsInSync = () => {
  if (!globalEventSource || globalEventSource.readyState !== EventSource.OPEN) {
    return false;
  }

  if (connectedChannels.size !== requestedChannels.size) {
    return false;
  }

  for (const channel of requestedChannels) {
    if (!connectedChannels.has(channel)) {
      return false;
    }
  }

  return true;
};

async function ensureConnection(forceReconnect = false) {
  if (!hasBrowserEnv()) return;
  if (!authenticatedRef) return;
  if (requestedChannels.size === 0) {
    closeEventSource();
    notifyConnectionStatus(false, null);
    return;
  }

  if (!forceReconnect && channelsInSync()) {
    notifyConnectionStatus(true, null);
    return;
  }

  if (connecting) {
    return;
  }

  const getToken = getAccessTokenRef;
  if (!getToken) {
    notifyConnectionStatus(false, 'Missing access token for SSE');
    return;
  }

  connecting = true;
  closeEventSource();

  const token = await getToken().catch((error) => {
    logger.warn('SSE: failed to obtain access token', { error }, 'useSSE');
    return null;
  });

  if (!token) {
    connecting = false;
    notifyConnectionStatus(false, 'Missing access token for SSE');
    scheduleTokenRetry();
    return;
  }

  const channelsList = Array.from(requestedChannels);
  const url = `${window.location.origin}/api/sse/events?channels=${encodeURIComponent(channelsList.join(','))}&token=${encodeURIComponent(token)}`;

  logger.debug(
    'Connecting to SSE endpoint...',
    { channels: channelsList.join(',') },
    'useSSE'
  );

  const eventSource = new EventSource(url);

  eventSource.onopen = () => {
    connecting = false;
    globalEventSource = eventSource;
    connectedChannels = new Set(requestedChannels);
    reconnectAttempts = 0;
    notifyConnectionStatus(true, null);
    logger.info('SSE connected', { channels: channelsList }, 'useSSE');
  };

  eventSource.addEventListener('message', (event) => {
    try {
      const message: SSEMessage = JSON.parse(event.data);
      const subs = channelSubscribers.get(message.channel);
      if (subs && subs.size > 0) {
        subs.forEach((callback) => {
          callback(message);
        });
      }
    } catch (error) {
      logger.error('Failed to parse SSE message', { error, data: event.data }, 'useSSE');
    }
  });

  eventSource.onerror = () => {
    connecting = false;
    notifyConnectionStatus(false, 'SSE connection error');
    logger.warn(
      'SSE connection lost, scheduling reconnect',
      undefined,
      'useSSE'
    );
    closeEventSource();

    if (!autoReconnectRef) {
      return;
    }

    if (reconnectAttempts >= maxReconnectAttemptsRef) {
      notifyConnectionStatus(
        false,
        'Unable to connect to real-time updates. Please refresh the page.'
      );
      logger.error(
        'SSE: Max reconnection attempts reached',
        undefined,
        'useSSE'
      );
      return;
    }

    const baseDelay = reconnectDelayRef * Math.pow(2, reconnectAttempts);
    const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
    const delay = Math.min(baseDelay + jitter, 30000);

    reconnectAttempts += 1;
    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      void ensureConnection();
    }, delay);
  };

  globalEventSource = eventSource;
}

export function useSSE(options: SSEHookOptions = {}): SSEHookReturn {
  const {
    channels: _initialChannels = [],
    autoReconnect = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const { getAccessToken, authenticated } = usePrivy();
  const [isConnected, setIsConnected] = useState(() =>
    Boolean(
      globalEventSource && globalEventSource.readyState === EventSource.OPEN
    )
  );
  const [error, setError] = useState<string | null>(lastConnectionError);

  const subscriptionsRef = useRef<
    Map<Channel, Set<(message: SSEMessage) => void>>
  >(new Map());

  useEffect(() => {
    getAccessTokenRef = getAccessToken;
    autoReconnectRef = autoReconnect;
    reconnectDelayRef = reconnectDelay;
    maxReconnectAttemptsRef = maxReconnectAttempts;
  }, [getAccessToken, autoReconnect, reconnectDelay, maxReconnectAttempts]);

  useEffect(() => {
    authenticatedRef = authenticated;
    if (!authenticated) {
      closeEventSource();
      notifyConnectionStatus(false, null);
      return;
    }

    if (requestedChannels.size > 0) {
      void ensureConnection();
    }
  }, [authenticated]);

  useEffect(() => {
    const listener: ConnectionListener = (connectedState, connectionError) => {
      setIsConnected(connectedState);
      setError(connectionError);
    };

    connectionListeners.add(listener);

    return () => {
      connectionListeners.delete(listener);
    };
  }, []);

  const subscribe = useCallback(
    (channel: Channel, callback: (message: SSEMessage) => void) => {
      if (!channel) return;

      if (!subscriptionsRef.current.has(channel)) {
        subscriptionsRef.current.set(channel, new Set());
      }
      const refSubs = subscriptionsRef.current.get(channel);
      if (refSubs) {
        refSubs.add(callback);
      }

      if (!channelSubscribers.has(channel)) {
        channelSubscribers.set(channel, new Set());
      }
      const globalSubs = channelSubscribers.get(channel);
      if (globalSubs) {
        globalSubs.add(callback);
      }

      const previousSize = requestedChannels.size;
      requestedChannels.add(channel);

      logger.debug(`Subscribed to channel: ${channel}`, { channel }, 'useSSE');

      if (!globalEventSource || previousSize !== requestedChannels.size) {
        void ensureConnection();
      } else if (!connectedChannels.has(channel)) {
        void ensureConnection(true);
      }
    },
    []
  );

  const unsubscribe = useCallback((channel: Channel) => {
    const hookSubscribers = subscriptionsRef.current.get(channel);
    if (!hookSubscribers) return;

    const globalSubscribers = channelSubscribers.get(channel);
    if (globalSubscribers) {
      hookSubscribers.forEach((callback) => {
        globalSubscribers.delete(callback);
      });

      if (globalSubscribers.size === 0) {
        channelSubscribers.delete(channel);
        requestedChannels.delete(channel);
      }
    }

    hookSubscribers.clear();
    subscriptionsRef.current.delete(channel);

    logger.debug(
      `Unsubscribed from channel: ${channel}`,
      { channel },
      'useSSE'
    );

    if (requestedChannels.size === 0) {
      closeEventSource();
      notifyConnectionStatus(false, null);
    } else if (!channelsInSync()) {
      void ensureConnection(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach((_, channel) => {
        unsubscribe(channel);
      });
      subscriptionsRef.current.clear();
    };
  }, [unsubscribe]);

  const reconnect = useCallback(() => {
    reconnectAttempts = 0;
    closeEventSource();
    void ensureConnection(true);
  }, []);

  return {
    isConnected,
    error,
    subscribe,
    unsubscribe,
    reconnect,
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
    channels: channel ? [channel] : [],
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
