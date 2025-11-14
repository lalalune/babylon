[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/db/context](../README.md) / asSystem

# Function: asSystem()

> **asSystem**\<`T`\>(`operation`, `operationName?`): `Promise`\<`T`\>

Defined in: [src/lib/db/context.ts:215](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/db/context.ts#L215)

Execute a database operation as system (bypass RLS completely)

Use this for operations that need full database access:
- Admin operations
- Background jobs
- Cron tasks
- System-level operations

WARNING: This bypasses all RLS policies. Only use when necessary.
All system operations are logged for security auditing.

## Type Parameters

### T

`T`

## Parameters

### operation

(`db`) => `Promise`\<`T`\>

The database operation to execute without RLS

### operationName?

`string`

Optional name for logging/auditing purposes

## Returns

`Promise`\<`T`\>

## Example

```ts
// Admin route
const allUsers = await asSystem(async (db) => {
  return await db.user.findMany() // Returns ALL users
}, 'admin-list-all-users')
```
