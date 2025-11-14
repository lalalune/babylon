import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-muted/50 rounded',
        className
      )}
      aria-hidden="true"
    />
  )
}

// Post Card Skeleton
export function PostCardSkeleton() {
  return (
    <div className="px-4 sm:px-6 py-4 sm:py-5 w-full border-b border-border/5">
      {/* Avatar + Header */}
      <div className="flex items-start gap-3 sm:gap-4 w-full mb-2">
        {/* Avatar */}
        <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex-shrink-0" />
        
        {/* Header */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-2 flex-1 min-w-0">
              <Skeleton className="h-5 w-32 sm:w-40 max-w-full" />
              <Skeleton className="h-4 w-24 sm:w-32 max-w-full" />
            </div>
            <Skeleton className="h-4 w-16 flex-shrink-0" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2 mb-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4 max-w-full" />
      </div>

      {/* Interaction Bar */}
      <div className="flex items-center gap-6 sm:gap-8">
        <Skeleton className="h-4 w-10 sm:w-12" />
        <Skeleton className="h-4 w-10 sm:w-12" />
        <Skeleton className="h-4 w-10 sm:w-12" />
      </div>
    </div>
  )
}

// Feed Skeleton - Multiple posts
export function FeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="w-full">
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Market Card Skeleton
export function MarketCardSkeleton() {
  return (
    <div className="p-3 rounded bg-muted/30">
      <div className="flex justify-between gap-3 mb-2">
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-5 w-20 max-w-full" />
          <Skeleton className="h-3 w-32 max-w-full" />
        </div>
        <div className="text-right space-y-2 flex-shrink-0">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
      <div className="flex gap-2 sm:gap-3 flex-wrap">
        <Skeleton className="h-3 w-16 sm:w-20" />
        <Skeleton className="h-3 w-16 sm:w-20" />
        <Skeleton className="h-3 w-16 sm:w-20" />
      </div>
    </div>
  )
}

// Markets List Skeleton
export function MarketsListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <MarketCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Chat List Item Skeleton
export function ChatListItemSkeleton() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-32 max-w-full" />
          <Skeleton className="h-3 w-48 max-w-full" />
        </div>
      </div>
    </div>
  )
}

// Chat List Skeleton
export function ChatListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="w-full">
      {Array.from({ length: count }).map((_, i) => (
        <ChatListItemSkeleton key={i} />
      ))}
    </div>
  )
}

// Chat Message Skeleton
export function ChatMessageSkeleton({ isCurrentUser = false }: { isCurrentUser?: boolean }) {
  return (
    <div className={cn('flex gap-3', isCurrentUser ? 'justify-end' : 'items-start')}>
      {!isCurrentUser && <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />}
      <div className={cn('max-w-[70%] min-w-0 space-y-2', isCurrentUser ? 'items-end' : 'items-start')}>
        <Skeleton className="h-3 w-24 max-w-full" />
        <Skeleton className={cn('h-20 rounded-2xl max-w-full', isCurrentUser ? 'w-36 sm:w-48' : 'w-40 sm:w-56')} />
      </div>
    </div>
  )
}

// Chat Messages Skeleton
export function ChatMessagesSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <ChatMessageSkeleton key={i} isCurrentUser={i % 3 === 0} />
      ))}
    </div>
  )
}

// Profile Header Skeleton
export function ProfileHeaderSkeleton() {
  return (
    <div className="p-4 sm:p-6">
      {/* Banner */}
      <Skeleton className="w-full h-32 sm:h-48 rounded-lg mb-4" />
      
      {/* Avatar and Info */}
      <div className="flex items-start gap-3 sm:gap-4 mb-4">
        <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
          <Skeleton className="h-5 sm:h-6 w-32 sm:w-40 max-w-full" />
          <Skeleton className="h-4 w-24 sm:w-32 max-w-full" />
          <div className="flex gap-2 flex-wrap">
            <Skeleton className="h-8 w-20 sm:w-24" />
            <Skeleton className="h-8 w-20 sm:w-24" />
          </div>
        </div>
      </div>
      
      {/* Bio */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4 max-w-full" />
      </div>
      
      {/* Stats */}
      <div className="flex gap-4 sm:gap-6 mt-4 flex-wrap">
        <div className="space-y-1">
          <Skeleton className="h-5 sm:h-6 w-14 sm:w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-5 sm:h-6 w-14 sm:w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-5 sm:h-6 w-14 sm:w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  )
}

// Leaderboard Item Skeleton
export function LeaderboardItemSkeleton() {
  return (
    <div className="p-3 sm:p-4">
      <div className="flex items-center gap-2 sm:gap-4">
        <Skeleton className="w-8 h-8 rounded flex-shrink-0" />
        <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-24 sm:w-32 max-w-full" />
          <Skeleton className="h-3 w-20 sm:w-24 max-w-full" />
        </div>
        <div className="text-right space-y-2 flex-shrink-0">
          <Skeleton className="h-4 sm:h-5 w-16 sm:w-20" />
          <Skeleton className="h-3 w-10 sm:w-12" />
        </div>
      </div>
    </div>
  )
}

// Leaderboard Skeleton
export function LeaderboardSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="w-full">
      {Array.from({ length: count }).map((_, i) => (
        <LeaderboardItemSkeleton key={i} />
      ))}
    </div>
  )
}

// Widget Panel Skeleton
export function WidgetPanelSkeleton() {
  return (
    <div className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border">
      <Skeleton className="h-5 w-32 max-w-full mb-3" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3 rounded-lg bg-muted/30 space-y-2">
            <Skeleton className="h-4 w-3/4 max-w-full" />
            <Skeleton className="h-3 w-1/2 max-w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Prediction Card Skeleton
export function PredictionCardSkeleton() {
  return (
    <div className="p-3 rounded bg-muted/30 space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4 max-w-full" />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2 sm:gap-3 flex-shrink-0">
          <Skeleton className="h-3 w-10 sm:w-12" />
          <Skeleton className="h-3 w-10 sm:w-12" />
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Skeleton className="h-3 w-14 sm:w-16" />
          <Skeleton className="h-3 w-14 sm:w-16" />
        </div>
      </div>
    </div>
  )
}

// Pool Card Skeleton
export function PoolCardSkeleton() {
  return (
    <div className="p-4 rounded-lg bg-muted/30 space-y-3">
      <div className="flex justify-between items-start gap-3">
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-4 w-32 max-w-full" />
          <Skeleton className="h-3 w-24 max-w-full" />
        </div>
        <Skeleton className="h-6 w-16 flex-shrink-0" />
      </div>
      <div className="flex gap-2 sm:gap-3 flex-wrap">
        <Skeleton className="h-3 w-16 sm:w-20" />
        <Skeleton className="h-3 w-16 sm:w-20" />
      </div>
    </div>
  )
}

// Stats Card Skeleton
export function StatsCardSkeleton() {
  return (
    <div className="bg-card/50 backdrop-blur rounded-lg p-4 sm:p-6 border border-border">
      <Skeleton className="h-4 w-24 max-w-full mb-2" />
      <Skeleton className="h-6 sm:h-8 w-28 sm:w-32 max-w-full mb-1" />
      <Skeleton className="h-3 w-20 max-w-full" />
    </div>
  )
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-2 sm:gap-4 p-2 sm:p-3 border-b border-border/5">
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="flex-1 min-w-0">
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  )
}

// Notification Item Skeleton
export function NotificationItemSkeleton() {
  return (
    <div className="p-4 border-b border-border/5">
      <div className="flex gap-3">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-3/4 max-w-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  )
}

// Page Header Skeleton
export function PageHeaderSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
      <Skeleton className="h-7 sm:h-8 w-40 sm:w-48 max-w-full" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <div className="flex gap-2 flex-wrap">
        <Skeleton className="h-10 w-28 sm:w-32" />
        <Skeleton className="h-10 w-28 sm:w-32" />
      </div>
    </div>
  )
}

