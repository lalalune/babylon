[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/trade](../README.md) / TradeSignalSchema

# Variable: TradeSignalSchema

> `const` **TradeSignalSchema**: `ZodObject`\<\{ `marketType`: `ZodEnum`\<\{ `prediction`: `"prediction"`; `perp`: `"perp"`; `spot`: `"spot"`; \}\>; `ticker`: `ZodOptional`\<`ZodString`\>; `marketId`: `ZodOptional`\<`ZodString`\>; `signal`: `ZodEnum`\<\{ `BUY`: `"BUY"`; `SELL`: `"SELL"`; `HOLD`: `"HOLD"`; `CLOSE`: `"CLOSE"`; \}\>; `confidence`: `ZodNumber`; `size`: `ZodOptional`\<`ZodNumber`\>; `price`: `ZodOptional`\<`ZodNumber`\>; `stopLoss`: `ZodOptional`\<`ZodNumber`\>; `takeProfit`: `ZodOptional`\<`ZodNumber`\>; `timeframe`: `ZodOptional`\<`ZodEnum`\<\{ `1m`: `"1m"`; `5m`: `"5m"`; `15m`: `"15m"`; `30m`: `"30m"`; `1h`: `"1h"`; `4h`: `"4h"`; `1d`: `"1d"`; `1w`: `"1w"`; `1M`: `"1M"`; \}\>\>; `reasoning`: `ZodOptional`\<`ZodString`\>; `metadata`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/trade.ts:95](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/trade.ts#L95)

Trade signal schema (for AI/algorithmic trading)
