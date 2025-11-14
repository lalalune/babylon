'use client'

import { Bell } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

interface NotificationsButtonProps {
  className?: string
  compact?: boolean
}

export function NotificationsButton({ className, compact = false }: NotificationsButtonProps) {
  const { authenticated, user } = useAuth()
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!authenticated || !user) {
      setUnreadCount(0)
      return
    }

    const fetchUnreadCount = async () => {
      setIsLoading(true)
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      
      if (!token) {
        setIsLoading(false)
        return
      }

      const response = await fetch('/api/notifications?unreadOnly=true&limit=1', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        // Use unreadCount directly from API response - it's accurate and efficient
        setUnreadCount(data.unreadCount || 0)
      }
      setIsLoading(false)
    }

    fetchUnreadCount()

    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [authenticated, user])

  if (!authenticated) {
    return null
  }

  const handleClick = () => {
    router.push('/notifications')
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        'relative p-2 hover:bg-sidebar-accent transition-colors',
        isLoading && 'opacity-50 cursor-wait'
      )}
      aria-label="Notifications"
      aria-busy={isLoading}
    >
      <Bell className={cn(
        compact ? 'w-5 h-5' : 'w-6 h-6',
        'transition-colors duration-200',
        isLoading && 'animate-pulse',
        className || 'text-sidebar-foreground'
      )} />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-background" />
      )}
    </button>
  )
}

