[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/profile/backend-signer](../README.md) / updateProfileBackendSigned

# Function: updateProfileBackendSigned()

> **updateProfileBackendSigned**(`params`): `Promise`\<[`BackendSignedUpdateResult`](../interfaces/BackendSignedUpdateResult.md)\>

Defined in: [src/lib/profile/backend-signer.ts:62](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/profile/backend-signer.ts#L62)

Update user profile by signing the transaction server-side

This eliminates the need for users to sign transactions for profile updates.
The server signs on behalf of the user, providing a seamless UX.

## Parameters

### params

[`BackendSignedUpdateParams`](../interfaces/BackendSignedUpdateParams.md)

Profile update parameters

## Returns

`Promise`\<[`BackendSignedUpdateResult`](../interfaces/BackendSignedUpdateResult.md)\>

Transaction hash and metadata
