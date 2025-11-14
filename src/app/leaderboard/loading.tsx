import { PageContainer } from '@/components/shared/PageContainer'
import { LeaderboardSkeleton, Skeleton } from '@/components/shared/Skeleton'

export default function LeaderboardLoading() {
  return (
    <PageContainer noPadding className="flex flex-col">
      {/* Desktop */}
      <div className="hidden sm:flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="w-full max-w-4xl mx-auto px-4 lg:px-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4 px-4 pt-4">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="w-4 h-4 rounded" />
            </div>
            
            {/* Leaderboard List */}
            <LeaderboardSkeleton count={15} />
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="flex sm:hidden flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="w-full px-4 sm:px-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4 pt-4 pb-2">
              <Skeleton className="w-5 h-5 rounded" />
              <Skeleton className="h-5 w-28" />
              <Skeleton className="w-4 h-4 rounded" />
            </div>
            
            {/* Leaderboard List */}
            <LeaderboardSkeleton count={10} />
          </div>
        </div>
      </div>
    </PageContainer>
  )
}



