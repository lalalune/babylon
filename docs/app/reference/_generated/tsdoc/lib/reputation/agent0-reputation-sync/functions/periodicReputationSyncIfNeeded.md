[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/agent0-reputation-sync](../README.md) / periodicReputationSyncIfNeeded

# Function: periodicReputationSyncIfNeeded()

> **periodicReputationSyncIfNeeded**(): `Promise`\<\{ `error?`: `undefined`; `synced`: `boolean`; `total?`: `undefined`; `successful?`: `undefined`; `failed?`: `undefined`; \} \| \{ `error?`: `undefined`; `synced`: `boolean`; `total`: `number`; `successful`: `number`; `failed`: `number`; \} \| \{ `total?`: `undefined`; `successful?`: `undefined`; `failed?`: `undefined`; `synced`: `boolean`; `error`: `string`; \}\>

Defined in: [src/lib/reputation/agent0-reputation-sync.ts:418](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/agent0-reputation-sync.ts#L418)

Periodic reputation sync if needed (called from game tick)
Only syncs if it's been 3+ hours since the last sync

## Returns

`Promise`\<\{ `error?`: `undefined`; `synced`: `boolean`; `total?`: `undefined`; `successful?`: `undefined`; `failed?`: `undefined`; \} \| \{ `error?`: `undefined`; `synced`: `boolean`; `total`: `number`; `successful`: `number`; `failed`: `number`; \} \| \{ `total?`: `undefined`; `successful?`: `undefined`; `failed?`: `undefined`; `synced`: `boolean`; `error`: `string`; \}\>

Object with synced status and optional results
