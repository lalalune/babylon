import * as fs from 'fs';
import * as path from 'path';

// Map of invalid affiliations to correct org IDs
const AFFILIATION_FIXES: Record<string, string> = {
  'aix': 'xai',
  'neurailink': 'neuralink',
  'opnai': 'openai',
  'Terminal-organization': 'trump-organization',
  'ainbc': 'msainbc',
  'lex-friedman-lobotomy': '', // Remove - doesn't exist
  'cnbs': '', // Remove - doesn't exist (should be cnbc but not in org list)
  'dark-horseshit-podcast': '', // Remove - doesn't exist
  'twaitch': '', // Remove - doesn't exist
  'cnnai': '', // Remove - doesn't exist
  'fAIx-news': 'faux-news',
};

function fixAffiliations() {
  const actorsPath = path.join(process.cwd(), 'public/data/actors.json');
  const data = JSON.parse(fs.readFileSync(actorsPath, 'utf-8'));
  
  const orgIds = new Set(data.organizations.map((o: any) => o.id));
  
  console.log('=== FIXING ACTOR AFFILIATIONS ===\n');
  
  let fixedCount = 0;
  
  for (const actor of data.actors) {
    if (actor.affiliations && Array.isArray(actor.affiliations)) {
      const fixedAffiliations: string[] = [];
      
      for (const aff of actor.affiliations) {
        if (!orgIds.has(aff)) {
          const fix = AFFILIATION_FIXES[aff];
          if (fix === '') {
            console.log(`${actor.name}: Removing invalid affiliation '${aff}'`);
            fixedCount++;
          } else if (fix && orgIds.has(fix)) {
            console.log(`${actor.name}: Fixing '${aff}' → '${fix}'`);
            fixedAffiliations.push(fix);
            fixedCount++;
          } else {
            console.log(`${actor.name}: WARNING - No fix for '${aff}'`);
            fixedAffiliations.push(aff); // Keep it
          }
        } else {
          fixedAffiliations.push(aff); // Valid, keep it
        }
      }
      
      actor.affiliations = fixedAffiliations;
    }
  }
  
  console.log(`\n✅ Fixed ${fixedCount} affiliations`);
  
  // Write back
  fs.writeFileSync(actorsPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log('✅ Updated actors.json');
}

fixAffiliations();

