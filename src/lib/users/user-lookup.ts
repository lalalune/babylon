import { prisma } from '@/lib/database-service'
import { NotFoundError } from '@/lib/errors'
import { Prisma, type User } from '@prisma/client'

type SelectArg = Parameters<typeof prisma.user.findUnique>[0]['select']

export async function findUserByIdentifier<T extends SelectArg | undefined = undefined>(
  identifier: string,
  select?: T
): Promise<T extends undefined ? User | null : (T extends SelectArg ? Prisma.UserGetPayload<{ select: T }> | null : never)> {
  // Try to find by ID first
  if (select) {
    const byId = await prisma.user.findUnique({ where: { id: identifier }, select })
    if (byId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return byId as any
    }
  } else {
    const byId = await prisma.user.findUnique({ where: { id: identifier } })
    if (byId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return byId as any
    }
  }

  // Try to find by privyId
  try {
    if (select) {
      const byPrivyId = await prisma.user.findUnique({ where: { privyId: identifier }, select })
      if (byPrivyId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return byPrivyId as any
      }
    } else {
      const byPrivyId = await prisma.user.findUnique({ where: { privyId: identifier } })
      if (byPrivyId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return byPrivyId as any
      }
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2022' &&
      error.meta?.column === 'User.privyId'
    ) {
      // Fall through to try username lookup
    } else {
      throw error
    }
  }

  // Try to find by username
  if (select) {
    const byUsername = await prisma.user.findUnique({ where: { username: identifier }, select })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return byUsername as any
  } else {
    const byUsername = await prisma.user.findUnique({ where: { username: identifier } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return byUsername as any
  }
}

export async function requireUserByIdentifier<T extends SelectArg | undefined = undefined>(
  identifier: string,
  select?: T
) {
  const user = await findUserByIdentifier(identifier, select)
  if (!user) {
    throw new NotFoundError('User', identifier)
  }
  return user
}
