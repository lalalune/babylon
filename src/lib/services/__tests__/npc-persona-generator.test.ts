/**
 * NPC Persona Generator Test Suite
 * 
 * @description
 * Tests for NPC persona generation and validation.
 * Ensures personas create learnable patterns for agents.
 */

import { describe, test, expect } from 'bun:test';
import { NPCPersonaGenerator } from '../npc-persona-generator';
import type { Actor, Organization } from '@/shared/types';

// Helper to create test actor
function createTestActor(
  id: string,
  overrides: Partial<Actor> = {}
): Actor {
  return {
    id,
    name: `Test Actor ${id}`,
    description: 'Test description',
    tier: 'B_TIER',
    domain: ['tech'],
    personality: 'balanced',
    ...overrides,
  };
}

// Helper to create test organization
function createTestOrg(id: string, type: 'company' | 'media' | 'government'): Organization {
  return {
    id,
    name: `Test ${type} ${id}`,
    description: 'Test org',
    type,
    canBeInvolved: true,
  };
}

describe('NPCPersonaGenerator', () => {
  describe('Persona Assignment', () => {
    test('assigns personas to all actors', () => {
      const generator = new NPCPersonaGenerator();
      const actors = [
        createTestActor('actor-1'),
        createTestActor('actor-2'),
        createTestActor('actor-3'),
      ];
      const orgs = [createTestOrg('org-1', 'company')];
      
      const personas = generator.assignPersonas(actors, orgs);
      
      expect(personas.size).toBe(3);
      expect(personas.has('actor-1')).toBe(true);
      expect(personas.has('actor-2')).toBe(true);
      expect(personas.has('actor-3')).toBe(true);
    });
    
    test('persona has all required fields', () => {
      const generator = new NPCPersonaGenerator();
      const actors = [createTestActor('actor-1')];
      const orgs = [createTestOrg('org-1', 'company')];
      
      const personas = generator.assignPersonas(actors, orgs);
      const persona = personas.get('actor-1')!;
      
      expect(persona.actorId).toBe('actor-1');
      expect(typeof persona.reliability).toBe('number');
      expect(persona.reliability).toBeGreaterThanOrEqual(0);
      expect(persona.reliability).toBeLessThanOrEqual(1);
      expect(Array.isArray(persona.insiderOrgs)).toBe(true);
      expect(Array.isArray(persona.expertise)).toBe(true);
      expect(typeof persona.willingToLie).toBe('boolean');
      expect(['wealth', 'reputation', 'ideology', 'chaos']).toContain(persona.selfInterest);
    });
  });
  
  describe('Reliability Levels', () => {
    test('conspiracy theorists have low reliability', () => {
      const generator = new NPCPersonaGenerator();
      const actors = [
        createTestActor('conspiracy-1', {
          personality: 'contrarian conspiracy-theorist',
          description: 'Believes in conspiracy theories',
        }),
      ];
      const orgs: Organization[] = [];
      
      const personas = generator.assignPersonas(actors, orgs);
      const persona = personas.get('conspiracy-1')!;
      
      expect(persona.reliability).toBeLessThan(0.4); // Low reliability
      expect(persona.willingToLie).toBe(true);
      expect(persona.selfInterest).toBe('chaos');
    });
    
    test('politicians have low reliability and willing to lie', () => {
      const generator = new NPCPersonaGenerator();
      const actors = [
        createTestActor('politician-1', {
          domain: ['politics'],
          description: 'Political figure',
        }),
      ];
      const orgs: Organization[] = [];
      
      const personas = generator.assignPersonas(actors, orgs);
      const persona = personas.get('politician-1')!;
      
      expect(persona.reliability).toBeLessThan(0.5);
      expect(persona.willingToLie).toBe(true);
      expect(persona.selfInterest).toBe('reputation');
    });
    
    test('journalists have medium reliability', () => {
      const generator = new NPCPersonaGenerator();
      const actors = [
        createTestActor('journalist-1', {
          domain: ['media', 'journalism'],
          role: 'journalist',
        }),
      ];
      const orgs: Organization[] = [];
      
      const personas = generator.assignPersonas(actors, orgs);
      const persona = personas.get('journalist-1')!;
      
      expect(persona.reliability).toBeGreaterThanOrEqual(0.50);
      expect(persona.reliability).toBeLessThanOrEqual(0.75);
      expect(persona.willingToLie).toBe(false);
    });
    
    test('insiders have high reliability', () => {
      const generator = new NPCPersonaGenerator();
      const actors = [
        createTestActor('insider-1', {
          affiliations: ['techcorp', 'megainc'],
          domain: ['tech'],
        }),
      ];
      const orgs = [
        createTestOrg('techcorp', 'company'),
        createTestOrg('megainc', 'company'),
      ];
      
      const personas = generator.assignPersonas(actors, orgs);
      const persona = personas.get('insider-1')!;
      
      expect(persona.reliability).toBeGreaterThanOrEqual(0.70); // Insiders minimum 0.7
      expect(persona.insiderOrgs).toEqual(['techcorp', 'megainc']);
    });
    
    test('experts have medium-high reliability', () => {
      const generator = new NPCPersonaGenerator();
      const actors = [
        createTestActor('expert-1', {
          domain: ['finance', 'tech'],
          role: 'expert',
        }),
      ];
      const orgs: Organization[] = [];
      
      const personas = generator.assignPersonas(actors, orgs);
      const persona = personas.get('expert-1')!;
      
      expect(persona.reliability).toBeGreaterThanOrEqual(0.60);
      expect(persona.reliability).toBeLessThanOrEqual(0.85);
    });
  });
  
  describe('Distribution Validation', () => {
    test('generates balanced reliability distribution', () => {
      const generator = new NPCPersonaGenerator();
      
      // Create mix of actor types
      const actors = [
        ...Array.from({ length: 3 }, (_, i) => createTestActor(`insider-${i}`, {
          affiliations: ['techcorp'],
          tier: 'A_TIER',
        })),
        ...Array.from({ length: 5 }, (_, i) => createTestActor(`journalist-${i}`, {
          domain: ['media'],
          role: 'journalist',
        })),
        ...Array.from({ length: 2 }, (_, i) => createTestActor(`politician-${i}`, {
          domain: ['politics'],
        })),
        ...Array.from({ length: 2 }, (_, i) => createTestActor(`conspiracy-${i}`, {
          personality: 'contrarian',
        })),
      ];
      
      const orgs = [createTestOrg('techcorp', 'company')];
      
      const personas = generator.assignPersonas(actors, orgs);
      
      const reliabilities = Array.from(personas.values()).map(p => p.reliability);
      const avgReliability = reliabilities.reduce((a, b) => a + b, 0) / reliabilities.length;
      
      // Average should be in reasonable range
      expect(avgReliability).toBeGreaterThan(0.40);
      expect(avgReliability).toBeLessThan(0.70);
      
      // Should have mix of high/medium/low
      const highRel = reliabilities.filter(r => r > 0.7).length;
      const lowRel = reliabilities.filter(r => r < 0.4).length;
      
      expect(highRel).toBeGreaterThan(0); // Some high reliability
      expect(lowRel).toBeGreaterThan(0); // Some low reliability
    });
    
    test('insiders are identified correctly', () => {
      const generator = new NPCPersonaGenerator();
      const actors = [
        createTestActor('insider-1', { affiliations: ['techcorp'] }),
        createTestActor('outsider-1', { affiliations: [] }),
      ];
      const orgs = [createTestOrg('techcorp', 'company')];
      
      const personas = generator.assignPersonas(actors, orgs);
      
      const insider = personas.get('insider-1')!;
      const outsider = personas.get('outsider-1')!;
      
      expect(insider.insiderOrgs.length).toBeGreaterThan(0);
      expect(outsider.insiderOrgs.length).toBe(0);
    });
  });
});

