/**
 * Sentry Server Actions Wrapper
 * 
 * Best practice: Wrap server actions with Sentry to capture errors and performance.
 * This provides better error tracking for Next.js server actions.
 * 
 * Usage:
 * ```ts
 * 'use server'
 * 
 * import { wrapServerActionWithSentry } from '@/lib/sentry/server-actions'
 * 
 * export const myServerAction = wrapServerActionWithSentry(
 *   'myServerAction',
 *   async (data: MyDataType) => {
 *     // Your server action code
 *   }
 * )
 * ```
 */

import * as Sentry from '@sentry/nextjs'

/**
 * Wrap a server action with Sentry error tracking and performance monitoring
 */
export function wrapServerActionWithSentry<T extends unknown[], R>(
  actionName: string,
  action: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    return Sentry.startSpan(
      {
        name: `serverAction.${actionName}`,
        op: 'function.server_action',
        attributes: {
          'server.action.name': actionName,
        },
      },
      async () => {
        return await action(...args)
      }
    )
  }
}

