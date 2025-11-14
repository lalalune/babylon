[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/batch-operations](../README.md) / batchExecuteWithResults

# Function: batchExecuteWithResults()

> **batchExecuteWithResults**\<`T`, `R`\>(`items`, `batchSize`, `operation`): `Promise`\<`PromiseSettledResult`\<`R`\>[]\>

Defined in: [src/lib/batch-operations.ts:56](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/batch-operations.ts#L56)

Execute async operations in batches with controlled concurrency and return results

## Type Parameters

### T

`T`

### R

`R`

## Parameters

### items

`T`[]

Array of items to process

### batchSize

`number`

Number of items to process concurrently (default: 10)

### operation

(`item`) => `Promise`\<`R`\>

Async function to execute for each item

## Returns

`Promise`\<`PromiseSettledResult`\<`R`\>[]\>

Promise that resolves with array of PromiseSettledResult

## Example

```ts
const results = await batchExecuteWithResults(
  users,
  10,
  async (user) => await processUser(user)
);
```
