import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedUser } from '@/lib/api/auth-middleware'
import { ensureUserForAuth, getCanonicalUserId } from '../ensure-user'

type UserRecord = {
  id: string
  privyId: string
  username: string | null
  displayName: string | null
  walletAddress: string | null
  isActor: boolean
  profileImageUrl: string | null
}

const state = {
  users: new Map<string, UserRecord>(),
}

const clone = <T>(value: T): T =>
  typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value))

const prismaMock = {
  user: {
    findUnique: async ({ where }: { where: { id?: string; privyId?: string } }) => {
      if (where.id) {
        return clone(state.users.get(where.id) ?? null)
      }
      if (where.privyId) {
        const match = [...state.users.values()].find((user) => user.privyId === where.privyId)
        return match ? clone(match) : null
      }
      return null
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<UserRecord> }) => {
      const current = state.users.get(where.id)
      if (!current) {
        throw new Error(`User ${where.id} not found`)
      }
      const updated: UserRecord = {
        ...current,
        ...data,
      }
      state.users.set(where.id, updated)
      return clone(updated)
    },
    create: async ({ data }: { data: UserRecord }) => {
      state.users.set(data.id, data)
      return clone(data)
    },
    upsert: async ({
      where,
      update,
      create,
    }: {
      where: { privyId: string }
      update: Partial<UserRecord>
      create: UserRecord
      select: { id: boolean; privyId: boolean; username: boolean; displayName: boolean; walletAddress: boolean; isActor: boolean; profileImageUrl: boolean }
    }) => {
      const existing = [...state.users.values()].find((user) => user.privyId === where.privyId)
      let target: UserRecord

      if (existing) {
        target = {
          ...existing,
          ...update,
        }
      } else {
        target = { ...create }
      }

      state.users.set(target.id, target)
      return {
        id: target.id,
        privyId: target.privyId,
        username: target.username,
        displayName: target.displayName,
        walletAddress: target.walletAddress,
        isActor: target.isActor,
        profileImageUrl: target.profileImageUrl,
      }
    },
  },
}

vi.mock('@/lib/database-service', () => ({
  prisma: prismaMock,
}))

describe('ensureUserForAuth', () => {
  beforeEach(() => {
    state.users.clear()
  })

  it('returns canonical user and sets dbUserId when record exists with different session id', async () => {
    state.users.set('uuid-123', {
      id: 'uuid-123',
      privyId: 'agent-alpha',
      username: 'agent-alpha',
      displayName: 'Agent Alpha',
      walletAddress: null,
      isActor: false,
      profileImageUrl: null,
    })

    const authUser: AuthenticatedUser = {
      userId: 'agent-alpha',
      privyId: 'agent-alpha',
      isAgent: true,
    }

    const { user: canonical } = await ensureUserForAuth(authUser)

    expect(canonical.id).toBe('uuid-123')
    expect(authUser.dbUserId).toBe('uuid-123')
    expect(getCanonicalUserId(authUser)).toBe('uuid-123')
  })

  it('creates a new user when none exist and returns canonical id', async () => {
    const authUser: AuthenticatedUser = {
      userId: 'new-user',
      privyId: 'new-user',
      walletAddress: '0xabc',
      isAgent: false,
    }

    const { user: canonical } = await ensureUserForAuth(authUser, {
      displayName: 'New User',
    })

    expect(canonical.id).toBe('new-user')
    expect(canonical.displayName).toBe('New User')
    expect(authUser.dbUserId).toBe('new-user')
    expect(getCanonicalUserId(authUser)).toBe('new-user')
  })

  it('does not overwrite existing display name when fallback provided', async () => {
    state.users.set('uuid-456', {
      id: 'uuid-456',
      privyId: 'existing-privy',
      username: 'existing',
      displayName: 'Custom Name',
      walletAddress: null,
      isActor: false,
      profileImageUrl: null,
    })

    const authUser: AuthenticatedUser = {
      userId: 'existing-privy',
      privyId: 'existing-privy',
      dbUserId: 'uuid-456',
      isAgent: false,
    }

    const { user: canonical } = await ensureUserForAuth(authUser, {
      displayName: 'Wallet Fallback',
    })

    expect(canonical.displayName).toBe('Custom Name')
    expect(state.users.get('uuid-456')?.displayName).toBe('Custom Name')
  })
})
