/**
 * RewardsSkeleton Component
 * 
 * Skeleton loader for the rewards page that matches the actual layout
 * to prevent layout shifts during loading
 */

import { Separator } from '@/components/shared/Separator'

function SkeletonBox({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  return (
    <div 
      className={`bg-muted/50 animate-pulse rounded ${className}`} 
      style={{ animationDelay: `${delay}ms` }}
      aria-hidden="true" 
    />
  )
}

function SkeletonText({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  return (
    <div 
      className={`bg-muted/50 animate-pulse rounded h-4 ${className}`} 
      style={{ animationDelay: `${delay}ms` }}
      aria-hidden="true" 
    />
  )
}

export function RewardsSkeleton() {
  return (
    <div role="status" aria-label="Loading rewards...">
      {/* Desktop Layout */}
      <div className="hidden xl:flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-4 sm:p-6 space-y-4">
          
          {/* Header */}
          <div className="mb-4">
            <SkeletonText className="w-32 h-8 mb-2" />
            <SkeletonText className="w-96 h-4" />
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Total Earned */}
            <div className="rounded-lg bg-gradient-to-r from-[#0066FF]/20 to-purple-500/20 p-4 border border-[#0066FF]/30">
              <div className="flex items-center gap-2 mb-2">
                <SkeletonBox className="w-5 h-5" delay={50} />
                <SkeletonText className="w-24 h-4" delay={50} />
              </div>
              <div className="bg-muted/50 animate-pulse rounded h-[1.875rem] w-20" style={{ animationDelay: '50ms' }} aria-hidden="true" />
            </div>

            {/* Current Balance */}
            <div className="rounded-lg bg-muted/30 border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <SkeletonBox className="w-5 h-5" delay={100} />
                <SkeletonText className="w-28 h-4" delay={100} />
              </div>
              <div className="bg-muted/50 animate-pulse rounded h-[1.875rem] w-24" style={{ animationDelay: '100ms' }} aria-hidden="true" />
            </div>

            {/* Total Referrals */}
            <div className="rounded-lg bg-muted/30 border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <SkeletonBox className="w-5 h-5" delay={150} />
                <SkeletonText className="w-28 h-4" delay={150} />
              </div>
              <div className="bg-muted/50 animate-pulse rounded h-[1.875rem] w-16" style={{ animationDelay: '150ms' }} aria-hidden="true" />
            </div>
          </div>

          {/* Reward Tasks */}
          <div className="rounded-lg bg-muted/30 border border-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <SkeletonBox className="w-5 h-5" />
              <SkeletonText className="w-28 h-5" />
            </div>

            <div className="grid gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 rounded-lg border bg-sidebar-accent/50 border-border"
                >
                  <SkeletonBox className="w-6 h-6 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <SkeletonText className="w-32 h-4" />
                    <SkeletonText className="w-48 h-3" />
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <SkeletonText className="w-12 h-4" />
                    <SkeletonText className="w-12 h-3" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Share Actions */}
          <div className="rounded-lg bg-muted/30 border border-border p-4">
            <div className="flex items-center gap-2 mb-4">
              <SkeletonBox className="w-5 h-5" />
              <SkeletonText className="w-32 h-5" />
            </div>

            <div className="space-y-3">
              <SkeletonText className="w-full h-4" />
              <SkeletonBox className="w-full h-10 rounded-lg" />
            </div>
          </div>

          <Separator />

          {/* Referral Link */}
          <div className="rounded-lg bg-muted/30 border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <SkeletonBox className="w-5 h-5" />
              <SkeletonText className="w-32 h-5" />
              <SkeletonText className="w-32 h-3 ml-auto" />
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <SkeletonBox className="flex-1 h-10 rounded-lg" />
                <SkeletonBox className="w-20 h-10 rounded-lg" />
              </div>
              <SkeletonBox className="w-full h-10 rounded-lg" />
            </div>
          </div>

          {/* Referred Users List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <SkeletonBox className="w-4 h-4" />
                <SkeletonText className="w-32 h-5" />
              </div>
            </div>

            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border"
                >
                  <SkeletonBox className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <SkeletonText className="w-32 h-4" />
                    <SkeletonText className="w-24 h-3" />
                    <SkeletonText className="w-28 h-3" />
                  </div>
                  <SkeletonBox className="w-6 h-6" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Layout */}
      <div className="flex xl:hidden flex-col flex-1 overflow-y-auto w-full">
        <div className="w-full px-4 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-6">
          
          {/* Header */}
          <div>
            <SkeletonText className="w-32 h-8 mb-2" />
            <SkeletonText className="w-full max-w-md h-4" />
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* Total Earned */}
            <div className="rounded-lg bg-gradient-to-r from-[#0066FF]/20 to-purple-500/20 p-3 border border-[#0066FF]/30">
              <div className="flex items-center gap-1 mb-1">
                <SkeletonBox className="w-4 h-4" />
                <SkeletonText className="w-16 h-3" />
              </div>
              <div className="bg-muted/50 animate-pulse rounded h-[1.5rem] w-16" aria-hidden="true" />
            </div>

            {/* Current Balance */}
            <div className="rounded-lg bg-muted/30 border border-border p-3">
              <div className="flex items-center gap-1 mb-1">
                <SkeletonBox className="w-4 h-4" />
                <SkeletonText className="w-16 h-3" />
              </div>
              <div className="bg-muted/50 animate-pulse rounded h-[1.5rem] w-20" aria-hidden="true" />
            </div>

            {/* Total Referrals */}
            <div className="rounded-lg bg-muted/30 border border-border p-3">
              <div className="flex items-center gap-1 mb-1">
                <SkeletonBox className="w-4 h-4" />
                <SkeletonText className="w-16 h-3" />
              </div>
              <div className="bg-muted/50 animate-pulse rounded h-[1.5rem] w-12" aria-hidden="true" />
            </div>
          </div>

          {/* Reward Tasks */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <SkeletonBox className="w-5 h-5" />
              <SkeletonText className="w-28 h-6" />
            </div>

            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 border-border"
                >
                  <SkeletonBox className="w-5 h-5 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <SkeletonText className="w-28 h-4" />
                    <SkeletonText className="w-40 h-3" />
                  </div>
                  <SkeletonText className="w-12 h-4 shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Share Actions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <SkeletonBox className="w-5 h-5" />
              <SkeletonText className="w-32 h-6" />
            </div>
            <SkeletonText className="w-full h-4" />
            <SkeletonBox className="w-full h-10 rounded-lg" />
          </div>

          <Separator />

          {/* Referral Link */}
          <div className="rounded-lg bg-muted/30 border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <SkeletonBox className="w-5 h-5" />
              <SkeletonText className="w-32 h-5" />
              <SkeletonText className="w-24 h-3 ml-2" />
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <SkeletonBox className="flex-1 min-w-0 h-10 rounded-lg" />
                <SkeletonBox className="w-12 h-10 rounded-lg shrink-0" />
              </div>
              <SkeletonBox className="w-full h-10 rounded-lg" />
            </div>
          </div>

          {/* Referred Users List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <SkeletonBox className="w-5 h-5" />
                <SkeletonText className="w-32 h-5" />
              </div>
            </div>

            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border"
                >
                  <SkeletonBox className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <SkeletonText className="w-32 h-4" />
                    <SkeletonText className="w-24 h-3" />
                    <SkeletonText className="w-28 h-3" />
                  </div>
                  <SkeletonBox className="w-6 h-6" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Screen reader announcement */}
      <span className="sr-only">Loading rewards content, please wait...</span>
    </div>
  )
}

