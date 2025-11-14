'use client'

import { useState, useEffect } from 'react'
import { Twitter, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { BouncingLogo } from '@/components/shared/BouncingLogo'

interface SocialImportStepProps {
  onImport: (platform: 'twitter' | 'farcaster') => Promise<void>
  onSkip: () => void
  isLoading?: boolean
}

interface CredentialStatus {
  twitter: boolean
  farcaster: boolean
}

// Farcaster icon SVG component
function FarcasterIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1000 1000"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z" />
      <path d="M128.889 253.333L157.778 351.111H182.222V844.444H128.889V253.333Z" />
      <path d="M871.111 253.333L842.222 351.111H817.778V844.444H871.111V253.333Z" />
    </svg>
  )
}

export function SocialImportStep({ onImport, onSkip, isLoading = false }: SocialImportStepProps) {
  const [importingPlatform, setImportingPlatform] = useState<'twitter' | 'farcaster' | null>(null)
  const [credentials, setCredentials] = useState<CredentialStatus>({ twitter: false, farcaster: false })
  const [loadingCredentials, setLoadingCredentials] = useState(true)

  useEffect(() => {
    // Check which OAuth credentials are available
    const checkCredentials = async () => {
      try {
        const response = await fetch('/api/auth/credentials/status')
        if (response.ok) {
          const data = await response.json() as CredentialStatus
          setCredentials(data)
        } else {
          logger.warn('Failed to check credential status', { status: response.status }, 'SocialImportStep')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        logger.error('Failed to check credential status', { 
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined 
        }, 'SocialImportStep')
      } finally {
        setLoadingCredentials(false)
      }
    }

    void checkCredentials()
  }, [])

  const handleImport = async (platform: 'twitter' | 'farcaster') => {
    // Don't allow import if credentials aren't available
    if (!credentials[platform]) {
      return
    }

    setImportingPlatform(platform)
    try {
      await onImport(platform)
    } finally {
      setImportingPlatform(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold">Import Your Profile</h3>
        <p className="text-sm text-muted-foreground">
          Connect your social account to automatically import your profile, or create one manually.
        </p>
      </div>

      {/* Social Import Options */}
      <div className="space-y-3">
        {/* Twitter Import */}
        <div className="relative">
          <button
            onClick={() => handleImport('twitter')}
            disabled={isLoading || importingPlatform !== null || !credentials.twitter}
            className={cn(
              'w-full p-4 rounded-lg border-2 transition-all',
              'flex items-center justify-between group',
              credentials.twitter
                ? 'hover:border-[#0066FF] hover:bg-[#0066FF]/5 disabled:opacity-50'
                : 'opacity-50 cursor-not-allowed border-dashed',
              'disabled:cursor-not-allowed'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-full bg-[#0066FF]/10 flex items-center justify-center transition-colors",
                credentials.twitter && "group-hover:bg-[#0066FF]/20"
              )}>
                {importingPlatform === 'twitter' ? (
                  <BouncingLogo size={24} />
                ) : (
                  <Twitter className="w-6 h-6 text-[#0066FF]" />
                )}
              </div>
              <div className="text-left">
                <div className="font-semibold">Import from X (Twitter)</div>
                <div className="text-sm text-muted-foreground">
                  Username, display name, bio, and profile picture
                </div>
              </div>
            </div>
            {credentials.twitter && (
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-[#0066FF] transition-colors" />
            )}
          </button>
          {!credentials.twitter && !loadingCredentials && (
            <div className="mt-1 text-xs text-center text-muted-foreground">
              Coming soon
            </div>
          )}
        </div>

        {/* Farcaster Import */}
        <div className="relative">
          <button
            onClick={() => handleImport('farcaster')}
            disabled={isLoading || importingPlatform !== null || !credentials.farcaster}
            className={cn(
              'w-full p-4 rounded-lg border-2 transition-all',
              'flex items-center justify-between group',
              credentials.farcaster
                ? 'hover:border-[#8A63D2] hover:bg-[#8A63D2]/5 disabled:opacity-50'
                : 'opacity-50 cursor-not-allowed border-dashed',
              'disabled:cursor-not-allowed'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-full bg-[#8A63D2]/10 flex items-center justify-center transition-colors",
                credentials.farcaster && "group-hover:bg-[#8A63D2]/20"
              )}>
                {importingPlatform === 'farcaster' ? (
                  <BouncingLogo size={24} />
                ) : (
                  <FarcasterIcon className="w-6 h-6 text-[#8A63D2]" />
                )}
              </div>
              <div className="text-left">
                <div className="font-semibold">Import from Farcaster</div>
                <div className="text-sm text-muted-foreground">
                  Username, display name, and profile picture
                </div>
              </div>
            </div>
            {credentials.farcaster && (
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-[#8A63D2] transition-colors" />
            )}
          </button>
          {!credentials.farcaster && !loadingCredentials && (
            <div className="mt-1 text-xs text-center text-muted-foreground">
              Coming soon
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-background text-muted-foreground">or</span>
        </div>
      </div>

      {/* Manual Creation Option */}
      <button
        onClick={onSkip}
        disabled={isLoading || importingPlatform !== null}
        className={cn(
          'w-full p-4 rounded-lg border-2 border-dashed transition-all',
          'hover:border-primary hover:bg-primary/5',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'text-center'
        )}
      >
        <div className="font-semibold">Create Profile Manually</div>
        <div className="text-sm text-muted-foreground mt-1">
          Set up your profile from scratch
        </div>
      </button>

      {/* Privacy Notice */}
      <div className="text-xs text-muted-foreground text-center pt-2">
        <p>
          By connecting, you authorize Babylon to access your public profile information.
          <br />
          We never post without your permission.
        </p>
      </div>
    </div>
  )
}

