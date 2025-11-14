/**
 * ShareEarnModal Component
 * 
 * Modal for sharing content to X and Farcaster with points tracking
 */

import { useState, useEffect } from 'react'
import { X as XIcon, Twitter, Check, Lock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { logger } from '@/lib/logger'

// Farcaster icon component
function FarcasterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1000 1000" fill="currentColor">
      <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z"/>
      <path d="M128.889 253.333L157.778 351.111H182.222V844.444H128.889V253.333Z"/>
      <path d="M871.111 253.333L842.222 351.111H817.778V844.444H871.111V253.333Z"/>
    </svg>
  )
}

interface ShareEarnModalProps {
  isOpen: boolean
  onClose: () => void
  contentType: 'post' | 'profile' | 'market' | 'referral' | 'leaderboard'
  contentId?: string
  url?: string
  text?: string
}

interface ShareStatus {
  twitter: { shared: boolean; earned: boolean; loading: boolean }
  farcaster: { shared: boolean; earned: boolean; loading: boolean }
}

export function ShareEarnModal({
  isOpen,
  onClose,
  contentType,
  contentId,
  url,
  text,
}: ShareEarnModalProps) {
  const { authenticated, user } = useAuth()
  const [shareStatus, setShareStatus] = useState<ShareStatus>({
    twitter: { shared: false, earned: false, loading: false },
    farcaster: { shared: false, earned: false, loading: false },
  })
  const [isTwitterConfigured, setIsTwitterConfigured] = useState(true) // Default to true, check on mount

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')
  const shareText = text || 'Check this out!'

  // Check configuration and existing shares on mount
  useEffect(() => {
    if (isOpen) {
      checkConfiguration()
      if (authenticated && user) {
        checkExistingShares()
      }
    }
  }, [isOpen, authenticated, user])

  const checkConfiguration = async () => {
    try {
      const response = await fetch('/api/auth/credentials/status')
      if (response.ok) {
        const data = await response.json() as { twitter?: boolean; farcaster?: boolean }
        setIsTwitterConfigured(data.twitter || false)
      } else {
        logger.warn('Failed to check credentials status', { status: response.status }, 'ShareEarnModal')
        // Default to true to not block users if check fails
        setIsTwitterConfigured(true)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to check credentials status', { 
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined 
      }, 'ShareEarnModal')
      // Default to true to not block users if check fails
      setIsTwitterConfigured(true)
    }
  }

  const checkExistingShares = async () => {
    if (!user) return

    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
    if (!token) return

    try {
      // Check for existing share actions
      // This would require a new API endpoint or passing this data in
      // For now, we'll check locally based on the response when sharing
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to check existing shares', { 
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined 
      }, 'ShareEarnModal')
    }
  }

  const trackShare = async (platform: 'twitter' | 'farcaster'): Promise<boolean> => {
    if (!authenticated || !user) {
      logger.warn('User not authenticated, cannot track share', undefined, 'ShareEarnModal')
      return false
    }

    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
    if (!token) {
      logger.warn('No access token available', undefined, 'ShareEarnModal')
      return false
    }

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          contentType,
          contentId,
          url: shareUrl,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const pointsAwarded = data.points?.awarded > 0
        const alreadyAwarded = data.points?.alreadyAwarded
        
        if (pointsAwarded) {
          logger.info(
            `Earned ${data.points.awarded} points for sharing to ${platform}`,
            { platform, points: data.points.awarded },
            'ShareEarnModal'
          )
        }
        
        return pointsAwarded || alreadyAwarded
      }
    } catch (error) {
      logger.error('Failed to track share', { error, platform }, 'ShareEarnModal')
    }
    
    return false
  }

  const handleShareToTwitter = async () => {
    if (shareStatus.twitter.shared || shareStatus.twitter.loading) return

    setShareStatus(prev => ({
      ...prev,
      twitter: { ...prev.twitter, loading: true }
    }))

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
    window.open(twitterUrl, '_blank', 'width=550,height=420')
    
    const earned = await trackShare('twitter')
    
    setShareStatus(prev => ({
      ...prev,
      twitter: { shared: true, earned, loading: false }
    }))
  }

  const handleShareToFarcaster = async () => {
    if (shareStatus.farcaster.shared || shareStatus.farcaster.loading) return

    setShareStatus(prev => ({
      ...prev,
      farcaster: { ...prev.farcaster, loading: true }
    }))

    const castText = `${shareText}\n\n${shareUrl}`
    const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}`
    window.open(warpcastUrl, '_blank', 'width=550,height=600')
    
    const earned = await trackShare('farcaster')
    
    setShareStatus(prev => ({
      ...prev,
      farcaster: { shared: true, earned, loading: false }
    }))
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">Share & Earn</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <XIcon className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-400 mb-4">
              Share to earn +1000 points per platform
            </p>

            {/* Twitter Share */}
            <button
              onClick={handleShareToTwitter}
              disabled={!isTwitterConfigured || shareStatus.twitter.shared || shareStatus.twitter.loading}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all ${
                !isTwitterConfigured
                  ? 'bg-gray-800/50 border-gray-700/50 cursor-not-allowed opacity-60'
                  : shareStatus.twitter.shared
                  ? 'bg-green-500/10 border-green-500/30 cursor-not-allowed'
                  : shareStatus.twitter.loading
                  ? 'bg-gray-800 border-gray-700 cursor-wait'
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-750 cursor-pointer'
              }`}
            >
              <Twitter className={`w-6 h-6 ${
                !isTwitterConfigured 
                  ? 'text-gray-600' 
                  : shareStatus.twitter.shared 
                  ? 'text-blue-400' 
                  : 'text-gray-400'
              }`} />
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-semibold ${!isTwitterConfigured ? 'text-gray-500' : 'text-white'}`}>
                    Share to X
                  </h3>
                  {!isTwitterConfigured && (
                    <span className="text-xs px-2 py-0.5 bg-gray-700/50 text-gray-400 rounded">
                      Coming Soon
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {!isTwitterConfigured
                    ? 'Twitter integration coming soon'
                    : shareStatus.twitter.loading
                    ? 'Processing...'
                    : shareStatus.twitter.shared
                    ? shareStatus.twitter.earned
                      ? 'Already earned points'
                      : 'Shared'
                    : 'Share your profile'}
                </p>
              </div>
              {!isTwitterConfigured ? (
                <Lock className="w-5 h-5 text-gray-600" />
              ) : shareStatus.twitter.shared ? (
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  {shareStatus.twitter.earned && (
                    <span className="text-xs font-semibold text-green-500">+1000</span>
                  )}
                </div>
              ) : null}
            </button>

            {/* Farcaster Share */}
            <button
              onClick={handleShareToFarcaster}
              disabled={shareStatus.farcaster.shared || shareStatus.farcaster.loading}
              className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all ${
                shareStatus.farcaster.shared
                  ? 'bg-green-500/10 border-green-500/30 cursor-not-allowed'
                  : shareStatus.farcaster.loading
                  ? 'bg-gray-800 border-gray-700 cursor-wait'
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-750 cursor-pointer'
              }`}
            >
              <FarcasterIcon className={`w-6 h-6 ${shareStatus.farcaster.shared ? 'text-purple-400' : 'text-gray-400'}`} />
              <div className="flex-1 text-left">
                <h3 className="text-sm font-semibold text-white">Share to Farcaster</h3>
                <p className="text-xs text-gray-400">
                  {shareStatus.farcaster.loading
                    ? 'Processing...'
                    : shareStatus.farcaster.shared
                    ? shareStatus.farcaster.earned
                      ? 'Already earned points'
                      : 'Shared'
                    : 'Share your profile'}
                </p>
              </div>
              {shareStatus.farcaster.shared && (
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  {shareStatus.farcaster.earned && (
                    <span className="text-xs font-semibold text-green-500">+1000</span>
                  )}
                </div>
              )}
            </button>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-700">
            <p className="text-xs text-gray-500 text-center">
              Points are awarded once per platform
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

