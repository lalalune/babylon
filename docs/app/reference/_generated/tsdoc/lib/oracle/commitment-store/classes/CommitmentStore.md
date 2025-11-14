[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/oracle/commitment-store](../README.md) / CommitmentStore

# Class: CommitmentStore

Defined in: [src/lib/oracle/commitment-store.ts:20](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/commitment-store.ts#L20)

## Constructors

### Constructor

> **new CommitmentStore**(): `CommitmentStore`

#### Returns

`CommitmentStore`

## Methods

### generateSalt()

> `static` **generateSalt**(): `string`

Defined in: [src/lib/oracle/commitment-store.ts:24](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/commitment-store.ts#L24)

Generate a cryptographically secure random salt

#### Returns

`string`

***

### store()

> `static` **store**(`commitment`): `Promise`\<`void`\>

Defined in: [src/lib/oracle/commitment-store.ts:68](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/commitment-store.ts#L68)

Store commitment with encrypted salt

#### Parameters

##### commitment

[`StoredCommitment`](../../types/interfaces/StoredCommitment.md)

#### Returns

`Promise`\<`void`\>

***

### retrieve()

> `static` **retrieve**(`questionId`): `Promise`\<[`StoredCommitment`](../../types/interfaces/StoredCommitment.md) \| `null`\>

Defined in: [src/lib/oracle/commitment-store.ts:91](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/commitment-store.ts#L91)

Retrieve commitment and decrypt salt

#### Parameters

##### questionId

`string`

#### Returns

`Promise`\<[`StoredCommitment`](../../types/interfaces/StoredCommitment.md) \| `null`\>

***

### delete()

> `static` **delete**(`questionId`): `Promise`\<`void`\>

Defined in: [src/lib/oracle/commitment-store.ts:114](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/commitment-store.ts#L114)

Delete commitment after reveal (cleanup)

#### Parameters

##### questionId

`string`

#### Returns

`Promise`\<`void`\>

***

### listPending()

> `static` **listPending**(): `Promise`\<[`StoredCommitment`](../../types/interfaces/StoredCommitment.md)[]\>

Defined in: [src/lib/oracle/commitment-store.ts:125](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/commitment-store.ts#L125)

List all pending commitments (for recovery/debugging)

#### Returns

`Promise`\<[`StoredCommitment`](../../types/interfaces/StoredCommitment.md)[]\>
