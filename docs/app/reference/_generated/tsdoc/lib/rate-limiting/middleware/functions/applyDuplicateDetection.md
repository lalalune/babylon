[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/rate-limiting/middleware](../README.md) / applyDuplicateDetection

# Function: applyDuplicateDetection()

> **applyDuplicateDetection**(`userId`, `content`, `config`): `object`

Defined in: [src/lib/rate-limiting/middleware.ts:89](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/rate-limiting/middleware.ts#L89)

Apply duplicate detection to content

Usage:
```ts
const duplicateResult = await applyDuplicateDetection(
  user.userId,
  content,
  DUPLICATE_DETECTION_CONFIGS.POST
);
if (duplicateResult.isDuplicate) {
  return duplicateContentError(duplicateResult.lastPostedAt);
}
```

## Parameters

### userId

`string`

### content

`string`

### config

\{ `windowMs`: `number`; `actionType`: `"post"`; \} | \{ `windowMs`: `number`; `actionType`: `"comment"`; \} | \{ `windowMs`: `number`; `actionType`: `"message"`; \}

## Returns

`object`

### isDuplicate

> **isDuplicate**: `boolean`

### lastPostedAt?

> `optional` **lastPostedAt**: `Date`
