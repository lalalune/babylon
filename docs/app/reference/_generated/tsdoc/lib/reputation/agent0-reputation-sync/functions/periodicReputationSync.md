[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/agent0-reputation-sync](../README.md) / periodicReputationSync

# Function: periodicReputationSync()

> **periodicReputationSync**(`userId?`): `Promise`\<\{ `total`: `number`; `results`: (\{ `userId`: `string`; `agent0TokenId`: `number`; `success`: `boolean`; `syncedAt`: `Date`; `error?`: `undefined`; \} \| \{ `syncedAt?`: `undefined`; `userId`: `string`; `agent0TokenId`: `number` \| `null`; `success`: `boolean`; `error`: `string`; \})[]; \}\>

Defined in: [src/lib/reputation/agent0-reputation-sync.ts:201](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/agent0-reputation-sync.ts#L201)

Periodic sync of on-chain reputation to local database

Should be called periodically (e.g., daily cron job) to keep local
reputation metrics in sync with blockchain state.

## Parameters

### userId?

`string`

Optional user ID to sync (if not provided, syncs all agents)

## Returns

`Promise`\<\{ `total`: `number`; `results`: (\{ `userId`: `string`; `agent0TokenId`: `number`; `success`: `boolean`; `syncedAt`: `Date`; `error?`: `undefined`; \} \| \{ `syncedAt?`: `undefined`; `userId`: `string`; `agent0TokenId`: `number` \| `null`; `success`: `boolean`; `error`: `string`; \})[]; \}\>

Sync results
