[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/token-counter](../README.md) / getSafeContextLimit

# Function: getSafeContextLimit()

> **getSafeContextLimit**(`model`, `outputTokens`, `safetyMargin`): `number`

Defined in: src/lib/token-counter.ts:170

Calculate safe context limit (leaving room for output)

## Parameters

### model

`string`

Model name

### outputTokens

`number` = `8000`

Expected output tokens (default: 8000)

### safetyMargin

`number` = `0.1`

Additional safety margin (default: 10%)

## Returns

`number`
