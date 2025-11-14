/**
 * ShareButton Component
 * 
 * Button to share content with tracking and points rewards
 */

import { useState } from 'react'
import { Share2, Twitter, Link as LinkIcon, Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ShareVerificationModal } from './ShareVerificationModal'
import { trackExternalShare } from '@/lib/share/trackExternalShare'

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

interface ExternalShareButtonProps {
  contentType: 'post' | 'profile' | 'market' | 'referral' | 'leaderboard'
  contentId?: string
  url?: string
  text?: string
  className?: string
}

export function ExternalShareButton({
  contentType,
  contentId,
  url,
  text,
  className = '',
}: ExternalShareButtonProps) {
  const { authenticated, user } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  const [shared, setShared] = useState(false)
  const [showVerification, setShowVerification] = useState(false)
  const [pendingVerification, setPendingVerification] = useState<{
    shareId: string
    platform: 'twitter' | 'farcaster'
  } | null>(null)

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')
  const shareText = text || 'Check this out!'

  const handleShareToTwitter = async () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
    window.open(twitterUrl, '_blank', 'width=550,height=420')
    
    const result = authenticated && user
      ? await trackExternalShare({
          platform: 'twitter',
          contentType,
          contentId,
          url: shareUrl,
          userId: user.id,
        })
      : { shareActionId: null, pointsAwarded: 0, alreadyAwarded: false }
    if (result.pointsAwarded > 0) {
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    }
    const shareId = result.shareActionId
    setShowMenu(false)
    
    // Show verification modal after a short delay (gives user time to post)
    if (shareId && user) {
      setTimeout(() => {
        setPendingVerification({ shareId, platform: 'twitter' })
        setShowVerification(true)
      }, 3000) // 3 second delay
    }
  }

  const handleShareToFarcaster = async () => {
    // Warpcast compose URL format
    const castText = `${shareText}\n\n${shareUrl}`
    const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}`
    window.open(warpcastUrl, '_blank', 'width=550,height=600')
    
    const result = authenticated && user
      ? await trackExternalShare({
          platform: 'farcaster',
          contentType,
          contentId,
          url: shareUrl,
          userId: user.id,
        })
      : { shareActionId: null, pointsAwarded: 0, alreadyAwarded: false }
    if (result.pointsAwarded > 0) {
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    }
    const shareId = result.shareActionId
    setShowMenu(false)
    
    // Show verification modal after a short delay (gives user time to post)
    if (shareId && user) {
      setTimeout(() => {
        setPendingVerification({ shareId, platform: 'farcaster' })
        setShowVerification(true)
      }, 3000) // 3 second delay
    }
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    if (authenticated && user) {
      void trackExternalShare({
        platform: 'link',
        contentType,
        contentId,
        url: shareUrl,
        userId: user.id,
      })
    }
    setShared(true)
    setTimeout(() => setShared(false), 2000)
    setShowMenu(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors ${className}`}
        aria-label="Share"
      >
        {shared ? (
          <>
            <Check className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium text-green-500">Shared!</span>
          </>
        ) : (
          <>
            <Share2 className="w-4 h-4" />
            <span className="text-sm font-medium">Share</span>
          </>
        )}
      </button>

      {/* Share Menu */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden z-50">
            <button
              onClick={handleShareToTwitter}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 text-left transition-colors"
            >
              <Twitter className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-200">Share to X</span>
            </button>

            <button
              onClick={handleShareToFarcaster}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 text-left transition-colors"
            >
              <FarcasterIcon className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-200">Share to Farcaster</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 text-left transition-colors"
            >
              <LinkIcon className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-200">Copy Link</span>
            </button>
          </div>
        </>
      )}

      {/* Verification Modal */}
      {showVerification && pendingVerification && user && (
        <ShareVerificationModal
          isOpen={showVerification}
          onClose={() => {
            setShowVerification(false)
            setPendingVerification(null)
          }}
          shareId={pendingVerification.shareId}
          platform={pendingVerification.platform}
          userId={user.id}
        />
      )}
    </div>
  )
}

