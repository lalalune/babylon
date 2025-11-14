import * as fs from 'fs';
import * as path from 'path';

interface Actor {
  id: string;
  name: string;
  realName: string;
  originalFirstName?: string;
  originalLastName?: string;
  postStyle?: string;
  hasPool?: boolean;
  [key: string]: any;
}

interface Organization {
  id: string;
  name: string;
  initialPrice?: number;
  [key: string]: any;
}

interface ActorsData {
  actors: Actor[];
  organizations: Organization[];
}

function cleanupActors() {
  const actorsPath = path.join(process.cwd(), 'public/data/actors.json');
  const data: ActorsData = JSON.parse(fs.readFileSync(actorsPath, 'utf-8'));
  
  let changesCount = 0;
  
  console.log('=== FIXING ACTOR ISSUES ===\n');
  
  // Fix actors with single names (no last name)
  for (const actor of data.actors) {
    // Fix missing originalLastName for single-name actors
    if (!actor.originalLastName && actor.originalFirstName) {
      console.log(`Fixing ${actor.name}: single name, setting lastName to empty string`);
      actor.originalLastName = '';
      changesCount++;
    }
    
    // Fix missing postStyle (GAInzy)
    if (!actor.postStyle) {
      console.log(`Warning: ${actor.name} is missing postStyle`);
      // Don't auto-fix, needs manual review
    }
    
    // Ensure hasPool has a default for actors that don't have it set
    if (actor.hasPool === undefined) {
      actor.hasPool = false;
      changesCount++;
    }
  }
  
  console.log('\n=== FIXING ORGANIZATION ISSUES ===\n');
  
  // Add default initialPrice for organizations missing it
  for (const org of data.organizations) {
    if (org.initialPrice === undefined) {
      // Media/journalism organizations typically don't have trading pools
      org.initialPrice = 0;
      console.log(`Set initialPrice=0 for ${org.name} (no trading pool)`);
      changesCount++;
    }
  }
  
  console.log(`\n=== CLEANUP SUMMARY ===`);
  console.log(`Total changes: ${changesCount}`);
  
  if (changesCount > 0) {
    // Write back
    fs.writeFileSync(actorsPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log('✅ Changes written to actors.json');
  } else {
    console.log('✅ No changes needed');
  }
  
  console.log('\n=== FIELD USAGE SUMMARY ===\n');
  console.log('Required fields in actors.json:');
  console.log('  Core: id, name, realName, username, nickname, aliases');
  console.log('  Behavior: description, profileDescription, domain, personality, quirks');
  console.log('  Posting: tier, affiliations, postStyle, postExample, canPostFeed, canPostGroups');
  console.log('  Images: physicalDescription, profileBanner');
  console.log('  Name replacement: originalFirstName, originalLastName, originalHandle');
  console.log('  Trading: hasPool');
  console.log('');
  console.log('Optional runtime fields (set by game engine, not in JSON):');
  console.log('  role, initialLuck, initialMood, tradingBalance, reputationPoints, profileImageUrl');
  console.log('');
  console.log('Required fields in organizations:');
  console.log('  Core: id, name, type, description, profileDescription');
  console.log('  Behavior: postStyle, postExample, canBeInvolved');
  console.log('  Images: pfpDescription, bannerDescription');
  console.log('  Name replacement: originalName, originalHandle');
  console.log('  Trading: initialPrice');
}

cleanupActors();

