[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/db/context](../README.md) / asPublic

# Function: asPublic()

> **asPublic**\<`T`\>(`operation`): `Promise`\<`T`\>

Defined in: [src/lib/db/context.ts:188](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/db/context.ts#L188)

Execute a database operation as public (unauthenticated user)

Use this for operations that should work without authentication but still
respect RLS policies for public data access.

Common use cases:
- Reading public posts/profiles
- Browsing public markets
- Viewing leaderboards

## Type Parameters

### T

`T`

## Parameters

### operation

(`db`) => `Promise`\<`T`\>

The database operation to execute without user context

## Returns

`Promise`\<`T`\>

## Example

```ts
// Public route
const posts = await asPublic(async (db) => {
  return await db.post.findMany() // Returns only public posts per RLS
})
```
