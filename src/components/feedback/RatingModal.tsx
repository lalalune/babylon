/**
 * RatingModal Component
 *
 * Modal wrapper for feedback/rating submission
 * Triggered after game completion, trades, or manual user interaction
 *
 * Pattern based on: PositionDetailModal.tsx
 */

'use client'

import { useEffect, useState } from 'react'
import { X, Star, Trophy, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FeedbackForm } from './FeedbackForm'
import { ReputationBadge } from '../reputation/ReputationBadge'

interface RatingModalProps {
  isOpen: boolean
  onClose: () => void
  toUserId: string
  toUserName?: string
  toUserReputation?: number
  context?: {
    type: 'game' | 'trade' | 'social' | 'general'
    gameId?: string
    tradeId?: string
    positionId?: string
    description?: string
  }
  onSuccess?: () => void
}

export function RatingModal({
  isOpen,
  onClose,
  toUserId,
  toUserName,
  toUserReputation,
  context,
  onSuccess,
}: RatingModalProps) {
  const [showThankYou, setShowThankYou] = useState(false)

  useEffect(() => {
    // Reset thank you state when modal opens
    if (isOpen) {
      setShowThankYou(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSuccess = () => {
    setShowThankYou(true)
    setTimeout(() => {
      onClose()
      if (onSuccess) {
        onSuccess()
      }
    }, 2000)
  }

  const getCategoryFromType = (
    type?: string
  ): 'game_performance' | 'trade_execution' | 'social_interaction' | 'general' => {
    switch (type) {
      case 'game':
        return 'game_performance'
      case 'trade':
        return 'trade_execution'
      case 'social':
        return 'social_interaction'
      default:
        return 'general'
    }
  }

  const getContextIcon = () => {
    switch (context?.type) {
      case 'game':
        return Trophy
      case 'trade':
        return Target
      case 'social':
        return Star
      default:
        return Star
    }
  }

  const getContextTitle = (): string => {
    switch (context?.type) {
      case 'game':
        return 'Rate Game Performance'
      case 'trade':
        return 'Rate Trading Experience'
      case 'social':
        return 'Rate Interaction'
      default:
        return 'Submit Feedback'
    }
  }

  const ContextIcon = getContextIcon()

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl max-w-lg w-full border border-border max-h-[90vh] overflow-y-auto">
        {showThankYou ? (
          /* Thank You State */
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
              <Star className="w-8 h-8 text-green-500" fill="currentColor" />
            </div>
            <h3 className="text-2xl font-bold text-foreground">Thank You!</h3>
            <p className="text-muted-foreground">
              Your feedback has been submitted and will help improve the community.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1c9cf0]/20 rounded-full flex items-center justify-center">
                  <ContextIcon className="w-5 h-5 text-[#1c9cf0]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {getContextTitle()}
                  </h2>
                  {context?.description && (
                    <p className="text-sm text-muted-foreground">{context.description}</p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                <div className="flex-1">
                  <div className="font-semibold text-foreground">
                    {toUserName || 'Unknown User'}
                  </div>
                  {toUserReputation !== undefined && (
                    <div className="mt-1">
                      <ReputationBadge
                        reputationPoints={toUserReputation}
                        size="sm"
                        showLabel={true}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Feedback Form */}
              <FeedbackForm
                toUserId={toUserId}
                toUserName={toUserName}
                category={getCategoryFromType(context?.type)}
                interactionType={
                  context?.type === 'game' || context?.type === 'trade'
                    ? 'game_to_agent'
                    : 'user_to_agent'
                }
                gameId={context?.gameId}
                tradeId={context?.tradeId}
                onSuccess={handleSuccess}
                onCancel={onClose}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * QuickRatingButton Component
 *
 * Quick action button to open rating modal
 */
interface QuickRatingButtonProps {
  userId: string
  userName?: string
  userReputation?: number
  context?: RatingModalProps['context']
  onSuccess?: () => void
  className?: string
  variant?: 'default' | 'compact' | 'icon'
}

export function QuickRatingButton({
  userId,
  userName,
  userReputation,
  context,
  onSuccess,
  className = '',
  variant = 'default',
}: QuickRatingButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleOpen = () => setIsOpen(true)
  const handleClose = () => setIsOpen(false)

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={handleOpen}
          className={cn(
            'p-2 hover:bg-muted rounded-lg transition-colors',
            className
          )}
          aria-label="Rate this user"
        >
          <Star className="w-4 h-4 text-yellow-500" />
        </button>
        <RatingModal
          isOpen={isOpen}
          onClose={handleClose}
          toUserId={userId}
          toUserName={userName}
          toUserReputation={userReputation}
          context={context}
          onSuccess={onSuccess}
        />
      </>
    )
  }

  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleOpen}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors',
            'bg-muted hover:bg-muted/70 text-foreground',
            className
          )}
        >
          <Star className="w-3 h-3" />
          <span>Rate</span>
        </button>
        <RatingModal
          isOpen={isOpen}
          onClose={handleClose}
          toUserId={userId}
          toUserName={userName}
          toUserReputation={userReputation}
          context={context}
          onSuccess={onSuccess}
        />
      </>
    )
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className={cn(
          'flex items-center gap-2 px-4 py-3 rounded-lg font-semibold transition-colors',
          'bg-[#1c9cf0] hover:bg-[#1c9cf0]/90 text-primary-foreground',
          className
        )}
      >
        <Star className="w-4 h-4" />
        <span>Rate Performance</span>
      </button>
      <RatingModal
        isOpen={isOpen}
        onClose={handleClose}
        toUserId={userId}
        toUserName={userName}
        toUserReputation={userReputation}
        context={context}
        onSuccess={onSuccess}
      />
    </>
  )
}
