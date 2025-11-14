import { PageContainer } from '@/components/shared/PageContainer'
import { Skeleton } from '@/components/shared/Skeleton'

export default function SettingsLoading() {
  return (
    <PageContainer>
      <div className="w-full max-w-2xl mx-auto space-y-6 px-4 sm:px-0">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-32 max-w-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>

        {/* Settings Sections */}
        {Array.from({ length: 4 }).map((_, sectionIdx) => (
          <div key={sectionIdx} className="bg-card/50 backdrop-blur rounded-lg p-4 sm:p-6 border border-border space-y-4">
            <Skeleton className="h-6 w-40 max-w-full mb-4" />
            {Array.from({ length: 3 }).map((_, itemIdx) => (
              <div key={itemIdx} className="flex items-center justify-between gap-3 py-3 border-b border-border/5 last:border-0">
                <div className="space-y-2 flex-1 min-w-0">
                  <Skeleton className="h-4 w-32 max-w-full" />
                  <Skeleton className="h-3 w-48 max-w-full" />
                </div>
                <Skeleton className="h-8 w-16 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        ))}

        {/* Action Buttons */}
        <div className="flex gap-3 flex-wrap">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
    </PageContainer>
  )
}

