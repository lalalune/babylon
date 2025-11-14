'use client'

import { cn } from '@/lib/utils'

interface FeedToggleProps {
  activeTab: 'latest' | 'following'
  onTabChange: (tab: 'latest' | 'following') => void
}

export function FeedToggle({ activeTab, onTabChange }: FeedToggleProps) {
  return (
    <div className="flex items-center gap-4 sm:gap-6">
      <button
        onClick={() => onTabChange('latest')}
        className={cn(
          'px-2 sm:px-3 py-2 font-semibold text-sm sm:text-base transition-all duration-300',
          'relative whitespace-nowrap',
          activeTab === 'latest'
            ? 'text-foreground opacity-100'
            : 'text-foreground opacity-50 hover:opacity-75'
        )}
      >
        Latest
      </button>
      <button
        onClick={() => onTabChange('following')}
        className={cn(
          'px-2 sm:px-3 py-2 font-semibold text-sm sm:text-base transition-all duration-300',
          'relative whitespace-nowrap',
          activeTab === 'following'
            ? 'text-foreground opacity-100'
            : 'text-foreground opacity-50 hover:opacity-75'
        )}
      >
        Following
      </button>
    </div>
  )
}
