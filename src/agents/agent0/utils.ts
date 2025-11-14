import { AgentCapabilitiesSchema, type AgentCapabilities } from '@/types/a2a';

const DefaultCapabilities: AgentCapabilities = {
  strategies: [],
  markets: [],
  actions: [],
  version: '1.0.0',
};

export function parseAgentCapabilities(capabilitiesJson: string): AgentCapabilities {
  const raw = JSON.parse(capabilitiesJson)
  const result = AgentCapabilitiesSchema.partial().parse(raw)
  
  return {
    ...DefaultCapabilities,
    ...result,
  }
}
