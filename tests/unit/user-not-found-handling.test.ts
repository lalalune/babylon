/**
 * Test for handling users not found in database but authenticated via Privy
 * Tests the fix for the error: "User not found: did:privy:cmhyl4q360160jm0cbhzltoyn"
 */

import { describe, expect, it, vi, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { authenticate, authenticateWithDbUser } from '@/lib/api/auth-middleware';
import { NotFoundError } from '@/lib/errors/base.errors';

// Mock Privy client
vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: vi.fn().mockImplementation(() => ({
    verifyAuthToken: vi.fn().mockResolvedValue({
      userId: 'did:privy:testuser123',
    }),
  })),
}));

// Mock agent auth
vi.mock('@/lib/auth/agent-auth', () => ({
  verifyAgentSession: vi.fn().mockResolvedValue(null),
}));

// Mock database
vi.mock('@/lib/database-service', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe('User Not Found Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set required env vars
    process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app-id';
    process.env.PRIVY_APP_SECRET = 'test-secret';
  });

  describe('authenticate()', () => {
    it('should return Privy DID when user does not exist in database', async () => {
      const { prisma } = await import('@/lib/database-service');
      prisma.user.findUnique = vi.fn().mockResolvedValue(null) as any;

      const request = new NextRequest('https://babylon.market/api/test', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const result = await authenticate(request);

      expect(result.userId).toBe('did:privy:testuser123');
      expect(result.privyId).toBe('did:privy:testuser123');
      expect(result.dbUserId).toBeUndefined();
      expect(result.isAgent).toBe(false);
    });

    it('should return database user ID when user exists in database', async () => {
      const { prisma } = await import('@/lib/database-service');
      prisma.user.findUnique = vi.fn().mockResolvedValue({
        id: 'db-user-123',
        walletAddress: '0x1234567890123456789012345678901234567890',
      });

      const request = new NextRequest('https://babylon.market/api/test', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const result = await authenticate(request);

      expect(result.userId).toBe('db-user-123');
      expect(result.dbUserId).toBe('db-user-123');
      expect(result.privyId).toBe('did:privy:testuser123');
      expect(result.walletAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(result.isAgent).toBe(false);
    });
  });

  describe('authenticateWithDbUser()', () => {
    it('should throw error when user does not exist in database', async () => {
      const { prisma } = await import('@/lib/database-service');
      prisma.user.findUnique = vi.fn().mockResolvedValue(null) as any;

      const request = new NextRequest('https://babylon.market/api/test', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      await expect(authenticateWithDbUser(request)).rejects.toThrow(
        'User profile not found. Please complete onboarding first.'
      );
    });

    it('should return user with dbUserId when user exists in database', async () => {
      const { prisma } = await import('@/lib/database-service');
      prisma.user.findUnique = vi.fn().mockResolvedValue({
        id: 'db-user-123',
        walletAddress: '0x1234567890123456789012345678901234567890',
      });

      const request = new NextRequest('https://babylon.market/api/test', {
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const result = await authenticateWithDbUser(request);

      expect(result.userId).toBe('db-user-123');
      expect(result.dbUserId).toBe('db-user-123');
      expect(result.privyId).toBe('did:privy:testuser123');
    });
  });

  describe('NotFoundError', () => {
    it('should support custom messages', () => {
      const error = new NotFoundError('User', 'did:privy:testuser123', 'User profile not found. Please complete onboarding first.');
      
      expect(error.message).toBe('User profile not found. Please complete onboarding first.');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.context?.resource).toBe('User');
      expect(error.context?.identifier).toBe('did:privy:testuser123');
    });

    it('should work with default message format', () => {
      const error = new NotFoundError('User', 'did:privy:testuser123');
      
      expect(error.message).toBe('User not found: did:privy:testuser123');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });

    it('should work with only resource name', () => {
      const error = new NotFoundError('User');
      
      expect(error.message).toBe('User not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });
  });
});

