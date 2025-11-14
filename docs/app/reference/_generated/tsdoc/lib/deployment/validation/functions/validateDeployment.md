[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/deployment/validation](../README.md) / validateDeployment

# Function: validateDeployment()

> **validateDeployment**(`env`, `rpcUrl`, `expectedContracts?`): `Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>

Defined in: [src/lib/deployment/validation.ts:117](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/deployment/validation.ts#L117)

Validate contract deployment

## Parameters

### env

[`DeploymentEnv`](../../env-detection/type-aliases/DeploymentEnv.md)

### rpcUrl

`string`

### expectedContracts?

`Partial`\<[`ContractAddresses`](../interfaces/ContractAddresses.md)\>

## Returns

`Promise`\<[`ValidationResult`](../interfaces/ValidationResult.md)\>
