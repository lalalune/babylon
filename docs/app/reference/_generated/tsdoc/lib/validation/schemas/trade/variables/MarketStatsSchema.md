[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/trade](../README.md) / MarketStatsSchema

# Variable: MarketStatsSchema

> `const` **MarketStatsSchema**: `ZodObject`\<\{ `marketType`: `ZodString`; `ticker`: `ZodNullable`\<`ZodString`\>; `marketId`: `ZodNullable`\<`ZodString`\>; `price`: `ZodNumber`; `change24h`: `ZodNumber`; `changePercent24h`: `ZodNumber`; `volume24h`: `ZodNumber`; `high24h`: `ZodNumber`; `low24h`: `ZodNumber`; `openInterest`: `ZodOptional`\<`ZodNumber`\>; `fundingRate`: `ZodOptional`\<`ZodNumber`\>; `nextFundingTime`: `ZodOptional`\<`ZodString`\>; `markPrice`: `ZodOptional`\<`ZodNumber`\>; `indexPrice`: `ZodOptional`\<`ZodNumber`\>; `timestamp`: `ZodString`; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/trade.ts:227](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/trade.ts#L227)

Market statistics schema
