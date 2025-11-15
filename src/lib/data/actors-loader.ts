/**
 * Loader for actors data from the split file structure
 * Handles loading actors, organizations, and relationships from public/data/
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { ActorsDatabase, ActorData, Organization } from '../../shared/types';

/**
 * Loads all actors data from the file system
 * Currently loads from the consolidated actors.json file
 * In the future, this will load from split files in actors/, organizations/, and relationships/
 */
export function loadActorsData(): ActorsDatabase {
  const dataDir = join(process.cwd(), 'public', 'data');
  const actorsJsonPath = join(dataDir, 'actors.json');
  const actorsFullPath = join(dataDir, 'actors-full.json');

  // First, try to load the full data file if it exists
  if (existsSync(actorsFullPath)) {
    const fullData = JSON.parse(readFileSync(actorsFullPath, 'utf-8'));
    if (fullData.actors && Array.isArray(fullData.actors)) {
      return {
        actors: fullData.actors as ActorData[],
        organizations: fullData.organizations || [],
        relationships: fullData.relationships || []
      };
    }
  }

  // Otherwise, try to load from the index file
  if (existsSync(actorsJsonPath)) {
    const data = JSON.parse(readFileSync(actorsJsonPath, 'utf-8'));

    // If the data already has the full structure, return it
    if (data.actors && Array.isArray(data.actors)) {
      // Check if the first actor has the full data or just a reference
      if (data.actors.length > 0 && typeof data.actors[0] === 'object' && !data.actors[0].file) {
        // This is already a full data file
        return {
          actors: data.actors as ActorData[],
          organizations: data.organizations || [],
          relationships: data.relationships || []
        };
      }

      // This is an index file with references
      // For now, since individual files don't exist, try to load from actors-full.json
      // In the future, this would load each file individually
      return {
        actors: [] as ActorData[],
        organizations: data.organizations || [],
        relationships: data.relationships || []
      };
    }
  }

  // Return empty structure if no data found
  return {
    actors: [],
    organizations: [],
    relationships: []
  };
}

/**
 * Loads a single actor by ID
 * @param actorId The ID of the actor to load
 */
export function loadActorById(actorId: string): ActorData | null {
  const data = loadActorsData();
  return data.actors.find(actor => actor.id === actorId) || null;
}

/**
 * Loads a single organization by ID
 * @param orgId The ID of the organization to load
 */
export function loadOrganizationById(orgId: string): Organization | null {
  const data = loadActorsData();
  return data.organizations.find(org => org.id === orgId) || null;
}