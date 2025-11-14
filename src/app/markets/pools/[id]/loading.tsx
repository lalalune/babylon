import { PageContainer } from '@/components/shared/PageContainer'
import { Skeleton, StatsCardSkeleton } from '@/components/shared/Skeleton'

export default function PoolDetailLoading() {
  return (
    <PageContainer>
      <div className="w-full max-w-4xl mx-auto space-y-6 px-4 sm:px-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-3 flex-1 min-w-0">
            <Skeleton className="h-8 w-64 max-w-full" />
            <div className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
              <div className="space-y-2 flex-1 min-w-0">
                <Skeleton className="h-4 w-32 max-w-full" />
                <Skeleton className="h-3 w-24 max-w-full" />
              </div>
            </div>
          </div>
          <Skeleton className="h-10 w-32 flex-shrink-0 rounded-lg" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>

        {/* Performance Chart */}
        <div className="bg-card/50 backdrop-blur rounded-lg p-4 sm:p-6 border border-border space-y-4">
          <Skeleton className="h-6 w-48 max-w-full" />
          <Skeleton className="h-48 sm:h-64 w-full rounded-lg" />
        </div>

        {/* Deposit/Withdraw Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card/50 backdrop-blur rounded-lg p-4 sm:p-6 border border-border space-y-4">
            <Skeleton className="h-6 w-24 max-w-full" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
          <div className="bg-card/50 backdrop-blur rounded-lg p-4 sm:p-6 border border-border space-y-4">
            <Skeleton className="h-6 w-24 max-w-full" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>

        {/* Holdings Table */}
        <div className="bg-card/50 backdrop-blur rounded-lg p-4 sm:p-6 border border-border space-y-4 overflow-x-auto">
          <Skeleton className="h-6 w-32 max-w-full" />
          <div className="space-y-2 min-w-[500px]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-2 sm:gap-4 p-3 bg-muted/30 rounded">
                <Skeleton className="h-4 w-20 sm:w-24" />
                <Skeleton className="h-4 w-16 sm:w-20" />
                <Skeleton className="h-4 w-12 sm:w-16" />
                <Skeleton className="h-4 w-16 sm:w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

