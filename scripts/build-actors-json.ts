#!/usr/bin/env bun
/**
 * Builds the full actors.json from individual split files
 * This is useful for client-side code that expects the full actors.json structure
 * 
 * Run: bun run scripts/build-actors-json.ts
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadActorsData } from '../src/lib/data/actors-loader';

async function main() {
  console.log('Building full actors.json from split files...');
  
  try {
    // Load all data using the loader
    const actorsData = loadActorsData();
    
    console.log(`Loaded ${actorsData.actors.length} actors, ${actorsData.organizations.length} organizations, and ${actorsData.relationships?.length || 0} relationships`);
    
    // Ensure the directory exists
    const dataDir = join(process.cwd(), 'public', 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    
    // Write the full file for client-side use
    const outputPath = join(dataDir, 'actors-full.json');
    writeFileSync(outputPath, JSON.stringify(actorsData, null, 2));
    
    console.log(`✓ Created ${outputPath}`);
    console.log('\nThis file can be used by client-side code that needs the full actors structure');
  } catch (error) {
    console.warn('⚠️  Could not build actors.json - this is optional for the build');
    console.warn('   Error:', error instanceof Error ? error.message : String(error));
    console.log('   Continuing with build...');
    // Don't throw - this is a non-critical prebuild step
    process.exit(0);
  }
}

main().catch((error) => {
  console.warn('⚠️  Prebuild script failed - this is optional');
  console.warn('   Error:', error instanceof Error ? error.message : String(error));
  process.exit(0); // Exit successfully even on error
});

