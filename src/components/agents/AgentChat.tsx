'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/shared/Avatar'
import { Send, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  modelUsed?: string
  pointsCost: number
  createdAt: string
}

interface AgentChatProps {
  agent: {
    id: string
    name: string
    profileImageUrl?: string
    pointsBalance: number
    modelTier: 'free' | 'pro'
  }
  onUpdate: () => void
}

export function AgentChat({ agent, onUpdate }: AgentChatProps) {
  const { user, getAccessToken } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [usePro, setUsePro] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchMessages()
  }, [agent.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchMessages = async () => {
    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        setLoading(false)
        return
      }
      
      const res = await fetch(`/api/agents/${agent.id}/chat?limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.ok) {
        const data = await res.json() as { success: boolean; messages: Message[] }
        if (data.success && data.messages) {
          setMessages(data.messages.reverse())
        }
      } else {
        logger.error('Failed to fetch messages', undefined, 'AgentChat')
      }
    } catch (error) {
      logger.error('Error fetching messages', { error }, 'AgentChat')
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || sending) return

    const userMessage = input
    setInput('')
    setSending(true)

    // Optimistically add user message
    const optimisticMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      pointsCost: 0,
      createdAt: new Date().toISOString()
    }
    setMessages(prev => [...prev, optimisticMessage])

    try {
      const token = await getAccessToken()
      if (!token) {
        throw new Error('Authentication required')
      }
      
      const res = await fetch(`/api/agents/${agent.id}/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage,
          usePro
        })
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to send message' })) as { error: string }
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
        toast.error(error.error || 'Failed to send message')
        setSending(false)
        return
      }

      const data = await res.json() as { success: boolean; messageId: string; response: string; modelUsed: string; pointsCost: number }

      if (!data.response || !data.messageId) {
        throw new Error('Invalid response from agent')
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: data.messageId,
        role: 'assistant',
        content: data.response,
        modelUsed: data.modelUsed,
        pointsCost: data.pointsCost,
        createdAt: new Date().toISOString()
      }
      setMessages(prev => [...prev, assistantMessage])

      // Update agent balance
      onUpdate()
      
      toast.success(`Message sent (-${data.pointsCost} points)`)
    } catch (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
      toast.error(errorMessage)
      logger.error('Chat error', { error }, 'AgentChat')
    } finally {
      setSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-[600px] rounded-lg bg-card/50 backdrop-blur border border-border">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Chat with {agent.name}</h3>
          <p className="text-sm text-muted-foreground">{agent.pointsBalance} points available</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUsePro(!usePro)}
            disabled={agent.modelTier === 'free'}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
              usePro
                ? 'bg-[#0066FF] text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            )}
          >
            <Sparkles className="w-4 h-4" />
            {usePro ? 'Pro Mode' : 'Free Mode'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            Loading chat history...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p className="mb-2">No messages yet</p>
            <p className="text-sm">Start a conversation with your agent!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <Avatar
                  id={agent.id}
                  name={agent.name}
                  type="user"
                  size="sm"
                  src={agent.profileImageUrl}
                  imageUrl={agent.profileImageUrl}
                />
              )}
              
              <div
                className={cn(
                  'max-w-[70%] rounded-lg p-3',
                  message.role === 'user'
                    ? 'bg-[#0066FF] text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <div className="flex items-center gap-2 mt-1 text-xs opacity-70">
                  <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                  {message.modelUsed && (
                    <>
                      <span>•</span>
                      <span>{message.modelUsed}</span>
                    </>
                  )}
                  {message.pointsCost > 0 && (
                    <>
                      <span>•</span>
                      <span>{message.pointsCost}pts</span>
                    </>
                  )}
                </div>
              </div>

              {message.role === 'user' && user && (
                <Avatar
                  id={user.id}
                  name={user.displayName || user.email || 'You'}
                  type="user"
                  size="sm"
                  src={user.profileImageUrl}
                  imageUrl={user.profileImageUrl}
                />
              )}
            </div>
          ))
        )}
        {sending && (
          <div className="flex gap-3 justify-start">
            <Avatar
              id={agent.id}
              name={agent.name}
              type="user"
              size="sm"
              src={agent.profileImageUrl}
              imageUrl={agent.profileImageUrl}
            />
            <div className="bg-muted rounded-lg p-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        {agent.pointsBalance < 1 ? (
          <div className="text-center text-red-600 text-sm py-2">
            Insufficient points. Please deposit points to continue chatting.
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={sending}
              className="flex-1"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending || agent.pointsBalance < 1}
              className="px-4 py-2 rounded-lg bg-[#0066FF] hover:bg-[#2952d9] text-primary-foreground font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

