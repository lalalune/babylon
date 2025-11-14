[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/swagger/auto-generator](../README.md) / generateAutoSpec

# Function: generateAutoSpec()

> **generateAutoSpec**(): `any`

Defined in: src/lib/swagger/auto-generator.ts:38

Generate OpenAPI specification automatically from JSDoc comments

## Returns

`any`

Complete OpenAPI 3.0 specification

## Description

Scans all API route files for

## Openapi

tags and generates
a complete OpenAPI 3.0 specification. This eliminates the need for manual
spec maintenance.

## Example

```typescript
import { generateAutoSpec } from '@/lib/swagger/auto-generator';

const spec = generateAutoSpec();
console.log(spec.paths); // All documented paths
```
