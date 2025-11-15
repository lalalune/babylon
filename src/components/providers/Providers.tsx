'use client';

import { Fragment, Suspense, useEffect, useState, useRef } from 'react';

import { type PrivyClientConfig, PrivyProvider } from '@privy-io/react-auth';
import { SmartWalletsProvider } from '@privy-io/react-auth/smart-wallets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ThemeProvider } from '@/components/shared/ThemeProvider';

import { privyConfig } from '@/lib/privy-config';

import { FontSizeProvider } from '@/contexts/FontSizeContext';
import { WidgetRefreshProvider } from '@/contexts/WidgetRefreshContext';

import { FarcasterMiniAppProvider } from './FarcasterMiniAppProvider';
import { GamePlaybackManager } from './GamePlaybackManager';
import { OnboardingProvider } from './OnboardingProvider';
import { PostHogErrorBoundary } from '@/components/analytics/PostHogErrorBoundary';
import { PostHogIdentifier } from '@/components/analytics/PostHogIdentifier';
import { ReferralCaptureProvider } from './ReferralCaptureProvider';

import { PostHogProvider } from './PostHogProvider';

// Wrapper component to fix clip-path DOM property issue in Privy
// This fixes the React 19 warning about invalid DOM property 'clip-path'
// The issue is that Privy uses 'clip-path' in inline styles, which React 19 rejects
function PrivyProviderWrapper({ children, ...props }: React.ComponentProps<typeof PrivyProvider>) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fix clip-path properties in Privy's rendered DOM after render
    // This converts 'clip-path' to 'clipPath' in inline styles
    const fixClipPath = () => {
      if (!containerRef.current) return;
      
      const allElements = containerRef.current.querySelectorAll('*');
      allElements.forEach((element) => {
        const htmlElement = element as HTMLElement;
        const styleAttr = htmlElement.getAttribute('style');
        
        if (styleAttr && styleAttr.includes('clip-path')) {
          // Extract clip-path value
          const clipPathMatch = styleAttr.match(/clip-path\s*:\s*([^;]+)/);
          if (clipPathMatch && clipPathMatch[1]) {
            const clipPathValue = clipPathMatch[1].trim();
            
            // Set clipPath using the style object (camelCase)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (htmlElement.style as any).clipPath = clipPathValue;
            
            // Remove clip-path from the style attribute
            const cleanedStyle = styleAttr
              .replace(/clip-path\s*:\s*[^;]+;?/g, '')
              .trim()
              .replace(/;\s*;/g, ';')
              .replace(/^;|;$/g, '');
            
            if (cleanedStyle) {
              htmlElement.setAttribute('style', cleanedStyle);
            } else {
              htmlElement.removeAttribute('style');
            }
          }
        }
      });
    };

    // Run after Privy has rendered
    const timeoutId = setTimeout(fixClipPath, 100);
    
    // Watch for dynamically added elements
    const observer = new MutationObserver(fixClipPath);
    
    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style'],
      });
    }

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef}>
      <PrivyProvider {...props}>{children}</PrivyProvider>
    </div>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Check if Privy is configured (for build-time safety)
  const hasPrivyConfig = privyConfig.appId && privyConfig.appId !== '';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render without Privy if not configured (for build-time)
  if (!hasPrivyConfig) {
    return (
      <div suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <FontSizeProvider>
            <QueryClientProvider client={queryClient}>
              <GamePlaybackManager />
              <WidgetRefreshProvider>
                {mounted ? (
                  <Fragment>{children}</Fragment>
                ) : (
                  <div className="min-h-screen bg-sidebar" />
                )}
              </WidgetRefreshProvider>
            </QueryClientProvider>
          </FontSizeProvider>
        </ThemeProvider>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning>
      <PostHogErrorBoundary>
        <Suspense fallback={null}>
          <PostHogProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange={false}
            >
              <FontSizeProvider>
                <QueryClientProvider client={queryClient}>
                  <GamePlaybackManager />
                  <PrivyProviderWrapper
                    appId={privyConfig.appId}
                    config={privyConfig.config as PrivyClientConfig}
                  >
                    <SmartWalletsProvider>
                      <FarcasterMiniAppProvider>
                        {/* PostHog user identification */}
                        <PostHogIdentifier />
                        {/* Capture referral code from URL if present */}
                        <Suspense fallback={null}>
                          <ReferralCaptureProvider />
                        </Suspense>
                        {/* Onboarding provider for username setup */}
                        <OnboardingProvider>
                          <WidgetRefreshProvider>
                            {mounted ? (
                              <Fragment>{children}</Fragment>
                            ) : (
                              <div className="min-h-screen bg-sidebar" />
                            )}
                          </WidgetRefreshProvider>
                        </OnboardingProvider>
                      </FarcasterMiniAppProvider>
                    </SmartWalletsProvider>
                  </PrivyProviderWrapper>
                </QueryClientProvider>
              </FontSizeProvider>
            </ThemeProvider>
          </PostHogProvider>
        </Suspense>
      </PostHogErrorBoundary>
    </div>
  );
}
