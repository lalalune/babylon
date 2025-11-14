'use client'

import { LoginButton } from '@/components/auth/LoginButton'
import { Avatar } from '@/components/shared/Avatar'
import { BouncingLogo } from '@/components/shared/BouncingLogo'
import { PageContainer } from '@/components/shared/PageContainer'
import { Separator } from '@/components/shared/Separator'
import { ChatListSkeleton } from '@/components/shared/Skeleton'
import { TaggedText } from '@/components/shared/TaggedText'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useA2A } from '@/hooks/useA2A'
import { useAuth } from '@/hooks/useAuth'
import { useChatMessages } from '@/hooks/useChatMessages'
import { useChatParam } from '@/hooks/useChatParam'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { usePrivy } from '@privy-io/react-auth'
import { AlertCircle, ArrowLeft, Check, Loader2, LogOut, MessageCircle, MoreVertical, Search, Send, Users, X } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

type ChatFilter = 'all' | 'dms' | 'groups'

interface Chat {
  id: string
  name: string
  isGroup: boolean
  lastMessage?: {
    id: string
    content: string
    createdAt: string
  } | null
  messageCount?: number
  qualityScore?: number
  participants?: number
  updatedAt: string
  otherUser?: {
    id: string
    displayName: string | null
    username: string | null
    profileImageUrl: string | null
  }
}

interface Message {
  id: string
  content: string
  senderId: string
  createdAt: string
}

interface ChatDetails {
  chat: {
    id: string
    name: string | null
    isGroup: boolean
    createdAt: string
    updatedAt: string
  }
  messages: Message[]
  participants: Array<{
    id: string
    displayName: string
    username?: string
    profileImageUrl?: string
  }>
}

export default function ChatsPage() {
  const { ready, authenticated } = useAuth()
  const { user } = useAuthStore()
  const { getAccessToken } = usePrivy()
  useA2A()
  useChatParam()
  
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [allChats, setAllChats] = useState<Chat[]>([])
  const [chatDetails, setChatDetails] = useState<ChatDetails | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [_loading, setLoading] = useState(true)
  const [loadingChat, setLoadingChat] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [isLeaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [isLeavingChat, setIsLeavingChat] = useState(false)
  const [leaveChatError, setLeaveChatError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement | null>(null)
  
  // Use SSE for real-time messages
  const { messages: realtimeMessages, isConnected: sseConnected } = useChatMessages(selectedChatId)
  
  // Pull-to-refresh state
  const {
    pullDistance,
    containerRef: setPullToRefreshRef,
  } = usePullToRefresh({
    onRefresh: async () => {
      if (!selectedChatId) return
      try {
        await loadChatDetails(selectedChatId)
      } catch (error) {
        console.error('Error refreshing chat details:', error)
      }
    },
  })

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      chatContainerRef.current = node
      setPullToRefreshRef(node)
    },
    [setPullToRefreshRef]
  )

  // Debug mode: enabled in localhost
  const isDebugMode = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  
  // Function declarations (before useEffects that use them)
  const loadChats = useCallback(async () => {
    setLoading(true)
    
    if (isDebugMode) {
      const response = await fetch('/api/chats?all=true')
      const data = await response.json()
      setAllChats(data.chats || [])
      setLoading(false)
      return
    }

    const token = await getAccessToken()
    if (!token) {
      console.error('Failed to get access token for loadChats')
      setLoading(false)
      return
    }

    const response = await fetch('/api/chats', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await response.json()

    // Combine both groups and DMs into a single list
    const combined = [
      ...(data.groupChats || []),
      ...(data.directChats || [])
    ].sort((a, b) => {
      // Sort by last message time (most recent first)
      const aTime = a.lastMessage?.createdAt || a.updatedAt
      const bTime = b.lastMessage?.createdAt || b.updatedAt
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })
    
    setAllChats(combined)
    setLoading(false)
  }, [getAccessToken, isDebugMode])

  const loadNewDMChat = useCallback(async (chatId: string, targetUserId: string) => {
    setLoadingChat(true)
    
    try {
      const token = await getAccessToken()
      if (!token) {
        console.error('Failed to get access token')
        setLoadingChat(false)
        return
      }

      // Fetch target user info
      const response = await fetch(`/api/users/${targetUserId}/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      if (!response.ok) {
        console.error('Failed to load user info')
        setLoadingChat(false)
        return
      }

      const userData = await response.json()
      const targetUser = userData.user
      
      // Create a virtual chat details object for new DM
      setChatDetails({
        chat: {
          id: chatId,
          name: null,
          isGroup: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        messages: [],
        participants: [
          {
            id: user!.id,
            displayName: user!.displayName || user!.username || 'You',
            username: user!.username,
            profileImageUrl: user!.profileImageUrl,
          },
          {
            id: targetUser.id,
            displayName: targetUser.displayName || targetUser.username || 'User',
            username: targetUser.username,
            profileImageUrl: targetUser.profileImageUrl,
          },
        ],
      })
      
      // Add to chat list immediately so it shows up
      const newChat: Chat = {
        id: chatId,
        name: targetUser.displayName || targetUser.username || 'User',
        isGroup: false,
        lastMessage: null,
        updatedAt: new Date().toISOString(),
        otherUser: {
          id: targetUser.id,
          displayName: targetUser.displayName,
          username: targetUser.username,
          profileImageUrl: targetUser.profileImageUrl,
        },
      }
      
      setAllChats(prev => {
        // Check if chat already exists
        if (prev.some(c => c.id === chatId)) {
          return prev
        }
        return [newChat, ...prev]
      })
    } catch (error) {
      console.error('Error loading new DM:', error)
    } finally {
      setLoadingChat(false)
    }
  }, [getAccessToken, user])

  const loadChatDetails = useCallback(async (chatId: string) => {
    setLoadingChat(true)
    
    if (isDebugMode) {
      const response = await fetch(`/api/chats/${chatId}?debug=true`)
      const data = await response.json()
      setChatDetails({
        ...data,
        chat: data.chat || null,
        messages: data.messages || [],
        participants: data.participants || [],
      })
      setLoadingChat(false)
      return
    }

    const token = await getAccessToken()
    if (!token) {
      console.error('Failed to get access token for loadChatDetails')
      setLoadingChat(false)
      return
    }

    const response = await fetch(`/api/chats/${chatId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    
    // If chat doesn't exist yet (404), it's a new DM that hasn't been persisted
    if (response.status === 404) {
      // Chat will be created when first message is sent
      setLoadingChat(false)
      return
    }
    
    if (!response.ok) {
      console.error('Failed to load chat details')
      setLoadingChat(false)
      return
    }
    
    const data = await response.json()
    setChatDetails({
      ...data,
      chat: data.chat || null,
      messages: data.messages || [],
      participants: data.participants || [],
    })
    setLoadingChat(false)
  }, [getAccessToken, isDebugMode])
  
  // Check for chat ID in URL query params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const chatParam = params.get('chat')
      const newDMParam = params.get('newDM')
      
      if (chatParam && chatParam !== selectedChatId) {
        setSelectedChatId(chatParam)
        
        // If this is a new DM, load the target user info
        if (newDMParam && chatParam.startsWith('dm-')) {
          loadNewDMChat(chatParam, newDMParam)
        }
        
        // Clean up URL
        window.history.replaceState({}, '', '/chats')
      }
    }
  }, [selectedChatId, loadNewDMChat])
  
  // Load user's chats from database
  useEffect(() => {
    if (authenticated || isDebugMode) {
      loadChats()
    }
  }, [authenticated, isDebugMode, loadChats])

  // Load selected chat details from database
  useEffect(() => {
    if (selectedChatId) {
      loadChatDetails(selectedChatId)
    }
  }, [selectedChatId, loadChatDetails])

  // Update chatDetails with realtime messages
  useEffect(() => {
    if (chatDetails && realtimeMessages.length > 0) {
      setChatDetails(prev => {
        if (!prev) return prev
        return {
          ...prev,
          messages: realtimeMessages
        }
      })
    }
  }, [realtimeMessages, chatDetails])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatDetails?.messages])

  const handleLeaveChat = async () => {
    if (!selectedChatId) return
    setIsLeavingChat(true)
    setLeaveChatError(null)

    const accessToken = await getAccessToken()
    if (!accessToken) {
      setLeaveChatError('Authentication failed. Please try again.')
      setIsLeavingChat(false)
      return
    }

    try {
      const response = await fetch(`/api/chats/${selectedChatId}/participants/me`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to leave chat')
      }

      setLeaveConfirmOpen(false)
      setSelectedChatId(null)
      await loadChats() // Refresh the chat list
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.'
      setLeaveChatError(errorMessage)
    } finally {
      setIsLeavingChat(false)
    }
  }

  const sendMessage = async () => {
    if (!selectedChatId || !messageInput.trim() || sending) return

    setSending(true)
    setSendError(null)
    setSendSuccess(false)

    const token = await getAccessToken()
    if (!token) {
      console.error('Failed to get access token for sendMessage')
      setSendError('Authentication required. Please log in again.')
      setSending(false)
      return
    }

    try {
      const response = await fetch(`/api/chats/${selectedChatId}/message`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: messageInput.trim() }),
      })

      const data = await response.json()

      if (data.warnings && data.warnings.length > 0) {
        setSendError(data.warnings.join('. '))
        setTimeout(() => setSendError(null), 5000)
      } else {
        setSendSuccess(true)
        setTimeout(() => setSendSuccess(false), 2000)
      }

      // SSE will handle adding the message in real-time
      setMessageInput('')
      void loadChats() // Refresh chat list to update last message
    } catch (error) {
      setSendError('Failed to send message. Please try again.')
      console.error('Send message error:', error)
    }
    
    setSending(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Filter chats based on active filter
  const filteredByType = activeFilter === 'all' 
    ? allChats 
    : activeFilter === 'dms'
      ? allChats.filter(c => !c.isGroup)
      : allChats.filter(c => c.isGroup)

  // Apply search filter
  const filteredChats = searchQuery
    ? filteredByType.filter((chat) =>
        chat.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : filteredByType

  // No games loaded state
  if (!ready && !authenticated) {
    return (
      <PageContainer noPadding className="flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md mx-auto p-8 text-center">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2 text-foreground">No Chats Yet</h2>
            <p className="text-muted-foreground mb-4">
              Game is auto-generating in the background...
            </p>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>This happens automatically on first run.</p>
              <p>Check the terminal logs for progress.</p>
              <p className="font-mono text-xs bg-muted p-2 rounded">
                First generation takes 3-5 minutes
              </p>
            </div>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          .chat-card {
            box-shadow: inset 5px 5px 5px rgba(0, 0, 0, 0.1), inset -5px -5px 5px rgba(255, 255, 255, 0.05);
          }

          .chat-button {
            box-shadow: inset 3px 3px 3px rgba(0, 0, 0, 0.1), inset -3px -3px 3px rgba(255, 255, 255, 0.05);
            transition: all 0.3s ease;
          }

          .chat-button:hover:not(:disabled) {
            box-shadow: none;
          }

          .message-input {
            box-shadow: inset 3px 3px 5px rgba(0, 0, 0, 0.15), inset -3px -3px 5px rgba(255, 255, 255, 0.05);
            transition: all 0.3s ease;
          }

          .message-input:focus {
            box-shadow: inset 3px 3px 5px rgba(28, 156, 240, 0.2), inset -3px -3px 5px rgba(28, 156, 240, 0.1);
          }

          .message-bubble {
            box-shadow: 3px 3px 8px rgba(0, 0, 0, 0.15), -3px -3px 8px rgba(255, 255, 255, 0.05);
          }

          .chat-tab {
            box-shadow: inset 3px 3px 5px rgba(0, 0, 0, 0.1), inset -3px -3px 5px rgba(255, 255, 255, 0.05);
            transition: all 0.3s ease;
          }

          .chat-tab-active {
            box-shadow: inset 3px 3px 5px rgba(28, 156, 240, 0.3), inset -3px -3px 5px rgba(28, 156, 240, 0.1);
          }
        `
      }} />
      <PageContainer noPadding className="flex flex-col">
        {/* Desktop: Two Column Layout */}
        <div className="hidden xl:flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <div className="flex h-full">
              {/* Left Column: Chat List with Filters */}
              <div className="w-96 flex flex-col bg-background border-r border-border">
                {/* Header with Filters */}
                <div className="p-4">
                  <h2 className="text-xl font-bold mb-4 text-foreground">Messages</h2>
                  
                  {/* Filter Tabs */}
                  <div className="flex gap-1 p-1 bg-sidebar-accent/30 rounded-lg mb-4">
                    <button
                      onClick={() => setActiveFilter('all')}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all',
                        activeFilter === 'all'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setActiveFilter('dms')}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all',
                        activeFilter === 'dms'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      DMs
                    </button>
                    <button
                      onClick={() => setActiveFilter('groups')}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all',
                        activeFilter === 'groups'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Groups
                    </button>
                  </div>
                  
                  {/* Search Bar */}
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search conversations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={cn(
                        'w-full pl-9 pr-9 py-2 rounded-lg text-sm',
                        'bg-sidebar-accent/50 message-input',
                        'text-foreground placeholder:text-muted-foreground',
                        'outline-none'
                      )}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                      >
                        <X className="w-4 h-4 text-foreground" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto">
                  {_loading ? (
                    <ChatListSkeleton count={10} />
                  ) : filteredChats.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12 px-4">
                      <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">
                        {searchQuery 
                          ? 'No conversations found' 
                          : activeFilter === 'all'
                            ? 'No conversations yet'
                            : activeFilter === 'dms'
                              ? 'No direct messages yet'
                              : 'No group chats yet'
                        }
                      </p>
                      {!searchQuery && activeFilter === 'dms' && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Visit a user&apos;s profile to start a DM
                        </p>
                      )}
                    </div>
                  ) : (
                    filteredChats.map((chat, idx) => (
                      <React.Fragment key={chat.id}>
                        <div
                          onClick={() => setSelectedChatId(chat.id)}
                          className={cn(
                            'p-4 cursor-pointer transition-all duration-300',
                            selectedChatId === chat.id
                              ? 'bg-sidebar-accent/50 border-l-4'
                              : 'hover:bg-sidebar-accent/30',
                          )}
                          style={{
                            borderLeftColor:
                              selectedChatId === chat.id
                                ? '#b82323'
                                : 'transparent',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {chat.isGroup ? (
                              <div className="w-10 h-10 rounded-full bg-sidebar-accent/50 flex items-center justify-center flex-shrink-0 chat-button">
                                <Users className="w-5 h-5" style={{ color: '#b82323' }} />
                              </div>
                            ) : (
                              <Avatar
                                id={chat.otherUser?.id || ''}
                                name={chat.otherUser?.displayName || chat.otherUser?.username || 'User'}
                                type="user"
                                size="md"
                                imageUrl={chat.otherUser?.profileImageUrl || undefined}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm truncate text-foreground">
                                {chat.name}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {chat.lastMessage?.content || 'No messages yet'}
                              </div>
                            </div>
                          </div>
                        </div>
                        {idx < filteredChats.length - 1 && <Separator />}
                      </React.Fragment>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Chat View */}
              <div className="flex-1 flex flex-col bg-background">
                {selectedChatId && chatDetails ? (
                  <>
                    {/* Chat Header */}
                    <div className="p-4 bg-background border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {chatDetails.chat.isGroup ? (
                          <div className="w-10 h-10 rounded-full bg-sidebar-accent/50 flex items-center justify-center">
                            <Users className="w-5 h-5" style={{ color: '#b82323' }} />
                          </div>
                        ) : (
                          <Avatar
                            id={chatDetails.participants.find(p => p.id !== user?.id)?.id || ''}
                            name={chatDetails.participants.find(p => p.id !== user?.id)?.displayName || 'User'}
                            type="user"
                            size="md"
                            imageUrl={chatDetails.participants.find(p => p.id !== user?.id)?.profileImageUrl}
                          />
                        )}
                        <div>
                          <h3 className="text-lg font-bold text-foreground">
                            {chatDetails.chat.name || 
                             chatDetails.participants.find(p => p.id !== user?.id)?.displayName ||
                             'Chat'}
                          </h3>
                          {chatDetails.chat.isGroup && (
                            <p className="text-xs text-muted-foreground">
                              {chatDetails.participants.length} participants
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {chatDetails.chat.isGroup && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setLeaveConfirmOpen(true)}
                              className="text-red-500"
                            >
                              <LogOut className="mr-2 h-4 w-4" />
                              <span>Leave Chat</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {/* Messages */}
                    <div 
                      ref={setRefs}
                      className="flex-1 overflow-y-auto p-4 space-y-4 relative"
                    >
                      {/* Pull-to-refresh indicator */}
                      {pullDistance > 0 && (
                        <div 
                          className="absolute top-0 left-0 right-0 flex items-center justify-center py-2 transition-opacity"
                          style={{ opacity: Math.min(pullDistance / 80, 1) }}
                        >
                          <Loader2 
                            className={cn(
                              "w-6 h-6 text-primary",
                              pullDistance > 80 ? "animate-spin" : ""
                            )} 
                          />
                        </div>
                      )}
                      
                      {loadingChat ? (
                        <div className="flex items-center justify-center h-full">
                          <BouncingLogo size={32} />
                        </div>
                      ) : (
                        (chatDetails?.messages || []).map((msg, i) => {
                          const msgDate = new Date(msg.createdAt)
                          const sender = chatDetails?.participants?.find(
                            (p) => p.id === msg.senderId,
                          )
                          const senderName = sender?.displayName || 'Unknown'
                          const isCurrentUser = user?.id && msg.senderId === user.id

                          return (
                            <div
                              key={i}
                              className={cn(
                                'flex gap-3',
                                isCurrentUser ? 'justify-end' : 'items-start',
                              )}
                            >
                              {!isCurrentUser && (
                                <Avatar
                                  id={msg.senderId}
                                  name={senderName}
                                  type="user"
                                  size="md"
                                  imageUrl={sender?.profileImageUrl}
                                />
                              )}
                              <div
                                className={cn(
                                  'max-w-[70%] flex flex-col',
                                  isCurrentUser ? 'items-end' : 'items-start',
                                )}
                              >
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  {!isCurrentUser && (
                                    <span className="font-bold text-sm text-foreground">
                                      {senderName}
                                    </span>
                                  )}
                                  {!isCurrentUser && (
                                    <span className="text-muted-foreground">
                                      ·
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {msgDate.toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}{' '}
                                    at{' '}
                                    {msgDate.toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    'px-4 py-2 rounded-2xl message-bubble text-sm whitespace-pre-wrap break-words',
                                    isCurrentUser
                                      ? 'rounded-tr-sm'
                                      : 'rounded-tl-sm',
                                  )}
                                  style={{
                                    backgroundColor: isCurrentUser
                                      ? '#0066FF20'
                                      : 'rgba(var(--sidebar-accent), 0.5)',
                                  }}
                                >
                                  <TaggedText
                                    text={msg.content}
                                    onTagClick={(tag) => setSearchQuery(tag)}
                                    className="text-foreground"
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}

                      {(chatDetails?.messages || []).length === 0 && !loadingChat && (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center text-muted-foreground max-w-md p-8">
                            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="mb-2 text-foreground">
                              No messages yet
                            </p>
                            {authenticated && (
                              <p className="text-xs text-muted-foreground">
                                Be the first to send a message!
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Feedback Messages */}
                    {authenticated && (sendError || sendSuccess) && (
                      <div className="px-4">
                        {sendError && (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-sidebar-accent/30 mb-2 border-2" style={{ borderColor: '#f59e0b' }}>
                            <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
                            <span className="text-xs" style={{ color: '#f59e0b' }}>{sendError}</span>
                          </div>
                        )}
                        {sendSuccess && (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-sidebar-accent/30 mb-2 border-2" style={{ borderColor: '#10b981' }}>
                            <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#10b981' }} />
                            <span className="text-xs" style={{ color: '#10b981' }}>Message sent!</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Message Input */}
                    {authenticated ? (
                      <div className="p-4 bg-background border-t border-border">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Type a message..."
                            disabled={sending}
                            className={cn(
                              'flex-1 px-4 py-3 rounded-lg text-sm',
                              'bg-sidebar-accent/50 message-input',
                              'text-foreground placeholder:text-muted-foreground',
                              'outline-none',
                              'disabled:opacity-50 disabled:cursor-not-allowed'
                            )}
                          />
                          <button
                            onClick={sendMessage}
                            disabled={!messageInput.trim() || sending}
                            className={cn(
                              'px-4 py-3 rounded-lg font-semibold flex items-center gap-2',
                              'bg-sidebar-accent/50 chat-button',
                              'transition-all duration-300',
                              'disabled:opacity-50 disabled:cursor-not-allowed'
                            )}
                            style={{ color: '#0066FF' }}
                          >
                            {sending ? (
                              <BouncingLogo size={20} />
                            ) : (
                              <Send className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-background border-t border-border">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-3">Log in to send messages</p>
                          <LoginButton />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-muted-foreground max-w-md p-8">
                      <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-xl font-bold mb-2 text-foreground">
                        Select a chat
                      </h3>
                      <p className="text-sm">
                        Choose a conversation from the list to view messages
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile/Tablet: Responsive Layout */}
        <div className="flex xl:hidden flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <div className="flex h-full">
              {/* Chat List (full screen on mobile, side panel on tablet when chat selected) */}
              <div
                className={cn(
                  'w-full flex-col bg-background',
                  selectedChatId ? 'hidden lg:flex lg:w-96 lg:border-r lg:border-border' : 'flex',
                )}
              >
                {/* Mobile Header with Tabs */}
                <div className="p-4">
                  <h2 className="text-xl font-bold mb-4 text-foreground">Messages</h2>
                  
                  {/* Filter Tabs */}
                  <div className="flex gap-1 p-1 bg-sidebar-accent/30 rounded-lg mb-4">
                    <button
                      onClick={() => setActiveFilter('all')}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all',
                        activeFilter === 'all'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setActiveFilter('dms')}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all',
                        activeFilter === 'dms'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      DMs
                    </button>
                    <button
                      onClick={() => setActiveFilter('groups')}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all',
                        activeFilter === 'groups'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Groups
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search conversations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={cn(
                        'w-full pl-9 pr-9 py-2 rounded-lg text-sm',
                        'bg-sidebar-accent/50 message-input',
                        'text-foreground placeholder:text-muted-foreground',
                        'outline-none'
                      )}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Status Row */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                    <span>
                      {filteredChats.length} {activeFilter === 'all' ? 'conversations' : activeFilter === 'dms' ? 'direct messages' : 'group chats'}
                    </span>
                    {authenticated && selectedChatId && (
                      <div className={cn(
                        'flex items-center gap-1.5',
                        sseConnected ? 'text-green-500' : 'text-yellow-500'
                      )}>
                        <div className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          sseConnected ? 'bg-green-500' : 'bg-yellow-500'
                        )} />
                        <span>{sseConnected ? 'Live' : 'Connecting...'}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto">
                  {_loading ? (
                    <ChatListSkeleton count={10} />
                  ) : filteredChats.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12 px-4">
                      <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">
                        {searchQuery 
                          ? 'No conversations found' 
                          : activeFilter === 'all'
                            ? 'No conversations yet'
                            : activeFilter === 'dms'
                              ? 'No direct messages yet'
                              : 'No group chats yet'
                        }
                      </p>
                      {!searchQuery && activeFilter === 'dms' && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Visit a user&apos;s profile to start a DM
                        </p>
                      )}
                    </div>
                  ) : (
                    filteredChats.map((chat, idx) => (
                      <React.Fragment key={chat.id}>
                        <div
                          onClick={() => setSelectedChatId(chat.id)}
                          className={cn(
                            'p-4 cursor-pointer transition-all duration-300',
                            selectedChatId === chat.id
                              ? 'bg-sidebar-accent/50 border-l-4'
                              : 'hover:bg-sidebar-accent/30',
                          )}
                          style={{
                            borderLeftColor:
                              selectedChatId === chat.id
                                ? '#b82323'
                                : 'transparent',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {chat.isGroup ? (
                              <div className="w-10 h-10 rounded-full bg-sidebar-accent/50 flex items-center justify-center flex-shrink-0 chat-button">
                                <Users className="w-5 h-5" style={{ color: '#b82323' }} />
                              </div>
                            ) : (
                              <Avatar
                                id={chat.otherUser?.id || ''}
                                name={chat.otherUser?.displayName || chat.otherUser?.username || 'User'}
                                type="user"
                                size="md"
                                imageUrl={chat.otherUser?.profileImageUrl || undefined}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm truncate text-foreground">
                                {chat.name}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {chat.lastMessage?.content || 'No messages yet'}
                              </div>
                            </div>
                          </div>
                        </div>
                        {idx < filteredChats.length - 1 && <Separator />}
                      </React.Fragment>
                    ))
                  )}
                </div>
              </div>

              {/* Chat View (full screen on mobile, shared on tablet) */}
              {selectedChatId && chatDetails && (
                <div
                  className={cn(
                    'flex-1 flex-col bg-background',
                    !selectedChatId ? 'hidden lg:flex' : 'flex',
                  )}
                >
                  {/* Mobile/Tablet Header with Back Button */}
                  <div className="p-4 bg-background border-b border-border">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedChatId(null)}
                        className="lg:hidden flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-sidebar-accent/50 transition-colors text-foreground"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                      </button>
                      {chatDetails.chat.isGroup ? (
                        <div className="w-10 h-10 rounded-full bg-sidebar-accent/50 flex items-center justify-center">
                          <Users className="w-5 h-5" style={{ color: '#b82323' }} />
                        </div>
                      ) : (
                        <Avatar
                          id={chatDetails.participants.find(p => p.id !== user?.id)?.id || ''}
                          name={chatDetails.participants.find(p => p.id !== user?.id)?.displayName || 'User'}
                          type="user"
                          size="md"
                          imageUrl={chatDetails.participants.find(p => p.id !== user?.id)?.profileImageUrl}
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-foreground">
                          {chatDetails.chat.name || 
                           chatDetails.participants.find(p => p.id !== user?.id)?.displayName ||
                           'Chat'}
                        </h3>
                        {chatDetails.chat.isGroup && (
                          <p className="text-xs text-muted-foreground">
                            {chatDetails.participants.length} participants
                          </p>
                        )}
                      </div>
                      
                      {chatDetails.chat.isGroup && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setLeaveConfirmOpen(true)}
                              className="text-red-500"
                            >
                              <LogOut className="mr-2 h-4 w-4" />
                              <span>Leave Chat</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loadingChat ? (
                      <div className="flex items-center justify-center h-full">
                        <BouncingLogo size={32} />
                      </div>
                    ) : (
                      (chatDetails?.messages || []).map((msg, i) => {
                        const msgDate = new Date(msg.createdAt)
                        const sender = chatDetails?.participants?.find(
                          (p) => p.id === msg.senderId,
                        )
                        const senderName = sender?.displayName || 'Unknown'
                        const isCurrentUser = user?.id && msg.senderId === user.id

                        return (
                          <div
                            key={i}
                            className={cn(
                              'flex gap-3',
                              isCurrentUser ? 'justify-end' : 'items-start',
                            )}
                          >
                            {!isCurrentUser && (
                              <Avatar
                                id={msg.senderId}
                                name={senderName}
                                type="user"
                                size="md"
                                imageUrl={sender?.profileImageUrl}
                              />
                            )}
                            <div
                              className={cn(
                                'max-w-[70%] flex flex-col',
                                isCurrentUser ? 'items-end' : 'items-start',
                              )}
                            >
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {!isCurrentUser && (
                                  <span className="font-bold text-sm text-foreground">
                                    {senderName}
                                  </span>
                                )}
                                {!isCurrentUser && (
                                  <span className="text-muted-foreground">
                                    ·
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {msgDate.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}{' '}
                                  at{' '}
                                  {msgDate.toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <div
                                className={cn(
                                  'px-4 py-2 rounded-2xl message-bubble text-sm whitespace-pre-wrap break-words',
                                  isCurrentUser
                                    ? 'rounded-tr-sm'
                                    : 'rounded-tl-sm',
                                )}
                                style={{
                                  backgroundColor: isCurrentUser
                                    ? '#0066FF20'
                                    : 'rgba(var(--sidebar-accent), 0.5)',
                                }}
                              >
                                <TaggedText
                                  text={msg.content}
                                  onTagClick={(tag) => setSearchQuery(tag)}
                                  className="text-foreground"
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}

                    {(chatDetails?.messages || []).length === 0 && !loadingChat && (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center text-muted-foreground max-w-md p-8">
                          <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="mb-2 text-foreground">
                            No messages yet
                          </p>
                          {authenticated && (
                            <p className="text-xs text-muted-foreground">
                              Be the first to send a message!
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Feedback Messages */}
                  {authenticated && (sendError || sendSuccess) && (
                    <div className="px-4">
                      {sendError && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-sidebar-accent/30 mb-2 border-2" style={{ borderColor: '#f59e0b' }}>
                          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
                          <span className="text-xs" style={{ color: '#f59e0b' }}>{sendError}</span>
                        </div>
                      )}
                      {sendSuccess && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-sidebar-accent/30 mb-2 border-2" style={{ borderColor: '#10b981' }}>
                          <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#10b981' }} />
                          <span className="text-xs" style={{ color: '#10b981' }}>Message sent!</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Input */}
                  {authenticated ? (
                    <div className="p-4 bg-background border-t border-border">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="Type a message..."
                          disabled={sending}
                          className={cn(
                            'flex-1 px-4 py-3 rounded-lg text-sm',
                            'bg-sidebar-accent/50 message-input',
                            'text-foreground placeholder:text-muted-foreground',
                            'outline-none',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                        />
                        <button
                          onClick={sendMessage}
                          disabled={!messageInput.trim() || sending}
                          className={cn(
                            'px-4 py-3 rounded-lg font-semibold flex items-center gap-2',
                            'bg-sidebar-accent/50 chat-button',
                            'transition-all duration-300',
                            'disabled:opacity-50 disabled:cursor-not-allowed'
                          )}
                          style={{ color: '#0066FF' }}
                        >
                          {sending ? (
                            <BouncingLogo size={20} />
                          ) : (
                            <Send className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-background border-t border-border">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-3">Log in to send messages</p>
                        <LoginButton />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </PageContainer>
      
      {/* Leave Chat Confirmation Dialog */}
      <AlertDialog open={isLeaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to leave this chat?
              </p>
              {leaveChatError && (
                <p className="text-sm text-red-500 mt-2">{leaveChatError}</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setLeaveConfirmOpen(false); setLeaveChatError(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveChat} className={buttonVariants()} disabled={isLeavingChat}>
              {isLeavingChat && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  )
}
