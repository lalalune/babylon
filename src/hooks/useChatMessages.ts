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
  const previousChatIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef<Set<string>>(new Set());

  // Load existing messages from API
  const loadMessages = useCallback(async (chatId: string) => {
    // Skip if already loaded
    if (hasLoadedRef.current.has(chatId)) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const response = await fetch(`/api/chats/${chatId}`);
    if (response.ok) {
      const data = await response.json();
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
        setMessages(formattedMessages);
        hasLoadedRef.current.add(chatId);
        logger.debug(`Loaded ${formattedMessages.length} messages for chat ${chatId}`, { chatId, count: formattedMessages.length }, 'useChatMessages');
      }
    }
    setIsLoading(false);
  }, []);

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
        loadMessages(chatId);
      } else {
        setIsLoading(false);
        setMessages([]);
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
    addMessage,
    clearMessages,
    reloadMessages,
    isConnected
  };
}

