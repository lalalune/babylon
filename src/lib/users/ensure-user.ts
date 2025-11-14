import { prisma } from '@/lib/database-service'
import type { AuthenticatedUser } from '@/lib/api/auth-middleware'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

interface EnsureUserOptions {
  displayName?: string
  username?: string | null
  isActor?: boolean
}

const selectWithPrivyId = {
  id: true,
  privyId: true,
  username: true,
  displayName: true,
  walletAddress: true,
  isActor: true,
  profileImageUrl: true,
} as const

const selectWithoutPrivyId = {
  id: true,
  username: true,
  displayName: true,
  walletAddress: true,
  isActor: true,
  profileImageUrl: true,
} as const

type CanonicalUserWithPrivy = Prisma.UserGetPayload<{ select: typeof selectWithPrivyId }>
type CanonicalUserWithoutPrivy = Prisma.UserGetPayload<{ select: typeof selectWithoutPrivyId }>

type CanonicalUser = CanonicalUserWithPrivy | CanonicalUserWithoutPrivy

export async function ensureUserForAuth(
  user: AuthenticatedUser,
  options: EnsureUserOptions = {}
): Promise<{ user: CanonicalUser }> {
  const privyId = user.privyId ?? user.userId

  const updateData: Prisma.UserUpdateInput = {}

  if (user.walletAddress) {
    updateData.walletAddress = user.walletAddress
  }
  if (options.username !== undefined) {
    updateData.username = options.username
  }
  if (options.isActor !== undefined) {
    updateData.isActor = options.isActor
  }

  const createData: Prisma.UserCreateInput = {
    id: user.dbUserId ?? user.userId,
    privyId,
    isActor: options.isActor ?? false,
  }

  if (user.walletAddress) {
    createData.walletAddress = user.walletAddress
  }
  if (options.username !== undefined) {
    createData.username = options.username ?? null
  }

  if (options.displayName !== undefined) {
    createData.displayName = options.displayName
    if (user.dbUserId) {
      const existing = await prisma.user.findUnique({
        where: { id: user.dbUserId },
        select: { displayName: true },
      })
      if (!existing?.displayName) {
        updateData.displayName = options.displayName
      }
    }
  }

  let canonicalUser: CanonicalUser

  try {
    canonicalUser = await prisma.user.upsert({
      where: { privyId },
      update: updateData,
      create: createData,
      select: selectWithPrivyId,
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2022' &&
      error.meta?.column === 'User.privyId'
    ) {
      logger.warn(
        'privyId column missing - falling back to legacy user upsert',
        { userId: user.userId },
        'ensureUserForAuth'
      )

      const { privyId: _privyId, ...fallbackCreateData } = createData

      canonicalUser = await prisma.user.upsert({
        where: { id: fallbackCreateData.id },
        update: updateData,
        create: fallbackCreateData as Prisma.UserCreateInput,
        select: selectWithoutPrivyId,
      })
    } else {
      throw error
    }
  }

  user.dbUserId = canonicalUser.id

  return { user: canonicalUser }
}

export function getCanonicalUserId(user: Pick<AuthenticatedUser, 'userId' | 'dbUserId'>): string {
  return user.dbUserId ?? user.userId
}
