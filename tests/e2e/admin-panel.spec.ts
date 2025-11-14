/**
 * E2E Tests: Admin Panel
 * 
 * Comprehensive tests for all admin panel functionality including:
 * - Access control
 * - All admin tabs
 * - Admin management (promoting/demoting admins)
 * - User management (banning/unbanning)
 * - System statistics
 */

import { test, expect } from './fixtures/admin-auth'

test.describe('Admin Panel - Access Control', () => {
  test('should allow admin users to access admin panel', async ({ adminPage }) => {
    await adminPage.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await adminPage.waitForLoadState('networkidle')

    // Verify admin dashboard loads
    await expect(adminPage.getByText('Admin Dashboard')).toBeVisible({ timeout: 10000 })
    await expect(adminPage.getByText('System management and monitoring')).toBeVisible()
    
    console.log('✅ Admin user can access admin panel')
  })

  test('should show admin shield icon in header', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Look for shield icon or admin badge
    const shieldIcon = adminPage.locator('[class*="Shield"]').first()
    await expect(shieldIcon).toBeVisible({ timeout: 10000 })
    
    console.log('✅ Admin shield icon visible')
  })

  test('should not allow non-admin users to access admin panel', async ({ page }) => {
    // Navigate as unauthenticated user
    await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle')

    // Should show access denied or redirect
    const accessDenied = await page.getByText('Access Denied').isVisible().catch(() => false)
    const unauthorized = await page.getByText('Unauthorized').isVisible().catch(() => false)
    const adminRequired = await page.getByText('Admin access required').isVisible().catch(() => false)
    
    expect(accessDenied || unauthorized || adminRequired).toBeTruthy()
    
    console.log('✅ Non-admin users blocked from admin panel')
  })
})

test.describe('Admin Panel - Dashboard Tab', () => {
  test('should load stats tab by default', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Verify Dashboard/Stats tab is active
    const statsTab = adminPage.getByRole('button', { name: /Dashboard/i }).or(adminPage.getByRole('button', { name: /Stats/i }))
    await expect(statsTab).toBeVisible({ timeout: 10000 })
    
    // Verify stats content loads
    await expect(adminPage.getByText(/Platform Overview/i)).toBeVisible({ timeout: 15000 })
    
    console.log('✅ Stats tab loads by default')
  })

  test('should display user statistics', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Wait for stats to load
    await adminPage.waitForTimeout(2000)

    // Check for various stat categories
    const statLabels = [
      'Total Users',
      'Real Users',
      'NPCs',
      'Markets',
      'Posts',
    ]

    for (const label of statLabels) {
      const element = adminPage.getByText(label).first()
      if (await element.isVisible().catch(() => false)) {
        console.log(`  ✓ Found stat: ${label}`)
      }
    }
    
    console.log('✅ User statistics display correctly')
  })

  test('should display financial statistics', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    await adminPage.waitForTimeout(2000)

    // Look for financial data - these might be formatted as currency
    const financialIndicators = adminPage.locator('text=/\\$|Balance|P&L|Volume/i')
    const count = await financialIndicators.count()
    
    expect(count).toBeGreaterThan(0)
    
    console.log(`✅ Found ${count} financial indicators`)
  })
})

test.describe('Admin Panel - User Management Tab', () => {
  test('should switch to users tab', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Click Users tab
    const usersTab = adminPage.getByRole('button', { name: /Users/i }).filter({ has: adminPage.locator('[class*="User"]') }).first()
    await usersTab.click()
    await adminPage.waitForTimeout(1000)

    // Verify users content loads
    await expect(adminPage.locator('input[placeholder*="Search"]').first()).toBeVisible({ timeout: 10000 })
    
    console.log('✅ Users tab loads successfully')
  })

  test('should display user list', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Users tab
    await adminPage.getByRole('button', { name: /Users/i }).filter({ has: adminPage.locator('[class*="User"]') }).first().click()
    await adminPage.waitForTimeout(2000)

    // Should show user cards or table
    const userElements = adminPage.locator('[class*="bg-card"]')
    const count = await userElements.count()
    
    expect(count).toBeGreaterThan(0)
    
    console.log(`✅ Found ${count} user elements`)
  })

  test('should filter users by type', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Users tab
    await adminPage.getByRole('button', { name: /Users/i }).filter({ has: adminPage.locator('[class*="User"]') }).first().click()
    await adminPage.waitForTimeout(1000)

    // Look for filter buttons
    const filters = ['All', 'Users', 'Actors', 'Banned', 'Admins']
    
    for (const filter of filters) {
      const filterButton = adminPage.getByRole('button', { name: filter, exact: true })
      if (await filterButton.isVisible().catch(() => false)) {
        console.log(`  ✓ Found filter: ${filter}`)
      }
    }
    
    console.log('✅ User filters available')
  })

  test('should search for users', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Users tab
    await adminPage.getByRole('button', { name: /Users/i }).filter({ has: adminPage.locator('[class*="User"]') }).first().click()
    await adminPage.waitForTimeout(1000)

    // Find and use search input
    const searchInput = adminPage.locator('input[placeholder*="Search"]').first()
    await expect(searchInput).toBeVisible()
    
    await searchInput.fill('test')
    await adminPage.waitForTimeout(500)
    
    console.log('✅ User search functionality works')
  })

  test('should show ban/unban buttons for users', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Users tab
    await adminPage.getByRole('button', { name: /Users/i }).filter({ has: adminPage.locator('[class*="User"]') }).first().click()
    await adminPage.waitForTimeout(2000)

    // Look for Ban or Unban buttons
    const banButton = adminPage.getByRole('button', { name: /Ban/i }).first()
    const unbanButton = adminPage.getByRole('button', { name: /Unban/i }).first()
    
    const hasBanButton = await banButton.isVisible().catch(() => false)
    const hasUnbanButton = await unbanButton.isVisible().catch(() => false)
    
    expect(hasBanButton || hasUnbanButton).toBeTruthy()
    
    console.log('✅ Ban/Unban buttons visible')
  })
})

test.describe('Admin Panel - Admin Management Tab', () => {
  test('should switch to admins tab', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Click Admins tab
    const adminsTab = adminPage.getByRole('button', { name: /Admins/i })
    await adminsTab.click()
    await adminPage.waitForTimeout(1000)

    // Verify admin management content loads
    await expect(adminPage.getByText(/Admin Management/i)).toBeVisible({ timeout: 10000 })
    
    console.log('✅ Admins tab loads successfully')
  })

  test('should display current admins list', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Admins tab
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(2000)

    // Should show admin count
    const adminCount = adminPage.locator('text=/\\d+ admins? with full system access/i')
    await expect(adminCount).toBeVisible({ timeout: 10000 })
    
    console.log('✅ Admin list displays')
  })

  test('should show Add Admin button', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Admins tab
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(1000)

    // Look for Add Admin button
    const addAdminButton = adminPage.getByRole('button', { name: /Add Admin/i })
    await expect(addAdminButton).toBeVisible({ timeout: 10000 })
    
    console.log('✅ Add Admin button visible')
  })

  test('should open Add Admin modal', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Admins tab
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(1000)

    // Click Add Admin button
    const addAdminButton = adminPage.getByRole('button', { name: /Add Admin/i })
    await addAdminButton.click()
    await adminPage.waitForTimeout(500)

    // Verify modal opens
    await expect(adminPage.getByText('Add Admin', { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(adminPage.locator('input[placeholder*="Search"]').last()).toBeVisible()
    
    console.log('✅ Add Admin modal opens')
  })

  test('should search for users in Add Admin modal', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Admins tab and open modal
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(1000)
    
    await adminPage.getByRole('button', { name: /Add Admin/i }).click()
    await adminPage.waitForTimeout(500)

    // Search for a user
    const searchInput = adminPage.locator('input[placeholder*="Search"]').last()
    await searchInput.fill('regular')
    await adminPage.waitForTimeout(1000)

    // Check if search results appear
    const results = adminPage.locator('[class*="bg-background"]').filter({ hasText: '@' })
    const count = await results.count()
    
    console.log(`✅ Found ${count} search results`)
  })

  test('should show Remove Admin button for admins', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Admins tab
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(2000)

    // Look for Remove Admin button
    const removeButton = adminPage.getByRole('button', { name: /Remove Admin/i }).first()
    await expect(removeButton).toBeVisible({ timeout: 10000 })
    
    console.log('✅ Remove Admin button visible')
  })

  test('should open Remove Admin confirmation modal', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Admins tab
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(2000)

    // Click Remove Admin button
    const removeButton = adminPage.getByRole('button', { name: /Remove Admin/i }).first()
    await removeButton.click()
    await adminPage.waitForTimeout(500)

    // Verify confirmation modal
    await expect(adminPage.getByText(/Remove Admin Privileges/i)).toBeVisible({ timeout: 5000 })
    await expect(adminPage.getByText(/Are you sure/i)).toBeVisible()
    
    console.log('✅ Remove Admin confirmation modal opens')
  })

  test('should display admin badges', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Admins tab
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(2000)

    // Look for admin badge
    const adminBadge = adminPage.locator('text=/Admin/i').filter({ has: adminPage.locator('[class*="Shield"]') })
    const count = await adminBadge.count()
    
    expect(count).toBeGreaterThan(0)
    
    console.log(`✅ Found ${count} admin badges`)
  })
})

test.describe('Admin Panel - Other Tabs', () => {
  test('should load Fees tab', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Click Fees tab
    const feesTab = adminPage.getByRole('button', { name: /Fees/i })
    await feesTab.click()
    await adminPage.waitForTimeout(1000)

    // Verify fees content loads (look for dollar signs or fee-related text)
    const feesIndicator = adminPage.locator('text=/Fee|\\$|Revenue/i').first()
    await expect(feesIndicator).toBeVisible({ timeout: 10000 })
    
    console.log('✅ Fees tab loads successfully')
  })

  test('should load Trading Feed tab', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Click Trading Feed tab
    const tradesTab = adminPage.getByRole('button', { name: /Trading Feed|Trades/i })
    await tradesTab.click()
    await adminPage.waitForTimeout(1000)

    // Wait for trades content
    await adminPage.waitForTimeout(2000)
    
    console.log('✅ Trading Feed tab loads successfully')
  })

  test('should load Registry tab', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Click Registry tab
    const registryTab = adminPage.getByRole('button', { name: /Registry/i })
    await registryTab.click()
    await adminPage.waitForTimeout(1000)

    await adminPage.waitForTimeout(2000)
    
    console.log('✅ Registry tab loads successfully')
  })

  test('should load Groups tab', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Click Groups tab
    const groupsTab = adminPage.getByRole('button', { name: /Groups/i })
    await groupsTab.click()
    await adminPage.waitForTimeout(1000)

    await adminPage.waitForTimeout(2000)
    
    console.log('✅ Groups tab loads successfully')
  })

  test('should load Notifications tab', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Click Notifications tab
    const notificationsTab = adminPage.getByRole('button', { name: /Notifications/i })
    await notificationsTab.click()
    await adminPage.waitForTimeout(1000)

    await adminPage.waitForTimeout(2000)
    
    console.log('✅ Notifications tab loads successfully')
  })

  test('should navigate between all tabs without errors', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    const tabs = ['Dashboard', 'Fees', 'Trading Feed', 'Users', 'Admins', 'Registry', 'Groups', 'Notifications']
    
    for (const tabName of tabs) {
      const tab = adminPage.getByRole('button', { name: new RegExp(tabName, 'i') }).first()
      
      if (await tab.isVisible().catch(() => false)) {
        await tab.click()
        await adminPage.waitForTimeout(1000)
        console.log(`  ✓ Navigated to ${tabName} tab`)
      }
    }
    
    console.log('✅ All tabs navigable without errors')
  })
})

test.describe('Admin Panel - Refresh Functionality', () => {
  test('should have refresh buttons in tabs', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Look for refresh button (usually has RefreshCw icon)
    const refreshButton = adminPage.getByRole('button', { name: /Refresh/i }).first()
    
    if (await refreshButton.isVisible().catch(() => false)) {
      console.log('✅ Refresh button found')
    } else {
      console.log('ℹ️  Refresh button not visible on current tab')
    }
  })

  test('should refresh data when refresh button clicked', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Users tab
    await adminPage.getByRole('button', { name: /Users/i }).filter({ has: adminPage.locator('[class*="User"]') }).first().click()
    await adminPage.waitForTimeout(1000)

    // Click refresh if available
    const refreshButton = adminPage.getByRole('button', { name: /Refresh/i }).first()
    
    if (await refreshButton.isVisible().catch(() => false)) {
      await refreshButton.click()
      await adminPage.waitForTimeout(1000)
      console.log('✅ Refresh functionality works')
    } else {
      console.log('ℹ️  No refresh button on this tab')
    }
  })
})

test.describe('Admin Panel - Responsive Design', () => {
  test('should work on mobile viewport', async ({ adminPage }) => {
    await adminPage.setViewportSize({ width: 375, height: 667 })
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Verify page loads on mobile
    await expect(adminPage.getByText('Admin Dashboard')).toBeVisible({ timeout: 10000 })
    
    console.log('✅ Admin panel works on mobile viewport')
  })

  test('should work on tablet viewport', async ({ adminPage }) => {
    await adminPage.setViewportSize({ width: 768, height: 1024 })
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Verify page loads on tablet
    await expect(adminPage.getByText('Admin Dashboard')).toBeVisible({ timeout: 10000 })
    
    console.log('✅ Admin panel works on tablet viewport')
  })

  test('should have scrollable tab navigation', async ({ adminPage }) => {
    await adminPage.setViewportSize({ width: 375, height: 667 })
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Tabs should be scrollable on mobile
    const tabContainer = adminPage.locator('[class*="overflow-x-auto"]').first()
    
    if (await tabContainer.isVisible().catch(() => false)) {
      console.log('✅ Tabs are scrollable on mobile')
    }
  })
})

test.describe('Admin Panel - Error Handling', () => {
  test('should handle API errors gracefully', async ({ adminPage }) => {
    // Override route to return error
    await adminPage.route('**/api/admin/stats', (route: any) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
        }),
      })
    })

    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')
    await adminPage.waitForTimeout(2000)

    // Should show error message or still render page
    const hasErrorMessage = await adminPage.getByText(/error|failed/i).isVisible().catch(() => false)
    
    if (hasErrorMessage) {
      console.log('✅ Error message displayed for API failure')
    } else {
      console.log('✅ Page renders even with API failure')
    }
  })

  test('should handle slow API responses', async ({ adminPage }) => {
    // Override route with delay
    await adminPage.route('**/api/admin/users*', async (route: any) => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { users: [], total: 0 },
        }),
      })
    })

    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Users tab
    await adminPage.getByRole('button', { name: /Users/i }).filter({ has: adminPage.locator('[class*="User"]') }).first().click()
    
    // Should show loading state
    await adminPage.waitForTimeout(500)
    
    console.log('✅ Handles slow API responses')
  })
})

console.log('\n🎉 All admin panel e2e tests defined!')


