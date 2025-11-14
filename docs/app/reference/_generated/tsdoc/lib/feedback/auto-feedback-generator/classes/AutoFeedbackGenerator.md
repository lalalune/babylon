[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/feedback/auto-feedback-generator](../README.md) / AutoFeedbackGenerator

# Class: AutoFeedbackGenerator

Defined in: [src/lib/feedback/auto-feedback-generator.ts:30](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/auto-feedback-generator.ts#L30)

Auto-Feedback Generator Service

Singleton service that listens to game events and generates feedback automatically.

## Methods

### getInstance()

> `static` **getInstance**(): `AutoFeedbackGenerator`

Defined in: [src/lib/feedback/auto-feedback-generator.ts:42](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/auto-feedback-generator.ts#L42)

Get or create singleton instance

#### Returns

`AutoFeedbackGenerator`

***

### initialize()

> **initialize**(`gameEngine`): `void`

Defined in: [src/lib/feedback/auto-feedback-generator.ts:54](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/auto-feedback-generator.ts#L54)

Initialize and start listening to game engine events

#### Parameters

##### gameEngine

`GameEngine`

GameEngine instance to listen to

#### Returns

`void`

***

### stop()

> **stop**(): `void`

Defined in: [src/lib/feedback/auto-feedback-generator.ts:88](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/auto-feedback-generator.ts#L88)

Stop listening to events

#### Returns

`void`

***

### getStatus()

> **getStatus**(): `object`

Defined in: [src/lib/feedback/auto-feedback-generator.ts:207](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/auto-feedback-generator.ts#L207)

Get current status

#### Returns

`object`

##### isListening

> **isListening**: `boolean`

##### hasEngine

> **hasEngine**: `boolean`
