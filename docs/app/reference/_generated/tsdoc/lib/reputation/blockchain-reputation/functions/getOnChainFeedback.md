[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/blockchain-reputation](../README.md) / getOnChainFeedback

# Function: getOnChainFeedback()

> **getOnChainFeedback**(`tokenId`, `index`): `Promise`\<\{ `from`: `` `0x${string}` ``; `rating`: `number`; `comment`: `string`; `timestamp`: `bigint`; \} \| `null`\>

Defined in: [src/lib/reputation/blockchain-reputation.ts:282](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/blockchain-reputation.ts#L282)

Get specific feedback from on-chain reputation system

## Parameters

### tokenId

`number`

ERC-8004 token ID

### index

`number`

Feedback index

## Returns

`Promise`\<\{ `from`: `` `0x${string}` ``; `rating`: `number`; `comment`: `string`; `timestamp`: `bigint`; \} \| `null`\>

Feedback details
