[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/onchain-market-service](../README.md) / ensureMarketOnChain

# Function: ensureMarketOnChain()

> **ensureMarketOnChain**(`marketId`): `Promise`\<`boolean`\>

Defined in: [src/lib/services/onchain-market-service.ts:247](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/onchain-market-service.ts#L247)

Ensure a market exists on-chain and update the database with onChainMarketId
This is idempotent - if the market already has an onChainMarketId, it won't create again

## Parameters

### marketId

`string`

## Returns

`Promise`\<`boolean`\>
