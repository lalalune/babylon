/**
 * Remove unused fields from actors.json
 * 
 * Based on thorough codebase analysis:
 * - nickname: NEVER accessed in code
 * - aliases: NEVER accessed in code
 * - quirks: NEVER accessed in code
 * - canPostFeed: Defined in types but NEVER checked
 * - canPostGroups: Defined in types but NEVER checked
 * 
 * These fields are dead weight and should be removed.
 */

import * as fs from 'fs';
import * as path from 'path';

interface Actor {
  [key: string]: any;
}

interface Organization {
  [key: string]: any;
}

interface ActorsData {
  actors: Actor[];
  organizations: Organization[];
}

const UNUSED_ACTOR_FIELDS = ['nickname', 'aliases', 'quirks', 'canPostFeed', 'canPostGroups'];
const UNUSED_ORG_FIELDS: string[] = []; // No unused org fields found

function removeUnusedFields() {
  const actorsPath = path.join(process.cwd(), 'public/data/actors.json');
  const data: ActorsData = JSON.parse(fs.readFileSync(actorsPath, 'utf-8'));
  
  let removedCount = 0;
  
  console.log('=== REMOVING UNUSED ACTOR FIELDS ===\n');
  console.log(`Fields to remove: ${UNUSED_ACTOR_FIELDS.join(', ')}\n`);
  
  // Remove unused fields from actors
  for (const actor of data.actors) {
    for (const field of UNUSED_ACTOR_FIELDS) {
      if (actor[field] !== undefined) {
        delete actor[field];
        removedCount++;
      }
    }
  }
  
  console.log(`Removed ${removedCount} field instances from ${data.actors.length} actors\n`);
  
  console.log('=== REMOVING UNUSED ORGANIZATION FIELDS ===\n');
  
  if (UNUSED_ORG_FIELDS.length === 0) {
    console.log('✅ No unused organization fields found\n');
  } else {
    let orgRemovedCount = 0;
    for (const org of data.organizations) {
      for (const field of UNUSED_ORG_FIELDS) {
        if (org[field] !== undefined) {
          delete org[field];
          orgRemovedCount++;
        }
      }
    }
    console.log(`Removed ${orgRemovedCount} field instances from ${data.organizations.length} organizations\n`);
  }
  
  // Write back
  fs.writeFileSync(actorsPath, JSON.stringify(data, null, 2), 'utf-8');
  
  console.log('=== SUMMARY ===');
  console.log(`✅ Removed ${removedCount} unused field instances`);
  console.log(`✅ Updated actors.json`);
  
  console.log('\n=== FIELDS KEPT (ALL ARE USED) ===\n');
  console.log('Core Identity:');
  console.log('  - id, name, realName, username');
  console.log('');
  console.log('Descriptions:');
  console.log('  - description: Internal character description');
  console.log('  - profileDescription: What the actor says about themselves');
  console.log('');
  console.log('Behavioral:');
  console.log('  - domain: Subject matter expertise');
  console.log('  - personality: Character personality type');
  console.log('  - tier: Influence level (S/A/B/C)');
  console.log('  - role: Game importance (main/supporting/extra) [set at runtime]');
  console.log('  - affiliations: Organization IDs');
  console.log('  - postStyle: How they write');
  console.log('  - postExample: Example posts');
  console.log('');
  console.log('Image Generation:');
  console.log('  - physicalDescription: Used by generate-actor-images.ts');
  console.log('  - profileBanner: Used by generate-actor-images.ts');
  console.log('');
  console.log('Name Replacement (NEW):');
  console.log('  - originalFirstName: For name scrubbing');
  console.log('  - originalLastName: For name scrubbing');
  console.log('  - originalHandle: For name scrubbing');
  console.log('');
  console.log('Trading/Game Mechanics:');
  console.log('  - hasPool: Can run a trading pool');
  console.log('  - initialLuck: Set at runtime');
  console.log('  - initialMood: Set at runtime');
  console.log('  - tradingBalance: Set at runtime');
  console.log('  - reputationPoints: Set at runtime');
  console.log('  - profileImageUrl: Set at runtime');
  console.log('');
  console.log('Organization Fields:');
  console.log('  - id, name, type, description, profileDescription');
  console.log('  - postStyle, postExample');
  console.log('  - pfpDescription, bannerDescription (for image generation)');
  console.log('  - originalName, originalHandle (for name scrubbing)');
  console.log('  - canBeInvolved, initialPrice (trading)');
}

removeUnusedFields();

