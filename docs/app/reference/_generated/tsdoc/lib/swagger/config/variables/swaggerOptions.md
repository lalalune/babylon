[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/swagger/config](../README.md) / swaggerOptions

# Variable: swaggerOptions

> `const` **swaggerOptions**: `object`

Defined in: [src/lib/swagger/config.ts:47](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/config.ts#L47)

Swagger UI options

## Type Declaration

### swaggerDefinition

> **swaggerDefinition**: `object`

Base OpenAPI specification definition

#### swaggerDefinition.openapi

> **openapi**: `string` = `'3.0.0'`

#### swaggerDefinition.info

> **info**: `object`

#### swaggerDefinition.info.title

> **title**: `string` = `'Babylon API'`

#### swaggerDefinition.info.version

> **version**: `string` = `'1.0.0'`

#### swaggerDefinition.info.description

> **description**: `string` = `'API documentation for Babylon social conspiracy game'`

#### swaggerDefinition.info.contact

> **contact**: `object`

#### swaggerDefinition.info.contact.name

> **name**: `string` = `'API Support'`

#### swaggerDefinition.info.contact.url

> **url**: `string` = `'https://github.com/elizaos/babylon'`

#### swaggerDefinition.servers

> **servers**: `object`[]

#### swaggerDefinition.components

> **components**: `object`

#### swaggerDefinition.components.securitySchemes

> **securitySchemes**: `object`

#### swaggerDefinition.components.securitySchemes.PrivyAuth

> **PrivyAuth**: `object`

#### swaggerDefinition.components.securitySchemes.PrivyAuth.type

> **type**: `string` = `'http'`

#### swaggerDefinition.components.securitySchemes.PrivyAuth.scheme

> **scheme**: `string` = `'bearer'`

#### swaggerDefinition.components.securitySchemes.PrivyAuth.bearerFormat

> **bearerFormat**: `string` = `'JWT'`

#### swaggerDefinition.components.securitySchemes.PrivyAuth.description

> **description**: `string` = `'Privy authentication token'`

#### swaggerDefinition.components.securitySchemes.CronSecret

> **CronSecret**: `object`

#### swaggerDefinition.components.securitySchemes.CronSecret.type

> **type**: `string` = `'http'`

#### swaggerDefinition.components.securitySchemes.CronSecret.scheme

> **scheme**: `string` = `'bearer'`

#### swaggerDefinition.components.securitySchemes.CronSecret.description

> **description**: `string` = `'Cron secret for scheduled jobs (CRON_SECRET environment variable)'`

### apis

> **apis**: `string`[]
