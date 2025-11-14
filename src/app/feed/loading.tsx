'use client'

import { PageContainer } from '@/components/shared/PageContainer'
import { FeedSkeleton } from '@/components/shared/Skeleton'
import { FeedToggle } from '@/components/shared/FeedToggle'

export default function FeedLoading() {
  return (
    <PageContainer noPadding className="flex flex-col min-h-screen w-full">
      {/* Mobile: Header with tabs */}
      <div className="sticky top-0 z-10 bg-background shadow-sm flex-shrink-0 md:hidden">
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2">
          <div className="flex-shrink-0">
            <FeedToggle activeTab="latest" onTabChange={() => {}} />
          </div>
        </div>
      </div>

      {/* Desktop: Multi-column layout */}
      <div className="hidden lg:flex flex-1 min-h-0">
        {/* Left: Feed area */}
        <div className="flex-1 flex flex-col min-w-0 border-l border-r border-[rgba(120,120,120,0.5)]">
          {/* Desktop: Top bar with tabs */}
          <div className="sticky top-0 z-10 bg-background shadow-sm flex-shrink-0">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <FeedToggle activeTab="latest" onTabChange={() => {}} />
              </div>
            </div>
          </div>

          {/* Feed content */}
          <div className="flex-1 bg-background">
            <div className="w-full px-6 max-w-[700px] mx-auto">
              <FeedSkeleton count={8} />
            </div>
          </div>
        </div>

        {/* Right: Widget placeholder */}
        <div className="w-80 xl:w-96 flex-shrink-0 border-l border-border/5 bg-background" />
      </div>

      {/* Mobile/Tablet: Feed area */}
      <div className="flex lg:hidden flex-1 overflow-y-auto overflow-x-hidden bg-background w-full">
        <div className="w-full px-4">
          <FeedSkeleton count={6} />
        </div>
      </div>
    </PageContainer>
  )
}



