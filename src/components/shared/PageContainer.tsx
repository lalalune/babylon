import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { forwardRef } from 'react'

interface PageContainerProps {
  children: ReactNode
  className?: string
  noPadding?: boolean
}

export const PageContainer = forwardRef<HTMLDivElement, PageContainerProps>(
  ({ children, className, noPadding = false }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Sharp corners, simple boxy layout
          'bg-background overflow-hidden',
          'h-full min-h-full w-full',
          // Desktop: Simple container - use full height
          'md:h-full',
          // Consistent padding: 16px mobile, 24px desktop
          !noPadding && 'px-4 md:px-6',
          className
        )}
      >
        {children}
      </div>
    )
  }
)

PageContainer.displayName = 'PageContainer'
