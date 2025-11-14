import { prisma } from '@/lib/database-service'
import { NotFoundError } from '@/lib/errors'
import { Prisma, type User } from '@prisma/client'

type SelectArg = Parameters<typeof prisma.user.findUnique>[0]['select']

// Helper type to get the return type based on select
type UserResult<T extends SelectArg | undefined> = 
  T extends undefined 
    ? User | null 
    : T extends SelectArg 
      ? Prisma.UserGetPayload<{ select: T }> | null 
      : never;

export async function findUserByIdentifier<T extends SelectArg | undefined = undefined>(
  identifier: string,
  select?: T
): Promise<UserResult<T>> {
  // Try to find by ID first
  if (select) {
    const byId = await prisma.user.findUnique({ where: { id: identifier }, select })
    if (byId) {
      return byId as UserResult<T>
    }
  } else {
    const byId = await prisma.user.findUnique({ where: { id: identifier } })
    if (byId) {
      return byId as UserResult<T>
    }
  }

  // Try to find by privyId
  try {
    if (select) {
      const byPrivyId = await prisma.user.findUnique({ where: { privyId: identifier }, select })
      if (byPrivyId) {
        return byPrivyId as UserResult<T>
      }
    } else {
      const byPrivyId = await prisma.user.findUnique({ where: { privyId: identifier } })
      if (byPrivyId) {
        return byPrivyId as UserResult<T>
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
    return byUsername as UserResult<T>
  } else {
    const byUsername = await prisma.user.findUnique({ where: { username: identifier } })
    return byUsername as UserResult<T>
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
