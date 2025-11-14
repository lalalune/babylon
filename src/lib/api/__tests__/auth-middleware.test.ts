import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { NextRequest } from 'next/server'

const mockVerifyAgentSession = mock()
const mockVerifyAuthToken = mock()
const mockFindUnique = mock()
const mockPrivyClient = mock(() => ({
  verifyAuthToken: mockVerifyAuthToken,
}))

mock.module('@/lib/auth/agent-auth', () => ({
  verifyAgentSession: mockVerifyAgentSession,
}))

mock.module('@/lib/database-service', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
    },
  },
}))

mock.module('@privy-io/server-auth', () => ({
  PrivyClient: mockPrivyClient,
}))

const createRequest = (token: string) =>
  ({
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? `Bearer ${token}` : null,
    },
  }) as unknown as NextRequest

describe('authenticate middleware', () => {
  let authenticate: (request: NextRequest) => Promise<unknown>

  beforeAll(async () => {
    ;({ authenticate } = await import('../auth-middleware'))
  })

  beforeEach(() => {
    mockVerifyAgentSession.mockReset()
    mockVerifyAuthToken.mockReset()
    mockFindUnique.mockReset()
    mockPrivyClient.mockReset()
    process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'test-app'
    process.env.PRIVY_APP_SECRET = 'test-secret'
  })

  it('returns agent user when session token is valid', async () => {
    mockVerifyAgentSession.mockReturnValueOnce({ agentId: 'agent-123' })

    const request = createRequest('agent-session-token')
    const result = await authenticate(request)

    expect(result).toEqual({
      userId: 'agent-123',
      privyId: 'agent-123',
      isAgent: true,
    })
    expect(mockVerifyAuthToken).not.toHaveBeenCalled()
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('falls back to privy claims when agent session missing and db user absent', async () => {
    mockVerifyAgentSession.mockReturnValueOnce(null)
    mockVerifyAuthToken.mockResolvedValueOnce({ userId: 'privy-user' })
    mockFindUnique.mockResolvedValueOnce(null)

    const request = createRequest('privy-token')
    const result = await authenticate(request)

    expect(result).toMatchObject({
      userId: 'privy-user',
      dbUserId: undefined,
      privyId: 'privy-user',
      isAgent: false,
    })
  })

  it('returns canonical id when privy user exists in db', async () => {
    mockVerifyAgentSession.mockReturnValueOnce(null)
    mockVerifyAuthToken.mockResolvedValueOnce({ userId: 'privy-user' })
    mockFindUnique.mockResolvedValueOnce({
      id: 'db-user-id',
      walletAddress: '0xabc',
    })

    const request = createRequest('privy-token')
    const result = await authenticate(request)

    expect(result).toMatchObject({
      userId: 'db-user-id',
      dbUserId: 'db-user-id',
      privyId: 'privy-user',
      walletAddress: '0xabc',
    })
  })

  it('throws descriptive error when privy token is expired', async () => {
    mockVerifyAgentSession.mockReturnValueOnce(null)
    mockVerifyAuthToken.mockRejectedValueOnce(new Error('token expired: exp mismatch'))

    const request = createRequest('expired-token')

    await expect(authenticate(request)).rejects.toMatchObject({
      message: 'Authentication token has expired. Please refresh your session.',
      code: 'AUTH_FAILED',
    })
  })
})
