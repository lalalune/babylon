[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/blockchain-reputation](../README.md) / recordLoss

# Function: recordLoss()

> **recordLoss**(`tokenId`, `loss`, `walletClient`): `Promise`\<`string`\>

Defined in: [src/lib/reputation/blockchain-reputation.ts:185](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/blockchain-reputation.ts#L185)

Record a loss on-chain

## Parameters

### tokenId

`number`

ERC-8004 token ID

### loss

`number`

Loss amount

### walletClient

Wallet client for signing transaction

## Returns

`Promise`\<`string`\>

Transaction hash
