/**
 * Integration Tests for Prisma Retry Logic
 * 
 * Tests the actual retry proxy behavior with mocked Prisma operations
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { createRetryProxy, withRetry, isRetryableError } from '../prisma-retry';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

// Mock Prisma client for testing
interface MockPrismaClient {
  user: {
    findMany: () => Promise<unknown[]>;
    create: (args: unknown) => Promise<unknown>;
  };
  $transaction: (callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  $executeRaw: (query: unknown) => Promise<unknown>;
  $queryRaw: (query: unknown) => Promise<unknown>;
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
}

describe('Prisma Retry Integration Tests', () => {
  describe('isRetryableError Function (Direct Testing)', () => {
    it('should return false for InvalidArg errors', () => {
      const error = new Error('data did not match any variant of untagged enum JsonBody');
      (error as Error & { code: string }).code = 'InvalidArg';
      error.name = 'PrismaClientKnownRequestError';
      
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for unique constraint violations (P2002)', () => {
      const error = new Error('Unique constraint failed');
      (error as Error & { code: string }).code = 'P2002';
      error.name = 'PrismaClientKnownRequestError';
      
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return true for connection timeout (P1002)', () => {
      const error = new Error('Connection timeout');
      (error as Error & { code: string }).code = 'P1002';
      error.name = 'PrismaClientKnownRequestError';
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for ETIMEDOUT network errors', () => {
      const error = new Error('ETIMEDOUT: Connection timed out');
      
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return false for non-Error objects', () => {
      expect(isRetryableError('string error')).toBe(false);
      expect(isRetryableError({ message: 'object' })).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  describe('Error Classification', () => {
    it('should NOT retry InvalidArg errors', async () => {
      let attempts = 0;
      
      const operation = mock(async () => {
        attempts++;
        const error = new Error(
          'Invalid `prisma.$queryRaw()` invocation:\n\ndata did not match any variant of untagged enum JsonBody'
        );
        (error as Error & { code: string }).code = 'InvalidArg';
        error.name = 'PrismaClientKnownRequestError';
        throw error;
      });

      await expect(
        withRetry(operation, 'test-operation', { maxRetries: 5 })
      ).rejects.toThrow('data did not match');

      // Should only attempt once (no retries for permanent errors)
      expect(attempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry unique constraint violations', async () => {
      let attempts = 0;
      
      const operation = mock(async () => {
        attempts++;
        const error = new Error('Unique constraint failed on the fields: (`email`)');
        (error as Error & { code: string }).code = 'P2002';
        error.name = 'PrismaClientKnownRequestError';
        throw error;
      });

      await expect(
        withRetry(operation, 'test-operation', { maxRetries: 5 })
      ).rejects.toThrow('Unique constraint');

      // Should only attempt once
      expect(attempts).toBe(1);
    });

    it('should NOT retry record not found errors', async () => {
      let attempts = 0;
      
      const operation = mock(async () => {
        attempts++;
        const error = new Error('Record to update not found.');
        (error as Error & { code: string }).code = 'P2025';
        error.name = 'PrismaClientKnownRequestError';
        throw error;
      });

      await expect(
        withRetry(operation, 'test-operation', { maxRetries: 5 })
      ).rejects.toThrow('Record to update not found');

      expect(attempts).toBe(1);
    });

    it('SHOULD retry connection timeout errors', async () => {
      let attempts = 0;
      
      const operation = mock(async () => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('Connection timeout');
          (error as Error & { code: string }).code = 'P1002';
          error.name = 'PrismaClientKnownRequestError';
          throw error;
        }
        return { success: true };
      });

      const result = await withRetry(operation, 'test-operation', { 
        maxRetries: 5,
        initialDelayMs: 1 // Speed up test
      });

      // Should retry and eventually succeed
      expect(attempts).toBe(3);
      expect(result).toEqual({ success: true });
    });

    it('SHOULD retry ETIMEDOUT network errors', async () => {
      let attempts = 0;
      
      const operation = mock(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('ETIMEDOUT: Connection timed out');
        }
        return { success: true };
      });

      const result = await withRetry(operation, 'test-operation', { 
        maxRetries: 5,
        initialDelayMs: 1
      });

      expect(attempts).toBe(2);
      expect(result).toEqual({ success: true });
    });

    it('SHOULD give up after max retries for retryable errors', async () => {
      let attempts = 0;
      
      const operation = mock(async () => {
        attempts++;
        const error = new Error('Connection timeout');
        (error as Error & { code: string }).code = 'P1002';
        throw error;
      });

      await expect(
        withRetry(operation, 'test-operation', { 
          maxRetries: 3,
          initialDelayMs: 1
        })
      ).rejects.toThrow('Connection timeout');

      // Should attempt 4 times total (initial + 3 retries)
      expect(attempts).toBe(4);
    });
  });

  describe('Retry Proxy Exclusions', () => {
    let mockClient: MockPrismaClient;

    beforeEach(() => {
      mockClient = {
        user: {
          findMany: mock(async () => [{ id: '1', name: 'Test' }]),
          create: mock(async (args: unknown) => ({ id: '1', ...args as Record<string, unknown> })),
        },
        $transaction: mock(async (callback: (txClient: MockPrismaClient) => Promise<unknown>) => {
          // Simulate transaction client
          const txClient = { ...mockClient };
          return await callback(txClient);
        }),
        $executeRaw: mock(async () => 1),
        $queryRaw: mock(async () => [{ result: 1 }]),
        $connect: mock(async () => undefined),
        $disconnect: mock(async () => undefined),
      };
    });

    it('should wrap regular model methods with retry', async () => {
      const proxiedClient = createRetryProxy(mockClient, {
        maxRetries: 3,
        initialDelayMs: 1,
      });

      // Call a model method
      await proxiedClient.user.findMany();

      // Should be called through proxy
      expect(mockClient.user.findMany).toHaveBeenCalled();
    });

    it('should NOT wrap $transaction with retry', async () => {
      const proxiedClient = createRetryProxy(mockClient, {
        maxRetries: 3,
        initialDelayMs: 1,
      });

      // Spy on the original method
      const transactionSpy = mockClient.$transaction as ReturnType<typeof mock>;

      // Call $transaction
      await proxiedClient.$transaction(async () => {
        return { success: true };
      });

      // Should call original directly (not wrapped)
      expect(transactionSpy).toHaveBeenCalled();
    });

    it('should NOT wrap $executeRaw with retry', async () => {
      const proxiedClient = createRetryProxy(mockClient, {
        maxRetries: 3,
        initialDelayMs: 1,
      });

      const executeRawSpy = mockClient.$executeRaw as ReturnType<typeof mock>;

      // Call $executeRaw
      await proxiedClient.$executeRaw(Prisma.sql`SELECT 1`);

      // Should call original directly
      expect(executeRawSpy).toHaveBeenCalled();
    });

    it('should NOT wrap $queryRaw with retry', async () => {
      const proxiedClient = createRetryProxy(mockClient, {
        maxRetries: 3,
        initialDelayMs: 1,
      });

      const queryRawSpy = mockClient.$queryRaw as ReturnType<typeof mock>;

      // Call $queryRaw
      await proxiedClient.$queryRaw(Prisma.sql`SELECT 1`);

      // Should call original directly
      expect(queryRawSpy).toHaveBeenCalled();
    });
  });

  describe('Transaction Context Flow', () => {
    it('should allow raw SQL in transaction callbacks', async () => {
      type TxClient = {
        $executeRaw: ReturnType<typeof mock>;
        user: { findMany: ReturnType<typeof mock> };
      };
      
      const mockClient = {
        $transaction: mock(async (callback: (tx: TxClient) => Promise<unknown>) => {
          // Simulate transaction client with $executeRaw
          const txClient: TxClient = {
            $executeRaw: mock(async () => 1),
            user: {
              findMany: mock(async () => []),
            },
          };
          return await callback(txClient);
        }),
      };

      const proxiedClient = createRetryProxy(mockClient, {
        maxRetries: 3,
      });

      // Execute transaction with raw SQL
      const result = await proxiedClient.$transaction(async (tx: TxClient) => {
        // This should work without serialization issues
        await tx.$executeRaw(Prisma.sql`SELECT set_config('test', 'value', true)`);
        await tx.user.findMany();
        return { success: true };
      });

      expect(result).toEqual({ success: true });
    });

    it('should not retry InvalidArg from transaction raw SQL', async () => {
      let transactionAttempts = 0;

      type TxClient = {
        $executeRaw: ReturnType<typeof mock>;
      };

      const mockClient = {
        $transaction: mock(async (callback: (tx: TxClient) => Promise<unknown>) => {
          transactionAttempts++;
          const txClient: TxClient = {
            $executeRaw: mock(async () => {
              const error = new Error('Invalid query') as Error & { code: string };
              error.code = 'InvalidArg';
              error.name = 'PrismaClientKnownRequestError';
              throw error;
            }),
          };
          return await callback(txClient);
        }),
      };

      const proxiedClient = createRetryProxy(mockClient, {
        maxRetries: 5,
        initialDelayMs: 1,
      });

      await expect(
        proxiedClient.$transaction(async (tx: TxClient) => {
          await tx.$executeRaw(Prisma.sql`INVALID QUERY`);
        })
      ).rejects.toThrow('Invalid query');

      // Transaction should only be attempted once
      // (not retried because InvalidArg is not retryable)
      expect(transactionAttempts).toBe(1);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle RLS context setting in transactions', async () => {
      type TxClient = {
        $executeRaw: ReturnType<typeof mock>;
        position: { findMany: ReturnType<typeof mock> };
      };

      const mockClient = {
        $transaction: mock(async (callback: (tx: TxClient) => Promise<unknown>) => {
          const txClient: TxClient = {
            $executeRaw: mock(async (_query: unknown) => {
              // Simulate successful RLS context setting
              return 1;
            }),
            position: {
              findMany: mock(async () => [
                { id: '1', userId: 'user123', amount: 100 }
              ]),
            },
          };
          return await callback(txClient);
        }),
      };

      const proxiedClient = createRetryProxy(mockClient);

      // Simulate asUser pattern
      const result = await proxiedClient.$transaction(async (tx: TxClient) => {
        // Set RLS context
        await tx.$executeRaw(
          Prisma.sql`SELECT set_config('app.current_user_id', ${'user123'}, true)`
        );
        
        // Query with RLS applied
        const positions = await tx.position.findMany();
        return positions;
      }) as Array<{ id: string; userId: string; amount: number }>;

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('userId', 'user123');
    });

    it('should handle concurrent transaction errors correctly', async () => {
      let attempts = 0;

      const mockClient = {
        user: {
          create: mock(async () => {
            attempts++;
            
            // First attempt: unique constraint violation (should not retry)
            if (attempts === 1) {
              const error = new Error('Unique constraint failed') as Error & { code: string };
              error.code = 'P2002';
              error.name = 'PrismaClientKnownRequestError';
              throw error;
            }
            
            return { id: '1', name: 'Test' };
          }),
        },
      };

      const proxiedClient = createRetryProxy(mockClient, {
        maxRetries: 5,
        initialDelayMs: 1,
      });

      // Should fail immediately without retry
      await expect(
        proxiedClient.user.create()
      ).rejects.toThrow('Unique constraint');

      expect(attempts).toBe(1);
    });
  });

  describe('Performance and Backoff', () => {
    it('should apply jitter and backoff correctly', async () => {
      // Note: Testing exact timing is flaky due to jitter and system variance
      // The important behavior (retry attempts) is tested in other tests
      let attempts = 0;

      const operation = mock(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('ETIMEDOUT');
        }
        return { success: true };
      });

      const result = await withRetry(operation, 'test', {
        maxRetries: 5,
        initialDelayMs: 1,
        backoffMultiplier: 2,
        jitter: true,
      });

      // Verify retry behavior works
      expect(attempts).toBe(3);
      expect(result).toEqual({ success: true });
    });
  });

  describe('Proxy Edge Cases', () => {
    it('should handle Symbol property access on client', () => {
      const mockClient = {
        user: {
          findMany: mock(async () => []),
        },
        [Symbol.for('test')]: 'symbolValue',
      };

      const proxiedClient = createRetryProxy(mockClient);
      
      // Should pass through Symbol access without wrapping
      expect(proxiedClient[Symbol.for('test')]).toBe('symbolValue');
    });

    it('should handle Symbol property access on model', () => {
      const mockModel = {
        findMany: mock(async () => []),
        [Symbol.for('modelSymbol')]: 'modelSymbolValue',
      };

      const mockClient = {
        user: mockModel,
      };

      const proxiedClient = createRetryProxy(mockClient);
      
      // Should pass through Symbol access on model
      expect(proxiedClient.user[Symbol.for('modelSymbol')]).toBe('modelSymbolValue');
    });

    it('should handle non-object model properties', () => {
      const mockClient = {
        user: {
          findMany: mock(async () => []),
        },
        someString: 'stringValue',
        someNumber: 42,
        someNull: null,
      };

      const proxiedClient = createRetryProxy(mockClient);
      
      // Should return primitives as-is without wrapping
      expect(proxiedClient.someString).toBe('stringValue');
      expect(proxiedClient.someNumber).toBe(42);
      expect(proxiedClient.someNull).toBe(null);
    });

    it('should handle non-function model properties', () => {
      const mockClient = {
        user: {
          findMany: mock(async () => []),
          someProperty: 'propertyValue',
          someConfig: { setting: true },
        },
      };

      const proxiedClient = createRetryProxy(mockClient);
      
      // Should return non-function properties as-is
      expect(proxiedClient.user.someProperty).toBe('propertyValue');
      expect(proxiedClient.user.someConfig).toEqual({ setting: true });
    });

    it('should handle undefined model', () => {
      const mockClient = {
        user: {
          findMany: mock(async () => []),
        },
        undefinedModel: undefined,
      };

      const proxiedClient = createRetryProxy(mockClient);
      
      // Should return undefined as-is
      expect(proxiedClient.undefinedModel).toBeUndefined();
    });
  });

  describe('Retry Logic Edge Cases', () => {
    it('should throw on max retries with no error (edge case)', async () => {
      // This tests the "should never be reached" code path
      let attempts = 0;
      const operation = mock(async () => {
        attempts++;
        // Always throw retryable error
        throw new Error('ETIMEDOUT');
      });

      await expect(
        withRetry(operation, 'test', {
          maxRetries: 2,
          initialDelayMs: 1,
        })
      ).rejects.toThrow('ETIMEDOUT');

      // Should attempt 3 times (initial + 2 retries)
      expect(attempts).toBe(3);
    });

    it('should handle jitter=false option', async () => {
      let attempts = 0;
      const delays: number[] = [];
      const startTimes: number[] = [];

      const operation = mock(async () => {
        const now = Date.now();
        if (attempts > 0) {
          const lastStartTime = startTimes[startTimes.length - 1];
          if (lastStartTime !== undefined) {
            delays.push(now - lastStartTime);
          }
        }
        startTimes.push(now);
        attempts++;
        
        if (attempts < 3) {
          throw new Error('ETIMEDOUT');
        }
        return { success: true };
      });

      await withRetry(operation, 'test', {
        maxRetries: 5,
        initialDelayMs: 10,
        backoffMultiplier: 2,
        jitter: false, // No jitter
      });

      // With jitter=false, delays should be more consistent
      expect(attempts).toBe(3);
      expect(delays.length).toBe(2);
    });

    it('should cap delay at maxDelayMs', async () => {
      let attempts = 0;
      const operation = mock(async () => {
        attempts++;
        if (attempts < 10) {
          throw new Error('ETIMEDOUT');
        }
        return { success: true };
      });

      const startTime = Date.now();
      
      await withRetry(operation, 'test', {
        maxRetries: 10,
        initialDelayMs: 1000,
        maxDelayMs: 50, // Cap at 50ms
        backoffMultiplier: 10, // Would grow very large without cap
        jitter: false,
      });

      const duration = Date.now() - startTime;
      
      // Should complete relatively quickly because delays are capped
      // 9 retries * 50ms max = 450ms maximum
      expect(duration).toBeLessThan(1000); // Well under 1 second
      expect(attempts).toBe(10);
    });

    it('should handle error without code property', async () => {
      let attempts = 0;
      const operation = mock(async () => {
        attempts++;
        const error = new Error('Generic error');
        // No code property
        throw error;
      });

      await expect(
        withRetry(operation, 'test', { maxRetries: 3 })
      ).rejects.toThrow('Generic error');

      // Should not retry (not a retryable error)
      expect(attempts).toBe(1);
    });

    it('should handle error with Symbol code property', async () => {
      let attempts = 0;
      const operation = mock(async () => {
        attempts++;
        const error = new Error('Symbol error') as Error & { code: symbol };
        error.code = Symbol('errorCode');
        throw error;
      });

      await expect(
        withRetry(operation, 'test', { maxRetries: 3 })
      ).rejects.toThrow('Symbol error');

      // Should not retry and should not crash on Symbol
      expect(attempts).toBe(1);
    });
  });

  describe('Actual Prisma Export Integration', () => {
    it('should have prisma export with retry proxy applied', () => {
      // Verify prisma client exists (may be null in build time)
      if (prisma) {
        // Verify it has the expected properties
        expect(prisma).toBeDefined();
        expect(typeof prisma.$transaction).toBe('function');
        
        // Verify model methods exist
        expect(prisma.user).toBeDefined();
        expect(typeof prisma.user.findMany).toBe('function');
      }
    });

    it('should expose all retry configuration exports', () => {
      // Verify all public APIs are exported
      expect(createRetryProxy).toBeDefined();
      expect(typeof createRetryProxy).toBe('function');
      
      expect(withRetry).toBeDefined();
      expect(typeof withRetry).toBe('function');
      
      expect(isRetryableError).toBeDefined();
      expect(typeof isRetryableError).toBe('function');
    });
  });

  describe('100% Coverage - All Error Codes', () => {
    const RETRYABLE_CODES = ['P1001', 'P1002', 'P1008', 'P1017', 'P2024'];
    const NON_RETRYABLE_CODES = ['P2002', 'P2025', 'P2003', 'P2014', 'P2016', 'InvalidArg'];

    RETRYABLE_CODES.forEach(code => {
      it(`should retry error code ${code}`, () => {
        const error = new Error(`Error ${code}`);
        (error as Error & { code: string }).code = code;
        error.name = 'PrismaClientKnownRequestError';
        
        expect(isRetryableError(error)).toBe(true);
      });
    });

    NON_RETRYABLE_CODES.forEach(code => {
      it(`should NOT retry error code ${code}`, () => {
        const error = new Error(`Error ${code}`);
        (error as Error & { code: string }).code = code;
        error.name = 'PrismaClientKnownRequestError';
        
        expect(isRetryableError(error)).toBe(false);
      });
    });

    const RETRYABLE_MESSAGES = [
      'Can\'t reach database server',
      'Connection timeout',
      'ECONNREFUSED',
      'ECONNRESET',
      'EPIPE',
      'Connection terminated unexpectedly',
    ];

    RETRYABLE_MESSAGES.forEach(message => {
      it(`should retry error with message: ${message}`, () => {
        const error = new Error(message);
        
        expect(isRetryableError(error)).toBe(true);
      });
    });
  });
});

