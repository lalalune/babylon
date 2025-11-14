[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/agent0-reputation-sync](../README.md) / submitFeedbackToAgent0

# Function: submitFeedbackToAgent0()

> **submitFeedbackToAgent0**(`feedbackId`, `submitToBlockchain`): `Promise`\<\{ `agent0TokenId`: `number`; `agent0Rating`: `number`; `submitted`: `boolean`; \} \| `null`\>

Defined in: [src/lib/reputation/agent0-reputation-sync.ts:100](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/agent0-reputation-sync.ts#L100)

Submit local feedback to Agent0 network

When users rate agents locally, optionally propagate feedback to Agent0's
on-chain reputation system for network-wide visibility.

## Parameters

### feedbackId

`string`

Local feedback record ID

### submitToBlockchain

`boolean` = `false`

Whether to also submit to ERC-8004 (requires gas)

## Returns

`Promise`\<\{ `agent0TokenId`: `number`; `agent0Rating`: `number`; `submitted`: `boolean`; \} \| `null`\>

Agent0 submission result
