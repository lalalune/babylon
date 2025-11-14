[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/trade](../README.md) / RiskParametersSchema

# Variable: RiskParametersSchema

> `const` **RiskParametersSchema**: `ZodObject`\<\{ `maxPositionSize`: `ZodNumber`; `maxLeverage`: `ZodNumber`; `maxDrawdown`: `ZodNumber`; `stopLossPercentage`: `ZodNumber`; `takeProfitPercentage`: `ZodOptional`\<`ZodNumber`\>; `maxOpenPositions`: `ZodNumber`; `dailyLossLimit`: `ZodOptional`\<`ZodNumber`\>; `marginCallLevel`: `ZodDefault`\<`ZodNumber`\>; `liquidationLevel`: `ZodDefault`\<`ZodNumber`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/trade.ts:153](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/trade.ts#L153)

Risk parameters schema
