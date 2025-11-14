'use client'

/**
 * Error Boundary for Next.js App Router
 * 
 * This file catches errors that occur in route segments.
 * It's different from global-error.tsx which catches errors in the root layout.
 * 
 * Best practice: This should be a client component and provide a way to reset the error.
 */

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Capture error in Sentry with additional context
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', 'route')
      if (error.digest) {
        scope.setTag('errorDigest', error.digest)
      }
      Sentry.captureException(error)
    })
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="text-center max-w-md">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
        <p className="text-muted-foreground mb-6">
          {error.message || 'An unexpected error occurred'}
        </p>
        {error.digest && (
          <p className="text-sm text-muted-foreground mb-4">
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            className="px-6 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  )
}

