'use client'

import { logger } from '@/lib/logger'
import { useState, useEffect } from 'react'
import { X, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

interface CreatePostModalProps {
  isOpen: boolean
  onClose: () => void
  onPostCreated?: (post: {
    id: string
    content: string
    authorId: string
    authorName: string
    authorUsername?: string | null
    authorDisplayName?: string | null
    authorProfileImageUrl?: string | null
    timestamp: string
  }) => void
}

export function CreatePostModal({ isOpen, onClose, onPostCreated }: CreatePostModalProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { authenticated, user } = useAuth()

  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = ''
      return
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose, isSubmitting])

  // Cleanup on unmount (for HMR)
  useEffect(() => {
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!authenticated || !user || !content.trim()) return

    setIsSubmitting(true)
    // Get auth token from window (set by useAuth hook)
    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
    
    if (!token) {
      alert('Please wait for authentication to complete.')
      setIsSubmitting(false)
      return
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    }

    const response = await fetch('/api/posts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: content.trim(),
      }),
    })

    if (response.ok) {
      let data
      try {
        data = await response.json()
      } catch (error) {
        logger.error('Failed to parse create post response', { error }, 'CreatePostModal')
        alert('Failed to parse response. Please try again.')
        return
      }
      setContent('')
      // Pass the created post data to the callback
      if (data.post) {
        onPostCreated?.(data.post)
      }
      onClose()
    } else {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      logger.error('Failed to create post:', error, 'CreatePostModal')
      alert(error.error || 'Failed to create post. Please try again.')
    }
    setIsSubmitting(false)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal - Mobile */}
      <div className="fixed inset-x-4 top-20 bottom-auto z-50 md:hidden rounded-2xl border border-white/10 bg-[#050816] shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-primary-foreground">Create Post</h2>
            <p className="text-xs text-primary-foreground/60">Share your thoughts with Babylon</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-primary-foreground/70 transition hover:bg-white/10 hover:text-primary-foreground"
            aria-label="Close create post modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-6 py-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening in Babylon?"
            className={cn(
              'flex-1 w-full px-4 py-3 rounded-xl',
              'border border-white/10 bg-white/5',
              'text-primary-foreground placeholder:text-primary-foreground/40',
              'resize-none focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20',
              'transition-colors'
            )}
            rows={8}
            maxLength={280}
          />

          {/* Character count */}
          <div className="flex items-center justify-between mt-3 mb-4">
            <span className={cn(
              'text-sm',
              content.length > 260 ? 'text-red-400' : 'text-primary-foreground/50'
            )}>
              {content.length}/280
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className={cn(
              'w-full py-3 px-4 rounded-xl font-semibold',
              'bg-white text-[#050816]',
              'hover:bg-white/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200',
              'flex items-center justify-center gap-3'
            )}
          >
            {isSubmitting ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#050816]/20 border-t-[#050816]" />
                <span>Posting...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Post</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Modal - Desktop */}
      <div className="hidden md:flex fixed inset-0 z-50 items-center justify-center p-4">
        <div className="rounded-2xl border border-white/10 bg-[#050816] shadow-2xl w-full max-w-feed max-h-[80vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold text-primary-foreground">Create Post</h2>
              <p className="text-xs text-primary-foreground/60">Share your thoughts with Babylon</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-primary-foreground/70 transition hover:bg-white/10 hover:text-primary-foreground"
              aria-label="Close create post modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-6 py-6">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening in Babylon?"
              className={cn(
                'flex-1 w-full px-4 py-3 rounded-xl',
                'border border-white/10 bg-white/5',
                'text-primary-foreground placeholder:text-primary-foreground/40',
                'resize-none focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20',
                'transition-colors'
              )}
              rows={8}
              maxLength={280}
            />

            {/* Character count */}
            <div className="flex items-center justify-between mt-3 mb-4">
              <span className={cn(
                'text-sm',
                content.length > 260 ? 'text-red-400' : 'text-primary-foreground/50'
              )}>
                {content.length}/280
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className={cn(
                'w-full py-3 px-4 rounded-xl font-semibold',
                'bg-white text-[#050816]',
                'hover:bg-white/90',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-all duration-200',
                'flex items-center justify-center gap-3'
              )}
            >
              {isSubmitting ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#050816]/20 border-t-[#050816]" />
                  <span>Posting...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Post</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

