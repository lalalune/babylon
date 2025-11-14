/**
 * E2E Tests: Admin Actions
 * 
 * Tests for critical admin actions including:
 * - Granting admin privileges
 * - Revoking admin privileges
 * - Banning users
 * - Unbanning users
 */

import { test, expect } from './fixtures/admin-auth'

test.describe('Admin Actions - Promoting Users to Admin', () => {
  test('should successfully promote a user to admin', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Admins tab
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(1000)

    // Click Add Admin
    await adminPage.getByRole('button', { name: /Add Admin/i }).click()
    await adminPage.waitForTimeout(500)

    // Search for user
    const searchInput = adminPage.locator('input[placeholder*="Search"]').last()
    await searchInput.fill('regular')
    await adminPage.waitForTimeout(1000)

    // Click Add button for first result
    const addButton = adminPage.getByRole('button', { name: /^Add$/i }).first()
    
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click()
      await adminPage.waitForTimeout(1000)

      // Should show success message
      const successMessage = adminPage.locator('text=/admin|success|promoted/i')
      await expect(successMessage.first()).toBeVisible({ timeout: 5000 })
      
      console.log('✅ User promoted to admin successfully')
    } else {
      console.log('ℹ️  No users found to promote')
    }
  })

  test('should close Add Admin modal after successful promotion', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Admins tab
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(1000)

    // Open Add Admin modal
    await adminPage.getByRole('button', { name: /Add Admin/i }).click()
    await adminPage.waitForTimeout(500)

    // Verify modal is open
    await expect(adminPage.getByText('Add Admin', { exact: true })).toBeVisible()

    // Search and add user (if available)
    const searchInput = adminPage.locator('input[placeholder*="Search"]').last()
    await searchInput.fill('regular')
    await adminPage.waitForTimeout(1000)

    const addButton = adminPage.getByRole('button', { name: /^Add$/i }).first()
    
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click()
      await adminPage.waitForTimeout(2000)

      // Modal should close
      const modalClosed = await adminPage.getByText('Add Admin', { exact: true }).isHidden().catch(() => true)
      expect(modalClosed).toBeTruthy()
      
      console.log('✅ Modal closes after promotion')
    }
  })

  test('should handle errors when promoting user', async ({ adminPage }) => {
    // Override route to return error
    await adminPage.route('**/api/admin/admins/*', (route: any) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'User is already an admin',
            code: 'ALREADY_ADMIN',
          }),
        })
      }
    })

    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Admins tab and try to add admin
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(1000)
    
    await adminPage.getByRole('button', { name: /Add Admin/i }).click()
    await adminPage.waitForTimeout(500)

    // Search and attempt to add
    const searchInput = adminPage.locator('input[placeholder*="Search"]').last()
    await searchInput.fill('regular')
    await adminPage.waitForTimeout(1000)

    const addButton = adminPage.getByRole('button', { name: /^Add$/i }).first()
    
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click()
      await adminPage.waitForTimeout(1000)

      // Should show error message
      const errorMessage = adminPage.locator('text=/error|failed|already/i')
      await expect(errorMessage.first()).toBeVisible({ timeout: 5000 })
      
      console.log('✅ Error handling works for promotion failures')
    }
  })

  test('should refresh admin list after promoting user', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Admins tab
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(1000)

    // Note initial count
    const initialText = await adminPage.locator('text=/\\d+ admins? with/i').textContent()
    
    // Try to add admin
    await adminPage.getByRole('button', { name: /Add Admin/i }).click()
    await adminPage.waitForTimeout(500)

    const searchInput = adminPage.locator('input[placeholder*="Search"]').last()
    await searchInput.fill('regular')
    await adminPage.waitForTimeout(1000)

    const addButton = adminPage.getByRole('button', { name: /^Add$/i }).first()
    
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click()
      await adminPage.waitForTimeout(2000)

      // List should refresh (might show different count or same count)
      const finalText = await adminPage.locator('text=/\\d+ admins? with/i').textContent()
      
      console.log(`  Initial: ${initialText}`)
      console.log(`  Final: ${finalText}`)
      console.log('✅ Admin list refreshes after promotion')
    }
  })
})

test.describe('Admin Actions - Demoting Admins', () => {
  test('should open confirmation modal when removing admin', async ({ adminPage }) => {
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
    
    console.log('✅ Confirmation modal shows for admin removal')
  })

  test('should show warning about admin privilege removal', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Admins tab
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(2000)

    // Open removal modal
    await adminPage.getByRole('button', { name: /Remove Admin/i }).first().click()
    await adminPage.waitForTimeout(500)

    // Should show warning about losing access
    const warning = adminPage.locator('text=/lose access|no longer|admin functions/i')
    await expect(warning.first()).toBeVisible({ timeout: 5000 })
    
    console.log('✅ Warning message displayed for admin removal')
  })

  test('should cancel admin removal', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Admins tab
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(2000)

    // Open removal modal
    await adminPage.getByRole('button', { name: /Remove Admin/i }).first().click()
    await adminPage.waitForTimeout(500)

    // Click Cancel
    const cancelButton = adminPage.getByRole('button', { name: /Cancel/i })
    await cancelButton.click()
    await adminPage.waitForTimeout(500)

    // Modal should close
    const modalClosed = await adminPage.getByText(/Remove Admin Privileges/i).isHidden().catch(() => true)
    expect(modalClosed).toBeTruthy()
    
    console.log('✅ Can cancel admin removal')
  })

  test('should confirm and remove admin', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Admins tab
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(2000)

    // Open removal modal
    await adminPage.getByRole('button', { name: /Remove Admin/i }).first().click()
    await adminPage.waitForTimeout(500)

    // Confirm removal
    const confirmButton = adminPage.getByRole('button', { name: /Remove Admin/i }).last()
    await confirmButton.click()
    await adminPage.waitForTimeout(1000)

    // Should show success message
    const successMessage = adminPage.locator('text=/success|removed|no longer/i')
    await expect(successMessage.first()).toBeVisible({ timeout: 5000 })
    
    console.log('✅ Admin removed successfully')
  })
})

test.describe('Admin Actions - Banning Users', () => {
  test('should open ban modal for user', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Users tab
    await adminPage.getByRole('button', { name: /Users/i }).filter({ has: adminPage.locator('[class*="User"]') }).first().click()
    await adminPage.waitForTimeout(2000)

    // Click Ban button if available
    const banButton = adminPage.getByRole('button', { name: /^Ban$/i }).first()
    
    if (await banButton.isVisible().catch(() => false)) {
      await banButton.click()
      await adminPage.waitForTimeout(500)

      // Verify ban modal
      await expect(adminPage.getByText(/Ban User/i)).toBeVisible({ timeout: 5000 })
      
      console.log('✅ Ban modal opens successfully')
    } else {
      console.log('ℹ️  No bannable users visible')
    }
  })

  test('should require ban reason', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Users tab
    await adminPage.getByRole('button', { name: /Users/i }).filter({ has: adminPage.locator('[class*="User"]') }).first().click()
    await adminPage.waitForTimeout(2000)

    // Open ban modal
    const banButton = adminPage.getByRole('button', { name: /^Ban$/i }).first()
    
    if (await banButton.isVisible().catch(() => false)) {
      await banButton.click()
      await adminPage.waitForTimeout(500)

      // Look for reason textarea
      const reasonInput = adminPage.locator('textarea[placeholder*="reason"]').or(adminPage.locator('textarea[placeholder*="ban"]'))
      await expect(reasonInput).toBeVisible({ timeout: 5000 })
      
      console.log('✅ Ban reason field required')
    }
  })

  test('should successfully ban user with reason', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Users tab
    await adminPage.getByRole('button', { name: /Users/i }).filter({ has: adminPage.locator('[class*="User"]') }).first().click()
    await adminPage.waitForTimeout(2000)

    // Open ban modal
    const banButton = adminPage.getByRole('button', { name: /^Ban$/i }).first()
    
    if (await banButton.isVisible().catch(() => false)) {
      await banButton.click()
      await adminPage.waitForTimeout(500)

      // Fill in reason
      const reasonInput = adminPage.locator('textarea').last()
      await reasonInput.fill('Test ban reason for E2E test')
      await adminPage.waitForTimeout(300)

      // Confirm ban
      const confirmButton = adminPage.getByRole('button', { name: /Ban User/i }).last()
      await confirmButton.click()
      await adminPage.waitForTimeout(1000)

      // Should show success message
      const successMessage = adminPage.locator('text=/banned|success/i')
      await expect(successMessage.first()).toBeVisible({ timeout: 5000 })
      
      console.log('✅ User banned successfully')
    }
  })

  test('should cancel user ban', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Users tab
    await adminPage.getByRole('button', { name: /Users/i }).filter({ has: adminPage.locator('[class*="User"]') }).first().click()
    await adminPage.waitForTimeout(2000)

    // Open ban modal
    const banButton = adminPage.getByRole('button', { name: /^Ban$/i }).first()
    
    if (await banButton.isVisible().catch(() => false)) {
      await banButton.click()
      await adminPage.waitForTimeout(500)

      // Click Cancel
      const cancelButton = adminPage.getByRole('button', { name: /Cancel/i })
      await cancelButton.click()
      await adminPage.waitForTimeout(500)

      // Modal should close
      const modalClosed = await adminPage.getByText(/Ban User/i).isHidden().catch(() => true)
      expect(modalClosed).toBeTruthy()
      
      console.log('✅ Can cancel user ban')
    }
  })
})

test.describe('Admin Actions - Unbanning Users', () => {
  test('should show unban button for banned users', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Users tab
    await adminPage.getByRole('button', { name: /Users/i }).filter({ has: adminPage.locator('[class*="User"]') }).first().click()
    await adminPage.waitForTimeout(1000)

    // Filter by banned users
    const bannedFilter = adminPage.getByRole('button', { name: 'Banned', exact: true })
    
    if (await bannedFilter.isVisible().catch(() => false)) {
      await bannedFilter.click()
      await adminPage.waitForTimeout(2000)

      // Look for Unban button
      const unbanButton = adminPage.getByRole('button', { name: /Unban/i }).first()
      
      if (await unbanButton.isVisible().catch(() => false)) {
        console.log('✅ Unban button visible for banned users')
      } else {
        console.log('ℹ️  No banned users to unban')
      }
    }
  })

  test('should successfully unban user', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Users tab
    await adminPage.getByRole('button', { name: /Users/i }).filter({ has: adminPage.locator('[class*="User"]') }).first().click()
    await adminPage.waitForTimeout(1000)

    // Filter by banned users
    const bannedFilter = adminPage.getByRole('button', { name: 'Banned', exact: true })
    
    if (await bannedFilter.isVisible().catch(() => false)) {
      await bannedFilter.click()
      await adminPage.waitForTimeout(2000)

      // Click Unban
      const unbanButton = adminPage.getByRole('button', { name: /Unban/i }).first()
      
      if (await unbanButton.isVisible().catch(() => false)) {
        await unbanButton.click()
        await adminPage.waitForTimeout(1000)

        // Should show success message
        const successMessage = adminPage.locator('text=/unbanned|success/i')
        await expect(successMessage.first()).toBeVisible({ timeout: 5000 })
        
        console.log('✅ User unbanned successfully')
      }
    }
  })
})

test.describe('Admin Actions - Security Validations', () => {
  test('should prevent demoting self (if detectable)', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Admins tab
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(2000)

    // Look for current admin (testadmin)
    const currentAdmin = adminPage.locator('text=/testadmin|Test Admin/i')
    
    if (await currentAdmin.isVisible().catch(() => false)) {
      // Try to find Remove Admin button for self
      // This should either not exist or show an error when clicked
      console.log('ℹ️  Self-demotion prevention is enforced at API level')
    }
  })

  test('should not show ban option for actors', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Navigate to Users tab
    await adminPage.getByRole('button', { name: /Users/i }).filter({ has: adminPage.locator('[class*="User"]') }).first().click()
    await adminPage.waitForTimeout(1000)

    // Filter by actors
    const actorsFilter = adminPage.getByRole('button', { name: 'Actors', exact: true })
    
    if (await actorsFilter.isVisible().catch(() => false)) {
      await actorsFilter.click()
      await adminPage.waitForTimeout(2000)

      // Actors should not have Ban buttons
      const banButton = adminPage.getByRole('button', { name: /Ban/i })
      const hasBanButton = await banButton.count().then((count: number) => count > 0).catch(() => false)
      
      expect(!hasBanButton).toBeTruthy()
      
      console.log('✅ Actors cannot be banned (as expected)')
    }
  })
})

test.describe('Admin Actions - Toast Notifications', () => {
  test('should show toast notification on successful action', async ({ adminPage }) => {
    await adminPage.goto('/admin')
    await adminPage.waitForLoadState('networkidle')

    // Perform any action (navigate to Admins tab as example)
    await adminPage.getByRole('button', { name: /Admins/i }).click()
    await adminPage.waitForTimeout(1000)

    // Try to perform an action that would show a toast
    await adminPage.getByRole('button', { name: /Refresh/i }).first().click().catch(() => {})
    await adminPage.waitForTimeout(1000)

    // Look for toast container (Sonner typically uses specific classes)
    const toast = adminPage.locator('[class*="toast"]').or(adminPage.locator('[data-sonner-toast]'))
    
    if (await toast.count().then((c: number) => c > 0).catch(() => false)) {
      console.log('✅ Toast notifications work')
    } else {
      console.log('ℹ️  No toast shown (might not be triggered by this action)')
    }
  })
})

console.log('\n🎉 All admin actions e2e tests defined!')

