/**
 * FeedbackForm Component
 *
 * Form for submitting user feedback/ratings
 * Supports star ratings, score sliders, and text comments
 *
 * Pattern based on: LinkSocialAccountsModal.tsx
 */

'use client'

import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { StarRatingInput } from './StarRating'
import { ScoreSlider } from './ScoreSlider'

interface FeedbackFormProps {
  toUserId: string
  toUserName?: string
  category?: 'game_performance' | 'trade_execution' | 'social_interaction' | 'general'
  interactionType?: string
  gameId?: string
  tradeId?: string
  onSuccess?: () => void
  onCancel?: () => void
  className?: string
}

export function FeedbackForm({
  toUserId,
  toUserName,
  category = 'general',
  interactionType = 'user_to_agent',
  gameId,
  tradeId,
  onSuccess,
  onCancel,
  className = '',
}: FeedbackFormProps) {
  const [score, setScore] = useState<number>(70) // 0-100, default 70 (3.5 stars)
  const [comment, setComment] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (score < 0 || score > 100) {
      toast.error('Please select a valid rating')
      return
    }

    setSubmitting(true)

    try {
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          toUserId,
          score,
          comment: comment.trim() || null,
          category,
          interactionType,
          metadata: {
            gameId: gameId || undefined,
            tradeId: tradeId || undefined,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to submit feedback' }))
        throw new Error(error.error || 'Failed to submit feedback')
      }

      const data = await response.json()

      toast.success(data.message || 'Feedback submitted successfully!')

      // Reset form
      setScore(70)
      setComment('')

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit feedback'
      toast.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      {/* Rating Input */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          Rate {toUserName || 'this user'}
        </label>
        <StarRatingInput value={score} onChange={setScore} showDescriptions={true} />
        <div className="text-xs text-muted-foreground">
          Or use the slider for more precise control:
        </div>
        <ScoreSlider
          value={score}
          onChange={setScore}
          showValue={true}
          showLabels={true}
        />
      </div>

      {/* Comment Input */}
      <div className="space-y-2">
        <label htmlFor="comment" className="text-sm font-medium text-foreground">
          Comments (optional)
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your thoughts..."
          maxLength={500}
          rows={4}
          className={cn(
            'w-full px-3 py-2 bg-muted rounded-lg border border-border',
            'text-foreground placeholder-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-[#1c9cf0] focus:border-transparent',
            'resize-none transition-colors'
          )}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Maximum 500 characters</span>
          <span>{comment.length}/500</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-colors',
            'bg-[#1c9cf0] hover:bg-[#1c9cf0]/90 text-white',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Submit Feedback</span>
            </>
          )}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={cn(
              'px-4 py-3 rounded-lg font-semibold transition-colors',
              'bg-muted hover:bg-muted/70 text-foreground',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
