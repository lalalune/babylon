[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/blockchain-reputation](../README.md) / submitOnChainFeedback

# Function: submitOnChainFeedback()

> **submitOnChainFeedback**(`tokenId`, `rating`, `comment`, `walletClient`): `Promise`\<`string`\>

Defined in: [src/lib/reputation/blockchain-reputation.ts:72](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/blockchain-reputation.ts#L72)

Submit feedback to on-chain reputation system

## Parameters

### tokenId

`number`

ERC-8004 token ID

### rating

`number`

Rating score (-128 to 127, maps to 0-100 scale)

### comment

`string`

Optional comment

### walletClient

Wallet client for signing transaction

## Returns

`Promise`\<`string`\>

Transaction hash
