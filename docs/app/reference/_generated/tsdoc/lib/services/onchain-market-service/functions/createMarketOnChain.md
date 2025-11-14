[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/onchain-market-service](../README.md) / createMarketOnChain

# Function: createMarketOnChain()

> **createMarketOnChain**(`question`, `endDate`, `oracleAddress?`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [src/lib/services/onchain-market-service.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/onchain-market-service.ts#L18)

Create a prediction market on-chain

## Parameters

### question

`string`

The question text

### endDate

`Date`

The resolution date

### oracleAddress?

`` `0x${string}` ``

The oracle address authorized to resolve this market

## Returns

`Promise`\<`` `0x${string}` `` \| `null`\>

The on-chain market ID (bytes32)
