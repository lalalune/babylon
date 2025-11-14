[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/prompts/complete-example](../README.md) / setupValidationMonitoring

# Function: setupValidationMonitoring()

> **setupValidationMonitoring**(): `object`

Defined in: [src/lib/prompts/complete-example.ts:232](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/prompts/complete-example.ts#L232)

## Returns

`object`

### logViolation()

> **logViolation**: (`post`, `violations`) => `void`

#### Parameters

##### post

`string`

##### violations

`string`[]

#### Returns

`void`

### logSuccess()

> **logSuccess**: (`post`, `type`) => `void`

#### Parameters

##### post

`string`

##### type

`string`

#### Returns

`void`

### getStats()

> **getStats**: () => `object`

#### Returns

`object`

##### totalGenerated

> **totalGenerated**: `number` = `0`

##### totalValid

> **totalValid**: `number` = `0`

##### totalInvalid

> **totalInvalid**: `number` = `0`

##### commonViolations

> **commonViolations**: `object` = `{}`
