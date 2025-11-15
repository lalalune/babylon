'use client'

import { useState } from 'react'
import { X as XIcon, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ShareVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  shareId: string
  platform: 'twitter' | 'farcaster'
  userId: string
}

export function ShareVerificationModal({ 
  isOpen, 
  onClose, 
  shareId, 
  platform,
  userId 
}: ShareVerificationModalProps) {
  const [postUrl, setPostUrl] = useState('')
  const [verifying, setVerifying] = useState(false)

  if (!isOpen) return null

  const handleVerify = async () => {
    if (!postUrl.trim()) {
      toast.error('Please enter the URL to your post')
      return
    }

    setVerifying(true)

    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}/verify-share`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          shareId,
          platform,
          postUrl: postUrl.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.message || data.error || 'Failed to verify share')
        setVerifying(false)
        return
      }

      if (data.verified) {
        const pointsMessage = data.points?.awarded > 0 
          ? `Share verified! You earned ${data.points.awarded} points.` 
          : 'Share verified! Thank you for sharing!'
        toast.success(pointsMessage)
        onClose()
        // Reload the page to update points display
        window.location.reload()
      } else {
        toast.error(data.message || 'Could not verify your post. Please check the URL.')
      }
    } catch (error) {
      toast.error(`An error occurred while verifying. Please try again. ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setVerifying(false)
    }
  }

  const platformName = platform === 'twitter' ? 'X' : 'Farcaster'
  const placeholderUrl = platform === 'twitter' 
    ? 'https://twitter.com/username/status/1234567890'
    : 'https://warpcast.com/username/0xabcdef...'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl max-w-md w-full border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold">Verify Your Share</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Help us verify that you shared to {platformName}! Paste the URL to your post below.
            </p>
            
            <label htmlFor="postUrl" className="block text-sm font-medium mb-2">
              Post URL
            </label>
            <input
              id="postUrl"
              type="url"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleVerify()
              }}
              placeholder={placeholderUrl}
              className="w-full px-4 py-2 rounded-lg bg-sidebar-accent/50 focus:outline-none focus:border-border"
              disabled={verifying}
            />
          </div>

          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-xs text-muted-foreground">
              <strong>Tip:</strong> After posting, copy the URL from your browser&apos;s address bar or use the &quot;Copy link&quot; option on your post.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleVerify}
              disabled={verifying || !postUrl.trim()}
              className={cn(
                'flex-1 px-4 py-2 rounded-lg font-semibold transition-colors',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {verifying ? (
                <>
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Verify</span>
                </>
              )}
            </button>
            
            <button
              onClick={onClose}
              disabled={verifying}
              className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/70 font-semibold transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

