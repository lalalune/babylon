[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/logger](../README.md) / Logger

# Class: Logger

Defined in: [src/lib/logger.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/logger.ts#L18)

## Constructors

### Constructor

> **new Logger**(): `Logger`

Defined in: [src/lib/logger.ts:27](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/logger.ts#L27)

#### Returns

`Logger`

## Methods

### debug()

> **debug**(`message`, `data?`, `context?`): `void`

Defined in: [src/lib/logger.ts:96](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/logger.ts#L96)

#### Parameters

##### message

`string`

##### data?

`unknown`

##### context?

`string`

#### Returns

`void`

***

### info()

> **info**(`message`, `data?`, `context?`): `void`

Defined in: [src/lib/logger.ts:100](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/logger.ts#L100)

#### Parameters

##### message

`string`

##### data?

`unknown`

##### context?

`string`

#### Returns

`void`

***

### warn()

> **warn**(`message`, `data?`, `context?`): `void`

Defined in: [src/lib/logger.ts:104](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/logger.ts#L104)

#### Parameters

##### message

`string`

##### data?

`unknown`

##### context?

`string`

#### Returns

`void`

***

### error()

> **error**(`message`, `data?`, `context?`): `void`

Defined in: [src/lib/logger.ts:108](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/logger.ts#L108)

#### Parameters

##### message

`string`

##### data?

`unknown`

##### context?

`string`

#### Returns

`void`

***

### setLevel()

> **setLevel**(`level`): `void`

Defined in: [src/lib/logger.ts:112](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/logger.ts#L112)

#### Parameters

##### level

[`LogLevel`](../type-aliases/LogLevel.md)

#### Returns

`void`

***

### getLevel()

> **getLevel**(): [`LogLevel`](../type-aliases/LogLevel.md)

Defined in: [src/lib/logger.ts:116](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/logger.ts#L116)

#### Returns

[`LogLevel`](../type-aliases/LogLevel.md)
