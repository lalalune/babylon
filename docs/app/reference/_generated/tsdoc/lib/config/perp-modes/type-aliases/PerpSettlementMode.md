[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/config/perp-modes](../README.md) / PerpSettlementMode

# Type Alias: PerpSettlementMode

> **PerpSettlementMode** = `"offchain"` \| `"onchain"` \| `"hybrid"`

Defined in: [src/lib/config/perp-modes.ts:10](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/config/perp-modes.ts#L10)

Perpetuals Settlement Mode Configuration

Supports three modes:
- offchain: Fast MVP trading with database persistence 
- onchain: Decentralized trading with blockchain settlement (P 
- hybrid: Off-chain execution with periodic on-chain settlement (best of both)
