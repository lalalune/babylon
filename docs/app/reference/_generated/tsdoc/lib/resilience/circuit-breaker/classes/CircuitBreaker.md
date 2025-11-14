[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/resilience/circuit-breaker](../README.md) / CircuitBreaker

# Class: CircuitBreaker

Defined in: [src/lib/resilience/circuit-breaker.ts:26](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/resilience/circuit-breaker.ts#L26)

Circuit Breaker implementation

## Constructors

### Constructor

> **new CircuitBreaker**(`options`): `CircuitBreaker`

Defined in: [src/lib/resilience/circuit-breaker.ts:33](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/resilience/circuit-breaker.ts#L33)

#### Parameters

##### options

[`CircuitBreakerOptions`](../interfaces/CircuitBreakerOptions.md)

#### Returns

`CircuitBreaker`

## Methods

### execute()

> **execute**\<`T`\>(`fn`): `Promise`\<`T`\>

Defined in: [src/lib/resilience/circuit-breaker.ts:40](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/resilience/circuit-breaker.ts#L40)

Execute function with circuit breaker protection

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

***

### getState()

> **getState**(): [`CircuitState`](../enumerations/CircuitState.md)

Defined in: [src/lib/resilience/circuit-breaker.ts:124](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/resilience/circuit-breaker.ts#L124)

Get current state

#### Returns

[`CircuitState`](../enumerations/CircuitState.md)

***

### getMetrics()

> **getMetrics**(): `object`

Defined in: [src/lib/resilience/circuit-breaker.ts:131](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/resilience/circuit-breaker.ts#L131)

Get current metrics

#### Returns

`object`

##### state

> **state**: [`CircuitState`](../enumerations/CircuitState.md)

##### failureCount

> **failureCount**: `number`

##### successCount

> **successCount**: `number`

##### nextAttempt

> **nextAttempt**: `Date` \| `null`

***

### reset()

> **reset**(): `void`

Defined in: [src/lib/resilience/circuit-breaker.ts:148](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/resilience/circuit-breaker.ts#L148)

Reset circuit breaker (for testing or manual intervention)

#### Returns

`void`
