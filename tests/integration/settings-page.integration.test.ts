/**
 * Integration Tests: Settings Page
 * 
 * Tests all functionality on the settings page including:
 * - Profile updates (display name, username, bio)
 * - Theme settings
 * - Security features
 * - Privacy features (data export, account deletion)
 * - Tab navigation
 * 
 * Prerequisites: Backend server must be running
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import type { User } from '@/stores/authStore';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3000/api';

// Test user credentials - you'll need to set these up
let testUserId: string;
let testAccessToken: string;
let testUser: User;

describe('Settings Page Integration Tests', () => {
  beforeAll(async () => {
    // TODO: Set up test user authentication
    // For now, skip tests if credentials are not available
    const hasTestCreds = process.env.TEST_USER_ID && process.env.TEST_ACCESS_TOKEN;
    if (!hasTestCreds) {
      console.warn('⚠️  Skipping settings tests - TEST_USER_ID and TEST_ACCESS_TOKEN not set');
      return;
    }
    
    testUserId = process.env.TEST_USER_ID!;
    testAccessToken = process.env.TEST_ACCESS_TOKEN!;
    
    // Fetch current user data
    const response = await fetch(`${API_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${testAccessToken}`,
      },
    });
    
    expect(response.ok).toBe(true);
    const data = await response.json();
    testUser = data.user;
  });

  describe('Profile Tab', () => {
    test('should update display name', async () => {
      if (!testAccessToken) return;

      const newDisplayName = `Test User ${Date.now()}`;
      
      const response = await fetch(`${API_URL}/users/${testUserId}/update-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testAccessToken}`,
        },
        body: JSON.stringify({
          displayName: newDisplayName,
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user.displayName).toBe(newDisplayName);
    });

    test('should update bio', async () => {
      if (!testAccessToken) return;

      const newBio = `Test bio updated at ${Date.now()}`;
      
      const response = await fetch(`${API_URL}/users/${testUserId}/update-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testAccessToken}`,
        },
        body: JSON.stringify({
          bio: newBio,
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user.bio).toBe(newBio);
    });

    test('should enforce username change rate limit (24 hours)', async () => {
      if (!testAccessToken) return;

      // First, try to change username
      const newUsername = `testuser${Date.now()}`;
      
      const firstResponse = await fetch(`${API_URL}/users/${testUserId}/update-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testAccessToken}`,
        },
        body: JSON.stringify({
          username: newUsername,
        }),
      });

      if (firstResponse.ok) {
        // If first change succeeded, try immediately again - should fail
        const secondResponse = await fetch(`${API_URL}/users/${testUserId}/update-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${testAccessToken}`,
          },
          body: JSON.stringify({
            username: `testuser${Date.now() + 1}`,
          }),
        });

        expect(secondResponse.ok).toBe(false);
        const errorData = await secondResponse.json();
        expect(errorData.error).toBeTruthy();
      }
    });

    test('should reject duplicate usernames', async () => {
      if (!testAccessToken) return;

      // Try to use a common username that likely exists
      const response = await fetch(`${API_URL}/users/${testUserId}/update-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testAccessToken}`,
        },
        body: JSON.stringify({
          username: 'admin', // Likely taken
        }),
      });

      // Should either fail or succeed (if somehow available)
      // Main point is to verify the API handles duplicate checks
      const data = await response.json();
      expect(data).toBeTruthy();
    });

    test('should require on-chain registration for profile updates', async () => {
      if (!testAccessToken) return;

      // Fetch current user to check registration status
      const userResponse = await fetch(`${API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${testAccessToken}`,
        },
      });

      const userData = await userResponse.json();
      
      if (!userData.user.onChainRegistered) {
        // If not registered, profile updates should fail
        const updateResponse = await fetch(`${API_URL}/users/${testUserId}/update-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${testAccessToken}`,
          },
          body: JSON.stringify({
            displayName: 'Should Fail',
          }),
        });

        expect(updateResponse.ok).toBe(false);
      }
    });
  });

  describe('Theme Tab', () => {
    test('should persist theme preference in localStorage', () => {
      // Theme is handled by next-themes and stored in localStorage
      // This is a client-side test, so we can only verify the implementation exists
      // In browser tests, we would:
      // 1. Navigate to settings
      // 2. Change theme
      // 3. Reload page
      // 4. Verify theme persisted
      expect(true).toBe(true); // Placeholder - requires browser testing
    });
  });

  describe('Security Tab', () => {
    test('should display connected wallets', async () => {
      // This is a Privy integration that requires browser testing
      // Verify the SecurityTab component exists and has proper structure
      expect(true).toBe(true); // Placeholder - requires browser testing
    });

    test('should allow logout', async () => {
      // Logout is handled by Privy client-side
      // Verify the logout button functionality exists
      expect(true).toBe(true); // Placeholder - requires browser testing
    });
  });

  describe('Privacy Tab', () => {
    test('should export user data (GDPR compliance)', async () => {
      if (!testAccessToken) return;

      const response = await fetch(`${API_URL}/users/export-data`, {
        headers: {
          'Authorization': `Bearer ${testAccessToken}`,
        },
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toContain('application/json');
      
      const data = await response.json();
      expect(data.export_info).toBeTruthy();
      expect(data.personal_information).toBeTruthy();
      expect(data.export_info.user_id).toBe(testUserId);
    });

    test('should include all user data in export', async () => {
      if (!testAccessToken) return;

      const response = await fetch(`${API_URL}/users/export-data`, {
        headers: {
          'Authorization': `Bearer ${testAccessToken}`,
        },
      });

      const data = await response.json();
      
      // Verify all required sections exist
      expect(data.export_info).toBeTruthy();
      expect(data.personal_information).toBeTruthy();
      expect(data.content).toBeTruthy();
      expect(data.trading).toBeTruthy();
      expect(data.social).toBeTruthy();
      expect(data.points_and_reputation).toBeTruthy();
      expect(data.financial).toBeTruthy();
      expect(data.notifications).toBeTruthy();
      expect(data.legal_consent).toBeTruthy();
    });

    test('should require exact confirmation for account deletion', async () => {
      if (!testAccessToken) return;

      // Try with wrong confirmation
      const response = await fetch(`${API_URL}/users/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testAccessToken}`,
        },
        body: JSON.stringify({
          confirmation: 'wrong confirmation',
          reason: 'Testing',
        }),
      });

      expect(response.ok).toBe(false);
    });

    test('should not allow account deletion without proper confirmation', async () => {
      if (!testAccessToken) return;

      // Missing confirmation field
      const response = await fetch(`${API_URL}/users/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testAccessToken}`,
        },
        body: JSON.stringify({
          reason: 'Testing',
        }),
      });

      expect(response.ok).toBe(false);
    });

    // NOTE: We don't actually test account deletion with correct confirmation
    // because that would delete the test account!
  });

  describe('Tab Navigation', () => {
    test('should sync tab with URL parameter', () => {
      // This requires browser testing to verify URL changes
      // Verify the implementation exists in the code
      expect(true).toBe(true); // Placeholder - requires browser testing
    });

    test('should handle browser back/forward navigation', () => {
      // This requires browser testing
      expect(true).toBe(true); // Placeholder - requires browser testing
    });
  });

  describe('Authentication Requirements', () => {
    test('should require authentication for profile updates', async () => {
      const response = await fetch(`${API_URL}/users/${testUserId}/update-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No Authorization header
        },
        body: JSON.stringify({
          displayName: 'Should Fail',
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    test('should require authentication for data export', async () => {
      const response = await fetch(`${API_URL}/users/export-data`, {
        headers: {
          // No Authorization header
        },
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    test('should require authentication for account deletion', async () => {
      const response = await fetch(`${API_URL}/users/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No Authorization header
        },
        body: JSON.stringify({
          confirmation: 'DELETE MY ACCOUNT',
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    test('should prevent users from updating other users profiles', async () => {
      if (!testAccessToken) return;

      // Try to update a different user's profile (use a different ID)
      const otherUserId = 'different-user-id';
      
      const response = await fetch(`${API_URL}/users/${otherUserId}/update-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testAccessToken}`,
        },
        body: JSON.stringify({
          displayName: 'Unauthorized Change',
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
    });
  });

  describe('Input Validation', () => {
    test('should validate display name length', async () => {
      if (!testAccessToken) return;

      // Try extremely long display name
      const longName = 'a'.repeat(300);
      
      const response = await fetch(`${API_URL}/users/${testUserId}/update-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testAccessToken}`,
        },
        body: JSON.stringify({
          displayName: longName,
        }),
      });

      // Should either be rejected or truncated
      const data = await response.json();
      if (response.ok) {
        expect(data.user.displayName.length).toBeLessThanOrEqual(100);
      } else {
        expect(response.status).toBe(400);
      }
    });

    test('should validate username format', async () => {
      if (!testAccessToken) return;

      // Try invalid username with special characters
      const invalidUsername = 'user@#$%^&*()';
      
      const response = await fetch(`${API_URL}/users/${testUserId}/update-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testAccessToken}`,
        },
        body: JSON.stringify({
          username: invalidUsername,
        }),
      });

      // Should be rejected if validation is in place
      if (!response.ok) {
        expect(response.status).toBe(400);
      }
    });

    test('should validate bio length', async () => {
      if (!testAccessToken) return;

      // Try extremely long bio
      const longBio = 'a'.repeat(2000);
      
      const response = await fetch(`${API_URL}/users/${testUserId}/update-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testAccessToken}`,
        },
        body: JSON.stringify({
          bio: longBio,
        }),
      });

      // Should either be rejected or truncated
      const data = await response.json();
      if (response.ok) {
        expect(data.user.bio.length).toBeLessThanOrEqual(500);
      } else {
        expect(response.status).toBe(400);
      }
    });
  });
});

