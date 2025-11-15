#!/usr/bin/env bun
/**
 * Builds the full actors.json from individual split files
 * This is useful for client-side code that expects the full actors.json structure
 * 
 * Run: bun run scripts/build-actors-json.ts
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { loadActorsData } from '../src/lib/data/actors-loader';

async function main() {
  console.log('Building full actors.json from split files...');
  
  // Load all data using the loader
  const actorsData = loadActorsData();
  
  console.log(`Loaded ${actorsData.actors.length} actors, ${actorsData.organizations.length} organizations, and ${actorsData.relationships?.length || 0} relationships`);
  
  // Write the full file for client-side use
  const outputPath = join(process.cwd(), 'public', 'data', 'actors-full.json');
  writeFileSync(outputPath, JSON.stringify(actorsData, null, 2));
  
  console.log(`✓ Created ${outputPath}`);
  console.log('\nThis file can be used by client-side code that needs the full actors structure');
}

main().catch(console.error);

