'use client'

import { cn } from '@/lib/utils'

interface FeedToggleProps {
  activeTab: 'latest' | 'following' | 'trades'
  onTabChange: (tab: 'latest' | 'following' | 'trades') => void
}

export function FeedToggle({ activeTab, onTabChange }: FeedToggleProps) {
  return (
    <div className="flex items-center w-full border-b border-border">
      <button
        onClick={() => onTabChange('latest')}
        className={cn(
          'flex-1 py-3.5 font-semibold transition-all relative hover:bg-muted/20',
          activeTab === 'latest' ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        Latest
        {activeTab === 'latest' && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary" />
        )}
      </button>
      <button
        onClick={() => onTabChange('following')}
        className={cn(
          'flex-1 py-3.5 font-semibold transition-all relative hover:bg-muted/20',
          activeTab === 'following' ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        Following
        {activeTab === 'following' && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary" />
        )}
      </button>
      <button
        onClick={() => onTabChange('trades')}
        className={cn(
          'flex-1 py-3.5 font-semibold transition-all relative hover:bg-muted/20',
          activeTab === 'trades' ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        Trades
        {activeTab === 'trades' && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary" />
        )}
      </button>
    </div>
  )
}
