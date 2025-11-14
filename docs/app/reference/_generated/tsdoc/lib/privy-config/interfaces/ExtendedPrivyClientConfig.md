[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/privy-config](../README.md) / ExtendedPrivyClientConfig

# Interface: ExtendedPrivyClientConfig

Defined in: [src/lib/privy-config.ts:16](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/privy-config.ts#L16)

## Extends

- `Omit`\<`PrivyClientConfig`, `"appearance"` \| `"embeddedWallets"`\>

## Properties

### appearance?

> `optional` **appearance**: `ExtendedAppearance`

Defined in: [src/lib/privy-config.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/privy-config.ts#L18)

***

### embeddedWallets?

> `optional` **embeddedWallets**: `object`

Defined in: [src/lib/privy-config.ts:19](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/privy-config.ts#L19)

#### ethereum?

> `optional` **ethereum**: `object`

##### ethereum.createOnLogin?

> `optional` **createOnLogin**: `"off"` \| `"all-users"` \| `"users-without-wallets"`

#### solana?

> `optional` **solana**: `object`

##### solana.createOnLogin?

> `optional` **createOnLogin**: `"off"` \| `"all-users"` \| `"users-without-wallets"`

#### disableAutomaticMigration?

> `optional` **disableAutomaticMigration**: `boolean`

#### showWalletUIs?

> `optional` **showWalletUIs**: `boolean`
