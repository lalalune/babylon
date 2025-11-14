[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/testing/load-test-simulator](../README.md) / LoadTestResult

# Interface: LoadTestResult

Defined in: [src/lib/testing/load-test-simulator.ts:36](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L36)

## Properties

### config

> **config**: [`LoadTestConfig`](LoadTestConfig.md)

Defined in: [src/lib/testing/load-test-simulator.ts:37](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L37)

***

### startTime

> **startTime**: `Date`

Defined in: [src/lib/testing/load-test-simulator.ts:38](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L38)

***

### endTime

> **endTime**: `Date`

Defined in: [src/lib/testing/load-test-simulator.ts:39](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L39)

***

### durationMs

> **durationMs**: `number`

Defined in: [src/lib/testing/load-test-simulator.ts:40](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L40)

***

### totalRequests

> **totalRequests**: `number`

Defined in: [src/lib/testing/load-test-simulator.ts:42](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L42)

***

### successfulRequests

> **successfulRequests**: `number`

Defined in: [src/lib/testing/load-test-simulator.ts:43](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L43)

***

### failedRequests

> **failedRequests**: `number`

Defined in: [src/lib/testing/load-test-simulator.ts:44](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L44)

***

### responseTime

> **responseTime**: `object`

Defined in: [src/lib/testing/load-test-simulator.ts:46](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L46)

#### min

> **min**: `number`

#### max

> **max**: `number`

#### mean

> **mean**: `number`

#### median

> **median**: `number`

#### p95

> **p95**: `number`

#### p99

> **p99**: `number`

***

### throughput

> **throughput**: `object`

Defined in: [src/lib/testing/load-test-simulator.ts:55](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L55)

#### requestsPerSecond

> **requestsPerSecond**: `number`

#### successRate

> **successRate**: `number`

***

### errors

> **errors**: `object`[]

Defined in: [src/lib/testing/load-test-simulator.ts:60](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L60)

#### endpoint

> **endpoint**: `string`

#### error

> **error**: `string`

#### count

> **count**: `number`

***

### endpointStats

> **endpointStats**: `Record`\<`string`, \{ `count`: `number`; `successCount`: `number`; `avgResponseTime`: `number`; `errorCount`: `number`; \}\>

Defined in: [src/lib/testing/load-test-simulator.ts:66](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L66)
