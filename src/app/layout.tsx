import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Sidebar } from '@/components/shared/Sidebar'
import { MobileHeader } from '@/components/shared/MobileHeader'
import { BottomNav } from '@/components/shared/BottomNav'
import { Providers } from '@/components/providers/Providers'
import { Suspense } from 'react'

// Game tick runs via cron (production) or local-cron-simulator (development)
// No initialization needed in layout - tick runs independently
import { Toaster } from 'sonner'
import { GlobalLoginModal } from '@/components/auth/GlobalLoginModal'
import { FeedAuthBanner } from '@/components/auth/FeedAuthBanner'

// Vercel Analytics
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const metadata: Metadata = {
  title: 'Babylon',
  description: 'In a world where everything is predicted, what really matters? ',
  metadataBase: new URL('https://babylon.market'),
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'Babylon',
    description: 'In a world where everything is predicted, what really matters? ',
    url: 'https://babylon.market',
    siteName: 'Babylon',
    images: [
      {
        url: '/assets/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Babylon Prediction Market',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Babylon',
    description: 'In a world where everything is predicted, what really matters? ',
    images: ['/assets/images/og-image.png'],
  },
  other: {
    // Farcaster Mini App metadata
    // Reference: https://miniapps.farcaster.xyz/
    'fc:frame': 'vNext',
    'fc:frame:image': 'https://babylon.market/assets/images/og-image.png',
    'fc:frame:button:1': 'Launch Babylon',
    'fc:frame:button:1:action': 'link',
    'fc:frame:button:1:target': 'https://babylon.market',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Disable viewport scaling and overscroll for better pull-to-refresh control
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className="overscroll-none">
      <body className="antialiased bg-background font-sans overscroll-none" suppressHydrationWarning>
        <Providers>
          <Toaster position="top-center" richColors />
          <Suspense fallback={null}>
            <GlobalLoginModal />
          </Suspense>

          {/* Mobile Header - Fixed, not affected by pull-to-refresh */}
          <Suspense fallback={null}>
            <MobileHeader />
          </Suspense>

          <div className="flex min-h-screen max-w-screen-xl mx-auto bg-sidebar">
            {/* Desktop Sidebar - Sticky, not affected by pull-to-refresh */}
            <Suspense fallback={null}>
              <Sidebar />
            </Suspense>

            {/* Main Content Area - Scrollable content with pull-to-refresh */}
            <main className="flex-1 min-h-screen w-full pt-14 pb-14 md:pt-0 md:pb-0 bg-background overflow-hidden">
              <div className="h-[calc(100vh-7rem)] md:h-auto w-full overflow-y-auto overscroll-contain">
                {children}
              </div>
            </main>

            {/* Mobile Bottom Navigation - Fixed, not affected by pull-to-refresh */}
            <Suspense fallback={null}>
              <BottomNav />
            </Suspense>
          </div>

          {/* Auth Banner - shows on all pages when not authenticated */}
          <Suspense fallback={null}>
            <FeedAuthBanner />
          </Suspense>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
