'use client'

import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function FeedAuthBannerContent() {
  const { login, authenticated, ready } = useAuth()
  const searchParams = useSearchParams()

  // Check if dev mode is enabled via URL parameter
  const isDevMode = searchParams.get('dev') === 'true'
  
  // Hide on production (babylon.market) on home page unless ?dev=true
  const isProduction = typeof window !== 'undefined' && window.location.hostname === 'babylon.market'
  const isHomePage = typeof window !== 'undefined' && window.location.pathname === '/'
  const shouldHide = isProduction && isHomePage && !isDevMode

  // If should be hidden, don't render anything
  if (shouldHide) {
    return null
  }

  // Don't show until auth state is ready (prevents flash on load)
  if (!ready) {
    return null
  }

  // Don't show if user is authenticated
  if (authenticated) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-background text-foreground',
        'border-t-2 border-border'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">
              Join the conversation.
            </h3>
            <p className="text-sm opacity-90">
              You&apos;re still early!
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={login}
              className={cn(
                'px-6 py-2 font-bold',
                'bg-background text-foreground',
                'hover:bg-background/90',
                'transition-colors',
                'bg-primary text-primary-foreground'
              )}
            >
              Log in
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FeedAuthBanner() {
  return (
    <Suspense fallback={null}>
      <FeedAuthBannerContent />
    </Suspense>
  )
}

