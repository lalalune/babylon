[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/rate-limiting/duplicate-detector](../README.md) / checkDuplicate

# Function: checkDuplicate()

> **checkDuplicate**(`userId`, `content`, `config`): `object`

Defined in: [src/lib/rate-limiting/duplicate-detector.ts:60](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/rate-limiting/duplicate-detector.ts#L60)

Check if content is a duplicate
Returns true if the same content was posted recently by the same user

## Parameters

### userId

`string`

### content

`string`

### config

#### windowMs

`number`

#### actionType

`string`

## Returns

`object`

### isDuplicate

> **isDuplicate**: `boolean`

### lastPostedAt?

> `optional` **lastPostedAt**: `Date`
