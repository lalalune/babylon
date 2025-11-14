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
  const [isCreatingWallet, setIsCreatingWallet] = useState(false)
  const [fid, setFid] = useState<number>()
  const [username, setUsername] = useState<string>()

  const { ready, authenticated, user, createWallet } = usePrivy()
  const { initLoginToMiniApp, loginToMiniApp } = useLoginToMiniApp()

  // Detect if running in Mini App context
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if we're in a Farcaster Mini App context
    const checkMiniApp = async () => {
      const context = await miniappSdk.context.catch(() => null)
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
      } else {
        // Not in a Mini App context, that's fine
        logger.debug('Not in Farcaster Mini App context', {}, 'FarcasterMiniApp')
      }
      setIsLoading(false)
    }

    checkMiniApp()
  }, [])

  const hasEmbeddedWallet =
    user?.wallet?.walletClientType === 'privy' ||
    user?.wallet?.walletClientType === 'privy-v2' ||
    (user?.linkedAccounts?.some((account) => {
      if (account.type !== 'wallet') {
        return false
      }

      return (
        account.walletClientType === 'privy' ||
        account.walletClientType === 'privy-v2'
      )
    }) ?? false)

  // Auto-login with Farcaster Mini App when detected
  useEffect(() => {
    if (!ready || !isMiniApp || authenticated || isLoading) {
      return
    }

    const attemptMiniAppLogin = async () => {
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
    }

    attemptMiniAppLogin().catch((error: Error) => {
      logger.error('Farcaster Mini App auto-login failed', { 
        error: error.message,
        fid,
        username
      }, 'FarcasterMiniApp')
      setError(error.message)
    })
  }, [ready, authenticated, isMiniApp, isLoading, fid, username, initLoginToMiniApp, loginToMiniApp, user?.id])

  // Ensure embedded wallets are created for non-Mini App sessions
  useEffect(() => {
    if (!ready || !authenticated || !user || isMiniApp || hasEmbeddedWallet || isCreatingWallet) {
      return
    }

    if (!createWallet) {
      logger.warn(
        'Privy createWallet helper unavailable, skipping embedded wallet creation',
        { userId: user.id },
        'FarcasterMiniApp',
      )
      return
    }

    setIsCreatingWallet(true)

    createWallet()
      .then(() => {
        logger.info(
          'Embedded wallet created for user',
          {
            userId: user.id,
          },
          'FarcasterMiniApp',
        )
      })
      .catch((creationError: Error) => {
        logger.error(
          'Failed to create embedded wallet automatically',
          {
            error: creationError.message,
            userId: user.id,
          },
          'FarcasterMiniApp',
        )
      })
      .finally(() => {
        setIsCreatingWallet(false)
      })
  }, [
    authenticated,
    createWallet,
    hasEmbeddedWallet,
    isCreatingWallet,
    isMiniApp,
    ready,
    user,
  ])

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

