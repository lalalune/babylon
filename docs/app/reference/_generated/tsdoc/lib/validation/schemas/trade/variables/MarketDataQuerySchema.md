[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/trade](../README.md) / MarketDataQuerySchema

# Variable: MarketDataQuerySchema

> `const` **MarketDataQuerySchema**: `ZodObject`\<\{ `marketType`: `ZodEnum`\<\{ `prediction`: `"prediction"`; `perp`: `"perp"`; `spot`: `"spot"`; \}\>; `ticker`: `ZodOptional`\<`ZodString`\>; `marketId`: `ZodOptional`\<`ZodString`\>; `timeframe`: `ZodEnum`\<\{ `1m`: `"1m"`; `5m`: `"5m"`; `15m`: `"15m"`; `30m`: `"30m"`; `1h`: `"1h"`; `4h`: `"4h"`; `1d`: `"1d"`; `1w`: `"1w"`; `1M`: `"1M"`; \}\>; `startTime`: `ZodOptional`\<`ZodString`\>; `endTime`: `ZodOptional`\<`ZodString`\>; `limit`: `ZodDefault`\<`ZodNumber`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/trade.ts:113](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/trade.ts#L113)

Market data query schema
