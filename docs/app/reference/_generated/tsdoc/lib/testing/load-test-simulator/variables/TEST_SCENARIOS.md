[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/testing/load-test-simulator](../README.md) / TEST\_SCENARIOS

# Variable: TEST\_SCENARIOS

> `const` **TEST\_SCENARIOS**: `object`

Defined in: [src/lib/testing/load-test-simulator.ts:354](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/testing/load-test-simulator.ts#L354)

Predefined test scenarios

## Type Declaration

### LIGHT

> **LIGHT**: `object`

Light load: 100 users for 1 minute

#### LIGHT.concurrentUsers

> **concurrentUsers**: `number` = `100`

#### LIGHT.durationSeconds

> **durationSeconds**: `number` = `60`

#### LIGHT.rampUpSeconds

> **rampUpSeconds**: `number` = `10`

#### LIGHT.thinkTimeMs

> **thinkTimeMs**: `number` = `1000`

#### LIGHT.endpoints

> **endpoints**: `object`[]

### NORMAL

> **NORMAL**: `object`

Normal load: 500 users for 2 minutes

#### NORMAL.concurrentUsers

> **concurrentUsers**: `number` = `500`

#### NORMAL.durationSeconds

> **durationSeconds**: `number` = `120`

#### NORMAL.rampUpSeconds

> **rampUpSeconds**: `number` = `20`

#### NORMAL.thinkTimeMs

> **thinkTimeMs**: `number` = `500`

#### NORMAL.endpoints

> **endpoints**: `object`[]

### HEAVY

> **HEAVY**: `object`

Heavy load: 1000 users for 5 minutes

#### HEAVY.concurrentUsers

> **concurrentUsers**: `number` = `1000`

#### HEAVY.durationSeconds

> **durationSeconds**: `number` = `300`

#### HEAVY.rampUpSeconds

> **rampUpSeconds**: `number` = `30`

#### HEAVY.thinkTimeMs

> **thinkTimeMs**: `number` = `200`

#### HEAVY.maxRps

> **maxRps**: `number` = `1000`

#### HEAVY.endpoints

> **endpoints**: `object`[]

### STRESS

> **STRESS**: `object`

Stress test: 2000+ users for 5 minutes

#### STRESS.concurrentUsers

> **concurrentUsers**: `number` = `2000`

#### STRESS.durationSeconds

> **durationSeconds**: `number` = `300`

#### STRESS.rampUpSeconds

> **rampUpSeconds**: `number` = `60`

#### STRESS.thinkTimeMs

> **thinkTimeMs**: `number` = `100`

#### STRESS.maxRps

> **maxRps**: `number` = `2000`

#### STRESS.endpoints

> **endpoints**: `object`[]
