/**
 * Data integrity tests for actors.json
 * Ensures all required fields are present and no unused fields remain
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import type { ActorsDataFile, ActorData, OrganizationData } from '../types/test-types';

describe('Actors.json Data Integrity', () => {
  let actorsData: ActorsDataFile;

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadActorsData } = require('../../src/lib/data/actors-loader');
    actorsData = loadActorsData() as ActorsDataFile;
  });

  describe('Actor Required Fields', () => {
    it('all actors should have id', () => {
      const missing = actorsData.actors.filter((a: ActorData) => !a.id);
      expect(missing).toHaveLength(0);
    });

    it('all actors should have name', () => {
      const missing = actorsData.actors.filter((a: ActorData) => !a.name);
      expect(missing).toHaveLength(0);
    });

    it('all actors should have realName', () => {
      const missing = actorsData.actors.filter((a: ActorData) => !a.realName);
      expect(missing).toHaveLength(0);
    });

    it('all actors should have username', () => {
      const missing = actorsData.actors.filter((a: ActorData) => !a.username);
      expect(missing).toHaveLength(0);
    });

    it('all actors should have description', () => {
      const missing = actorsData.actors.filter((a: ActorData) => !a.description);
      expect(missing).toHaveLength(0);
    });

    it('all actors should have profileDescription', () => {
      const missing = actorsData.actors.filter((a: ActorData) => !a.profileDescription);
      expect(missing).toHaveLength(0);
    });

    it('all actors should have domain array', () => {
      const missing = actorsData.actors.filter((a: ActorData) => !Array.isArray(a.domain));
      expect(missing).toHaveLength(0);
    });

    it('all actors should have personality', () => {
      const missing = actorsData.actors.filter((a: ActorData) => !a.personality);
      expect(missing).toHaveLength(0);
    });

    it('all actors should have tier', () => {
      const missing = actorsData.actors.filter((a: ActorData) => !a.tier);
      expect(missing).toHaveLength(0);
    });

    it('all actors should have postStyle', () => {
      const missing = actorsData.actors.filter((a: ActorData) => !a.postStyle);
      expect(missing).toHaveLength(0);
    });

    it('all actors should have postExample array', () => {
      const missing = actorsData.actors.filter((a: ActorData) => !Array.isArray(a.postExample));
      expect(missing).toHaveLength(0);
    });

    it('all actors should have hasPool boolean', () => {
      const missing = actorsData.actors.filter((a: ActorData) => typeof a.hasPool !== 'boolean');
      expect(missing).toHaveLength(0);
    });

    it('all actors should have physicalDescription', () => {
      const missing = actorsData.actors.filter((a: ActorData) => !a.physicalDescription);
      expect(missing).toHaveLength(0);
    });

    it('all actors should have profileBanner', () => {
      const missing = actorsData.actors.filter((a: ActorData) => !a.profileBanner);
      expect(missing).toHaveLength(0);
    });

    it('all actors should have originalFirstName', () => {
      const missing = actorsData.actors.filter((a: ActorData) => 
        a.originalFirstName === undefined || a.originalFirstName === null
      );
      expect(missing).toHaveLength(0);
    });

    it('all actors should have originalLastName (can be empty string)', () => {
      const missing = actorsData.actors.filter((a: ActorData) => 
        a.originalLastName === undefined || a.originalLastName === null
      );
      expect(missing).toHaveLength(0);
    });

    it('all actors should have originalHandle', () => {
      const missing = actorsData.actors.filter((a: ActorData) => !a.originalHandle);
      expect(missing).toHaveLength(0);
    });
  });

  describe('Organization Required Fields', () => {
    it('all organizations should have id', () => {
      const missing = actorsData.organizations.filter((o: OrganizationData) => !o.id);
      expect(missing).toHaveLength(0);
    });

    it('all organizations should have name', () => {
      const missing = actorsData.organizations.filter((o: OrganizationData) => !o.name);
      expect(missing).toHaveLength(0);
    });

    it('all organizations should have type', () => {
      const missing = actorsData.organizations.filter((o: OrganizationData) => !o.type);
      expect(missing).toHaveLength(0);
    });

    it('all organizations should have description', () => {
      const missing = actorsData.organizations.filter((o: OrganizationData) => !o.description);
      expect(missing).toHaveLength(0);
    });

    it('all organizations should have postStyle', () => {
      const missing = actorsData.organizations.filter((o: OrganizationData) => !o.postStyle);
      expect(missing).toHaveLength(0);
    });

    it('all organizations should have postExample array', () => {
      const missing = actorsData.organizations.filter((o: OrganizationData) => !Array.isArray(o.postExample));
      expect(missing).toHaveLength(0);
    });

    it('all organizations should have initialPrice (number)', () => {
      const missing = actorsData.organizations.filter((o: OrganizationData) => typeof o.initialPrice !== 'number');
      expect(missing).toHaveLength(0);
    });

    it('all organizations should have originalName', () => {
      const missing = actorsData.organizations.filter((o: OrganizationData) => !o.originalName);
      expect(missing).toHaveLength(0);
    });

    it('all organizations should have originalHandle', () => {
      const missing = actorsData.organizations.filter((o: OrganizationData) => !o.originalHandle);
      expect(missing).toHaveLength(0);
    });
  });

  describe('Unused Fields Removed', () => {
    it('no actors should have "nickname" field', () => {
      const withNickname = actorsData.actors.filter((a) => 'nickname' in (a as unknown as Record<string, unknown>));
      expect(withNickname).toHaveLength(0);
    });

    it('no actors should have "aliases" field', () => {
      const withAliases = actorsData.actors.filter((a) => 'aliases' in (a as unknown as Record<string, unknown>));
      expect(withAliases).toHaveLength(0);
    });

    it('no actors should have "quirks" field', () => {
      const withQuirks = actorsData.actors.filter((a) => 'quirks' in (a as unknown as Record<string, unknown>));
      expect(withQuirks).toHaveLength(0);
    });

    it('no actors should have "canPostFeed" field', () => {
      const withCanPostFeed = actorsData.actors.filter((a) => 'canPostFeed' in (a as unknown as Record<string, unknown>));
      expect(withCanPostFeed).toHaveLength(0);
    });

    it('no actors should have "canPostGroups" field', () => {
      const withCanPostGroups = actorsData.actors.filter((a) => 'canPostGroups' in (a as unknown as Record<string, unknown>));
      expect(withCanPostGroups).toHaveLength(0);
    });
  });

  describe('Name Parody Validation', () => {
    it('all actor names should be different from realName', () => {
      const notParodied = actorsData.actors.filter((a: ActorData) => a.name === a.realName);
      expect(notParodied).toHaveLength(0);
    });

    it('actor names should contain AI variations', () => {
      const aiPatterns = /AI|ai/;
      const withAI = actorsData.actors.filter((a: ActorData) => aiPatterns.test(a.name));
      // Most should have AI in the name
      expect(withAI.length).toBeGreaterThan(actorsData.actors.length * 0.8);
    });

    it('organization names should be parodied', () => {
      const notParodied = actorsData.organizations.filter((o: OrganizationData) => o.name === o.originalName);
      expect(notParodied).toHaveLength(0);
    });
  });

  describe('Data Consistency', () => {
    it('all actor IDs should be unique', () => {
      const ids = actorsData.actors.map((a: ActorData) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all organization IDs should be unique', () => {
      const ids = actorsData.organizations.map((o: OrganizationData) => o.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('actor affiliations should reference valid organization IDs', () => {
      const orgIds = new Set(actorsData.organizations.map((o: OrganizationData) => o.id));
      
      for (const actor of actorsData.actors) {
        if (actor.affiliations && Array.isArray(actor.affiliations)) {
          for (const affiliation of actor.affiliations) {
            expect(orgIds.has(affiliation)).toBe(true);
          }
        }
      }
    });

    it('all hasPool values should be boolean', () => {
      for (const actor of actorsData.actors) {
        expect(typeof actor.hasPool).toBe('boolean');
      }
    });

    it('all initialPrice values should be number', () => {
      for (const org of actorsData.organizations) {
        expect(typeof org.initialPrice).toBe('number');
      }
    });
  });

  describe('Counts', () => {
    it('should have 64 actors', () => {
      expect(actorsData.actors).toHaveLength(64);
    });

    it('should have 52 organizations', () => {
      expect(actorsData.organizations).toHaveLength(52);
    });
  });
});

