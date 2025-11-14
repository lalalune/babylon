[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/users/user-lookup](../README.md) / requireUserByIdentifier

# Function: requireUserByIdentifier()

> **requireUserByIdentifier**\<`T`\>(`identifier`, `select?`): `Promise`\<`NonNullable`\<`T` *extends* `undefined` ? \{ \} \| `null` : `T` *extends* `UserSelect`\<`DefaultArgs`\> \| `null` \| `undefined` ? `object` *extends* `object` & `Record`\<`string`, `unknown`\> \| `object` & `Record`\<`string`, `unknown`\> ? \{ \[K in string \| number \| symbol as (S & I)\[K\] extends false \| Skip \| null \| undefined ? never : K\]: (S & I)\[K\] extends object ? $UserPayload\<DefaultArgs\> extends SelectablePayloadFields\<K, (...)\[\]\> ? O extends OperationPayload ? (...)\[\] : never : $UserPayload\<(...)\> extends SelectablePayloadFields\<(...), (...)\> ? (...) extends (...) ? (...) : (...) : (...) extends (...) ? (...) : (...) : $UserPayload\<DefaultArgs\> extends SelectablePayloadFields\<K, (...)\[\]\> ? O extends OperationPayload ? (...)\[\] : never : $UserPayload\<(...)\> extends SelectablePayloadFields\<(...), (...)\> ? (...) extends (...) ? (...) : (...) : (...) extends (...) ? (...) : (...) \} : `object` \| `null` : `never`\>\>

Defined in: [src/lib/users/user-lookup.ts:65](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/users/user-lookup.ts#L65)

## Type Parameters

### T

`T` *extends* `UserSelect`\<`DefaultArgs`\> \| `null` \| `undefined` = `undefined`

## Parameters

### identifier

`string`

### select?

`T`

## Returns

`Promise`\<`NonNullable`\<`T` *extends* `undefined` ? \{ \} \| `null` : `T` *extends* `UserSelect`\<`DefaultArgs`\> \| `null` \| `undefined` ? `object` *extends* `object` & `Record`\<`string`, `unknown`\> \| `object` & `Record`\<`string`, `unknown`\> ? \{ \[K in string \| number \| symbol as (S & I)\[K\] extends false \| Skip \| null \| undefined ? never : K\]: (S & I)\[K\] extends object ? $UserPayload\<DefaultArgs\> extends SelectablePayloadFields\<K, (...)\[\]\> ? O extends OperationPayload ? (...)\[\] : never : $UserPayload\<(...)\> extends SelectablePayloadFields\<(...), (...)\> ? (...) extends (...) ? (...) : (...) : (...) extends (...) ? (...) : (...) : $UserPayload\<DefaultArgs\> extends SelectablePayloadFields\<K, (...)\[\]\> ? O extends OperationPayload ? (...)\[\] : never : $UserPayload\<(...)\> extends SelectablePayloadFields\<(...), (...)\> ? (...) extends (...) ? (...) : (...) : (...) extends (...) ? (...) : (...) \} : `object` \| `null` : `never`\>\>
