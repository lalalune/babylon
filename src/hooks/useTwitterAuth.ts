/**
 * Hook for managing Twitter OAuth authentication for posting tweets
 */

import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { logger } from '@/lib/logger'

interface TwitterAuthStatus {
  connected: boolean
  screenName?: string
  connectedAt?: Date
}

interface UseTwitterAuthReturn {
  authStatus: TwitterAuthStatus | null
  loading: boolean
  error: string | null
  connectTwitter: (returnPath?: string) => void
  disconnectTwitter: () => Promise<void>
  refreshStatus: () => Promise<void>
}

export function useTwitterAuth(): UseTwitterAuthReturn {
  const { user } = useAuthStore()
  const [authStatus, setAuthStatus] = useState<TwitterAuthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkAuthStatus = useCallback(async () => {
    if (!user?.id) {
      setAuthStatus(null)
      setLoading(false)
      return
    }

    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
    if (!token) {
      setLoading(false)
      return
    }

    const response = await fetch('/api/twitter/auth-status', {
      headers: { 'Authorization': `Bearer ${token}` },
    })

    if (response.ok) {
      try {
        const data = await response.json() as TwitterAuthStatus
        setAuthStatus(data)
        setError(null)
      } catch (error) {
        logger.error('Failed to parse Twitter auth status response', { error }, 'useTwitterAuth')
        setAuthStatus(null)
        setError('Failed to parse response')
      }
    } else {
      setAuthStatus(null)
    }
    
    setLoading(false)
  }, [user?.id])

  // Check auth status on mount and when user changes
  useEffect(() => {
    checkAuthStatus()
  }, [checkAuthStatus])

  // Check for successful auth callback
  useEffect(() => {
    if (typeof window === 'undefined') return

    const urlParams = new URLSearchParams(window.location.search)
    const twitterAuth = urlParams.get('twitter_auth')

    if (twitterAuth === 'success') {
      // Refresh auth status
      checkAuthStatus()

      // Clean up URL
      const url = new URL(window.location.href)
      url.searchParams.delete('twitter_auth')
      window.history.replaceState({}, '', url.toString())
    }
  }, [checkAuthStatus])

  const connectTwitter = useCallback((_returnPath?: string) => {
    if (!user?.id) {
      setError('Please sign in first')
      return
    }

    // Redirect to OAuth 2.0 flow
    window.location.href = `/api/auth/twitter/initiate`
  }, [user?.id])

  const disconnectTwitter = useCallback(async () => {
    if (!user?.id) return

    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
    if (!token) return

    const response = await fetch('/api/twitter/disconnect', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    })

    if (response.ok) {
      setAuthStatus(null)
      setError(null)
    }
  }, [user?.id])

  const refreshStatus = useCallback(async () => {
    setLoading(true)
    await checkAuthStatus()
  }, [checkAuthStatus])

  return {
    authStatus,
    loading,
    error,
    connectTwitter,
    disconnectTwitter,
    refreshStatus,
  }
}

