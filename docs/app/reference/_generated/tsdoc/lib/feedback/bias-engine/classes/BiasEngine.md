[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/feedback/bias-engine](../README.md) / BiasEngine

# Class: BiasEngine

Defined in: [src/lib/feedback/bias-engine.ts:28](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/bias-engine.ts#L28)

## Methods

### getInstance()

> `static` **getInstance**(): `BiasEngine`

Defined in: [src/lib/feedback/bias-engine.ts:40](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/bias-engine.ts#L40)

Get singleton instance

#### Returns

`BiasEngine`

***

### setBias()

> **setBias**(`entityId`, `entityName`, `direction`, `strength`, `options?`): `void`

Defined in: [src/lib/feedback/bias-engine.ts:54](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/bias-engine.ts#L54)

Add or update a bias configuration

#### Parameters

##### entityId

`string`

##### entityName

`string`

##### direction

`"up"` | `"down"`

##### strength

`number` = `0.5`

##### options?

###### durationHours?

`number`

###### decayRate?

`number`

#### Returns

`void`

#### Example

```ts
biasEngine.setBias('tesla', 'Tesla', 'up', 0.8, { durationHours: 24 })
biasEngine.setBias('elon-musk', 'Elon Musk', 'down', 0.6)
```

***

### removeBias()

> **removeBias**(`entityId`): `boolean`

Defined in: [src/lib/feedback/bias-engine.ts:94](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/bias-engine.ts#L94)

Remove a bias

#### Parameters

##### entityId

`string`

#### Returns

`boolean`

***

### tuneBiasStrength()

> **tuneBiasStrength**(`entityId`, `strength`, `decayRate?`): `boolean`

Defined in: [src/lib/feedback/bias-engine.ts:110](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/bias-engine.ts#L110)

Tune the strength of an existing bias

#### Parameters

##### entityId

`string`

Entity ID to tune

##### strength

`number`

New strength (0-1)

##### decayRate?

`number`

Optional new decay rate (0-1)

#### Returns

`boolean`

true if bias was found and tuned, false otherwise

***

### getActiveBiases()

> **getActiveBiases**(): [`BiasConfig`](../interfaces/BiasConfig.md)[]

Defined in: [src/lib/feedback/bias-engine.ts:141](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/bias-engine.ts#L141)

Get all active biases

#### Returns

[`BiasConfig`](../interfaces/BiasConfig.md)[]

***

### getBiasAdjustment()

> **getBiasAdjustment**(`entityId`): [`BiasAdjustment`](../interfaces/BiasAdjustment.md)

Defined in: [src/lib/feedback/bias-engine.ts:154](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/bias-engine.ts#L154)

Get bias adjustment for an entity

Returns price impact and sentiment shift based on active biases.
Handles bias decay over time and expiration.

#### Parameters

##### entityId

`string`

Entity ID or ticker to check

#### Returns

[`BiasAdjustment`](../interfaces/BiasAdjustment.md)

BiasAdjustment with price and sentiment modifiers

***

### getCombinedBiasAdjustment()

> **getCombinedBiasAdjustment**(`entityIds`): [`BiasAdjustment`](../interfaces/BiasAdjustment.md)

Defined in: [src/lib/feedback/bias-engine.ts:212](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/bias-engine.ts#L212)

Get combined bias adjustment for multiple potential matches

Useful when entity might be referenced by different IDs/keywords

#### Parameters

##### entityIds

`string`[]

Array of potential entity IDs to check

#### Returns

[`BiasAdjustment`](../interfaces/BiasAdjustment.md)

Combined bias adjustment

***

### findBiasesInText()

> **findBiasesInText**(`text`): `Map`\<`string`, [`BiasAdjustment`](../interfaces/BiasAdjustment.md)\>

Defined in: [src/lib/feedback/bias-engine.ts:248](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/bias-engine.ts#L248)

Find entity matches for text analysis

Searches for entity mentions in text and returns relevant bias adjustments

#### Parameters

##### text

`string`

Text to analyze for entity mentions

#### Returns

`Map`\<`string`, [`BiasAdjustment`](../interfaces/BiasAdjustment.md)\>

Map of entity IDs to bias adjustments

***

### setBulkBiases()

> **setBulkBiases**(`biases`): `void`

Defined in: [src/lib/feedback/bias-engine.ts:274](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/bias-engine.ts#L274)

Bulk set biases from configuration

#### Parameters

##### biases

`object`[]

#### Returns

`void`

#### Example

```ts
biasEngine.setBulkBiases([
  { entityId: 'tesla', entityName: 'Tesla', direction: 'up', strength: 0.8 },
  { entityId: 'elon-musk', entityName: 'Elon Musk', direction: 'down', strength: 0.6 }
])
```

***

### stop()

> **stop**(): `void`

Defined in: [src/lib/feedback/bias-engine.ts:330](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/bias-engine.ts#L330)

Stop cleanup interval (for shutdown)

#### Returns

`void`

***

### exportBiases()

> **exportBiases**(): [`BiasConfig`](../interfaces/BiasConfig.md)[]

Defined in: [src/lib/feedback/bias-engine.ts:341](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/bias-engine.ts#L341)

Export current biases for persistence

#### Returns

[`BiasConfig`](../interfaces/BiasConfig.md)[]

***

### importBiases()

> **importBiases**(`biases`): `void`

Defined in: [src/lib/feedback/bias-engine.ts:348](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/bias-engine.ts#L348)

Import biases from persistence

#### Parameters

##### biases

[`BiasConfig`](../interfaces/BiasConfig.md)[]

#### Returns

`void`
