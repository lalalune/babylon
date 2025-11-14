'use client'

import { logger } from '@/lib/logger'
import { useState, useEffect } from 'react'
import { UserPlus, UserMinus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { BouncingLogo } from '@/components/shared/BouncingLogo'
import { useSocialTracking } from '@/hooks/usePostHog'

interface FollowButtonProps {
  userId: string
  initialFollowing?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'button' | 'icon'
  className?: string
  onFollowChange?: (isFollowing: boolean) => void
}

export function FollowButton({
  userId,
  initialFollowing = false,
  size = 'md',
  variant = 'button',
  className,
  onFollowChange,
}: FollowButtonProps) {
  const { authenticated, user } = useAuth()
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const { trackFollow } = useSocialTracking()

  // Check follow status on mount
  useEffect(() => {
    // Check if viewing own profile (userId could be username or user ID)
    const isOwnProfile = user && (
      user.id === userId || 
      user.username === userId ||
      (user.username && user.username.startsWith('@') && user.username.slice(1) === userId)
    )
    
    if (!authenticated || !user || isOwnProfile) {
      setIsChecking(false)
      return
    }

    const checkFollowStatus = async () => {
      if (!userId) {
        setIsChecking(false)
        return
      }

      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      if (!token) {
        setIsChecking(false)
        return
      }

      // Encode userId/username to handle special characters
      const encodedIdentifier = encodeURIComponent(userId)
      const response = await fetch(`/api/users/${encodedIdentifier}/follow`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setIsFollowing(data.isFollowing || false)
      } else {
        // If check fails, assume not following (don't show error)
        setIsFollowing(false)
      }
      setIsChecking(false)
    }

    checkFollowStatus()
  }, [authenticated, user, userId])

  const handleFollow = async () => {
    if (!authenticated || !user) {
      toast.error('Please sign in to follow users')
      return
    }

    // Check if viewing own profile (userId could be username or user ID)
    const isOwnProfile = user.id === userId || 
      user.username === userId ||
      (user.username && user.username.startsWith('@') && user.username.slice(1) === userId)
    
    if (isOwnProfile) {
      // Don't show error, just return silently (button shouldn't be visible anyway)
      return
    }

    if (!userId) {
      logger.error('No userId/username provided to FollowButton', {}, 'FollowButton')
      return
    }

    setIsLoading(true)
    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
    if (!token) {
      toast.error('Authentication required')
      setIsLoading(false)
      return
    }

    // Encode userId/username to handle special characters
    const encodedIdentifier = encodeURIComponent(userId)
    const method = isFollowing ? 'DELETE' : 'POST'
    const response = await fetch(`/api/users/${encodedIdentifier}/follow`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (response.ok) {
      const newFollowingState = !isFollowing
      setIsFollowing(newFollowingState)
      onFollowChange?.(newFollowingState)
      toast.success(newFollowingState ? 'Following' : 'Unfollowed')
      // Track follow action (client-side for instant feedback)
      trackFollow(userId, newFollowingState)
    } else {
      // Try to get error message, but don't show generic errors for 404s
      const errorData = await response.json().catch(() => ({ error: null }))
      if (response.status === 404) {
        // If profile not found, silently fail or show a more helpful message
        logger.warn('Profile not found for follow:', { userId }, 'FollowButton')
        toast.error('Unable to follow this profile')
      } else {
        // Extract error message properly (handle both string and object formats)
        const errorMessage = typeof errorData?.error === 'string' 
          ? errorData.error 
          : errorData?.error?.message || 'Failed to update follow status'
        toast.error(errorMessage)
      }
    }
    setIsLoading(false)
  }

  // Don't show button if checking or if user is viewing their own profile
  const isOwnProfile = user && (
    user.id === userId || 
    user.username === userId ||
    (user.username && user.username.startsWith('@') && user.username.slice(1) === userId)
  )
  
  if (isChecking || isOwnProfile) {
    return null
  }

  if (!authenticated) {
    return null
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  const iconPixelSizes = {
    sm: 12,
    md: 16,
    lg: 20,
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleFollow}
        disabled={isLoading}
        className={cn(
          'p-2 rounded transition-colors',
          isFollowing
            ? 'text-muted-foreground hover:text-foreground'
            : 'text-primary hover:text-primary/80',
          isLoading && 'opacity-50 cursor-not-allowed',
          className
        )}
        aria-label={isFollowing ? 'Unfollow' : 'Follow'}
      >
        {isLoading ? (
          <BouncingLogo size={iconPixelSizes[size]} />
        ) : isFollowing ? (
          <UserMinus className={iconSizes[size]} />
        ) : (
          <UserPlus className={iconSizes[size]} />
        )}
      </button>
    )
  }

  // Old-school style button
  return (
    <button
      onClick={handleFollow}
      disabled={isLoading}
      className={cn(
        'group relative flex items-center justify-center gap-1.5 rounded-full font-bold transition-all duration-200',
        'border',
        isFollowing
          ? 'text-foreground bg-background border-border hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500'
          : 'text-white bg-[#0066FF] border-[#0066FF] hover:bg-[#0052CC]',
        sizeClasses[size],
        isLoading && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {isLoading ? (
        <>
          <BouncingLogo size={iconPixelSizes[size]} />
          <span>...</span>
        </>
      ) : isFollowing ? (
        <>
          <span className="group-hover:hidden">Following</span>
          <span className="hidden group-hover:inline">Unfollow</span>
        </>
      ) : (
        <span>Follow</span>
      )}
    </button>
  )
}

