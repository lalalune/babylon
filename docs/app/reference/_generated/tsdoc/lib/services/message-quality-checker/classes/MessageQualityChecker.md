[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/message-quality-checker](../README.md) / MessageQualityChecker

# Class: MessageQualityChecker

Defined in: [src/lib/services/message-quality-checker.ts:29](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/message-quality-checker.ts#L29)

## Constructors

### Constructor

> **new MessageQualityChecker**(): `MessageQualityChecker`

#### Returns

`MessageQualityChecker`

## Methods

### checkQuality()

> `static` **checkQuality**(`message`, `userId`, `contextType`, `contextId`): `Promise`\<[`QualityCheckResult`](../interfaces/QualityCheckResult.md)\>

Defined in: [src/lib/services/message-quality-checker.ts:42](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/message-quality-checker.ts#L42)

Check message quality

#### Parameters

##### message

`string`

##### userId

`string`

##### contextType

`"dm"` | `"reply"` | `"groupchat"`

##### contextId

`string`

#### Returns

`Promise`\<[`QualityCheckResult`](../interfaces/QualityCheckResult.md)\>

***

### getUserQualityStats()

> `static` **getUserQualityStats**(`userId`): `Promise`\<\{ `averageScore`: `number`; `totalMessages`: `number`; `highQualityCount`: `number`; `lowQualityCount`: `number`; \}\>

Defined in: [src/lib/services/message-quality-checker.ts:269](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/message-quality-checker.ts#L269)

Get user's quality statistics

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<\{ `averageScore`: `number`; `totalMessages`: `number`; `highQualityCount`: `number`; `lowQualityCount`: `number`; \}\>
