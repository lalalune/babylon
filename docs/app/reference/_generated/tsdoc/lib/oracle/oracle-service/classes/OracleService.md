[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/oracle/oracle-service](../README.md) / OracleService

# Class: OracleService

Defined in: [src/lib/oracle/oracle-service.ts:21](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/oracle-service.ts#L21)

## Constructors

### Constructor

> **new OracleService**(`config?`): `OracleService`

Defined in: [src/lib/oracle/oracle-service.ts:27](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/oracle-service.ts#L27)

#### Parameters

##### config?

`Partial`\<[`OracleConfig`](../../types/interfaces/OracleConfig.md)\>

#### Returns

`OracleService`

## Methods

### commitGame()

> **commitGame**(`questionId`, `questionNumber`, `question`, `category`, `outcome`): `Promise`\<[`CommitTransactionResult`](../../types/interfaces/CommitTransactionResult.md)\>

Defined in: [src/lib/oracle/oracle-service.ts:84](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/oracle-service.ts#L84)

Commit a game to the oracle (when question is created)

#### Parameters

##### questionId

`string`

##### questionNumber

`number`

##### question

`string`

##### category

`string`

##### outcome

`boolean`

#### Returns

`Promise`\<[`CommitTransactionResult`](../../types/interfaces/CommitTransactionResult.md)\>

***

### revealGame()

> **revealGame**(`questionId`, `outcome`, `winners`, `totalPayout`): `Promise`\<[`RevealTransactionResult`](../../types/interfaces/RevealTransactionResult.md)\>

Defined in: [src/lib/oracle/oracle-service.ts:187](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/oracle-service.ts#L187)

Reveal a game outcome (when question is resolved)

#### Parameters

##### questionId

`string`

##### outcome

`boolean`

##### winners

`string`[] = `[]`

##### totalPayout

`bigint` = `...`

#### Returns

`Promise`\<[`RevealTransactionResult`](../../types/interfaces/RevealTransactionResult.md)\>

***

### batchCommitGames()

> **batchCommitGames**(`games`): `Promise`\<[`BatchCommitResult`](../../types/interfaces/BatchCommitResult.md)\>

Defined in: [src/lib/oracle/oracle-service.ts:265](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/oracle-service.ts#L265)

Batch commit multiple games (gas optimization)

#### Parameters

##### games

`object`[]

#### Returns

`Promise`\<[`BatchCommitResult`](../../types/interfaces/BatchCommitResult.md)\>

***

### batchRevealGames()

> **batchRevealGames**(`reveals`): `Promise`\<[`BatchRevealResult`](../../types/interfaces/BatchRevealResult.md)\>

Defined in: [src/lib/oracle/oracle-service.ts:402](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/oracle-service.ts#L402)

Batch reveal multiple games (gas optimization)

#### Parameters

##### reveals

`object`[]

#### Returns

`Promise`\<[`BatchRevealResult`](../../types/interfaces/BatchRevealResult.md)\>

***

### getGameInfo()

> **getGameInfo**(`sessionId`): `Promise`\<`any`\>

Defined in: [src/lib/oracle/oracle-service.ts:514](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/oracle-service.ts#L514)

Get game info from oracle

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<`any`\>

***

### getStatistics()

> **getStatistics**(): `Promise`\<\{ `committed`: `any`; `revealed`: `any`; `pending`: `any`; \}\>

Defined in: [src/lib/oracle/oracle-service.ts:527](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/oracle-service.ts#L527)

Get oracle statistics

#### Returns

`Promise`\<\{ `committed`: `any`; `revealed`: `any`; `pending`: `any`; \}\>

***

### healthCheck()

> **healthCheck**(): `Promise`\<\{ `healthy`: `boolean`; `error?`: `string`; \}\>

Defined in: [src/lib/oracle/oracle-service.ts:544](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/oracle/oracle-service.ts#L544)

Health check - verify oracle is accessible and properly configured

#### Returns

`Promise`\<\{ `healthy`: `boolean`; `error?`: `string`; \}\>
