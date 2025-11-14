'use client'

import { logger } from '@/lib/logger'
import { useState, useEffect } from 'react'
import { X, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

interface CreatePostModalProps {
  isOpen: boolean
  onClose: () => void
  onPostCreated?: () => void
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
      await response.json()
      setContent('')
      // Pass the created post data to the callback
      onPostCreated?.()
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
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal - Mobile */}
      <div className="fixed inset-x-4 top-20 bottom-auto z-50 md:hidden bg-background border border-border p-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Create Post</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prompt */}
        <p className="text-muted-foreground mb-4">What&apos;s happening in Babylon?</p>

        {/* Text Area */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your thoughts..."
            className={cn(
              'flex-1 w-full p-4 border border-border',
              'bg-background text-foreground',
              'resize-none focus:outline-none focus:ring-2 focus:ring-primary',
              'placeholder:text-muted-foreground'
            )}
            rows={8}
            maxLength={280}
          />

          {/* Character count */}
          <div className="flex items-center justify-between mt-2 mb-4">
            <span className="text-sm text-muted-foreground">
              {content.length}/280
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className={cn(
              'w-full py-3 px-4 font-semibold',
              'bg-primary text-primary-foreground',
              'hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200',
              'flex items-center justify-center gap-2'
            )}
          >
            <Send className="w-5 h-5" />
            <span>Post</span>
          </button>
        </form>
      </div>

      {/* Modal - Desktop */}
      <div className="hidden md:flex fixed inset-0 z-50 items-center justify-center">
        <div className="bg-background border border-border p-6 w-full max-w-[600px] max-h-[80vh] flex flex-col mx-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Create Post</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Prompt */}
          <p className="text-muted-foreground mb-4">What&apos;s happening in Babylon?</p>

          {/* Text Area */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts..."
              className={cn(
                'flex-1 w-full p-4 border border-border',
                'bg-background text-foreground',
                'resize-none focus:outline-none focus:ring-2 focus:ring-primary',
                'placeholder:text-muted-foreground'
              )}
              rows={8}
              maxLength={280}
            />

            {/* Character count */}
            <div className="flex items-center justify-between mt-2 mb-4">
              <span className="text-sm text-muted-foreground">
                {content.length}/280
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className={cn(
                'w-full py-3 px-4 font-semibold',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-all duration-200',
                'flex items-center justify-center gap-2'
              )}
            >
              <Send className="w-5 h-5" />
              <span>Post</span>
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

