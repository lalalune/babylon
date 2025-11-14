[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/capital-allocation-service](../README.md) / CapitalAllocationService

# Class: CapitalAllocationService

Defined in: [src/lib/services/capital-allocation-service.ts:21](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/capital-allocation-service.ts#L21)

## Constructors

### Constructor

> **new CapitalAllocationService**(): `CapitalAllocationService`

#### Returns

`CapitalAllocationService`

## Methods

### calculateCapital()

> `static` **calculateCapital**(`actor`): `CapitalAllocation`

Defined in: [src/lib/services/capital-allocation-service.ts:25](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/capital-allocation-service.ts#L25)

Calculate starting capital for an NPC based on their profile

#### Parameters

##### actor

[`Actor`](../../../../engine/FeedGenerator/interfaces/Actor.md)

#### Returns

`CapitalAllocation`

***

### getExampleAllocations()

> `static` **getExampleAllocations**(): `object`[]

Defined in: [src/lib/services/capital-allocation-service.ts:197](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/capital-allocation-service.ts#L197)

Get example allocations for common actor types

#### Returns

`object`[]

***

### validateAllocation()

> `static` **validateAllocation**(`actor`, `allocation`): `boolean`

Defined in: [src/lib/services/capital-allocation-service.ts:214](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/capital-allocation-service.ts#L214)

Validate capital allocation makes sense

#### Parameters

##### actor

[`Actor`](../../../../engine/FeedGenerator/interfaces/Actor.md)

##### allocation

`CapitalAllocation`

#### Returns

`boolean`
