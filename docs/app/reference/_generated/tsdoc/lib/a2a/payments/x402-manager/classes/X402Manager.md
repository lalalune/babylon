[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/a2a/payments/x402-manager](../README.md) / X402Manager

# Class: X402Manager

Defined in: [src/lib/a2a/payments/x402-manager.ts:38](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/payments/x402-manager.ts#L38)

## Constructors

### Constructor

> **new X402Manager**(`config`): `X402Manager`

Defined in: [src/lib/a2a/payments/x402-manager.ts:44](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/payments/x402-manager.ts#L44)

#### Parameters

##### config

[`X402Config`](../interfaces/X402Config.md)

#### Returns

`X402Manager`

## Methods

### createPaymentRequest()

> **createPaymentRequest**(`from`, `to`, `amount`, `service`, `metadata?`): `Promise`\<`PaymentRequest`\>

Defined in: [src/lib/a2a/payments/x402-manager.ts:149](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/payments/x402-manager.ts#L149)

Create a payment request for a service

#### Parameters

##### from

`string`

##### to

`string`

##### amount

`string`

##### service

`string`

##### metadata?

`Record`\<`string`, `string` \| `number` \| `boolean` \| `null`\>

#### Returns

`Promise`\<`PaymentRequest`\>

***

### verifyPayment()

> **verifyPayment**(`verificationData`): `Promise`\<`PaymentVerificationResult`\>

Defined in: [src/lib/a2a/payments/x402-manager.ts:191](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/payments/x402-manager.ts#L191)

Verify a payment receipt against blockchain transaction
Supports both EOA and smart wallet transactions

#### Parameters

##### verificationData

`PaymentVerificationParams`

#### Returns

`Promise`\<`PaymentVerificationResult`\>

***

### getPaymentRequest()

> **getPaymentRequest**(`requestId`): `Promise`\<`PaymentRequest` \| `null`\>

Defined in: [src/lib/a2a/payments/x402-manager.ts:282](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/payments/x402-manager.ts#L282)

Get payment request details

#### Parameters

##### requestId

`string`

#### Returns

`Promise`\<`PaymentRequest` \| `null`\>

***

### isPaymentVerified()

> **isPaymentVerified**(`requestId`): `Promise`\<`boolean`\>

Defined in: [src/lib/a2a/payments/x402-manager.ts:290](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/payments/x402-manager.ts#L290)

Check if payment has been verified

#### Parameters

##### requestId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### cancelPaymentRequest()

> **cancelPaymentRequest**(`requestId`): `Promise`\<`boolean`\>

Defined in: [src/lib/a2a/payments/x402-manager.ts:298](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/payments/x402-manager.ts#L298)

Cancel a payment request

#### Parameters

##### requestId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### getPendingPayments()

> **getPendingPayments**(): `Promise`\<`PendingPayment`[]\>

Defined in: [src/lib/a2a/payments/x402-manager.ts:313](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/payments/x402-manager.ts#L313)

Get all pending payments (for testing/debugging)

#### Returns

`Promise`\<`PendingPayment`[]\>

***

### getStatistics()

> **getStatistics**(): `Promise`\<\{ `pending`: `number`; `verified`: `number`; `expired`: `number`; \}\>

Defined in: [src/lib/a2a/payments/x402-manager.ts:323](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/payments/x402-manager.ts#L323)

Get statistics about payments (for testing/debugging)

#### Returns

`Promise`\<\{ `pending`: `number`; `verified`: `number`; `expired`: `number`; \}\>

***

### cleanup()

> **cleanup**(): `void`

Defined in: [src/lib/a2a/payments/x402-manager.ts:347](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/payments/x402-manager.ts#L347)

Cleanup method to be called when shutting down.
In this implementation, Redis handles TTL, so no explicit cleanup is needed.

#### Returns

`void`
