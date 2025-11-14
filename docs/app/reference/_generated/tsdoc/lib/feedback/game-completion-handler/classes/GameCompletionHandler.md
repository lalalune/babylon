[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/feedback/game-completion-handler](../README.md) / GameCompletionHandler

# Class: GameCompletionHandler

Defined in: [src/lib/feedback/game-completion-handler.ts:17](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/game-completion-handler.ts#L17)

Game Completion Handler Service

Manages the lifecycle of automatic feedback generation in response to game events.

## Methods

### getInstance()

> `static` **getInstance**(): `GameCompletionHandler`

Defined in: [src/lib/feedback/game-completion-handler.ts:28](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/game-completion-handler.ts#L28)

Get or create singleton instance

#### Returns

`GameCompletionHandler`

***

### start()

> **start**(`gameEngine`): `void`

Defined in: [src/lib/feedback/game-completion-handler.ts:42](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/game-completion-handler.ts#L42)

Start handling game completions

Initializes auto-feedback generator and connects it to game engine events.

#### Parameters

##### gameEngine

`GameEngine`

GameEngine instance to monitor

#### Returns

`void`

***

### stop()

> **stop**(): `void`

Defined in: [src/lib/feedback/game-completion-handler.ts:80](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/game-completion-handler.ts#L80)

Stop handling game completions

Disconnects from game engine and stops auto-feedback generation.

#### Returns

`void`

***

### getStatus()

> **getStatus**(): `object`

Defined in: [src/lib/feedback/game-completion-handler.ts:101](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/game-completion-handler.ts#L101)

Get current handler status

#### Returns

`object`

##### isActive

> **isActive**: `boolean`

##### autoFeedbackStatus

> **autoFeedbackStatus**: `object`

###### autoFeedbackStatus.isListening

> **isListening**: `boolean`

###### autoFeedbackStatus.hasEngine

> **hasEngine**: `boolean`

***

### isReady()

> **isReady**(): `boolean`

Defined in: [src/lib/feedback/game-completion-handler.ts:114](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/game-completion-handler.ts#L114)

Check if handler is ready to process completions

#### Returns

`boolean`
