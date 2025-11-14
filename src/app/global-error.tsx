'use client'

/**
 * Global Error Boundary for Next.js App Router
 * 
 * This file catches errors that occur in the root layout or other global components.
 * It's separate from the regular error.tsx because it must be a client component
 * and wraps the entire application, including the root layout.
 * 
 * Best practice: This is the last line of defense for errors in the app.
 */

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Capture error in Sentry with highest priority context
    Sentry.withScope((scope) => {
      scope.setLevel('fatal') // Mark as fatal since it's a global error
      scope.setTag('errorBoundary', 'global')
      if (error.digest) {
        scope.setTag('errorDigest', error.digest)
      }
      scope.setContext('globalError', {
        message: error.message,
        stack: error.stack,
        digest: error.digest,
      })
      Sentry.captureException(error)
    })
  }, [error])

  return (
    <html lang="en">
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
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
      </body>
    </html>
  )
}

