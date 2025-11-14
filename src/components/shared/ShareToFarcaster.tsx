'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

interface ShareToFarcasterProps {
  text: string
  url?: string
  className?: string
}

/**
 * Share to Farcaster button component
 * Opens Warpcast composer with pre-filled text
 */
export function ShareToFarcaster({ text, url, className = '' }: ShareToFarcasterProps) {
  const [isSharing, setIsSharing] = useState(false)

  const handleShare = async () => {
    try {
      setIsSharing(true)

      // Build Warpcast intent URL
      const shareUrl = url || window.location.href
      const shareText = `${text}\n\n${shareUrl}`
      
      // Encode for URL
      const encodedText = encodeURIComponent(shareText)
      
      // Open Warpcast composer
      const warpcastUrl = `https://warpcast.com/~/compose?text=${encodedText}`
      
      logger.info('Sharing to Farcaster', { text, url: shareUrl }, 'ShareToFarcaster')
      
      window.open(warpcastUrl, '_blank', 'width=600,height=800')
      
      toast.success('Opening Warpcast...')
    } catch (error) {
      logger.error('Failed to share to Farcaster', { error }, 'ShareToFarcaster')
      toast.error('Failed to share to Farcaster')
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={isSharing}
      className={`inline-flex items-center px-4 py-2 border border-border rounded-lg bg-card hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <svg
        className="w-4 h-4 mr-2"
        viewBox="0 0 1000 1000"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z"/>
        <path d="M128.889 253.333L157.778 351.111H182.222V844.444H128.889V253.333Z"/>
        <path d="M871.111 253.333L842.222 351.111H817.778V844.444H871.111V253.333Z"/>
      </svg>
      {isSharing ? 'Opening...' : 'Share to Farcaster'}
    </button>
  )
}

