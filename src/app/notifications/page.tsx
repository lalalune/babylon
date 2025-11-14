'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { PageContainer } from '@/components/shared/PageContainer'
import { Avatar } from '@/components/shared/Avatar'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { PullToRefreshIndicator } from '@/components/shared/PullToRefreshIndicator'
import { GroupInviteCard } from '@/components/groups/GroupInviteCard'
import { useRouter } from 'next/navigation'

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
  groupId: string | null
  inviteId: string | null
  message: string
  read: boolean
  createdAt: string
}

interface GroupInvite {
  inviteId: string
  groupId: string
  groupName: string
  groupDescription: string | null
  memberCount: number
  invitedAt: string
}

export default function NotificationsPage() {
  const { authenticated, user, getAccessToken } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [groupInvites, setGroupInvites] = useState<GroupInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async (showLoading = true, silent = false) => {
    if (showLoading) {
      setLoading(true)
    }
    const token = await getAccessToken()

    if (!token) {
      if (showLoading) {
        setLoading(false)
      }
      return
    }

    const [notifResponse, invitesResponse] = await Promise.all([
      fetch('/api/notifications?limit=100', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }),
      fetch('/api/groups/invites', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }),
    ])

    if (notifResponse.ok) {
      const data = await notifResponse.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } else {
      console.error('Failed to fetch notifications:', notifResponse.statusText)
      if (!silent) {
        toast.error('Failed to refresh notifications')
      }
    }

    if (invitesResponse.ok) {
      const data = await invitesResponse.json()
      setGroupInvites(data.invites || [])
    }

    if (!silent && notifResponse.ok) {
      toast.success('Notifications refreshed')
    }

    if (showLoading) {
      setLoading(false)
    }
  }, [getAccessToken])

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

    // Poll for new notifications every 1 minute when page is visible
    // Use silent refresh (no loading indicator) for polling
    const interval = setInterval(() => {
      // Only refresh if page is visible (not in background tab)
      if (document.visibilityState === 'visible') {
        fetchNotifications(false, true) // Silent refresh, no loading indicator, no toast
      }
    }, 60000) // 60 seconds = 1 minute

    return () => clearInterval(interval)
  }, [authenticated, user, fetchNotifications])

  const markAsRead = useCallback(async (notificationId: string, isAlreadyRead: boolean) => {
    // Skip if already marked as read
    if (isAlreadyRead) {
      return
    }
    
    const token = await getAccessToken()

    if (!token) return

    // Update local state optimistically first
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
    )
    setUnreadCount(prev => Math.max(0, prev - 1))

    // Then make the API call
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

    if (!response.ok) {
      console.error('Failed to mark notification as read:', response.statusText)
      // Revert optimistic update on error
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: false } : n))
      )
      setUnreadCount(prev => prev + 1)
    }
  }, [getAccessToken])

  // Intersection Observer - marks notifications as read after viewing for 3 seconds
  useEffect(() => {
    if (!authenticated || notifications.length === 0) return

    const timers = new Map<string, NodeJS.Timeout>()
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const notificationId = entry.target.getAttribute('data-notification-id')
          if (!notificationId) return

          const notification = notifications.find(n => n.id === notificationId)
          if (!notification || notification.read) return

          if (entry.isIntersecting) {
            // Clear any existing timer first (in case notification re-enters viewport)
            const existingTimer = timers.get(notificationId)
            if (existingTimer) {
              clearTimeout(existingTimer)
            }
            
            // Start a timer when notification becomes visible
            const timer = setTimeout(() => {
              markAsRead(notificationId, false)
            }, 3000) // 3 seconds delay
            
            timers.set(notificationId, timer)
          } else {
            // Cancel timer if notification leaves viewport before 3 seconds
            const timer = timers.get(notificationId)
            if (timer) {
              clearTimeout(timer)
              timers.delete(notificationId)
            }
          }
        })
      },
      {
        threshold: 0.5, // At least 50% of notification must be visible
        rootMargin: '-50px' // Adds margin to trigger when fully in view
      }
    )

    // Observe all notification elements
    const notificationElements = document.querySelectorAll('[data-notification-id]')
    notificationElements.forEach((el) => observer.observe(el))

    // Cleanup
    return () => {
      observer.disconnect()
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [notifications, authenticated, markAsRead])

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
    // Group chat invite - go to chat
    if (notification.type === 'system' && notification.message.includes('invited you to')) {
      // Extract chat ID from the message or notification data
      // For now, go to chats page where they can see their invitations
      return '/chats'
    }
    
    // DM or group chat message - go to the specific chat
    if (notification.type === 'system' && (notification.message.includes('Message') || notification.message.includes('message'))) {
      return '/chats'
    }
    
    // Profile completion - go to settings
    if (notification.type === 'system' && notification.message.includes('profile')) {
      return '/settings'
    }
    
    // Follow notification - go to the follower's profile
    if (notification.type === 'follow' && notification.actorId) {
      return `/profile/${notification.actorId}`
    }
    
    // Comment or reaction on post - go to the post detail page
    if ((notification.type === 'comment' || notification.type === 'reaction' || notification.type === 'reply') && notification.postId) {
      return `/post/${notification.postId}`
    }
    
    // Share notification - go to the post
    if (notification.type === 'share' && notification.postId) {
      return `/post/${notification.postId}`
    }
    
    // Mention - go to the post if available
    if (notification.type === 'mention' && notification.postId) {
      return `/post/${notification.postId}`
    }
    
    // Default: go to feed
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
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {unreadCount} unread
            </p>
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
          <div className="max-w-feed mx-auto space-y-4">
            {/* Group Invites Section */}
            {groupInvites.length > 0 && (
              <div className="px-4 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Pending Group Invites</h3>
                {groupInvites.map((invite) => (
                  <GroupInviteCard
                    key={invite.inviteId}
                    inviteId={invite.inviteId}
                    groupId={invite.groupId}
                    groupName={invite.groupName}
                    groupDescription={invite.groupDescription}
                    memberCount={invite.memberCount}
                    invitedAt={invite.invitedAt}
                    onAccepted={(_groupId, chatId) => {
                      // Refresh invites list
                      fetchNotifications(false, true)
                      toast.success('Joined group!')
                      // Navigate to chat if available
                      if (chatId) {
                        router.push(`/chats?chat=${chatId}`)
                      }
                    }}
                    onDeclined={() => {
                      // Refresh invites list
                      fetchNotifications(false, true)
                      toast.success('Invite declined')
                    }}
                  />
                ))}
              </div>
            )}

            {/* Regular Notifications */}
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                href={getNotificationLink(notification)}
                onClick={() => markAsRead(notification.id, notification.read)}
                data-notification-id={notification.id}
                className={cn(
                  'block px-4 py-4 border-b border-border',
                  'hover:bg-muted/30 transition-colors',
                  !notification.read && 'bg-primary/5'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Unread Indicator - moved to left */}
                  {!notification.read && (
                    <div className="w-2 h-2 bg-primary rounded-full shrink-0 mt-2" />
                  )}
                  
                  {/* Actor Avatar */}
                  {notification.actor ? (
                    <Avatar
                      id={notification.actor.id}
                      name={notification.actor.displayName}
                      size="md"
                      className="shrink-0"
                    />
                  ) : (
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
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
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        {notification.type === 'system' ? (
                          <p className="text-foreground leading-relaxed">
                            {notification.message}
                          </p>
                        ) : (
                          <p className="text-foreground leading-relaxed">
                            {notification.type !== 'system' ? (
                              <>
                                <span className="font-semibold">
                                  {notification.actor?.displayName || 'Someone'}
                                </span>
                                {' '}
                                <span className="text-muted-foreground">
                                  {getNotificationIcon(notification.type)}{' '}
                                  {notification.message.replace(notification.actor?.displayName || '', '').replace(/^:\s*/, '')}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                {getNotificationIcon(notification.type)} {notification.message}
                              </span>
                            )}
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
