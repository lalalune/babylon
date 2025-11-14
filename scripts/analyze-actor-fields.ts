import * as fs from 'fs';
import * as path from 'path';

interface ActorsData {
  actors: any[];
  organizations: any[];
}

// Fields that should be present based on usage analysis
const REQUIRED_ACTOR_FIELDS = new Set([
  // Core identity
  'id', 'name', 'realName', 'username', 'nickname', 'aliases',
  
  // Behavioral
  'description', 'profileDescription', 'domain', 'personality', 'quirks',
  'role', 'affiliations', 'postStyle', 'postExample', 'tier',
  
  // Game mechanics
  'initialLuck', 'initialMood', 'hasPool', 'tradingBalance', 'reputationPoints',
  
  // Posting permissions
  'canPostFeed', 'canPostGroups',
  
  // Image generation
  'physicalDescription', 'profileBanner',
  
  // Name replacement (newly added)
  'originalFirstName', 'originalLastName', 'originalHandle'
]);

const REQUIRED_ORG_FIELDS = new Set([
  // Core identity
  'id', 'name', 'originalName', 'originalHandle',
  
  // Description
  'description', 'profileDescription', 'type',
  
  // Behavioral
  'postStyle', 'postExample',
  
  // Image generation
  'pfpDescription', 'bannerDescription',
  
  // Game mechanics
  'canBeInvolved', 'initialPrice'
]);

function analyzeActors() {
  const actorsPath = path.join(process.cwd(), 'public/data/actors.json');
  const data: ActorsData = JSON.parse(fs.readFileSync(actorsPath, 'utf-8'));
  
  console.log('=== ACTOR FIELD ANALYSIS ===\n');
  
  // Collect all fields used across all actors
  const allActorFields = new Set<string>();
  for (const actor of data.actors) {
    Object.keys(actor).forEach(key => allActorFields.add(key));
  }
  
  // Find fields not in required set
  const extraActorFields = Array.from(allActorFields).filter(f => !REQUIRED_ACTOR_FIELDS.has(f));
  
  console.log('Extra actor fields (not documented as required):');
  if (extraActorFields.length === 0) {
    console.log('  ✓ None');
  } else {
    extraActorFields.forEach(f => {
      const count = data.actors.filter(a => a[f] !== undefined).length;
      console.log(`  - ${f} (present in ${count}/${data.actors.length} actors)`);
    });
  }
  
  // Find required fields missing from some actors
  console.log('\nMissing required fields:');
  let missingCount = 0;
  for (const field of REQUIRED_ACTOR_FIELDS) {
    const actorsMissing = data.actors.filter(a => a[field] === undefined || a[field] === null || a[field] === '');
    if (actorsMissing.length > 0) {
      missingCount++;
      console.log(`  - ${field} missing from ${actorsMissing.length} actors:`);
      actorsMissing.slice(0, 5).forEach(a => console.log(`    • ${a.name}`));
      if (actorsMissing.length > 5) {
        console.log(`    ... and ${actorsMissing.length - 5} more`);
      }
    }
  }
  if (missingCount === 0) {
    console.log('  ✓ None');
  }
  
  console.log('\n=== ORGANIZATION FIELD ANALYSIS ===\n');
  
  // Collect all fields used across all organizations
  const allOrgFields = new Set<string>();
  for (const org of data.organizations) {
    Object.keys(org).forEach(key => allOrgFields.add(key));
  }
  
  // Find fields not in required set
  const extraOrgFields = Array.from(allOrgFields).filter(f => !REQUIRED_ORG_FIELDS.has(f));
  
  console.log('Extra organization fields (not documented as required):');
  if (extraOrgFields.length === 0) {
    console.log('  ✓ None');
  } else {
    extraOrgFields.forEach(f => {
      const count = data.organizations.filter(o => o[f] !== undefined).length;
      console.log(`  - ${f} (present in ${count}/${data.organizations.length} orgs)`);
    });
  }
  
  // Find required fields missing from some orgs
  console.log('\nMissing required fields:');
  missingCount = 0;
  for (const field of REQUIRED_ORG_FIELDS) {
    const orgsMissing = data.organizations.filter(o => o[field] === undefined || o[field] === null || o[field] === '');
    if (orgsMissing.length > 0) {
      missingCount++;
      console.log(`  - ${field} missing from ${orgsMissing.length} orgs:`);
      orgsMissing.slice(0, 5).forEach(o => console.log(`    • ${o.name}`));
      if (orgsMissing.length > 5) {
        console.log(`    ... and ${orgsMissing.length - 5} more`);
      }
    }
  }
  if (missingCount === 0) {
    console.log('  ✓ None');
  }
  
  console.log('\n=== FIELD CONSOLIDATION SUGGESTIONS ===\n');
  
  // Check for redundant fields
  const redundancies = [
    { fields: ['description', 'profileDescription'], suggestion: 'Consider if both are needed or can be merged' },
    { fields: ['aliases', 'nickname'], suggestion: 'nickname could be an alias' },
    { fields: ['domain', 'role', 'tier'], suggestion: 'Consider if all three categorizations are needed' },
  ];
  
  for (const { fields, suggestion } of redundancies) {
    console.log(`${fields.join(' + ')}: ${suggestion}`);
  }
}

analyzeActors();

