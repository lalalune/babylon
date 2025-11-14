[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/db/monitored-prisma](../README.md) / createMonitoredPrismaClient

# Function: createMonitoredPrismaClient()

> **createMonitoredPrismaClient**(`baseClient`): `PrismaClient`

Defined in: [src/lib/db/monitored-prisma.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/db/monitored-prisma.ts#L18)

Create a Prisma client with automatic query monitoring
This wraps the client and intercepts queries to track performance

## Parameters

### baseClient

`PrismaClient`

## Returns

`PrismaClient`
