import { PageContainer } from '@/components/shared/PageContainer'
import { Skeleton, StatsCardSkeleton } from '@/components/shared/Skeleton'

export default function RewardsLoading() {
  return (
    <PageContainer>
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>

        {/* Referral Section */}
        <div className="bg-card/50 backdrop-blur rounded-lg p-4 sm:p-6 border border-border space-y-4">
          <Skeleton className="h-6 w-40 max-w-full" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <div className="flex gap-2 flex-wrap">
            <Skeleton className="h-10 flex-1 min-w-[200px]" />
            <Skeleton className="h-10 w-24 shrink-0" />
          </div>
        </div>

        {/* Rewards List */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card/50 backdrop-blur rounded-lg p-4 border border-border">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-2 flex-1 min-w-0">
                  <Skeleton className="h-5 w-32 max-w-full" />
                  <Skeleton className="h-4 w-48 max-w-full" />
                </div>
                <Skeleton className="h-6 w-16 shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}

