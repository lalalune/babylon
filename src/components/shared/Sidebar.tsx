'use client'

import { LoginButton } from '@/components/auth/LoginButton'
import { UserMenu } from '@/components/auth/UserMenu'
import { Avatar } from '@/components/shared/Avatar'
import { Separator } from '@/components/shared/Separator'
import { useAuth } from '@/hooks/useAuth'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import { cn } from '@/lib/utils'
import { Bell, Bot, Check, Copy, Gift, Home, LogOut, MessageCircle, Shield, TrendingUp, Trophy, User } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'

function SidebarContent() {
  const [showMdMenu, setShowMdMenu] = useState(false)
  const [copiedReferral, setCopiedReferral] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const mdMenuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { ready, authenticated, user, logout } = useAuth()
  const { totalUnread: unreadMessages } = useUnreadMessages()

  // Check if dev mode is enabled via URL parameter
  const isDevMode = searchParams.get('dev') === 'true'
  
  // Hide sidebar on production (babylon.market) on home page unless ?dev=true
  const isProduction = typeof window !== 'undefined' && window.location.hostname === 'babylon.market'
  const isHomePage = pathname === '/'
  const shouldHideSidebar = isProduction && isHomePage && !isDevMode

  // Check if user is admin from the user object
  const isAdmin = user?.isAdmin ?? false

  // All hooks must be called before any conditional returns
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mdMenuRef.current && !mdMenuRef.current.contains(event.target as Node)) {
        setShowMdMenu(false)
      }
    }

    if (showMdMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
    return undefined
  }, [showMdMenu])

  // Poll for unread notifications
  useEffect(() => {
    if (!authenticated || !user) {
      setUnreadNotifications(0)
      return
    }

    const fetchUnreadCount = async () => {
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      
      if (!token) {
        return
      }

      const response = await fetch('/api/notifications?unreadOnly=true&limit=1', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUnreadNotifications(data.unreadCount || 0)
      }
    }

    fetchUnreadCount()

    // Refresh every 1 minute
    const interval = setInterval(fetchUnreadCount, 60000) // 60 seconds = 1 minute
    return () => clearInterval(interval)
  }, [authenticated, user])

  const copyReferralCode = async () => {
    if (!user?.referralCode) return
    
    await navigator.clipboard.writeText(user.referralCode)
    setCopiedReferral(true)
    setTimeout(() => setCopiedReferral(false), 2000)
  }

  // Render nothing if sidebar should be hidden (after all hooks)
  if (shouldHideSidebar) {
    return null
  }

  const navItems = [
    {
      name: 'Home',
      href: '/feed',
      icon: Home,
      color: '#0066FF',
      active: pathname === '/feed' || pathname === '/',
    },
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      color: '#0066FF',
      active: pathname === '/notifications',
    },
    {
      name: 'Leaderboard',
      href: '/leaderboard',
      icon: Trophy,
      color: '#0066FF',
      active: pathname === '/leaderboard',
    },
    {
      name: 'Markets',
      href: '/markets',
      icon: TrendingUp,
      color: '#0066FF',
      active: pathname === '/markets',
    },
    {
      name: 'Chats',
      href: '/chats',
      icon: MessageCircle,
      color: '#0066FF',
      active: pathname === '/chats',
    },
    {
      name: 'Agents',
      href: '/agents',
      icon: Bot,
      color: '#0066FF',
      active: pathname === '/agents' || pathname.startsWith('/agents/'),
    },
    {
      name: 'Rewards',
      href: '/rewards',
      icon: Gift,
      color: '#a855f7',
      active: pathname === '/rewards',
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: User,
      color: '#0066FF',
      active: pathname === '/profile',
    },
    // Admin link (only shown for admins)
    ...(isAdmin ? [{
      name: 'Admin',
      href: '/admin',
      icon: Shield,
      color: '#f97316',
      active: pathname === '/admin',
    }] : []),
  ]

  return (
    <>
      {/* Responsive sidebar: icons only on tablet (md), icons + names on desktop (lg+) */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col h-screen sticky top-0',
          'bg-sidebar',
          'transition-all duration-300',
          'md:w-20 lg:w-64'
        )}
      >
      {/* Header - Logo */}
      <div className="p-6 flex items-center justify-center lg:justify-start">
        <Link
          href="/feed"
          className="hover:scale-105 transition-transform duration-300"
        >
          {/* Icon-only logo for md (tablet) */}
          <Image
            src="/assets/logos/logo.svg"
            alt="Babylon Logo"
            width={32}
            height={32}
            className="w-8 h-8 lg:hidden"
          />
          {/* Full logo with text for lg+ (desktop) */}
          <Image
            src="/assets/logos/logo_full.svg"
            alt="Babylon"
            width={160}
            height={38}
            className="hidden lg:block h-8 w-auto"
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const hasNotificationBadge = (item.name === 'Notifications' && unreadNotifications > 0) || 
                                        (item.name === 'Chats' && unreadMessages > 0)
          return (
            <Link
              key={item.name}
              href={item.href}
              prefetch={true}
              className={cn(
                'group relative flex items-center px-4 py-3',
                'transition-colors duration-200',
                'md:justify-center lg:justify-start',
                !item.active && 'bg-transparent hover:bg-sidebar-accent'
              )}
              title={item.name}
              style={{
                backgroundColor: item.active ? item.color : undefined,
              }}
              onMouseEnter={(e) => {
                if (!item.active) {
                  e.currentTarget.style.backgroundColor = item.color
                }
              }}
              onMouseLeave={(e) => {
                if (!item.active) {
                  e.currentTarget.style.backgroundColor = ''
                }
              }}
            >
              {/* Icon with notification indicator */}
              <div className="relative lg:mr-3">
                <Icon
                  className={cn(
                    'w-6 h-6 flex-shrink-0',
                    'transition-all duration-300',
                    'group-hover:scale-110',
                    !item.active && 'text-sidebar-foreground'
                  )}
                  style={{
                    color: item.active ? '#e4e4e4' : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!item.active) {
                      e.currentTarget.style.color = '#e4e4e4'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!item.active) {
                      e.currentTarget.style.color = ''
                    }
                  }}
                />
                {hasNotificationBadge && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-sidebar" />
                )}
              </div>

              {/* Label - hidden on tablet (md), shown on desktop (lg+) */}
              <span
                className={cn(
                  'hidden lg:block',
                  'text-lg transition-colors duration-300',
                  item.active ? 'font-semibold' : 'text-sidebar-foreground'
                )}
                style={{
                  color: item.active ? '#e4e4e4' : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!item.active) {
                    e.currentTarget.style.color = '#e4e4e4'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!item.active) {
                    e.currentTarget.style.color = ''
                  }
                }}
              >
                {item.name}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Separator - only shown on desktop */}
      <div className="hidden lg:block px-4 py-2">
        <Separator />
      </div>

      {/* Bottom Section - Authentication (Desktop lg+) */}
      <div className="hidden lg:block p-4">
        {!ready ? (
          // Skeleton loader while authentication is initializing
          <div className="flex items-center gap-3 p-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-sidebar-accent/50" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-4 bg-sidebar-accent/50 rounded w-24" />
              <div className="h-3 bg-sidebar-accent/30 rounded w-16" />
            </div>
          </div>
        ) : authenticated ? (
          <UserMenu />
        ) : (
          <LoginButton />
        )}
      </div>

      {/* Bottom Section - User Icon (Tablet md) */}
      {authenticated && user && (
        <div className="md:block lg:hidden relative" ref={mdMenuRef}>
          <div className="p-4 flex justify-center">
            <button
              onClick={() => setShowMdMenu(!showMdMenu)}
              className="hover:opacity-80 transition-opacity"
              aria-label="Open user menu"
            >
              <Avatar 
                id={user.id} 
                name={user.displayName || user.email || 'User'} 
                type="user"
                size="md"
                src={user.profileImageUrl || undefined}
                imageUrl={user.profileImageUrl || undefined}
              />
            </button>
          </div>

          {/* Dropdown Menu - Icon Only */}
          {showMdMenu && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-auto bg-sidebar border border-border rounded-lg shadow-lg overflow-hidden z-50">
              {/* Referral Code */}
              {user.referralCode && (
                <button
                  onClick={copyReferralCode}
                  className="w-full flex items-center justify-center p-3 hover:bg-sidebar-accent transition-colors"
                  title={copiedReferral ? "Copied!" : "Copy Referral Link"}
                  aria-label={copiedReferral ? "Copied!" : "Copy Referral Link"}
                >
                  {copiedReferral ? (
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Copy className="w-5 h-5 text-sidebar-foreground flex-shrink-0" />
                  )}
                </button>
              )}
              
              {/* Separator */}
              {user.referralCode && <div className="border-t border-border" />}
              
              {/* Logout */}
              <button
                onClick={() => {
                  setShowMdMenu(false)
                  logout()
                }}
                className="w-full flex items-center justify-center p-3 hover:bg-destructive/10 transition-colors text-destructive"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
    </>
  )
}

export function Sidebar() {
  return (
    <Suspense fallback={null}>
      <SidebarContent />
    </Suspense>
  )
}
