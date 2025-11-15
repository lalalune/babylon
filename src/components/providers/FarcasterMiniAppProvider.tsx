'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useLoginToMiniApp } from '@privy-io/react-auth/farcaster'
import { sdk } from '@farcaster/miniapp-sdk'
import { logger } from '@/lib/logger'

/**
 * Consolidated Farcaster Mini App Provider
 * Handles:
 * 1. Mini App detection
 * 2. SDK initialization (calling ready())
 * 3. Auto-authentication with Privy
 * 4. Wallet creation
 * 5. Share functionality
 * 
 * Works seamlessly in both Mini App and standalone modes
 */

interface MiniAppContext {
  user?: {
    fid: number
    username: string
  }
}

interface FarcasterMiniAppContextType {
  isMiniApp: boolean
  isLoading: boolean
  error?: string
  fid?: number
  username?: string
  context: MiniAppContext | null
  share: (options: { text?: string; url?: string; embeds?: string[] }) => Promise<void>
}

const FarcasterMiniAppContext = createContext<FarcasterMiniAppContextType | null>(null)

export function useFarcasterMiniApp() {
  const context = useContext(FarcasterMiniAppContext)
  if (!context) {
    throw new Error('useFarcasterMiniApp must be used within FarcasterMiniAppProvider')
  }
  return context
}

export function FarcasterMiniAppProvider({ children }: { children: React.ReactNode }) {
  const [isMiniApp, setIsMiniApp] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [isCreatingWallet, setIsCreatingWallet] = useState(false)
  const [fid, setFid] = useState<number>()
  const [username, setUsername] = useState<string>()
  const [miniAppContext, setMiniAppContext] = useState<MiniAppContext | null>(null)
  const hasCalledReady = useRef(false)

  const { ready, authenticated, user, createWallet } = usePrivy()
  const { initLoginToMiniApp, loginToMiniApp } = useLoginToMiniApp()

  // Detect Mini App context and call sdk.actions.ready()
  useEffect(() => {
    if (typeof window === 'undefined') return

    const initializeMiniApp = async () => {
      try {
        const context = await sdk.context
        
        if (context) {
          setIsMiniApp(true)
          setMiniAppContext(context as MiniAppContext)
          
          if (context.user) {
            setFid(context.user.fid)
            setUsername(context.user.username)
          }
          
          logger.info('Detected Farcaster Mini App context', { 
            fid: context.user?.fid,
            username: context.user?.username 
          }, 'FarcasterMiniApp')

          // Call ready() to hide splash screen and show content
          // Only call once
          if (!hasCalledReady.current) {
            hasCalledReady.current = true
            
            // Small delay to ensure DOM is ready
            setTimeout(async () => {
              try {
                await sdk.actions.ready()
                logger.info('Farcaster Mini App ready() called successfully', {}, 'FarcasterMiniApp')
              } catch (readyError) {
                logger.error('Failed to call sdk.actions.ready()', {
                  error: readyError instanceof Error ? readyError.message : String(readyError)
                }, 'FarcasterMiniApp')
              }
            }, 100)
          }
        } else {
          logger.debug('Not in Farcaster Mini App context', {}, 'FarcasterMiniApp')
        }
      } catch (error) {
        logger.debug('Not in Farcaster Mini App context', { 
          error: error instanceof Error ? error.message : String(error)
        }, 'FarcasterMiniApp')
      } finally {
        setIsLoading(false)
      }
    }

    initializeMiniApp()
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
      const result = await sdk.actions.signIn({ nonce })
      
      logger.debug('Received signature, authenticating with Privy', {}, 'FarcasterMiniApp')
      
      // Extract only serializable data (avoid passing functions in postMessage)
      const message = typeof result.message === 'string' ? result.message : String(result.message || '')
      const signature = typeof result.signature === 'string' ? result.signature : String(result.signature || '')
      
      // Send the received signature from Farcaster to Privy for authentication
      await loginToMiniApp({
        message,
        signature,
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

  // Share functionality using Mini App SDK
  const share = async (options: { text?: string; url?: string; embeds?: string[] }) => {
    if (!isMiniApp) {
      logger.warn('Attempted to use Mini App share outside of Mini App context', {}, 'FarcasterMiniApp')
      return
    }

    try {
      await sdk.actions.openUrl(
        `https://warpcast.com/~/compose?text=${encodeURIComponent(options.text || '')}${
          options.url ? `&embeds[]=${encodeURIComponent(options.url)}` : ''
        }`
      )
      logger.info('Mini App share opened', options, 'FarcasterMiniApp')
    } catch (error) {
      logger.error('Failed to open Mini App share', {
        error: error instanceof Error ? error.message : String(error),
        options
      }, 'FarcasterMiniApp')
      throw error
    }
  }

  const value: FarcasterMiniAppContextType = {
    isMiniApp,
    isLoading,
    error,
    fid,
    username,
    context: miniAppContext,
    share,
  }

  return (
    <FarcasterMiniAppContext.Provider value={value}>
      {children}
    </FarcasterMiniAppContext.Provider>
  )
}

