[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/swagger/config](../README.md) / swaggerDefinition

# Variable: swaggerDefinition

> `const` **swaggerDefinition**: `object`

Defined in: [src/lib/swagger/config.ts:10](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/config.ts#L10)

Base OpenAPI specification definition

## Type Declaration

### openapi

> **openapi**: `string` = `'3.0.0'`

### info

> **info**: `object`

#### info.title

> **title**: `string` = `'Babylon API'`

#### info.version

> **version**: `string` = `'1.0.0'`

#### info.description

> **description**: `string` = `'API documentation for Babylon social conspiracy game'`

#### info.contact

> **contact**: `object`

#### info.contact.name

> **name**: `string` = `'API Support'`

#### info.contact.url

> **url**: `string` = `'https://github.com/elizaos/babylon'`

### servers

> **servers**: `object`[]

### components

> **components**: `object`

#### components.securitySchemes

> **securitySchemes**: `object`

#### components.securitySchemes.PrivyAuth

> **PrivyAuth**: `object`

#### components.securitySchemes.PrivyAuth.type

> **type**: `string` = `'http'`

#### components.securitySchemes.PrivyAuth.scheme

> **scheme**: `string` = `'bearer'`

#### components.securitySchemes.PrivyAuth.bearerFormat

> **bearerFormat**: `string` = `'JWT'`

#### components.securitySchemes.PrivyAuth.description

> **description**: `string` = `'Privy authentication token'`

#### components.securitySchemes.CronSecret

> **CronSecret**: `object`

#### components.securitySchemes.CronSecret.type

> **type**: `string` = `'http'`

#### components.securitySchemes.CronSecret.scheme

> **scheme**: `string` = `'bearer'`

#### components.securitySchemes.CronSecret.description

> **description**: `string` = `'Cron secret for scheduled jobs (CRON_SECRET environment variable)'`
