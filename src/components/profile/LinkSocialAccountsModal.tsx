'use client'

import { useState, useEffect } from 'react'
import { X as XIcon, Check, ExternalLink, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { toast } from 'sonner'
import { BouncingLogo } from '@/components/shared/BouncingLogo'

interface LinkSocialAccountsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function LinkSocialAccountsModal({ isOpen, onClose }: LinkSocialAccountsModalProps) {
  const { user, setUser } = useAuthStore()
  const [linking, setLinking] = useState<string | null>(null)

  // Handle OAuth callback messages (for Farcaster)
  useEffect(() => {
    if (!isOpen) return

    const handleMessage = async (event: MessageEvent) => {
      // Verify origin
      if (event.origin !== window.location.origin) return

      if (event.data.type === 'FARCASTER_AUTH_SUCCESS') {
        const { fid, username, displayName, pfpUrl } = event.data
        
        setLinking('farcaster')
        
        try {
          const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
          const state = `${user?.id}:${Date.now()}:${Math.random().toString(36).substring(7)}`
          
          const response = await fetch('/api/auth/farcaster/callback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              message: event.data.message,
              signature: event.data.signature,
              fid,
              username,
              displayName,
              pfpUrl,
              state,
            }),
          })

          const data = await response.json()

          if (response.ok && data.success) {
            if (user) {
              setUser({
                ...user,
                hasFarcaster: true,
                farcasterUsername: username,
                reputationPoints: data.newTotal || user.reputationPoints,
              })
            }

            if (data.pointsAwarded > 0) {
              toast.success(`Farcaster linked! +${data.pointsAwarded} points awarded`)
            } else {
              toast.success('Farcaster account linked successfully!')
            }

            onClose()
          } else {
            throw new Error(data.error || 'Failed to link account')
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to link Farcaster')
        } finally {
          setLinking(null)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [isOpen, user, setUser, onClose])

  if (!isOpen) return null

  const handleTwitterOAuth = async () => {
    if (!user?.id) return
    
    setLinking('twitter')

    try {
      // Redirect to OAuth initiation endpoint
      const initiateUrl = `/api/auth/twitter/initiate`
      
      // Store current URL to return to
      sessionStorage.setItem('oauth_return_url', window.location.pathname)
      
      window.location.href = initiateUrl
    } catch {
      toast.error('Failed to initiate Twitter authentication')
      setLinking(null)
    }
  }

  const handleFarcasterAuth = () => {
    if (!user?.id) return
    
    setLinking('farcaster')

    try {
      // Open Farcaster Auth in popup
      const state = `${user.id}:${Date.now()}:${Math.random().toString(36).substring(7)}`
      const authUrl = `https://warpcast.com/~/sign-in-with-farcaster?channelToken=${state}`
      
      const width = 600
      const height = 700
      const left = (window.screen.width - width) / 2
      const top = (window.screen.height - height) / 2
      
      const popup = window.open(
        authUrl,
        'farcaster-auth',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      if (!popup) {
        toast.error('Please allow popups to connect Farcaster')
        setLinking(null)
        return
      }

      // Monitor popup
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup)
          setLinking(null)
        }
      }, 1000)
    } catch {
      toast.error('Failed to initiate Farcaster authentication')
      setLinking(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl max-w-md w-full border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Link Social Accounts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Twitter/X */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <h3 className="font-semibold">Twitter / X</h3>
              {user?.hasTwitter && (
                <span className="ml-auto flex items-center gap-1 text-sm text-green-500">
                  <Check className="w-4 h-4" />
                  Verified
                </span>
              )}
            </div>

            {user?.hasTwitter ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">@{user.twitterUsername}</span>
                <a
                  href={`https://twitter.com/${user.twitterUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-primary hover:text-primary/80"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-2">
                  <Shield className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    You&apos;ll be redirected to Twitter to authorize access. We&apos;ll verify your account ownership.
                  </p>
                </div>
                <button
                  onClick={handleTwitterOAuth}
                  disabled={linking === 'twitter'}
                  className={cn(
                    'w-full px-4 py-2 rounded-lg font-semibold transition-colors',
                    'bg-[#0066FF] text-white hover:bg-[#2952d9]',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'flex items-center justify-center gap-2'
                  )}
                >
                  {linking === 'twitter' ? (
                    <>
                      <BouncingLogo size={16} />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>Connect with Twitter</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Farcaster */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 1000 1000" fill="currentColor">
                <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z"/>
                <path d="M128.889 253.333L157.778 351.111H182.222V844.444H128.889V253.333Z"/>
                <path d="M871.111 253.333L842.222 351.111H817.778V844.444H871.111V253.333Z"/>
              </svg>
              <h3 className="font-semibold">Farcaster</h3>
              {user?.hasFarcaster && (
                <span className="ml-auto flex items-center gap-1 text-sm text-green-500">
                  <Check className="w-4 h-4" />
                  Verified
                </span>
              )}
            </div>

            {user?.hasFarcaster ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">@{user.farcasterUsername}</span>
                <a
                  href={`https://warpcast.com/${user.farcasterUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-primary hover:text-primary/80"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-start gap-2">
                  <Shield className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Sign in with Farcaster to verify your account. A popup will open for authentication.
                  </p>
                </div>
                <button
                  onClick={handleFarcasterAuth}
                  disabled={linking === 'farcaster'}
                  className={cn(
                    'w-full px-4 py-2 rounded-lg font-semibold transition-colors',
                    'bg-[#8A63D2] text-white hover:bg-[#7952c4]',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'flex items-center justify-center gap-2'
                  )}
                >
                  {linking === 'farcaster' ? (
                    <>
                      <BouncingLogo size={16} />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>Sign in with Farcaster</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                OAuth authentication verifies your account ownership and earns you reputation points!
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg bg-muted hover:bg-muted/70 font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

