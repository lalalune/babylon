/**
 * Playwright Auth Fixtures
 * Provides authenticated test contexts with mock user data
 */

import { test as base, expect } from '@playwright/test'

// Declare global types for test mode flags
declare global {
  interface Window {
    __E2E_TEST_MODE?: boolean
    __E2E_TEST_USER?: typeof TEST_USER
    __E2E_TEST_WALLET?: {
      address: string
      chainId: string
    }
    __privyAccessToken?: string | null
  }
}

// Mock test user data
export const TEST_USER = {
  id: 'test-user-12345',
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  email: 'test@babylon.test',
  displayName: 'Test User',
  username: 'testuser',
  bio: 'Test user for E2E tests',
  profileComplete: true,
  reputationPoints: 1000,
  referralCode: 'TEST123',
  onChainRegistered: true,
}

// Mock Privy access token
export const MOCK_ACCESS_TOKEN = 'mock-privy-access-token-for-testing'

/**
 * Set up authentication state in the browser
 */
export async function setupAuthState(page: any, navigateToUrl?: string) {
  // Set up route interception BEFORE any navigation
  await page.route('**/api/users/me', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: TEST_USER,
      }),
    })
  })

  await page.route('**/api/users/*/posts*', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          items: [],
        },
      }),
    })
  })

  // Mock Privy API calls to return authenticated state
  await page.route('**privy.io/api/**', (route: any) => {
    const url = route.request().url()

    // Mock the authenticated user endpoint
    if (url.includes('/api/v1/users/me')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: TEST_USER.id,
          email: { address: TEST_USER.email },
          wallet: { address: TEST_USER.walletAddress },
          created_at: Date.now(),
        }),
      })
    }
    // Mock the access token endpoint
    else if (url.includes('/api/v1/sessions')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: MOCK_ACCESS_TOKEN,
          refresh_token: 'mock-refresh-token',
          user: {
            id: TEST_USER.id,
            email: { address: TEST_USER.email },
          },
        }),
      })
    }
    // Allow other Privy calls through or mock as needed
    else {
      route.continue()
    }
  })

  // Set up init script BEFORE navigation (runs on every page load)
  await page.addInitScript((data: { user: typeof TEST_USER; token: string }) => {
    // Enable E2E test mode bypass
    window.__E2E_TEST_MODE = true
    window.__E2E_TEST_USER = data.user
    window.__E2E_TEST_WALLET = {
      address: data.user.walletAddress,
      chainId: 'eip155:1',
    }

    // Set Privy token for API calls
    window.__privyAccessToken = data.token

    // Mock Privy's localStorage state to simulate authenticated session
    const privyState = {
      'privy:connections': JSON.stringify([{
        type: 'wallet',
        address: data.user.walletAddress,
        chainId: 'eip155:1',
      }]),
      'privy:token': data.token,
      'privy:refresh_token': 'mock-refresh-token',
      'privy:user': JSON.stringify({
        id: data.user.id,
        created_at: Date.now(),
        linked_accounts: [{
          type: 'wallet',
          address: data.user.walletAddress,
        }],
        email: data.user.email ? { address: data.user.email } : undefined,
      }),
    }

    // Set each key in localStorage - fail fast if localStorage unavailable
    Object.entries(privyState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, { user: TEST_USER, token: MOCK_ACCESS_TOKEN })

  // Set cookies
  await page.context().addCookies([
    {
      name: 'privy-token',
      value: MOCK_ACCESS_TOKEN,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'privy-refresh-token',
      value: 'mock-refresh-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])

  // If navigateToUrl is provided, navigate and then inject test mode flags
  if (navigateToUrl) {
    await page.goto(navigateToUrl)

    // Inject test mode flags directly after page load
    await page.evaluate((data: { user: typeof TEST_USER; token: string }) => {
      window.__E2E_TEST_MODE = true
      window.__E2E_TEST_USER = data.user
      window.__E2E_TEST_WALLET = {
        address: data.user.walletAddress,
        chainId: 'eip155:1',
      }
      window.__privyAccessToken = data.token
    }, { user: TEST_USER, token: MOCK_ACCESS_TOKEN })

    // Force a re-render by dispatching a storage event
    await page.evaluate(() => {
      window.dispatchEvent(new Event('storage'))
    })
  }
}

/**
 * Extended Playwright test with authenticated context
 */
type AuthFixtures = {
  authenticatedPage: any
}

export const test = base.extend<AuthFixtures>({
  // Authenticated page fixture
  authenticatedPage: async ({ page }: { page: any }, use: (page: any) => Promise<void>) => {
    await setupAuthState(page)
    await use(page)
  },
})

export { expect }
