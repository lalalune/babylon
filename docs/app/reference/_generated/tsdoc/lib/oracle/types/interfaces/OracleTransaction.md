[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/oracle/types](../README.md) / OracleTransaction

# Interface: OracleTransaction

Defined in: [src/lib/oracle/types.ts:70](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/types.ts#L70)

## Properties

### id

> **id**: `string`

Defined in: [src/lib/oracle/types.ts:71](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/types.ts#L71)

***

### questionId?

> `optional` **questionId**: `string`

Defined in: [src/lib/oracle/types.ts:72](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/types.ts#L72)

***

### txType

> **txType**: `"commit"` \| `"reveal"` \| `"resolve"`

Defined in: [src/lib/oracle/types.ts:73](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/types.ts#L73)

***

### txHash

> **txHash**: `string`

Defined in: [src/lib/oracle/types.ts:74](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/types.ts#L74)

***

### status

> **status**: [`TransactionStatus`](../enumerations/TransactionStatus.md)

Defined in: [src/lib/oracle/types.ts:75](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/types.ts#L75)

***

### blockNumber?

> `optional` **blockNumber**: `number`

Defined in: [src/lib/oracle/types.ts:76](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/types.ts#L76)

***

### gasUsed?

> `optional` **gasUsed**: `bigint`

Defined in: [src/lib/oracle/types.ts:77](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/types.ts#L77)

***

### gasPrice?

> `optional` **gasPrice**: `bigint`

Defined in: [src/lib/oracle/types.ts:78](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/types.ts#L78)

***

### error?

> `optional` **error**: `string`

Defined in: [src/lib/oracle/types.ts:79](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/types.ts#L79)

***

### retryCount

> **retryCount**: `number`

Defined in: [src/lib/oracle/types.ts:80](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/types.ts#L80)

***

### createdAt

> **createdAt**: `Date`

Defined in: [src/lib/oracle/types.ts:81](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/types.ts#L81)

***

### confirmedAt?

> `optional` **confirmedAt**: `Date`

Defined in: [src/lib/oracle/types.ts:82](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/types.ts#L82)
