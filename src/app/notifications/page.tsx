'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck } from 'lucide-react'
import { PageContainer } from '@/components/shared/PageContainer'
import { Avatar } from '@/components/shared/Avatar'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullToRefreshIndicator } from '@/components/shared/PullToRefreshIndicator'

interface Notification {
  id: string
  type: string
  actorId: string | null
  actor: {
    id: string
    displayName: string
    username: string | null
    profileImageUrl: string | null
  } | null
  postId: string | null
  commentId: string | null
  message: string
  read: boolean
  createdAt: string
}

export default function NotificationsPage() {
  const { authenticated, user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [markingAsRead, setMarkingAsRead] = useState(false)

  const fetchNotifications = useCallback(async (showLoading = true, silent = false) => {
    if (showLoading) {
      setLoading(true)
    }
    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null

    if (!token) {
      if (showLoading) {
        setLoading(false)
      }
      return
    }

    const response = await fetch('/api/notifications?limit=100', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (response.ok) {
      const data = await response.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
      if (!silent) {
        toast.success('Notifications refreshed')
      }
    } else {
      console.error('Failed to fetch notifications:', response.statusText)
      if (!silent) {
        toast.error('Failed to refresh notifications')
      }
    }
    if (showLoading) {
      setLoading(false)
    }
  }, [])

  const handleRefresh = useCallback(async () => {
    await fetchNotifications(false, false) // Show loading via pull-to-refresh indicator, show toast on complete
  }, [fetchNotifications])

  // Pull-to-refresh hook
  const {
    pullDistance,
    isRefreshing,
    containerRef,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
  })

  useEffect(() => {
    if (!authenticated || !user) {
      setLoading(false)
      return
    }

    fetchNotifications(true, true) // Initial load: show loading, but silent (no toast)

    // Poll for new notifications every 30 seconds when page is visible
    // Use silent refresh (no loading indicator) for polling
    const interval = setInterval(() => {
      // Only refresh if page is visible (not in background tab)
      if (document.visibilityState === 'visible') {
        fetchNotifications(false, true) // Silent refresh, no loading indicator, no toast
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [authenticated, user, fetchNotifications])

  const markAsRead = async (notificationId: string) => {
    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null

    if (!token) return

    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notificationIds: [notificationId],
      }),
    })

    if (response.ok) {
      // Update local state optimistically
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } else {
      console.error('Failed to mark notification as read:', response.statusText)
    }
  }

  const markAllAsRead = async () => {
    setMarkingAsRead(true)
    const token = typeof window !== 'undefined' ? window.__privyAccessToken : null

    if (!token) {
      setMarkingAsRead(false)
      return
    }

    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        markAllAsRead: true,
      }),
    })

    if (response.ok) {
      // Update local state optimistically
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } else {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
      toast.error(errorData.message || 'Failed to mark all as read')
    }
    setMarkingAsRead(false)
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return '💬'
      case 'reaction':
        return '❤️'
      case 'follow':
        return '👤'
      case 'mention':
        return '📢'
      case 'reply':
        return '↩️'
      case 'share':
        return '🔁'
      case 'system':
        return '✨'
      default:
        return '🔔'
    }
  }

  const getNotificationLink = (notification: Notification) => {
    // System notifications redirect based on their content
    if (notification.type === 'system') {
      if (notification.message.includes('profile')) {
        return '/settings'
      }
      return '/feed'
    }
    if (notification.postId) {
      return `/feed#post-${notification.postId}`
    }
    if (notification.commentId) {
      return `/feed#comment-${notification.commentId}`
    }
    if (notification.actorId) {
      return `/profile/${notification.actorId}`
    }
    return '/feed'
  }

  if (!authenticated) {
    return (
      <PageContainer noPadding className="flex flex-col">
        <div className="sticky top-0 z-10 bg-background border-b border-border">
          <div className="px-4 py-3">
            <h1 className="text-xl font-bold">Notifications</h1>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Please sign in to view notifications</p>
          <Link
            href="/feed"
            className="px-6 py-3 rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
          >
            Go to Feed
          </Link>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer noPadding className="flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {unreadCount} unread
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              disabled={markingAsRead}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-semibold',
                'bg-transparent hover:bg-muted/50',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors'
              )}
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto relative"
      >
        {/* Pull to refresh indicator */}
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
        />
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-muted-foreground">Loading notifications...</div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Bell className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
            <h2 className="text-xl font-semibold mb-2">No notifications yet</h2>
            <p className="text-muted-foreground text-center px-4">
              When you get comments, reactions, follows, or mentions, they&apos;ll show up here.
            </p>
          </div>
        ) : (
          <div className="max-w-[600px] mx-auto">
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={getNotificationLink(notification)}
                onClick={() => {
                  if (!notification.read) {
                    markAsRead(notification.id)
                  }
                }}
                className={cn(
                  'block px-4 py-4 border-b border-border',
                  'hover:bg-muted/30 transition-colors',
                  !notification.read && 'bg-primary/5'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Unread Indicator - moved to left */}
                  {!notification.read && (
                    <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                  )}
                  
                  {/* Actor Avatar */}
                  {notification.actor ? (
                    <Avatar
                      id={notification.actor.id}
                      name={notification.actor.displayName}
                      size="md"
                      className="flex-shrink-0"
                    />
                  ) : (
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      notification.type === 'system' ? "bg-primary/10" : "bg-muted"
                    )}>
                      {notification.type === 'system' ? (
                        <span className="text-xl">{getNotificationIcon(notification.type)}</span>
                      ) : (
                        <Bell className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        {notification.type === 'system' ? (
                          <p className="text-foreground leading-relaxed">
                            {notification.message}
                          </p>
                        ) : (
                          <p className="text-foreground leading-relaxed">
                            <span className="font-semibold">
                              {notification.actor?.displayName || 'Someone'}
                            </span>
                            {' '}
                            <span className="text-muted-foreground">
                              {getNotificationIcon(notification.type)} {notification.message}
                            </span>
                          </p>
                        )}
                        <time className="text-sm text-muted-foreground mt-1 block">
                          {formatTimeAgo(notification.createdAt)}
                        </time>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  )
}

