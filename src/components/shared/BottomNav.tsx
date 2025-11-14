'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Home, TrendingUp, MessageCircle, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Suspense } from 'react'

function BottomNavContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Check if dev mode is enabled via URL parameter
  const isDevMode = searchParams.get('dev') === 'true'
  
  // Hide bottom nav on production (babylon.market) on home page unless ?dev=true
  const isProduction = typeof window !== 'undefined' && window.location.hostname === 'babylon.market'
  const isHomePage = pathname === '/'
  const shouldHide = isProduction && isHomePage && !isDevMode

  // If should be hidden, don't render anything
  if (shouldHide) {
    return null
  }

  const navItems = [
    {
      name: 'Feed',
      href: '/feed',
      icon: Home,
      color: '#0066FF',
      active: pathname === '/feed' || pathname === '/',
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
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      color: '#0066FF',
      active: pathname === '/notifications',
    }
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-sidebar border-t border-border bottom-nav-rounded">
      {/* Navigation Items */}
      <div className="flex justify-between items-center h-14 px-4 safe-area-bottom">
        <div className="flex justify-around items-center flex-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center justify-center w-12 h-12 rounded-lg transition-colors duration-200',
                  'hover:bg-sidebar-accent/50'
                )}
                aria-label={item.name}
              >
                <Icon
                  className={cn(
                    'w-6 h-6 transition-colors duration-200',
                    item.active ? 'text-sidebar-primary' : 'text-sidebar-foreground'
                  )}
                  style={{
                    color: item.active ? item.color : undefined,
                  }}
                />
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavContent />
    </Suspense>
  )
}
