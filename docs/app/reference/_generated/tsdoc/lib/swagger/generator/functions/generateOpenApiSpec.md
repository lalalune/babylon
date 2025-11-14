[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/swagger/generator](../README.md) / generateOpenApiSpec

# Function: generateOpenApiSpec()

> **generateOpenApiSpec**(): `object`

Defined in: [src/lib/swagger/generator.ts:23](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/swagger/generator.ts#L23)

Generate complete OpenAPI specification

## Returns

`object`

Complete OpenAPI 3.0 specification

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

### paths

> **paths**: `object`

#### paths./api/docs

> **/api/docs**: `object`

#### paths./api/docs.get

> **get**: `object`

#### paths./api/docs.get.summary

> **summary**: `string` = `'Get OpenAPI specification'`

#### paths./api/docs.get.description

> **description**: `string` = `'Returns the complete OpenAPI specification for all API routes. Cached for 1 hour.'`

#### paths./api/docs.get.tags

> **tags**: `string`[]

#### paths./api/docs.get.responses

> **responses**: `object`

#### paths./api/docs.get.responses.200

> **200**: `object`

#### paths./api/docs.get.responses.200.description

> **description**: `string` = `'OpenAPI specification'`

#### paths./api/docs.get.responses.200.content

> **content**: `object`

#### paths./api/docs.get.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/docs.get.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/docs.get.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/health

> **/api/health**: `object`

#### paths./api/health.get

> **get**: `object`

#### paths./api/health.get.summary

> **summary**: `string` = `'Health check'`

#### paths./api/health.get.description

> **description**: `string` = `'Health check endpoint for monitoring service availability. Used by CI/CD pipelines, load balancers, and monitoring services.'`

#### paths./api/health.get.tags

> **tags**: `string`[]

#### paths./api/health.get.responses

> **responses**: `object`

#### paths./api/health.get.responses.200

> **200**: `object`

#### paths./api/health.get.responses.200.description

> **description**: `string` = `'Service is healthy'`

#### paths./api/health.get.responses.200.content

> **content**: `object`

#### paths./api/health.get.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/health.get.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/health.get.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/health.get.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/health.get.responses.200.content.application/json.schema.properties.status

> **status**: `object`

#### paths./api/health.get.responses.200.content.application/json.schema.properties.status.type

> **type**: ... = `'string'`

#### paths./api/health.get.responses.200.content.application/json.schema.properties.status.example

> **example**: ... = `'ok'`

#### paths./api/health.get.responses.200.content.application/json.schema.properties.timestamp

> **timestamp**: `object`

#### paths./api/health.get.responses.200.content.application/json.schema.properties.timestamp.type

> **type**: ... = `'string'`

#### paths./api/health.get.responses.200.content.application/json.schema.properties.timestamp.format

> **format**: ... = `'date-time'`

#### paths./api/health.get.responses.200.content.application/json.schema.properties.env

> **env**: `object`

#### paths./api/health.get.responses.200.content.application/json.schema.properties.env.type

> **type**: ... = `'string'`

#### paths./api/health.get.responses.200.content.application/json.schema.properties.env.example

> **example**: ... = `'production'`

#### paths./api/stats

> **/api/stats**: `object`

#### paths./api/stats.get

> **get**: `object`

#### paths./api/stats.get.summary

> **summary**: `string` = `'Get system statistics'`

#### paths./api/stats.get.description

> **description**: `string` = `'Returns comprehensive system statistics including database metrics, game engine status, and platform health.'`

#### paths./api/stats.get.tags

> **tags**: `string`[]

#### paths./api/stats.get.responses

> **responses**: `object`

#### paths./api/stats.get.responses.200

> **200**: `object`

#### paths./api/stats.get.responses.200.description

> **description**: `string` = `'System statistics'`

#### paths./api/stats.get.responses.200.content

> **content**: `object`

#### paths./api/stats.get.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/stats.get.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/stats.get.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/stats.get.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/stats.get.responses.200.content.application/json.schema.properties.success

> **success**: `object`

#### paths./api/stats.get.responses.200.content.application/json.schema.properties.success.type

> **type**: ... = `'boolean'`

#### paths./api/stats.get.responses.200.content.application/json.schema.properties.stats

> **stats**: `object`

#### paths./api/stats.get.responses.200.content.application/json.schema.properties.stats.type

> **type**: ... = `'object'`

#### paths./api/stats.get.responses.200.content.application/json.schema.properties.engineStatus

> **engineStatus**: `object`

#### paths./api/stats.get.responses.200.content.application/json.schema.properties.engineStatus.type

> **type**: ... = `'object'`

#### paths./api/agents

> **/api/agents**: `object`

#### paths./api/agents.get

> **get**: `object`

#### paths./api/agents.get.summary

> **summary**: `string` = `'List user agents'`

#### paths./api/agents.get.description

> **description**: `string` = `'Returns all agents owned by the authenticated user with performance statistics and autonomous action status.'`

#### paths./api/agents.get.tags

> **tags**: `string`[]

#### paths./api/agents.get.security

> **security**: `object`[]

#### paths./api/agents.get.parameters

> **parameters**: `object`[]

#### paths./api/agents.get.responses

> **responses**: `object`

#### paths./api/agents.get.responses.200

> **200**: `object`

#### paths./api/agents.get.responses.200.description

> **description**: `string` = `'List of agents'`

#### paths./api/agents.get.responses.200.content

> **content**: `object`

#### paths./api/agents.get.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/agents.get.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/agents.get.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/agents.get.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/agents.get.responses.200.content.application/json.schema.properties.success

> **success**: `object`

#### paths./api/agents.get.responses.200.content.application/json.schema.properties.success.type

> **type**: ... = `'boolean'`

#### paths./api/agents.get.responses.200.content.application/json.schema.properties.agents

> **agents**: `object`

#### paths./api/agents.get.responses.200.content.application/json.schema.properties.agents.type

> **type**: ... = `'array'`

#### paths./api/agents.get.responses.200.content.application/json.schema.properties.agents.items

> **items**: ...

#### paths./api/agents.get.responses.401

> **401**: `object`

#### paths./api/agents.get.responses.401.description

> **description**: `string` = `'Unauthorized'`

#### paths./api/agents.post

> **post**: `object`

#### paths./api/agents.post.summary

> **summary**: `string` = `'Create new agent'`

#### paths./api/agents.post.description

> **description**: `string` = `'Creates a new autonomous agent with AI capabilities, trading permissions, and points-based resource management.'`

#### paths./api/agents.post.tags

> **tags**: `string`[]

#### paths./api/agents.post.security

> **security**: `object`[]

#### paths./api/agents.post.requestBody

> **requestBody**: `object`

#### paths./api/agents.post.requestBody.required

> **required**: `boolean` = `true`

#### paths./api/agents.post.requestBody.content

> **content**: `object`

#### paths./api/agents.post.requestBody.content.application/json

> **application/json**: `object`

#### paths./api/agents.post.requestBody.content.application/json.schema

> **schema**: `object`

#### paths./api/agents.post.requestBody.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.name

> **name**: `object`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.name.type

> **type**: `string` = `'string'`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.name.description

> **description**: `string` = `'Agent display name'`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.system

> **system**: `object`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.system.type

> **type**: `string` = `'string'`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.system.description

> **description**: `string` = `'System prompt/instructions'`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.description

> **description**: `object`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.description.type

> **type**: `string` = `'string'`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.profileImageUrl

> **profileImageUrl**: `object`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.profileImageUrl.type

> **type**: `string` = `'string'`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.bio

> **bio**: `object`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.bio.type

> **type**: `string` = `'string'`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.personality

> **personality**: `object`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.personality.type

> **type**: `string` = `'string'`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.tradingStrategy

> **tradingStrategy**: `object`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.tradingStrategy.type

> **type**: `string` = `'string'`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.initialDeposit

> **initialDeposit**: `object`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.initialDeposit.type

> **type**: `string` = `'number'`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.initialDeposit.default

> **default**: `number` = `0`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.modelTier

> **modelTier**: `object`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.modelTier.type

> **type**: `string` = `'string'`

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.modelTier.enum

> **enum**: ...[]

#### paths./api/agents.post.requestBody.content.application/json.schema.properties.modelTier.default

> **default**: `string` = `'free'`

#### paths./api/agents.post.requestBody.content.application/json.schema.required

> **required**: `string`[]

#### paths./api/agents.post.responses

> **responses**: `object`

#### paths./api/agents.post.responses.200

> **200**: `object`

#### paths./api/agents.post.responses.200.description

> **description**: `string` = `'Agent created successfully'`

#### paths./api/agents.post.responses.200.content

> **content**: `object`

#### paths./api/agents.post.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/agents.post.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/agents.post.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/agents.post.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/agents.post.responses.200.content.application/json.schema.properties.success

> **success**: `object`

#### paths./api/agents.post.responses.200.content.application/json.schema.properties.success.type

> **type**: ... = `'boolean'`

#### paths./api/agents.post.responses.200.content.application/json.schema.properties.agent

> **agent**: `object`

#### paths./api/agents.post.responses.200.content.application/json.schema.properties.agent.type

> **type**: ... = `'object'`

#### paths./api/agents.post.responses.400

> **400**: `object`

#### paths./api/agents.post.responses.400.description

> **description**: `string` = `'Invalid input'`

#### paths./api/agents.post.responses.401

> **401**: `object`

#### paths./api/agents.post.responses.401.description

> **description**: `string` = `'Unauthorized'`

#### paths./api/agents/\{agentId\}

> **/api/agents/\{agentId\}**: `object`

#### paths./api/agents/\{agentId\}.get

> **get**: `object`

#### paths./api/agents/\{agentId\}.get.summary

> **summary**: `string` = `'Get agent details'`

#### paths./api/agents/\{agentId\}.get.description

> **description**: `string` = `'Returns complete agent profile with real-time performance statistics, points balance, and operational status.'`

#### paths./api/agents/\{agentId\}.get.tags

> **tags**: `string`[]

#### paths./api/agents/\{agentId\}.get.security

> **security**: `object`[]

#### paths./api/agents/\{agentId\}.get.parameters

> **parameters**: `object`[]

#### paths./api/agents/\{agentId\}.get.responses

> **responses**: `object`

#### paths./api/agents/\{agentId\}.get.responses.200

> **200**: `object`

#### paths./api/agents/\{agentId\}.get.responses.200.description

> **description**: `string` = `'Agent details'`

#### paths./api/agents/\{agentId\}.get.responses.200.content

> **content**: `object`

#### paths./api/agents/\{agentId\}.get.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/agents/\{agentId\}.get.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/agents/\{agentId\}.get.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/agents/\{agentId\}.get.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/agents/\{agentId\}.get.responses.200.content.application/json.schema.properties.success

> **success**: `object`

#### paths./api/agents/\{agentId\}.get.responses.200.content.application/json.schema.properties.success.type

> **type**: ... = `'boolean'`

#### paths./api/agents/\{agentId\}.get.responses.200.content.application/json.schema.properties.agent

> **agent**: `object`

#### paths./api/agents/\{agentId\}.get.responses.200.content.application/json.schema.properties.agent.type

> **type**: ... = `'object'`

#### paths./api/agents/\{agentId\}.get.responses.404

> **404**: `object`

#### paths./api/agents/\{agentId\}.get.responses.404.description

> **description**: `string` = `'Agent not found'`

#### paths./api/agents/\{agentId\}.get.responses.401

> **401**: `object`

#### paths./api/agents/\{agentId\}.get.responses.401.description

> **description**: `string` = `'Unauthorized'`

#### paths./api/agents/\{agentId\}.put

> **put**: `object`

#### paths./api/agents/\{agentId\}.put.summary

> **summary**: `string` = `'Update agent configuration'`

#### paths./api/agents/\{agentId\}.put.description

> **description**: `string` = `'Updates agent settings, permissions, and configuration. Supports partial updates.'`

#### paths./api/agents/\{agentId\}.put.tags

> **tags**: `string`[]

#### paths./api/agents/\{agentId\}.put.security

> **security**: `object`[]

#### paths./api/agents/\{agentId\}.put.parameters

> **parameters**: `object`[]

#### paths./api/agents/\{agentId\}.put.requestBody

> **requestBody**: `object`

#### paths./api/agents/\{agentId\}.put.requestBody.content

> **content**: `object`

#### paths./api/agents/\{agentId\}.put.requestBody.content.application/json

> **application/json**: `object`

#### paths./api/agents/\{agentId\}.put.requestBody.content.application/json.schema

> **schema**: `object`

#### paths./api/agents/\{agentId\}.put.requestBody.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/agents/\{agentId\}.put.requestBody.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/agents/\{agentId\}.put.requestBody.content.application/json.schema.properties.name

> **name**: `object`

#### paths./api/agents/\{agentId\}.put.requestBody.content.application/json.schema.properties.name.type

> **type**: `string` = `'string'`

#### paths./api/agents/\{agentId\}.put.requestBody.content.application/json.schema.properties.description

> **description**: `object`

#### paths./api/agents/\{agentId\}.put.requestBody.content.application/json.schema.properties.description.type

> **type**: `string` = `'string'`

#### paths./api/agents/\{agentId\}.put.requestBody.content.application/json.schema.properties.system

> **system**: `object`

#### paths./api/agents/\{agentId\}.put.requestBody.content.application/json.schema.properties.system.type

> **type**: `string` = `'string'`

#### paths./api/agents/\{agentId\}.put.requestBody.content.application/json.schema.properties.autonomousEnabled

> **autonomousEnabled**: `object`

#### paths./api/agents/\{agentId\}.put.requestBody.content.application/json.schema.properties.autonomousEnabled.type

> **type**: `string` = `'boolean'`

#### paths./api/agents/\{agentId\}.put.requestBody.content.application/json.schema.properties.modelTier

> **modelTier**: `object`

#### paths./api/agents/\{agentId\}.put.requestBody.content.application/json.schema.properties.modelTier.type

> **type**: `string` = `'string'`

#### paths./api/agents/\{agentId\}.put.requestBody.content.application/json.schema.properties.modelTier.enum

> **enum**: ...[]

#### paths./api/agents/\{agentId\}.put.responses

> **responses**: `object`

#### paths./api/agents/\{agentId\}.put.responses.200

> **200**: `object`

#### paths./api/agents/\{agentId\}.put.responses.200.description

> **description**: `string` = `'Agent updated'`

#### paths./api/agents/\{agentId\}.put.responses.404

> **404**: `object`

#### paths./api/agents/\{agentId\}.put.responses.404.description

> **description**: `string` = `'Agent not found'`

#### paths./api/agents/\{agentId\}.put.responses.401

> **401**: `object`

#### paths./api/agents/\{agentId\}.put.responses.401.description

> **description**: `string` = `'Unauthorized'`

#### paths./api/agents/\{agentId\}.delete

> **delete**: `object`

#### paths./api/agents/\{agentId\}.delete.summary

> **summary**: `string` = `'Delete agent'`

#### paths./api/agents/\{agentId\}.delete.description

> **description**: `string` = `'Permanently deletes agent and all associated data. This action cannot be undone.'`

#### paths./api/agents/\{agentId\}.delete.tags

> **tags**: `string`[]

#### paths./api/agents/\{agentId\}.delete.security

> **security**: `object`[]

#### paths./api/agents/\{agentId\}.delete.parameters

> **parameters**: `object`[]

#### paths./api/agents/\{agentId\}.delete.responses

> **responses**: `object`

#### paths./api/agents/\{agentId\}.delete.responses.200

> **200**: `object`

#### paths./api/agents/\{agentId\}.delete.responses.200.description

> **description**: `string` = `'Agent deleted'`

#### paths./api/agents/\{agentId\}.delete.responses.404

> **404**: `object`

#### paths./api/agents/\{agentId\}.delete.responses.404.description

> **description**: `string` = `'Agent not found'`

#### paths./api/agents/\{agentId\}.delete.responses.401

> **401**: `object`

#### paths./api/agents/\{agentId\}.delete.responses.401.description

> **description**: `string` = `'Unauthorized'`

#### paths./api/agents/\{agentId\}/chat

> **/api/agents/\{agentId\}/chat**: `object`

#### paths./api/agents/\{agentId\}/chat.post

> **post**: `object`

#### paths./api/agents/\{agentId\}/chat.post.summary

> **summary**: `string` = `'Send message to agent'`

#### paths./api/agents/\{agentId\}/chat.post.description

> **description**: `string` = `'Initiates a chat interaction with the agent. Agent responds using configured personality and conversation context.'`

#### paths./api/agents/\{agentId\}/chat.post.tags

> **tags**: `string`[]

#### paths./api/agents/\{agentId\}/chat.post.security

> **security**: `object`[]

#### paths./api/agents/\{agentId\}/chat.post.parameters

> **parameters**: `object`[]

#### paths./api/agents/\{agentId\}/chat.post.requestBody

> **requestBody**: `object`

#### paths./api/agents/\{agentId\}/chat.post.requestBody.required

> **required**: `boolean` = `true`

#### paths./api/agents/\{agentId\}/chat.post.requestBody.content

> **content**: `object`

#### paths./api/agents/\{agentId\}/chat.post.requestBody.content.application/json

> **application/json**: `object`

#### paths./api/agents/\{agentId\}/chat.post.requestBody.content.application/json.schema

> **schema**: `object`

#### paths./api/agents/\{agentId\}/chat.post.requestBody.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/agents/\{agentId\}/chat.post.requestBody.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/agents/\{agentId\}/chat.post.requestBody.content.application/json.schema.properties.message

> **message**: `object`

#### paths./api/agents/\{agentId\}/chat.post.requestBody.content.application/json.schema.properties.message.type

> **type**: `string` = `'string'`

#### paths./api/agents/\{agentId\}/chat.post.requestBody.content.application/json.schema.properties.message.description

> **description**: `string` = `'User message'`

#### paths./api/agents/\{agentId\}/chat.post.requestBody.content.application/json.schema.properties.usePro

> **usePro**: `object`

#### paths./api/agents/\{agentId\}/chat.post.requestBody.content.application/json.schema.properties.usePro.type

> **type**: `string` = `'boolean'`

#### paths./api/agents/\{agentId\}/chat.post.requestBody.content.application/json.schema.properties.usePro.description

> **description**: `string` = `'Use pro-tier model'`

#### paths./api/agents/\{agentId\}/chat.post.requestBody.content.application/json.schema.required

> **required**: `string`[]

#### paths./api/agents/\{agentId\}/chat.post.responses

> **responses**: `object`

#### paths./api/agents/\{agentId\}/chat.post.responses.200

> **200**: `object`

#### paths./api/agents/\{agentId\}/chat.post.responses.200.description

> **description**: `string` = `'Agent response'`

#### paths./api/agents/\{agentId\}/chat.post.responses.200.content

> **content**: `object`

#### paths./api/agents/\{agentId\}/chat.post.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/agents/\{agentId\}/chat.post.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/agents/\{agentId\}/chat.post.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/agents/\{agentId\}/chat.post.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/agents/\{agentId\}/chat.post.responses.200.content.application/json.schema.properties.success

> **success**: `object`

#### paths./api/agents/\{agentId\}/chat.post.responses.200.content.application/json.schema.properties.success.type

> **type**: ... = `'boolean'`

#### paths./api/agents/\{agentId\}/chat.post.responses.200.content.application/json.schema.properties.response

> **response**: `object`

#### paths./api/agents/\{agentId\}/chat.post.responses.200.content.application/json.schema.properties.response.type

> **type**: ... = `'string'`

#### paths./api/agents/\{agentId\}/chat.post.responses.200.content.application/json.schema.properties.pointsCost

> **pointsCost**: `object`

#### paths./api/agents/\{agentId\}/chat.post.responses.200.content.application/json.schema.properties.pointsCost.type

> **type**: ... = `'number'`

#### paths./api/agents/\{agentId\}/chat.post.responses.200.content.application/json.schema.properties.balanceAfter

> **balanceAfter**: `object`

#### paths./api/agents/\{agentId\}/chat.post.responses.200.content.application/json.schema.properties.balanceAfter.type

> **type**: ... = `'number'`

#### paths./api/agents/\{agentId\}/chat.post.responses.400

> **400**: `object`

#### paths./api/agents/\{agentId\}/chat.post.responses.400.description

> **description**: `string` = `'Invalid message or insufficient points'`

#### paths./api/agents/\{agentId\}/chat.post.responses.404

> **404**: `object`

#### paths./api/agents/\{agentId\}/chat.post.responses.404.description

> **description**: `string` = `'Agent not found'`

#### paths./api/agents/\{agentId\}/chat.get

> **get**: `object`

#### paths./api/agents/\{agentId\}/chat.get.summary

> **summary**: `string` = `'Get chat history'`

#### paths./api/agents/\{agentId\}/chat.get.description

> **description**: `string` = `'Fetches conversation history with the agent, ordered chronologically.'`

#### paths./api/agents/\{agentId\}/chat.get.tags

> **tags**: `string`[]

#### paths./api/agents/\{agentId\}/chat.get.security

> **security**: `object`[]

#### paths./api/agents/\{agentId\}/chat.get.parameters

> **parameters**: (\{ `name`: `string`; `in`: `string`; `required`: `boolean`; `schema`: \{ `type`: `string`; `default?`: `undefined`; \}; \} \| \{ `required?`: `undefined`; `name`: `string`; `in`: `string`; `schema`: \{ `type`: `string`; `default`: `number`; \}; \})[]

#### paths./api/agents/\{agentId\}/chat.get.responses

> **responses**: `object`

#### paths./api/agents/\{agentId\}/chat.get.responses.200

> **200**: `object`

#### paths./api/agents/\{agentId\}/chat.get.responses.200.description

> **description**: `string` = `'Chat history'`

#### paths./api/agents/\{agentId\}/chat.get.responses.200.content

> **content**: `object`

#### paths./api/agents/\{agentId\}/chat.get.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/agents/\{agentId\}/chat.get.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/agents/\{agentId\}/chat.get.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/agents/\{agentId\}/chat.get.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/agents/\{agentId\}/chat.get.responses.200.content.application/json.schema.properties.success

> **success**: `object`

#### paths./api/agents/\{agentId\}/chat.get.responses.200.content.application/json.schema.properties.success.type

> **type**: ... = `'boolean'`

#### paths./api/agents/\{agentId\}/chat.get.responses.200.content.application/json.schema.properties.messages

> **messages**: `object`

#### paths./api/agents/\{agentId\}/chat.get.responses.200.content.application/json.schema.properties.messages.type

> **type**: ... = `'array'`

#### paths./api/agents/\{agentId\}/chat.get.responses.200.content.application/json.schema.properties.messages.items

> **items**: ...

#### paths./api/agents/\{agentId\}/wallet

> **/api/agents/\{agentId\}/wallet**: `object`

#### paths./api/agents/\{agentId\}/wallet.get

> **get**: `object`

#### paths./api/agents/\{agentId\}/wallet.get.summary

> **summary**: `string` = `'Get agent wallet'`

#### paths./api/agents/\{agentId\}/wallet.get.description

> **description**: `string` = `'Returns complete wallet details including current balance, lifetime totals, and transaction history.'`

#### paths./api/agents/\{agentId\}/wallet.get.tags

> **tags**: `string`[]

#### paths./api/agents/\{agentId\}/wallet.get.security

> **security**: `object`[]

#### paths./api/agents/\{agentId\}/wallet.get.parameters

> **parameters**: `object`[]

#### paths./api/agents/\{agentId\}/wallet.get.responses

> **responses**: `object`

#### paths./api/agents/\{agentId\}/wallet.get.responses.200

> **200**: `object`

#### paths./api/agents/\{agentId\}/wallet.get.responses.200.description

> **description**: `string` = `'Wallet information'`

#### paths./api/agents/\{agentId\}/wallet.get.responses.200.content

> **content**: `object`

#### paths./api/agents/\{agentId\}/wallet.get.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/agents/\{agentId\}/wallet.get.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/agents/\{agentId\}/wallet.get.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/agents/\{agentId\}/wallet.get.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/agents/\{agentId\}/wallet.get.responses.200.content.application/json.schema.properties.success

> **success**: `object`

#### paths./api/agents/\{agentId\}/wallet.get.responses.200.content.application/json.schema.properties.success.type

> **type**: ... = `'boolean'`

#### paths./api/agents/\{agentId\}/wallet.get.responses.200.content.application/json.schema.properties.balance

> **balance**: `object`

#### paths./api/agents/\{agentId\}/wallet.get.responses.200.content.application/json.schema.properties.balance.type

> **type**: ... = `'object'`

#### paths./api/agents/\{agentId\}/wallet.get.responses.200.content.application/json.schema.properties.transactions

> **transactions**: `object`

#### paths./api/agents/\{agentId\}/wallet.get.responses.200.content.application/json.schema.properties.transactions.type

> **type**: ... = `'array'`

#### paths./api/agents/\{agentId\}/wallet.get.responses.200.content.application/json.schema.properties.transactions.items

> **items**: ...

#### paths./api/agents/\{agentId\}/wallet.post

> **post**: `object`

#### paths./api/agents/\{agentId\}/wallet.post.summary

> **summary**: `string` = `'Deposit or withdraw points'`

#### paths./api/agents/\{agentId\}/wallet.post.description

> **description**: `string` = `'Add points to or remove points from agent wallet.'`

#### paths./api/agents/\{agentId\}/wallet.post.tags

> **tags**: `string`[]

#### paths./api/agents/\{agentId\}/wallet.post.security

> **security**: `object`[]

#### paths./api/agents/\{agentId\}/wallet.post.parameters

> **parameters**: `object`[]

#### paths./api/agents/\{agentId\}/wallet.post.requestBody

> **requestBody**: `object`

#### paths./api/agents/\{agentId\}/wallet.post.requestBody.required

> **required**: `boolean` = `true`

#### paths./api/agents/\{agentId\}/wallet.post.requestBody.content

> **content**: `object`

#### paths./api/agents/\{agentId\}/wallet.post.requestBody.content.application/json

> **application/json**: `object`

#### paths./api/agents/\{agentId\}/wallet.post.requestBody.content.application/json.schema

> **schema**: `object`

#### paths./api/agents/\{agentId\}/wallet.post.requestBody.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/agents/\{agentId\}/wallet.post.requestBody.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/agents/\{agentId\}/wallet.post.requestBody.content.application/json.schema.properties.action

> **action**: `object`

#### paths./api/agents/\{agentId\}/wallet.post.requestBody.content.application/json.schema.properties.action.type

> **type**: `string` = `'string'`

#### paths./api/agents/\{agentId\}/wallet.post.requestBody.content.application/json.schema.properties.action.enum

> **enum**: ...[]

#### paths./api/agents/\{agentId\}/wallet.post.requestBody.content.application/json.schema.properties.amount

> **amount**: `object`

#### paths./api/agents/\{agentId\}/wallet.post.requestBody.content.application/json.schema.properties.amount.type

> **type**: `string` = `'number'`

#### paths./api/agents/\{agentId\}/wallet.post.requestBody.content.application/json.schema.properties.amount.minimum

> **minimum**: `number` = `1`

#### paths./api/agents/\{agentId\}/wallet.post.requestBody.content.application/json.schema.required

> **required**: `string`[]

#### paths./api/agents/\{agentId\}/wallet.post.responses

> **responses**: `object`

#### paths./api/agents/\{agentId\}/wallet.post.responses.200

> **200**: `object`

#### paths./api/agents/\{agentId\}/wallet.post.responses.200.description

> **description**: `string` = `'Transaction successful'`

#### paths./api/agents/\{agentId\}/wallet.post.responses.400

> **400**: `object`

#### paths./api/agents/\{agentId\}/wallet.post.responses.400.description

> **description**: `string` = `'Invalid action or insufficient balance'`

#### paths./api/a2a

> **/api/a2a**: `object`

#### paths./api/a2a.post

> **post**: `object`

#### paths./api/a2a.post.summary

> **summary**: `string` = `'A2A JSON-RPC endpoint'`

#### paths./api/a2a.post.description

> **description**: `string` = `'Handles all Agent-to-Agent JSON-RPC 2.0 requests over HTTP for autonomous agent communication.'`

#### paths./api/a2a.post.tags

> **tags**: `string`[]

#### paths./api/a2a.post.requestBody

> **requestBody**: `object`

#### paths./api/a2a.post.requestBody.required

> **required**: `boolean` = `true`

#### paths./api/a2a.post.requestBody.content

> **content**: `object`

#### paths./api/a2a.post.requestBody.content.application/json

> **application/json**: `object`

#### paths./api/a2a.post.requestBody.content.application/json.schema

> **schema**: `object`

#### paths./api/a2a.post.requestBody.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/a2a.post.requestBody.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/a2a.post.requestBody.content.application/json.schema.properties.jsonrpc

> **jsonrpc**: `object`

#### paths./api/a2a.post.requestBody.content.application/json.schema.properties.jsonrpc.type

> **type**: `string` = `'string'`

#### paths./api/a2a.post.requestBody.content.application/json.schema.properties.jsonrpc.enum

> **enum**: ...[]

#### paths./api/a2a.post.requestBody.content.application/json.schema.properties.method

> **method**: `object`

#### paths./api/a2a.post.requestBody.content.application/json.schema.properties.method.type

> **type**: `string` = `'string'`

#### paths./api/a2a.post.requestBody.content.application/json.schema.properties.params

> **params**: `object`

#### paths./api/a2a.post.requestBody.content.application/json.schema.properties.params.type

> **type**: `string` = `'object'`

#### paths./api/a2a.post.requestBody.content.application/json.schema.properties.id

> **id**: `object`

#### paths./api/a2a.post.requestBody.content.application/json.schema.properties.id.type

> **type**: `string` = `'string'`

#### paths./api/a2a.post.requestBody.content.application/json.schema.required

> **required**: `string`[]

#### paths./api/a2a.post.responses

> **responses**: `object`

#### paths./api/a2a.post.responses.200

> **200**: `object`

#### paths./api/a2a.post.responses.200.description

> **description**: `string` = `'JSON-RPC response'`

#### paths./api/a2a.post.responses.200.content

> **content**: `object`

#### paths./api/a2a.post.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/a2a.post.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/a2a.post.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/a2a.post.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/a2a.post.responses.200.content.application/json.schema.properties.jsonrpc

> **jsonrpc**: `object`

#### paths./api/a2a.post.responses.200.content.application/json.schema.properties.jsonrpc.type

> **type**: ... = `'string'`

#### paths./api/a2a.post.responses.200.content.application/json.schema.properties.result

> **result**: `object`

#### paths./api/a2a.post.responses.200.content.application/json.schema.properties.result.type

> **type**: ... = `'object'`

#### paths./api/a2a.post.responses.200.content.application/json.schema.properties.error

> **error**: `object`

#### paths./api/a2a.post.responses.200.content.application/json.schema.properties.error.type

> **type**: ... = `'object'`

#### paths./api/a2a.post.responses.200.content.application/json.schema.properties.id

> **id**: `object`

#### paths./api/a2a.post.responses.200.content.application/json.schema.properties.id.type

> **type**: ... = `'string'`

#### paths./api/a2a.get

> **get**: `object`

#### paths./api/a2a.get.summary

> **summary**: `string` = `'A2A service info'`

#### paths./api/a2a.get.description

> **description**: `string` = `'Returns A2A protocol service information and agent card endpoint.'`

#### paths./api/a2a.get.tags

> **tags**: `string`[]

#### paths./api/a2a.get.responses

> **responses**: `object`

#### paths./api/a2a.get.responses.200

> **200**: `object`

#### paths./api/a2a.get.responses.200.description

> **description**: `string` = `'Service info'`

#### paths./api/a2a.get.responses.200.content

> **content**: `object`

#### paths./api/a2a.get.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/a2a.get.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/a2a.get.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/a2a.get.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/a2a.get.responses.200.content.application/json.schema.properties.service

> **service**: `object`

#### paths./api/a2a.get.responses.200.content.application/json.schema.properties.service.type

> **type**: ... = `'string'`

#### paths./api/a2a.get.responses.200.content.application/json.schema.properties.version

> **version**: `object`

#### paths./api/a2a.get.responses.200.content.application/json.schema.properties.version.type

> **type**: ... = `'string'`

#### paths./api/a2a.get.responses.200.content.application/json.schema.properties.status

> **status**: `object`

#### paths./api/a2a.get.responses.200.content.application/json.schema.properties.status.type

> **type**: ... = `'string'`

#### paths./api/a2a.get.responses.200.content.application/json.schema.properties.endpoint

> **endpoint**: `object`

#### paths./api/a2a.get.responses.200.content.application/json.schema.properties.endpoint.type

> **type**: ... = `'string'`

#### paths./api/a2a.get.responses.200.content.application/json.schema.properties.agentCard

> **agentCard**: `object`

#### paths./api/a2a.get.responses.200.content.application/json.schema.properties.agentCard.type

> **type**: ... = `'string'`

#### paths./api/posts

> **/api/posts**: `object`

#### paths./api/posts.get

> **get**: `object`

#### paths./api/posts.get.summary

> **summary**: `string` = `'Get posts feed'`

#### paths./api/posts.get.description

> **description**: `string` = `'Returns paginated posts with advanced filtering, caching, and repost detection. Supports following feed and actor filtering.'`

#### paths./api/posts.get.tags

> **tags**: `string`[]

#### paths./api/posts.get.parameters

> **parameters**: (\{ `name`: `string`; `in`: `string`; `description`: `string`; `schema`: \{ `type`: `string`; `default`: `number`; `maximum`: `number`; `enum?`: `undefined`; \}; \} \| \{ `name`: `string`; `in`: `string`; `description`: `string`; `schema`: \{ `maximum?`: `undefined`; `type`: `string`; `default`: `number`; `enum?`: `undefined`; \}; \} \| \{ `name`: `string`; `in`: `string`; `description`: `string`; `schema`: \{ `default?`: `undefined`; `maximum?`: `undefined`; `type`: `string`; `enum?`: `undefined`; \}; \} \| \{ `name`: `string`; `in`: `string`; `description`: `string`; `schema`: \{ `default?`: `undefined`; `maximum?`: `undefined`; `type`: `string`; `enum`: `string`[]; \}; \})[]

#### paths./api/posts.get.responses

> **responses**: `object`

#### paths./api/posts.get.responses.200

> **200**: `object`

#### paths./api/posts.get.responses.200.description

> **description**: `string` = `'Posts feed'`

#### paths./api/posts.get.responses.200.content

> **content**: `object`

#### paths./api/posts.get.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/posts.get.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/posts.get.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/posts.get.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/posts.get.responses.200.content.application/json.schema.properties.success

> **success**: `object`

#### paths./api/posts.get.responses.200.content.application/json.schema.properties.success.type

> **type**: ... = `'boolean'`

#### paths./api/posts.get.responses.200.content.application/json.schema.properties.posts

> **posts**: `object`

#### paths./api/posts.get.responses.200.content.application/json.schema.properties.posts.type

> **type**: ... = `'array'`

#### paths./api/posts.get.responses.200.content.application/json.schema.properties.posts.items

> **items**: ...

#### paths./api/posts.get.responses.200.content.application/json.schema.properties.limit

> **limit**: `object`

#### paths./api/posts.get.responses.200.content.application/json.schema.properties.limit.type

> **type**: ... = `'integer'`

#### paths./api/posts.get.responses.200.content.application/json.schema.properties.offset

> **offset**: `object`

#### paths./api/posts.get.responses.200.content.application/json.schema.properties.offset.type

> **type**: ... = `'integer'`

#### paths./api/posts.post

> **post**: `object`

#### paths./api/posts.post.summary

> **summary**: `string` = `'Create new post'`

#### paths./api/posts.post.description

> **description**: `string` = `'Creates a new post with automatic mention notifications, rate limiting, and real-time SSE broadcasting.'`

#### paths./api/posts.post.tags

> **tags**: `string`[]

#### paths./api/posts.post.security

> **security**: `object`[]

#### paths./api/posts.post.requestBody

> **requestBody**: `object`

#### paths./api/posts.post.requestBody.required

> **required**: `boolean` = `true`

#### paths./api/posts.post.requestBody.content

> **content**: `object`

#### paths./api/posts.post.requestBody.content.application/json

> **application/json**: `object`

#### paths./api/posts.post.requestBody.content.application/json.schema

> **schema**: `object`

#### paths./api/posts.post.requestBody.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/posts.post.requestBody.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/posts.post.requestBody.content.application/json.schema.properties.content

> **content**: `object`

#### paths./api/posts.post.requestBody.content.application/json.schema.properties.content.type

> **type**: `string` = `'string'`

#### paths./api/posts.post.requestBody.content.application/json.schema.properties.content.maxLength

> **maxLength**: `number` = `280`

#### paths./api/posts.post.requestBody.content.application/json.schema.required

> **required**: `string`[]

#### paths./api/posts.post.responses

> **responses**: `object`

#### paths./api/posts.post.responses.200

> **200**: `object`

#### paths./api/posts.post.responses.200.description

> **description**: `string` = `'Post created successfully'`

#### paths./api/posts.post.responses.200.content

> **content**: `object`

#### paths./api/posts.post.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/posts.post.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/posts.post.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/posts.post.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/posts.post.responses.200.content.application/json.schema.properties.success

> **success**: `object`

#### paths./api/posts.post.responses.200.content.application/json.schema.properties.success.type

> **type**: ... = `'boolean'`

#### paths./api/posts.post.responses.200.content.application/json.schema.properties.post

> **post**: `object`

#### paths./api/posts.post.responses.200.content.application/json.schema.properties.post.type

> **type**: ... = `'object'`

#### paths./api/posts.post.responses.400

> **400**: `object`

#### paths./api/posts.post.responses.400.description

> **description**: `string` = `'Invalid content or rate limited'`

#### paths./api/posts.post.responses.401

> **401**: `object`

#### paths./api/posts.post.responses.401.description

> **description**: `string` = `'Unauthorized'`

#### paths./api/chats

> **/api/chats**: `object`

#### paths./api/chats.get

> **get**: `object`

#### paths./api/chats.get.summary

> **summary**: `string` = `'List user chats'`

#### paths./api/chats.get.description

> **description**: `string` = `'Returns all chats (group and DMs) the authenticated user participates in.'`

#### paths./api/chats.get.tags

> **tags**: `string`[]

#### paths./api/chats.get.security

> **security**: `object`[]

#### paths./api/chats.get.parameters

> **parameters**: `object`[]

#### paths./api/chats.get.responses

> **responses**: `object`

#### paths./api/chats.get.responses.200

> **200**: `object`

#### paths./api/chats.get.responses.200.description

> **description**: `string` = `'Chat listings'`

#### paths./api/chats.get.responses.200.content

> **content**: `object`

#### paths./api/chats.get.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/chats.get.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/chats.get.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/chats.get.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/chats.get.responses.200.content.application/json.schema.properties.groupChats

> **groupChats**: `object`

#### paths./api/chats.get.responses.200.content.application/json.schema.properties.groupChats.type

> **type**: ... = `'array'`

#### paths./api/chats.get.responses.200.content.application/json.schema.properties.groupChats.items

> **items**: ...

#### paths./api/chats.get.responses.200.content.application/json.schema.properties.directChats

> **directChats**: `object`

#### paths./api/chats.get.responses.200.content.application/json.schema.properties.directChats.type

> **type**: ... = `'array'`

#### paths./api/chats.get.responses.200.content.application/json.schema.properties.directChats.items

> **items**: ...

#### paths./api/chats.get.responses.200.content.application/json.schema.properties.total

> **total**: `object`

#### paths./api/chats.get.responses.200.content.application/json.schema.properties.total.type

> **type**: ... = `'integer'`

#### paths./api/chats.post

> **post**: `object`

#### paths./api/chats.post.summary

> **summary**: `string` = `'Create new chat'`

#### paths./api/chats.post.description

> **description**: `string` = `'Creates a new chat (group or DM) and adds participants.'`

#### paths./api/chats.post.tags

> **tags**: `string`[]

#### paths./api/chats.post.security

> **security**: `object`[]

#### paths./api/chats.post.requestBody

> **requestBody**: `object`

#### paths./api/chats.post.requestBody.content

> **content**: `object`

#### paths./api/chats.post.requestBody.content.application/json

> **application/json**: `object`

#### paths./api/chats.post.requestBody.content.application/json.schema

> **schema**: `object`

#### paths./api/chats.post.requestBody.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/chats.post.requestBody.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/chats.post.requestBody.content.application/json.schema.properties.name

> **name**: `object`

#### paths./api/chats.post.requestBody.content.application/json.schema.properties.name.type

> **type**: `string` = `'string'`

#### paths./api/chats.post.requestBody.content.application/json.schema.properties.isGroup

> **isGroup**: `object`

#### paths./api/chats.post.requestBody.content.application/json.schema.properties.isGroup.type

> **type**: `string` = `'boolean'`

#### paths./api/chats.post.requestBody.content.application/json.schema.properties.isGroup.default

> **default**: `boolean` = `false`

#### paths./api/chats.post.requestBody.content.application/json.schema.properties.participantIds

> **participantIds**: `object`

#### paths./api/chats.post.requestBody.content.application/json.schema.properties.participantIds.type

> **type**: `string` = `'array'`

#### paths./api/chats.post.requestBody.content.application/json.schema.properties.participantIds.items

> **items**: `object`

#### paths./api/chats.post.requestBody.content.application/json.schema.properties.participantIds.items.type

> **type**: ... = `'string'`

#### paths./api/chats.post.responses

> **responses**: `object`

#### paths./api/chats.post.responses.201

> **201**: `object`

#### paths./api/chats.post.responses.201.description

> **description**: `string` = `'Chat created'`

#### paths./api/chats.post.responses.401

> **401**: `object`

#### paths./api/chats.post.responses.401.description

> **description**: `string` = `'Unauthorized'`

#### paths./api/users/me

> **/api/users/me**: `object`

#### paths./api/users/me.get

> **get**: `object`

#### paths./api/users/me.get.summary

> **summary**: `string` = `'Get current user profile'`

#### paths./api/users/me.get.description

> **description**: `string` = `'Returns the authenticated user complete profile including onboarding status, social connections, and reputation.'`

#### paths./api/users/me.get.tags

> **tags**: `string`[]

#### paths./api/users/me.get.security

> **security**: `object`[]

#### paths./api/users/me.get.responses

> **responses**: `object`

#### paths./api/users/me.get.responses.200

> **200**: `object`

#### paths./api/users/me.get.responses.200.description

> **description**: `string` = `'User profile'`

#### paths./api/users/me.get.responses.200.content

> **content**: `object`

#### paths./api/users/me.get.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/users/me.get.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/users/me.get.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/users/me.get.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/users/me.get.responses.200.content.application/json.schema.properties.authenticated

> **authenticated**: `object`

#### paths./api/users/me.get.responses.200.content.application/json.schema.properties.authenticated.type

> **type**: ... = `'boolean'`

#### paths./api/users/me.get.responses.200.content.application/json.schema.properties.needsOnboarding

> **needsOnboarding**: `object`

#### paths./api/users/me.get.responses.200.content.application/json.schema.properties.needsOnboarding.type

> **type**: ... = `'boolean'`

#### paths./api/users/me.get.responses.200.content.application/json.schema.properties.needsOnchain

> **needsOnchain**: `object`

#### paths./api/users/me.get.responses.200.content.application/json.schema.properties.needsOnchain.type

> **type**: ... = `'boolean'`

#### paths./api/users/me.get.responses.200.content.application/json.schema.properties.user

> **user**: `object`

#### paths./api/users/me.get.responses.200.content.application/json.schema.properties.user.type

> **type**: ... = `'object'`

#### paths./api/users/me.get.responses.200.content.application/json.schema.properties.user.properties

> **properties**: ...

#### paths./api/users/me.get.responses.401

> **401**: `object`

#### paths./api/users/me.get.responses.401.description

> **description**: `string` = `'Unauthorized'`

#### paths./api/trades

> **/api/trades**: `object`

#### paths./api/trades.get

> **get**: `object`

#### paths./api/trades.get.summary

> **summary**: `string` = `'Get trading feed'`

#### paths./api/trades.get.description

> **description**: `string` = `'Public trading feed showing recent activity across all market types with user/agent profiles.'`

#### paths./api/trades.get.tags

> **tags**: `string`[]

#### paths./api/trades.get.parameters

> **parameters**: (\{ `name`: `string`; `in`: `string`; `schema`: \{ `type`: `string`; `minimum`: `number`; `maximum`: `number`; `default`: `number`; \}; `description?`: `undefined`; \} \| \{ `name`: `string`; `in`: `string`; `schema`: \{ `maximum?`: `undefined`; `type`: `string`; `minimum`: `number`; `default`: `number`; \}; `description?`: `undefined`; \} \| \{ `name`: `string`; `in`: `string`; `description`: `string`; `schema`: \{ `default?`: `undefined`; `maximum?`: `undefined`; `minimum?`: `undefined`; `type`: `string`; \}; \})[]

#### paths./api/trades.get.responses

> **responses**: `object`

#### paths./api/trades.get.responses.200

> **200**: `object`

#### paths./api/trades.get.responses.200.description

> **description**: `string` = `'Trading feed'`

#### paths./api/trades.get.responses.200.content

> **content**: `object`

#### paths./api/trades.get.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/trades.get.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/trades.get.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/trades.get.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/trades.get.responses.200.content.application/json.schema.properties.trades

> **trades**: `object`

#### paths./api/trades.get.responses.200.content.application/json.schema.properties.trades.type

> **type**: ... = `'array'`

#### paths./api/trades.get.responses.200.content.application/json.schema.properties.trades.items

> **items**: ...

#### paths./api/trades.get.responses.200.content.application/json.schema.properties.total

> **total**: `object`

#### paths./api/trades.get.responses.200.content.application/json.schema.properties.total.type

> **type**: ... = `'integer'`

#### paths./api/trades.get.responses.200.content.application/json.schema.properties.hasMore

> **hasMore**: `object`

#### paths./api/trades.get.responses.200.content.application/json.schema.properties.hasMore.type

> **type**: ... = `'boolean'`

#### paths./api/markets/perps

> **/api/markets/perps**: `object`

#### paths./api/markets/perps.get

> **get**: `object`

#### paths./api/markets/perps.get.summary

> **summary**: `string` = `'Get perpetual futures markets'`

#### paths./api/markets/perps.get.description

> **description**: `string` = `'Returns all available perp markets with real-time pricing, 24h statistics, and funding rates.'`

#### paths./api/markets/perps.get.tags

> **tags**: `string`[]

#### paths./api/markets/perps.get.responses

> **responses**: `object`

#### paths./api/markets/perps.get.responses.200

> **200**: `object`

#### paths./api/markets/perps.get.responses.200.description

> **description**: `string` = `'Perp markets'`

#### paths./api/markets/perps.get.responses.200.content

> **content**: `object`

#### paths./api/markets/perps.get.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/markets/perps.get.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/markets/perps.get.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/markets/perps.get.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/markets/perps.get.responses.200.content.application/json.schema.properties.success

> **success**: `object`

#### paths./api/markets/perps.get.responses.200.content.application/json.schema.properties.success.type

> **type**: ... = `'boolean'`

#### paths./api/markets/perps.get.responses.200.content.application/json.schema.properties.markets

> **markets**: `object`

#### paths./api/markets/perps.get.responses.200.content.application/json.schema.properties.markets.type

> **type**: ... = `'array'`

#### paths./api/markets/perps.get.responses.200.content.application/json.schema.properties.markets.items

> **items**: ...

#### paths./api/markets/perps.get.responses.200.content.application/json.schema.properties.count

> **count**: `object`

#### paths./api/markets/perps.get.responses.200.content.application/json.schema.properties.count.type

> **type**: ... = `'integer'`

#### paths./api/notifications

> **/api/notifications**: `object`

#### paths./api/notifications.get

> **get**: `object`

#### paths./api/notifications.get.summary

> **summary**: `string` = `'Get user notifications'`

#### paths./api/notifications.get.description

> **description**: `string` = `'Returns paginated notifications with filtering support. Cached for 10 seconds.'`

#### paths./api/notifications.get.tags

> **tags**: `string`[]

#### paths./api/notifications.get.security

> **security**: `object`[]

#### paths./api/notifications.get.parameters

> **parameters**: (\{ `name`: `string`; `in`: `string`; `schema`: \{ `type`: `string`; `minimum`: `number`; `maximum`: `number`; `default`: `number`; \}; \} \| \{ `name`: `string`; `in`: `string`; `schema`: \{ `default?`: `undefined`; `maximum?`: `undefined`; `minimum?`: `undefined`; `type`: `string`; \}; \})[]

#### paths./api/notifications.get.responses

> **responses**: `object`

#### paths./api/notifications.get.responses.200

> **200**: `object`

#### paths./api/notifications.get.responses.200.description

> **description**: `string` = `'Notifications'`

#### paths./api/notifications.get.responses.200.content

> **content**: `object`

#### paths./api/notifications.get.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/notifications.get.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/notifications.get.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/notifications.get.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/notifications.get.responses.200.content.application/json.schema.properties.notifications

> **notifications**: `object`

#### paths./api/notifications.get.responses.200.content.application/json.schema.properties.notifications.type

> **type**: ... = `'array'`

#### paths./api/notifications.get.responses.200.content.application/json.schema.properties.notifications.items

> **items**: ...

#### paths./api/notifications.get.responses.200.content.application/json.schema.properties.unreadCount

> **unreadCount**: `object`

#### paths./api/notifications.get.responses.200.content.application/json.schema.properties.unreadCount.type

> **type**: ... = `'integer'`

#### paths./api/notifications.get.responses.401

> **401**: `object`

#### paths./api/notifications.get.responses.401.description

> **description**: `string` = `'Unauthorized'`

#### paths./api/notifications.patch

> **patch**: `object`

#### paths./api/notifications.patch.summary

> **summary**: `string` = `'Mark notifications as read'`

#### paths./api/notifications.patch.description

> **description**: `string` = `'Marks specific notifications or all notifications as read.'`

#### paths./api/notifications.patch.tags

> **tags**: `string`[]

#### paths./api/notifications.patch.security

> **security**: `object`[]

#### paths./api/notifications.patch.requestBody

> **requestBody**: `object`

#### paths./api/notifications.patch.requestBody.content

> **content**: `object`

#### paths./api/notifications.patch.requestBody.content.application/json

> **application/json**: `object`

#### paths./api/notifications.patch.requestBody.content.application/json.schema

> **schema**: `object`

#### paths./api/notifications.patch.requestBody.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/notifications.patch.requestBody.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/notifications.patch.requestBody.content.application/json.schema.properties.notificationIds

> **notificationIds**: `object`

#### paths./api/notifications.patch.requestBody.content.application/json.schema.properties.notificationIds.type

> **type**: `string` = `'array'`

#### paths./api/notifications.patch.requestBody.content.application/json.schema.properties.notificationIds.items

> **items**: `object`

#### paths./api/notifications.patch.requestBody.content.application/json.schema.properties.notificationIds.items.type

> **type**: ... = `'string'`

#### paths./api/notifications.patch.requestBody.content.application/json.schema.properties.markAllAsRead

> **markAllAsRead**: `object`

#### paths./api/notifications.patch.requestBody.content.application/json.schema.properties.markAllAsRead.type

> **type**: `string` = `'boolean'`

#### paths./api/notifications.patch.responses

> **responses**: `object`

#### paths./api/notifications.patch.responses.200

> **200**: `object`

#### paths./api/notifications.patch.responses.200.description

> **description**: `string` = `'Notifications marked as read'`

#### paths./api/notifications.patch.responses.401

> **401**: `object`

#### paths./api/notifications.patch.responses.401.description

> **description**: `string` = `'Unauthorized'`

#### paths./api/cron/agent-tick

> **/api/cron/agent-tick**: `object`

#### paths./api/cron/agent-tick.post

> **post**: `object`

#### paths./api/cron/agent-tick.post.summary

> **summary**: `string` = `'Run autonomous agents'`

#### paths./api/cron/agent-tick.post.description

> **description**: `string` = `'Scheduled cron job that runs all autonomous agents, executing their configured autonomous actions.'`

#### paths./api/cron/agent-tick.post.tags

> **tags**: `string`[]

#### paths./api/cron/agent-tick.post.security

> **security**: `object`[]

#### paths./api/cron/agent-tick.post.responses

> **responses**: `object`

#### paths./api/cron/agent-tick.post.responses.200

> **200**: `object`

#### paths./api/cron/agent-tick.post.responses.200.description

> **description**: `string` = `'Execution summary'`

#### paths./api/cron/agent-tick.post.responses.200.content

> **content**: `object`

#### paths./api/cron/agent-tick.post.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/cron/agent-tick.post.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/cron/agent-tick.post.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/cron/agent-tick.post.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/cron/agent-tick.post.responses.200.content.application/json.schema.properties.success

> **success**: `object`

#### paths./api/cron/agent-tick.post.responses.200.content.application/json.schema.properties.success.type

> **type**: ... = `'boolean'`

#### paths./api/cron/agent-tick.post.responses.200.content.application/json.schema.properties.processed

> **processed**: `object`

#### paths./api/cron/agent-tick.post.responses.200.content.application/json.schema.properties.processed.type

> **type**: ... = `'integer'`

#### paths./api/cron/agent-tick.post.responses.200.content.application/json.schema.properties.duration

> **duration**: `object`

#### paths./api/cron/agent-tick.post.responses.200.content.application/json.schema.properties.duration.type

> **type**: ... = `'integer'`

#### paths./api/cron/agent-tick.post.responses.200.content.application/json.schema.properties.results

> **results**: `object`

#### paths./api/cron/agent-tick.post.responses.200.content.application/json.schema.properties.results.type

> **type**: ... = `'array'`

#### paths./api/cron/agent-tick.post.responses.200.content.application/json.schema.properties.results.items

> **items**: ...

#### paths./api/cron/agent-tick.post.responses.401

> **401**: `object`

#### paths./api/cron/agent-tick.post.responses.401.description

> **description**: `string` = `'Unauthorized - invalid CRON_SECRET'`

#### paths./api/debug/clear-agent-cache

> **/api/debug/clear-agent-cache**: `object`

#### paths./api/debug/clear-agent-cache.post

> **post**: `object`

#### paths./api/debug/clear-agent-cache.post.summary

> **summary**: `string` = `'Clear agent runtime cache'`

#### paths./api/debug/clear-agent-cache.post.description

> **description**: `string` = `'Debug endpoint to forcefully clear all cached agent runtimes from memory.'`

#### paths./api/debug/clear-agent-cache.post.tags

> **tags**: `string`[]

#### paths./api/debug/clear-agent-cache.post.responses

> **responses**: `object`

#### paths./api/debug/clear-agent-cache.post.responses.200

> **200**: `object`

#### paths./api/debug/clear-agent-cache.post.responses.200.description

> **description**: `string` = `'Cache cleared'`

#### paths./api/debug/clear-agent-cache.post.responses.200.content

> **content**: `object`

#### paths./api/debug/clear-agent-cache.post.responses.200.content.application/json

> **application/json**: `object`

#### paths./api/debug/clear-agent-cache.post.responses.200.content.application/json.schema

> **schema**: `object`

#### paths./api/debug/clear-agent-cache.post.responses.200.content.application/json.schema.type

> **type**: `string` = `'object'`

#### paths./api/debug/clear-agent-cache.post.responses.200.content.application/json.schema.properties

> **properties**: `object`

#### paths./api/debug/clear-agent-cache.post.responses.200.content.application/json.schema.properties.success

> **success**: `object`

#### paths./api/debug/clear-agent-cache.post.responses.200.content.application/json.schema.properties.success.type

> **type**: ... = `'boolean'`

#### paths./api/debug/clear-agent-cache.post.responses.200.content.application/json.schema.properties.cleared

> **cleared**: `object`

#### paths./api/debug/clear-agent-cache.post.responses.200.content.application/json.schema.properties.cleared.type

> **type**: ... = `'integer'`

### tags

> **tags**: `object`[]

## Description

Generates the OpenAPI 3.0 specification for all API routes
with comprehensive documentation extracted from TSDoc comments in route files.

## Example

```typescript
const spec = generateOpenApiSpec();
console.log(spec.info.title); // 'Babylon API'
```
