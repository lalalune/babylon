[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/batch-operations](../README.md) / batchExecute

# Function: batchExecute()

> **batchExecute**\<`T`\>(`items`, `batchSize`, `operation`): `Promise`\<`void`\>

Defined in: [src/lib/batch-operations.ts:25](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/batch-operations.ts#L25)

Execute async operations in batches with controlled concurrency

## Type Parameters

### T

`T`

## Parameters

### items

`T`[]

Array of items to process

### batchSize

`number`

Number of items to process concurrently (default: 10)

### operation

(`item`) => `Promise`\<`void`\>

Async function to execute for each item

## Returns

`Promise`\<`void`\>

Promise that resolves when all operations complete

## Example

```ts
await batchExecute(
  organizations,
  10, // Process 10 at a time
  async (org) => await db.upsertOrganization(org)
);
```
