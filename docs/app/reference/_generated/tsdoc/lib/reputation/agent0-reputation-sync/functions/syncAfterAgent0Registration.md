[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/agent0-reputation-sync](../README.md) / syncAfterAgent0Registration

# Function: syncAfterAgent0Registration()

> **syncAfterAgent0Registration**(`userId`, `agent0TokenId`): `Promise`\<\{ \}\>

Defined in: [src/lib/reputation/agent0-reputation-sync.ts:25](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/agent0-reputation-sync.ts#L25)

Sync Agent0 on-chain reputation to local database after registration

Called automatically after successful Agent0 registration to initialize
local reputation metrics with on-chain data.

## Parameters

### userId

`string`

User ID

### agent0TokenId

`number`

Agent0 network token ID

## Returns

`Promise`\<\{ \}\>

Updated performance metrics
