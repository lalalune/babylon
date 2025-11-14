[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/testing/load-test-simulator](../README.md) / LoadTestSimulator

# Class: LoadTestSimulator

Defined in: [src/lib/testing/load-test-simulator.ts:82](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L82)

## Constructors

### Constructor

> **new LoadTestSimulator**(`baseUrl`): `LoadTestSimulator`

Defined in: [src/lib/testing/load-test-simulator.ts:89](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L89)

#### Parameters

##### baseUrl

`string` = `'http://localhost:3000'`

#### Returns

`LoadTestSimulator`

## Methods

### runTest()

> **runTest**(`config`): `Promise`\<[`LoadTestResult`](../interfaces/LoadTestResult.md)\>

Defined in: [src/lib/testing/load-test-simulator.ts:96](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L96)

Run a load test with the given configuration

#### Parameters

##### config

[`LoadTestConfig`](../interfaces/LoadTestConfig.md)

#### Returns

`Promise`\<[`LoadTestResult`](../interfaces/LoadTestResult.md)\>

***

### stop()

> **stop**(): `void`

Defined in: [src/lib/testing/load-test-simulator.ts:339](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L339)

Stop the running test

#### Returns

`void`
