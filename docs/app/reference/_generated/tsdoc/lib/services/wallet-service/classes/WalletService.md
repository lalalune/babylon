[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/wallet-service](../README.md) / WalletService

# Class: WalletService

Defined in: [src/lib/services/wallet-service.ts:36](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/wallet-service.ts#L36)

## Constructors

### Constructor

> **new WalletService**(): `WalletService`

#### Returns

`WalletService`

## Methods

### getBalance()

> `static` **getBalance**(`userId`): `Promise`\<[`BalanceInfo`](../interfaces/BalanceInfo.md)\>

Defined in: [src/lib/services/wallet-service.ts:42](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/wallet-service.ts#L42)

Get user's current balance

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<[`BalanceInfo`](../interfaces/BalanceInfo.md)\>

***

### hasSufficientBalance()

> `static` **hasSufficientBalance**(`userId`, `requiredAmount`): `Promise`\<`boolean`\>

Defined in: [src/lib/services/wallet-service.ts:64](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/wallet-service.ts#L64)

Check if user has sufficient balance

#### Parameters

##### userId

`string`

##### requiredAmount

`number`

#### Returns

`Promise`\<`boolean`\>

***

### debit()

> `static` **debit**(`userId`, `amount`, `type`, `description`, `relatedId?`): `Promise`\<`void`\>

Defined in: [src/lib/services/wallet-service.ts:79](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/wallet-service.ts#L79)

Debit from user's balance (opening position, buying shares)

#### Parameters

##### userId

`string`

##### amount

`number`

##### type

`string`

##### description

`string`

##### relatedId?

`string`

#### Returns

`Promise`\<`void`\>

***

### credit()

> `static` **credit**(`userId`, `amount`, `type`, `description`, `relatedId?`): `Promise`\<`void`\>

Defined in: [src/lib/services/wallet-service.ts:121](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/wallet-service.ts#L121)

Credit to user's balance (closing position with profit, payouts)

#### Parameters

##### userId

`string`

##### amount

`number`

##### type

`string`

##### description

`string`

##### relatedId?

`string`

#### Returns

`Promise`\<`void`\>

***

### recordPnL()

> `static` **recordPnL**(`userId`, `pnl`, `tradeType`, `relatedId?`): `Promise`\<\{ `previousLifetimePnL`: `number`; `newLifetimePnL`: `number`; `earnedPointsDelta`: `number`; \}\>

Defined in: [src/lib/services/wallet-service.ts:163](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/wallet-service.ts#L163)

Record PnL (update lifetime PnL and earned points)

#### Parameters

##### userId

`string`

##### pnl

`number`

##### tradeType

`string`

##### relatedId?

`string`

#### Returns

`Promise`\<\{ `previousLifetimePnL`: `number`; `newLifetimePnL`: `number`; `earnedPointsDelta`: `number`; \}\>

***

### getTransactionHistory()

> `static` **getTransactionHistory**(`userId`, `limit`): `Promise`\<[`TransactionHistoryItem`](../interfaces/TransactionHistoryItem.md)[]\>

Defined in: [src/lib/services/wallet-service.ts:205](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/wallet-service.ts#L205)

Get transaction history

#### Parameters

##### userId

`string`

##### limit

`number` = `50`

#### Returns

`Promise`\<[`TransactionHistoryItem`](../interfaces/TransactionHistoryItem.md)[]\>

***

### initializeBalance()

> `static` **initializeBalance**(`userId`): `Promise`\<`void`\>

Defined in: [src/lib/services/wallet-service.ts:231](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/wallet-service.ts#L231)

Initialize user balance (for new users)

#### Parameters

##### userId

`string`

#### Returns

`Promise`\<`void`\>
