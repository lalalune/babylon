[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/testing/load-test-simulator](../README.md) / LoadTestConfig

# Interface: LoadTestConfig

Defined in: [src/lib/testing/load-test-simulator.ts:10](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L10)

## Properties

### concurrentUsers

> **concurrentUsers**: `number`

Defined in: [src/lib/testing/load-test-simulator.ts:12](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L12)

Number of concurrent users to simulate

***

### durationSeconds

> **durationSeconds**: `number`

Defined in: [src/lib/testing/load-test-simulator.ts:15](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L15)

Duration of test in seconds

***

### endpoints

> **endpoints**: `object`[]

Defined in: [src/lib/testing/load-test-simulator.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L18)

Endpoints to test with their weights (probability of being called)

#### path

> **path**: `string`

#### method

> **method**: `"POST"` \| `"GET"` \| `"PUT"` \| `"PATCH"` \| `"DELETE"`

#### weight

> **weight**: `number`

#### headers?

> `optional` **headers**: `Record`\<`string`, `string`\>

#### body?

> `optional` **body**: `Record`\<`string`, `unknown`\>

***

### rampUpSeconds?

> `optional` **rampUpSeconds**: `number`

Defined in: [src/lib/testing/load-test-simulator.ts:27](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L27)

Ramp-up time in seconds (gradually increase load)

***

### thinkTimeMs?

> `optional` **thinkTimeMs**: `number`

Defined in: [src/lib/testing/load-test-simulator.ts:30](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L30)

Think time between requests (ms)

***

### maxRps?

> `optional` **maxRps**: `number`

Defined in: [src/lib/testing/load-test-simulator.ts:33](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L33)

Maximum requests per second (rate limiting)
