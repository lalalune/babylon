'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { X, Home, TrendingUp, MessageCircle, Trophy, Gift, Bell, LogOut, Coins, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { useLoginModal } from '@/hooks/useLoginModal'
import { usePathname, useSearchParams } from 'next/navigation'
import { Avatar } from '@/components/shared/Avatar'
import { Suspense } from 'react'

function MobileHeaderContent() {
  const { authenticated, logout } = useAuth()
  const { user, setUser } = useAuthStore()
  const { showLoginModal } = useLoginModal()
  const [showSideMenu, setShowSideMenu] = useState(false)
  const [pointsData, setPointsData] = useState<{ available: number; total: number } | null>(null)
  const [copiedReferral, setCopiedReferral] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Check if dev mode is enabled via URL parameter
  const isDevMode = searchParams.get('dev') === 'true'
  
  // Hide mobile header on production (babylon.market) on home page unless ?dev=true
  const isProduction = typeof window !== 'undefined' && window.location.hostname === 'babylon.market'
  const isHomePage = pathname === '/'
  const shouldHide = isProduction && isHomePage && !isDevMode

  // All hooks must be called before any conditional returns
  useEffect(() => {
    if (!authenticated || !user?.id || user.profileImageUrl) {
      return
    }

    const controller = new AbortController()

    const hydrateProfileImage = async () => {
      try {
        const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/profile`, {
          signal: controller.signal,
        })
        if (!response.ok) return
        const data = await response.json().catch(() => ({}))
        const profileUrl = data?.user?.profileImageUrl as string | undefined
        const coverUrl = data?.user?.coverImageUrl as string | undefined
        if (profileUrl || coverUrl) {
          setUser({
            ...user,
            profileImageUrl: profileUrl ?? user.profileImageUrl,
            coverImageUrl: coverUrl ?? user.coverImageUrl,
          })
        }
      } catch (error) {
        if ((error as DOMException).name === 'AbortError') return
      }
    }

    void hydrateProfileImage()

    return () => controller.abort()
  }, [authenticated, setUser, user?.id, user?.profileImageUrl, user?.coverImageUrl])

  useEffect(() => {
    const fetchPoints = async () => {
      if (!authenticated || !user?.id) {
        setPointsData(null)
        return
      }

      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null
      if (!token) {
        // No token available yet, skip fetching protected data
        return
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }

      const response = await fetch(`/api/users/${encodeURIComponent(user.id)}/balance`, { headers })
      if (response.ok) {
        const data = await response.json()
        setPointsData({
          available: Number(data.balance || 0),
          total: Number(data.totalDeposited || 0),
        })
      }
    }

    fetchPoints()
    const interval = setInterval(fetchPoints, 30000)
    return () => clearInterval(interval)
  }, [authenticated, user?.id])

  const copyReferralCode = async () => {
    if (!user?.referralCode) return
    
    try {
      // Create full referral URL
      const referralUrl = `${window.location.origin}?ref=${user.referralCode}`
      await navigator.clipboard.writeText(referralUrl)
      setCopiedReferral(true)
      setTimeout(() => setCopiedReferral(false), 2000)
    } catch (err) {
      console.error('Failed to copy referral code:', err)
    }
  }

  // Render nothing if should be hidden (after all hooks)
  if (shouldHide) {
    return null
  }

  const menuItems = [
    {
      name: 'Feed',
      href: '/feed',
      icon: Home,
      active: pathname === '/feed' || pathname === '/',
    },
    {
      name: 'Markets',
      href: '/markets',
      icon: TrendingUp,
      active: pathname === '/markets',
    },
    {
      name: 'Chats',
      href: '/chats',
      icon: MessageCircle,
      active: pathname === '/chats',
    },
    {
      name: 'Leaderboards',
      href: '/leaderboard',
      icon: Trophy,
      active: pathname === '/leaderboard',
    },
    {
      name: 'Rewards',
      href: '/rewards',
      icon: Gift,
      active: pathname === '/rewards',
    },
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      active: pathname === '/notifications',
    },
  ]

  return (
    <>
      <header
        className={cn(
          'md:hidden',
          'fixed top-0 left-0 right-0 z-40',
          'bg-sidebar/95',
        )}
      >
        <div className="flex items-center justify-between h-14 px-4">
          {/* Left: Profile Picture (when authenticated) or Login button */}
          <div className="flex-shrink-0 w-8">
            {authenticated && user ? (
              <button
                onClick={() => setShowSideMenu(true)}
                className="hover:opacity-80 transition-opacity"
                aria-label="Open profile menu"
              >
                <Avatar 
                  id={user.id} 
                  name={user.displayName || user.email || 'User'} 
                  type="user"
                  size="sm"
                  src={user.profileImageUrl || undefined}
                  imageUrl={user.profileImageUrl || undefined}
                />
              </button>
            ) : !authenticated ? (
              <button
                onClick={() => showLoginModal()}
                className="px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Login
              </button>
            ) : (
              <div className="w-8" />
            )}
          </div>

          {/* Center: Logo */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Link href="/feed" className="hover:scale-105 transition-transform duration-300">
              <Image
                src="/assets/logos/logo.svg"
                alt="Babylon Logo"
                width={28}
                height={28}
                className="w-7 h-7"
              />
            </Link>
          </div>

          {/* Right: Empty space for balance */}
          <div className="flex-shrink-0 w-8" />
        </div>
      </header>

      {/* Side Menu */}
      {showSideMenu && authenticated && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 md:hidden"
            onClick={() => setShowSideMenu(false)}
          />

          {/* Menu Panel - slides in from left */}
          <div className="fixed top-0 left-0 bottom-0 z-50 md:hidden bg-sidebar w-[280px] animate-in slide-in-from-left duration-300 flex flex-col">
            {/* Header - User Profile */}
            <Link 
              href="/profile"
              onClick={() => setShowSideMenu(false)}
              className="flex items-center justify-between p-4 hover:bg-sidebar-accent transition-colors flex-shrink-0"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar 
                  id={user?.id} 
                  name={user?.displayName || user?.email || 'User'} 
                  type="user"
                  size="md"
                  src={user?.profileImageUrl || undefined}
                  imageUrl={user?.profileImageUrl || undefined}
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-foreground truncate">
                    {user?.displayName || user?.email || 'User'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    @{user?.username || `user${user?.id.slice(0, 8)}`}
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  setShowSideMenu(false)
                }}
                className="p-2 hover:bg-muted transition-colors flex-shrink-0"
              >
                <X size={20} style={{ color: '#0066FF' }} />
              </button>
            </Link>

            {/* Points Display */}
            {pointsData && (
              <div className="px-4 py-4 bg-muted/30 flex-shrink-0">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#0066FF' }}>
                    <Coins className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Balance</div>
                    <div className="font-bold text-base text-foreground mt-1">
                      {pointsData.available.toLocaleString()} pts
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Menu Items - Scrollable */}
            <nav className="flex-1 overflow-y-auto min-h-0">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setShowSideMenu(false)}
                    className={cn(
                      'flex items-center gap-4 px-4 py-3 transition-colors',
                      item.active 
                        ? 'bg-[#0066FF] text-white font-bold' 
                        : 'text-sidebar-foreground hover:bg-sidebar-accent font-semibold'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-base">{item.name}</span>
                  </Link>
                )
              })}
            </nav>

            {/* Bottom Section - Referral & Logout */}
            <div className="flex-shrink-0 border-t border-border bg-sidebar pb-20">
              {/* Referral Code Button */}
              {user?.referralCode && (
                <button
                  onClick={copyReferralCode}
                  className="flex items-center gap-4 px-4 py-3 w-full text-left hover:bg-sidebar-accent transition-colors font-semibold"
                >
                  {copiedReferral ? (
                    <>
                      <Check className="w-5 h-5 text-green-500" />
                      <span className="text-base text-green-500">Referral Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" style={{ color: '#0066FF' }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-base text-foreground">Copy Referral Link</div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {typeof window !== 'undefined' && `${window.location.host}?ref=${user.referralCode}`}
                        </div>
                      </div>
                    </>
                  )}
                </button>
              )}
              
              {/* Separator */}
              {user?.referralCode && <div className="border-t border-border" />}
              
              {/* Logout Button */}
              <button
                onClick={() => {
                  setShowSideMenu(false)
                  logout()
                }}
                className="flex items-center gap-4 px-4 py-3 w-full text-left text-destructive hover:bg-destructive/10 transition-colors font-semibold"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-base">Logout</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export function MobileHeader() {
  return (
    <Suspense fallback={null}>
      <MobileHeaderContent />
    </Suspense>
  )
}
