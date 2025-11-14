/**
 * useChatMessages Hook
 * 
 * Manages chat messages with SSE for real-time updates
 * Replaces WebSocket-based useChatMessages from useWebSocket
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSSEChannel } from './useSSE';
import { logger } from '@/lib/logger';

export interface ChatMessage {
  id: string;
  content: string;
  chatId: string;
  senderId: string;
  createdAt: string;
  isGameChat?: boolean;
}

/**
 * Hook for managing chat messages with real-time SSE updates
 */
export function useChatMessages(chatId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const previousChatIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef<Set<string>>(new Set());

  // Load existing messages from API (initial load)
  const loadMessages = useCallback(async (chatId: string) => {
    // Skip if already loaded
    if (hasLoadedRef.current.has(chatId)) {
      console.log(`[useChatMessages] Skipping reload for ${chatId} - already loaded`);
      setIsLoading(false);
      return;
    }

    console.log(`[useChatMessages] Loading initial messages for chat ${chatId}`);
    setIsLoading(true);
    const response = await fetch(`/api/chats/${chatId}?limit=50`);
    console.log(`[useChatMessages] Response status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`[useChatMessages] Response data:`, data);
      if (data.messages) {
        const formattedMessages: ChatMessage[] = data.messages.map((msg: {
          id: string;
          content: string;
          senderId: string;
          createdAt: string | Date;
        }) => ({
          id: msg.id,
          content: msg.content,
          chatId: chatId,
          senderId: msg.senderId,
          createdAt: typeof msg.createdAt === 'string' ? msg.createdAt : msg.createdAt.toISOString(),
        }));
        console.log(`[useChatMessages] Loaded ${formattedMessages.length} messages, hasMore:`, data.pagination?.hasMore);
        setMessages(formattedMessages);
        setHasMore(data.pagination?.hasMore || false);
        setNextCursor(data.pagination?.nextCursor || null);
        hasLoadedRef.current.add(chatId);
        logger.debug(`Loaded ${formattedMessages.length} messages for chat ${chatId}`, { 
          chatId, 
          count: formattedMessages.length,
          hasMore: data.pagination?.hasMore 
        }, 'useChatMessages');
      }
    } else {
      const errorData = await response.json().catch(() => null);
      console.error(`[useChatMessages] Failed to load messages:`, errorData);
    }
    setIsLoading(false);
  }, []);

  // Load more older messages (pagination)
  const loadMore = useCallback(async () => {
    if (!chatId || !nextCursor || isLoadingMore || !hasMore) {
      console.log(`[useChatMessages] Skip loadMore:`, { chatId, nextCursor, isLoadingMore, hasMore });
      return;
    }

    console.log(`[useChatMessages] Loading more messages with cursor: ${nextCursor}`);
    setIsLoadingMore(true);
    
    const response = await fetch(`/api/chats/${chatId}?cursor=${nextCursor}&limit=50`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`[useChatMessages] Loaded ${data.messages?.length} more messages`);
      
      if (data.messages && data.messages.length > 0) {
        const formattedMessages: ChatMessage[] = data.messages.map((msg: {
          id: string;
          content: string;
          senderId: string;
          createdAt: string | Date;
        }) => ({
          id: msg.id,
          content: msg.content,
          chatId: chatId,
          senderId: msg.senderId,
          createdAt: typeof msg.createdAt === 'string' ? msg.createdAt : msg.createdAt.toISOString(),
        }));
        
        // Prepend older messages to the beginning
        setMessages(prev => [...formattedMessages, ...prev]);
        setHasMore(data.pagination?.hasMore || false);
        setNextCursor(data.pagination?.nextCursor || null);
        
        logger.debug(`Loaded ${formattedMessages.length} more messages`, { 
          chatId, 
          count: formattedMessages.length,
          hasMore: data.pagination?.hasMore 
        }, 'useChatMessages');
      }
    } else {
      console.error(`[useChatMessages] Failed to load more messages:`, response.statusText);
    }
    
    setIsLoadingMore(false);
  }, [chatId, nextCursor, isLoadingMore, hasMore]);

  // Handle SSE updates for this chat
  const handleChatUpdate = useCallback((data: Record<string, unknown>) => {
    if (data.type === 'new_message' && data.message) {
      const messageData = data.message as Record<string, unknown>;
      
      // Type guard for ChatMessage
      if (
        typeof messageData.id === 'string' &&
        typeof messageData.content === 'string' &&
        typeof messageData.chatId === 'string' &&
        typeof messageData.senderId === 'string' &&
        typeof messageData.createdAt === 'string'
      ) {
        const newMessage: ChatMessage = {
          id: messageData.id,
          content: messageData.content,
          chatId: messageData.chatId,
          senderId: messageData.senderId,
          createdAt: messageData.createdAt,
          isGameChat: typeof messageData.isGameChat === 'boolean' ? messageData.isGameChat : undefined,
        };

        // Only add message if it's for the current chat
        if (newMessage.chatId === chatId) {
          setIsLoading(false);
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(msg => msg.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage].sort((a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
        }
      }
    }
  }, [chatId]);

  // Subscribe to chat channel
  const channel = chatId ? `chat:${chatId}` : null;
  const { isConnected } = useSSEChannel(channel, handleChatUpdate);

  // Load messages when switching chats
  useEffect(() => {
    const previousChatId = previousChatIdRef.current;
    
    if (previousChatId !== chatId) {
      if (chatId) {
        setMessages([]);
        setHasMore(false);
        setNextCursor(null);
        loadMessages(chatId);
      } else {
        setIsLoading(false);
        setMessages([]);
        setHasMore(false);
        setNextCursor(null);
      }
      previousChatIdRef.current = chatId;
    }
  }, [chatId, loadMessages]);

  // Polling fallback: Refresh chat every 15 seconds
  // Ensures new messages appear even if SSE fails in multi-instance serverless
  useEffect(() => {
    if (!chatId || !hasLoadedRef.current.has(chatId)) return
    
    const interval = setInterval(() => {
      // Silently reload messages (don't show loading state)
      loadMessages(chatId).catch(err => {
        logger.debug('Background chat refresh failed', { error: err, chatId }, 'useChatMessages');
      });
    }, 15000); // 15 seconds (more frequent for chat)
    
    return () => clearInterval(interval);
  }, [chatId, loadMessages]);

  // Mark as loaded when connected
  useEffect(() => {
    if (isConnected && chatId) {
      // Initial loading done - we're ready to receive messages
      setIsLoading(false);
    }
  }, [isConnected, chatId]);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      if (prev.some(msg => msg.id === message.id)) {
        return prev;
      }
      return [...prev, message].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    hasLoadedRef.current.clear();
  }, []);

  const reloadMessages = useCallback(() => {
    if (chatId) {
      hasLoadedRef.current.delete(chatId);
      loadMessages(chatId);
    }
  }, [chatId, loadMessages]);

  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    addMessage,
    clearMessages,
    reloadMessages,
    isConnected
  };
}

