[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/prediction-pricing](../README.md) / PredictionPricing

# Class: PredictionPricing

Defined in: [src/lib/prediction-pricing.ts:28](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/prediction-pricing.ts#L28)

## Constructors

### Constructor

> **new PredictionPricing**(): `PredictionPricing`

#### Returns

`PredictionPricing`

## Methods

### calculateBuy()

> `static` **calculateBuy**(`currentYesShares`, `currentNoShares`, `side`, `usdAmount`): [`ShareCalculation`](../interfaces/ShareCalculation.md)

Defined in: [src/lib/prediction-pricing.ts:32](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/prediction-pricing.ts#L32)

Calculate shares when buying (CPMM: k = yesShares * noShares)

#### Parameters

##### currentYesShares

`number`

##### currentNoShares

`number`

##### side

`"yes"` | `"no"`

##### usdAmount

`number`

#### Returns

[`ShareCalculation`](../interfaces/ShareCalculation.md)

***

### calculateSell()

> `static` **calculateSell**(`currentYesShares`, `currentNoShares`, `side`, `sharesToSell`): [`ShareCalculation`](../interfaces/ShareCalculation.md)

Defined in: [src/lib/prediction-pricing.ts:99](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/prediction-pricing.ts#L99)

Calculate proceeds when selling shares (CPMM: k = yesShares * noShares)

#### Parameters

##### currentYesShares

`number`

##### currentNoShares

`number`

##### side

`"yes"` | `"no"`

##### sharesToSell

`number`

#### Returns

[`ShareCalculation`](../interfaces/ShareCalculation.md)

***

### getCurrentPrice()

> `static` **getCurrentPrice**(`yesShares`, `noShares`, `side`): `number`

Defined in: [src/lib/prediction-pricing.ts:164](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/prediction-pricing.ts#L164)

#### Parameters

##### yesShares

`number`

##### noShares

`number`

##### side

`"yes"` | `"no"`

#### Returns

`number`

***

### calculateExpectedPayout()

> `static` **calculateExpectedPayout**(`shares`): `number`

Defined in: [src/lib/prediction-pricing.ts:172](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/prediction-pricing.ts#L172)

Calculate expected payout if position wins

#### Parameters

##### shares

`number`

#### Returns

`number`

***

### initializeMarket()

> `static` **initializeMarket**(`initialLiquidity`): `object`

Defined in: [src/lib/prediction-pricing.ts:177](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/prediction-pricing.ts#L177)

#### Parameters

##### initialLiquidity

`number` = `1000`

#### Returns

`object`

##### yesShares

> **yesShares**: `number`

##### noShares

> **noShares**: `number`

***

### calculateBuyWithFees()

> `static` **calculateBuyWithFees**(`currentYesShares`, `currentNoShares`, `side`, `totalAmount`): [`ShareCalculationWithFees`](../interfaces/ShareCalculationWithFees.md)

Defined in: [src/lib/prediction-pricing.ts:188](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/prediction-pricing.ts#L188)

Calculate buy with trading fees
User provides total amount to spend, fees are deducted, then shares are calculated

#### Parameters

##### currentYesShares

`number`

##### currentNoShares

`number`

##### side

`"yes"` | `"no"`

##### totalAmount

`number`

#### Returns

[`ShareCalculationWithFees`](../interfaces/ShareCalculationWithFees.md)

***

### calculateSellWithFees()

> `static` **calculateSellWithFees**(`currentYesShares`, `currentNoShares`, `side`, `sharesToSell`): [`ShareCalculationWithFees`](../interfaces/ShareCalculationWithFees.md)

Defined in: [src/lib/prediction-pricing.ts:219](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/prediction-pricing.ts#L219)

Calculate sell with trading fees
Calculates proceeds, then deducts fee from proceeds

#### Parameters

##### currentYesShares

`number`

##### currentNoShares

`number`

##### side

`"yes"` | `"no"`

##### sharesToSell

`number`

#### Returns

[`ShareCalculationWithFees`](../interfaces/ShareCalculationWithFees.md)
