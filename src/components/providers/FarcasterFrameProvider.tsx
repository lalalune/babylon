'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useLoginToMiniApp } from '@privy-io/react-auth/farcaster'
import miniappSdk from '@farcaster/miniapp-sdk'
import { logger } from '@/lib/logger'

interface FarcasterMiniAppContextType {
  isMiniApp: boolean
  isLoading: boolean
  error?: string
  fid?: number
  username?: string
}

const FarcasterMiniAppContext = createContext<FarcasterMiniAppContextType | null>(null)

export function useFarcasterMiniApp() {
  const context = useContext(FarcasterMiniAppContext)
  if (!context) {
    throw new Error('useFarcasterMiniApp must be used within FarcasterFrameProvider')
  }
  return context
}

/**
 * Farcaster Mini App Provider
 * Handles automatic authentication using Farcaster's Mini App SDK
 * Based on: https://docs.privy.io/recipes/farcaster/mini-apps
 */
export function FarcasterFrameProvider({ children }: { children: React.ReactNode }) {
  const [isMiniApp, setIsMiniApp] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [fid, setFid] = useState<number>()
  const [username, setUsername] = useState<string>()

  const { ready, authenticated, user } = usePrivy()
  const { initLoginToMiniApp, loginToMiniApp } = useLoginToMiniApp()

  // Detect if running in Mini App context
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if we're in a Farcaster Mini App context
    const checkMiniApp = async () => {
      try {
        // Mini Apps have the SDK available and can interact with the parent
        const context = await miniappSdk.context
        if (context) {
          setIsMiniApp(true)
          if (context.user) {
            setFid(context.user.fid)
            setUsername(context.user.username)
          }
          logger.info('Detected Farcaster Mini App context', { 
            fid: context.user?.fid,
          username: context.user?.username 
        }, 'FarcasterMiniApp')
        }
      } catch {
        // Not in a Mini App context, that's fine
        logger.debug('Not in Farcaster Mini App context', {}, 'FarcasterMiniApp')
      } finally {
        setIsLoading(false)
      }
    }

    checkMiniApp()
  }, [])

  // Auto-login with Farcaster Mini App when detected
  useEffect(() => {
    if (!ready || !isMiniApp || authenticated || isLoading) {
      return
    }

    const attemptMiniAppLogin = async () => {
      try {
        logger.info('Attempting Farcaster Mini App auto-login', { fid, username }, 'FarcasterMiniApp')

        // Initialize a new login attempt to get a nonce for the Farcaster wallet to sign
        const { nonce } = await initLoginToMiniApp()
        
        logger.debug('Requesting signature from Farcaster', { nonce }, 'FarcasterMiniApp')
        
        // Request a signature from Farcaster using Mini App SDK
        const result = await miniappSdk.actions.signIn({ nonce })
        
        logger.debug('Received signature, authenticating with Privy', {}, 'FarcasterMiniApp')
        
        // Send the received signature from Farcaster to Privy for authentication
        await loginToMiniApp({
          message: result.message,
          signature: result.signature,
        })

        logger.info('Farcaster Mini App auto-login successful', { 
          fid,
          username,
          userId: user?.id 
        }, 'FarcasterMiniApp')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        logger.error('Farcaster Mini App auto-login failed', { 
          error: errorMessage,
          fid,
          username
        }, 'FarcasterMiniApp')
        setError(errorMessage)
      }
    }

    attemptMiniAppLogin()
  }, [ready, authenticated, isMiniApp, isLoading, fid, username, initLoginToMiniApp, loginToMiniApp, user?.id])

  const value: FarcasterMiniAppContextType = {
    isMiniApp,
    isLoading,
    error,
    fid,
    username,
  }

  return (
    <FarcasterMiniAppContext.Provider value={value}>
      {children}
    </FarcasterMiniAppContext.Provider>
  )
}

