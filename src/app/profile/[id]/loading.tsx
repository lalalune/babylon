import { PageContainer } from '@/components/shared/PageContainer'
import { ProfileHeaderSkeleton, FeedSkeleton } from '@/components/shared/Skeleton'

export default function ProfileLoading() {
  return (
    <PageContainer noPadding className="flex flex-col min-h-screen">
      {/* Desktop */}
      <div className="hidden lg:flex flex-1">
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 border-l border-r border-[rgba(120,120,120,0.5)]">
          <div className="flex-1 overflow-y-auto">
            <div className="w-full max-w-[700px] mx-auto">
              {/* Profile Header */}
              <ProfileHeaderSkeleton />
              
              {/* Posts */}
              <div className="border-t border-border/5 mt-4">
                <FeedSkeleton count={5} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Widget placeholder */}
        <div className="w-80 xl:w-96 shrink-0 border-l border-border/5 bg-background" />
      </div>

      {/* Mobile/Tablet */}
      <div className="flex lg:hidden flex-1 overflow-y-auto">
        <div className="w-full">
          {/* Profile Header */}
          <ProfileHeaderSkeleton />
          
          {/* Posts */}
          <div className="border-t border-border/5 mt-4">
            <FeedSkeleton count={4} />
          </div>
        </div>
      </div>
    </PageContainer>
  )
}








