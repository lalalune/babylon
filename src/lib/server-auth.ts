/**
 * Server-side authentication utilities
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'

export async function authenticateUser(req: NextRequest) {
  const authUser = await authenticate(req)
  return {
    id: authUser.userId,
    privyId: authUser.privyId,
    ...authUser
  }
}

