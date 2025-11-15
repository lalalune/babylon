/**
 * Shared Capabilities Schema
 * 
 * Centralized Zod schema for validating agent capabilities across Agent0 integration.
 * Used by Agent0Client, AgentDiscovery, and SubgraphClient.
 */

import { z } from 'zod'

/**
 * Agent Capabilities Schema
 * Validates capabilities structure from Agent0 registry and subgraph
 */
export const CapabilitiesSchema = z.object({
  strategies: z.array(z.string()).optional(),
  markets: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),
  version: z.string().optional(),
})

/**
 * Parse and validate capabilities with defaults
 */
export function parseCapabilities(
  capabilities: unknown,
  defaults = {
    strategies: [] as string[],
    markets: [] as string[],
    actions: [] as string[],
    version: '1.0.0',
  }
): {
  strategies: string[]
  markets: string[]
  actions: string[]
  version: string
} {
  const validation = CapabilitiesSchema.safeParse(capabilities)
  
  if (!validation.success) {
    return defaults
  }
  
  return {
    strategies: validation.data.strategies ?? defaults.strategies,
    markets: validation.data.markets ?? defaults.markets,
    actions: validation.data.actions ?? defaults.actions,
    version: validation.data.version ?? defaults.version,
  }
}

