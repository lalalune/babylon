/**
 * Playwright Admin Auth Fixtures
 * Provides authenticated admin test contexts
 */

import { test as base, expect } from '@playwright/test'

// Mock admin user data
export const ADMIN_USER = {
  id: 'test-admin-12345',
  walletAddress: '0xadmin567890abcdef1234567890abcdef12345678',
  email: 'admin@babylon.test',
  displayName: 'Test Admin',
  username: 'testadmin',
  bio: 'Admin user for E2E tests',
  profileComplete: true,
  reputationPoints: 10000,
  referralCode: 'ADMIN123',
  onChainRegistered: true,
  isAdmin: true,
}

// Mock regular user for testing admin actions
export const REGULAR_USER = {
  id: 'test-user-67890',
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  email: 'user@babylon.test',
  displayName: 'Regular User',
  username: 'regularuser',
  bio: 'Regular user for testing',
  profileComplete: true,
  reputationPoints: 1000,
  referralCode: 'USER123',
  onChainRegistered: true,
  isAdmin: false,
}

export const MOCK_ADMIN_TOKEN = 'mock-admin-access-token-for-testing'

/**
 * Set up admin authentication state in the browser
 */
export async function setupAdminAuthState(page: any, navigateToUrl?: string) {
  // Mock API routes for admin operations
  await page.route('**/api/users/me', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: ADMIN_USER,
      }),
    })
  })

  await page.route('**/api/admin/stats', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          users: {
            total: 150,
            actors: 50,
            realUsers: 100,
            banned: 5,
            admins: 3,
            signups: { today: 5, thisWeek: 20, thisMonth: 80 },
          },
          markets: {
            total: 75,
            active: 50,
            resolved: 25,
            positions: 200,
          },
          trading: {
            balanceTransactions: 500,
            npcTrades: 300,
          },
          social: {
            posts: 1000,
            postsToday: 50,
            comments: 500,
            reactions: 2000,
          },
          financial: {
            totalVirtualBalance: '500000.00',
            totalDeposited: '300000.00',
            totalWithdrawn: '100000.00',
            totalLifetimePnL: '100000.00',
          },
          pools: {
            total: 10,
            active: 8,
            deposits: 50,
          },
          engagement: {
            referrals: 30,
            pointsTransactions: 200,
          },
          topUsers: {
            byBalance: [],
            byReputation: [],
          },
          recentSignups: [],
        },
      }),
    })
  })

  await page.route('**/api/admin/users*', (route: any) => {
    const url = new URL(route.request().url())
    const filter = url.searchParams.get('filter')
    
    let users = [
      {
        id: REGULAR_USER.id,
        username: REGULAR_USER.username,
        displayName: REGULAR_USER.displayName,
        walletAddress: REGULAR_USER.walletAddress,
        profileImageUrl: null,
        isActor: false,
        isAdmin: false,
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        bannedBy: null,
        virtualBalance: '1000.00',
        totalDeposited: '1000.00',
        totalWithdrawn: '0.00',
        lifetimePnL: '0.00',
        reputationPoints: 1000,
        referralCount: 0,
        onChainRegistered: true,
        nftTokenId: null,
        hasFarcaster: false,
        hasTwitter: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: {
          comments: 10,
          reactions: 50,
          positions: 5,
          following: 10,
          followedBy: 15,
        },
      },
    ]

    if (filter === 'admins') {
      users = [{
        ...ADMIN_USER,
        isActor: false,
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        bannedBy: null,
        virtualBalance: '10000.00',
        totalDeposited: '10000.00',
        totalWithdrawn: '0.00',
        lifetimePnL: '0.00',
        referralCount: 5,
        nftTokenId: null,
        hasFarcaster: true,
        hasTwitter: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        profileImageUrl: null,
        _count: {
          comments: 50,
          reactions: 200,
          positions: 20,
          following: 30,
          followedBy: 50,
        },
      }]
    }

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          users,
          total: users.length,
        },
      }),
    })
  })

  await page.route('**/api/admin/admins', (route: any) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            admins: [{
              id: ADMIN_USER.id,
              username: ADMIN_USER.username,
              displayName: ADMIN_USER.displayName,
              walletAddress: ADMIN_USER.walletAddress,
              profileImageUrl: null,
              isActor: false,
              isAdmin: true,
              isBanned: false,
              onChainRegistered: true,
              hasFarcaster: true,
              hasTwitter: true,
              farcasterUsername: 'testadmin',
              twitterUsername: 'testadmin',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }],
            total: 1,
          },
        }),
      })
    }
  })

  await page.route('**/api/admin/admins/*', (route: any) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            message: `User ${body.action}d successfully`,
            user: {
              ...REGULAR_USER,
              isAdmin: body.action === 'promote',
              updatedAt: new Date().toISOString(),
            },
            action: body.action,
          },
        }),
      })
    }
  })

  await page.route('**/api/admin/users/*/ban', (route: any) => {
    const body = route.request().postDataJSON()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          message: `User ${body.action}ned successfully`,
          user: {
            ...REGULAR_USER,
            isBanned: body.action === 'ban',
            bannedAt: body.action === 'ban' ? new Date().toISOString() : null,
            bannedReason: body.action === 'ban' ? body.reason : null,
          },
        },
      }),
    })
  })

  await page.route('**/api/admin/trades*', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          trades: [],
          total: 0,
        },
      }),
    })
  })

  await page.route('**/api/admin/fees*', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          platformStats: {
            totalFeesCollected: 1000,
            totalUserFees: 800,
            totalReferrerFees: 200,
            totalTrades: 100,
          },
        },
      }),
    })
  })

  await page.route('**/api/admin/groups*', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          groups: [],
          total: 0,
        },
      }),
    })
  })

  await page.route('**/api/admin/notifications*', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          notifications: [],
          total: 0,
        },
      }),
    })
  })

  await page.route('**/api/admin/registry*', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          users: [],
          actors: [],
          totals: { total: 0, users: 0, actors: 0, agents: 0 },
        },
      }),
    })
  })

  // Mock Privy API calls
  await page.route('**privy.io/api/**', (route: any) => {
    const url = route.request().url()

    if (url.includes('/api/v1/users/me')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: ADMIN_USER.id,
          email: { address: ADMIN_USER.email },
          wallet: { address: ADMIN_USER.walletAddress },
          created_at: Date.now(),
        }),
      })
    } else if (url.includes('/api/v1/sessions')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: MOCK_ADMIN_TOKEN,
          refresh_token: 'mock-refresh-token',
          user: {
            id: ADMIN_USER.id,
            email: { address: ADMIN_USER.email },
          },
        }),
      })
    } else {
      route.continue()
    }
  })

  // Set up init script
  await page.addInitScript((data: { user: typeof ADMIN_USER; token: string }) => {
    window.__E2E_TEST_MODE = true
    window.__E2E_TEST_USER = data.user
    window.__E2E_TEST_WALLET = {
      address: data.user.walletAddress,
      chainId: 'eip155:1',
    }
    window.__privyAccessToken = data.token

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

    Object.entries(privyState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, { user: ADMIN_USER, token: MOCK_ADMIN_TOKEN })

  // Set cookies
  await page.context().addCookies([
    {
      name: 'privy-token',
      value: MOCK_ADMIN_TOKEN,
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

  if (navigateToUrl) {
    await page.goto(navigateToUrl)

    await page.evaluate((data: { user: typeof ADMIN_USER; token: string }) => {
      window.__E2E_TEST_MODE = true
      window.__E2E_TEST_USER = data.user
      window.__E2E_TEST_WALLET = {
        address: data.user.walletAddress,
        chainId: 'eip155:1',
      }
      window.__privyAccessToken = data.token
    }, { user: ADMIN_USER, token: MOCK_ADMIN_TOKEN })

    await page.evaluate(() => {
      window.dispatchEvent(new Event('storage'))
    })
  }
}

/**
 * Extended Playwright test with admin authenticated context
 */
type AdminAuthFixtures = {
  adminPage: any
}

export const test = base.extend<AdminAuthFixtures>({
  adminPage: async ({ page }: { page: any }, use: (page: any) => Promise<void>) => {
    await setupAdminAuthState(page)
    await use(page)
  },
})

export { expect }


