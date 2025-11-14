[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/db/context](../README.md) / asUser

# Function: asUser()

> **asUser**\<`T`\>(`authUser`, `operation`): `Promise`\<`T`\>

Defined in: [src/lib/db/context.ts:156](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/db/context.ts#L156)

Execute a database operation as a user (with RLS)

Sets the PostgreSQL session variable `app.current_user_id` to the authenticated
user's ID, which RLS policies use to filter queries automatically.

SECURITY: This function requires a valid authenticated user. If authUser is null/undefined,
it will throw an error. Use asPublic() for unauthenticated access or asSystem() for
admin/system operations.

## Type Parameters

### T

`T`

## Parameters

### authUser

The authenticated user (from authenticate())

[`AuthenticatedUser`](../../../api/auth-middleware/interfaces/AuthenticatedUser.md) | `null` | `undefined`

### operation

(`db`) => `Promise`\<`T`\>

The database operation to execute with RLS context

## Returns

`Promise`\<`T`\>

## Throws

If authUser is null or undefined

## Example

```ts
// Authenticated route
const authUser = await authenticate(request)
const positions = await asUser(authUser, async (db) => {
  return await db.position.findMany() // Only returns user's positions
})
```
