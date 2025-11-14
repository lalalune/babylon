// @ts-nocheck

import * as fs from 'fs';
import * as path from 'path';

interface Actor {
  id: string;
  name: string;
  realName: string;
  username: string;
  originalFirstName: string;
  originalLastName: string;
  originalHandle: string;
  [key: string]: any;
}

interface Organization {
  id: string;
  name: string;
  originalName: string;
  originalHandle: string;
  [key: string]: any;
}

interface ActorsData {
  actors: Actor[];
  organizations: Organization[];
}

interface ReplacementPattern {
  pattern: RegExp;
  replacement: string;
  description: string;
}

// Helper function to match case of original string
function matchCase(original: string, replacement: string): string {
  if (original === original.toUpperCase()) {
    return replacement.toUpperCase();
  }
  if (original === original.toLowerCase()) {
    return replacement.toLowerCase();
  }
  if (original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1).toLowerCase();
  }
  return replacement;
}

export class NameReplacer {
  private patterns: ReplacementPattern[] = [];
  private actorsData: ActorsData;

  constructor(actorsJsonPath: string) {
    this.actorsData = JSON.parse(fs.readFileSync(actorsJsonPath, 'utf-8'));
    this.buildPatterns();
  }

  private buildPatterns(): void {
    // Process actors
    for (const actor of this.actorsData.actors) {
      const { originalFirstName, originalLastName, originalHandle } = actor;
      const firstName = actor.name.split(' ')[0];
      const lastName = actor.name.split(' ').slice(1).join(' ');
      
      if (!originalFirstName || !originalLastName) continue;

      // Full name patterns (FirstLast, Firstlast, firstlast, FIRSTLAST)
      const fullOriginal = `${originalFirstName}${originalLastName}`;
      const fullReplacement = `${firstName}${lastName}`.replace(/\s+/g, '');
      
      // Full name with space (First Last, first last, FIRST LAST)
      const fullWithSpaceOriginal = `${originalFirstName} ${originalLastName}`;
      const fullWithSpaceReplacement = actor.name;
      
      // Add patterns for all case variations
      this.addPattern(fullOriginal, fullReplacement, `Full name: ${fullOriginal}`);
      this.addPattern(fullWithSpaceOriginal, fullWithSpaceReplacement, `Full name with space: ${fullWithSpaceOriginal}`);
      
      // First name only patterns (First, first, FIRST)
      this.addPattern(originalFirstName, firstName, `First name: ${originalFirstName}`);
      
      // Last name only patterns (Last, last, LAST)
      this.addPattern(originalLastName, lastName, `Last name: ${originalLastName}`);
      
      // Handle patterns (@handle)
      if (originalHandle) {
        this.addPattern(`@${originalHandle}`, `@${actor.username}`, `Handle: @${originalHandle}`);
        this.addPattern(originalHandle, actor.username, `Handle without @: ${originalHandle}`);
      }
    }

    // Process organizations
    for (const org of this.actorsData.organizations) {
      const { originalName, originalHandle } = org;
      
      if (!originalName) continue;

      // Organization name patterns (handle all cases)
      this.addPattern(originalName, org.name, `Org name: ${originalName}`);
      
      // Remove spaces for combined patterns
      const originalNoSpace = originalName.replace(/\s+/g, '');
      const replacementNoSpace = org.name.replace(/\s+/g, '');
      
      if (originalNoSpace !== originalName) {
        this.addPattern(originalNoSpace, replacementNoSpace, `Org name no space: ${originalNoSpace}`);
      }
      
      // Handle patterns
      if (originalHandle) {
        this.addPattern(`@${originalHandle}`, `@${org.id}`, `Org handle: @${originalHandle}`);
        this.addPattern(originalHandle, org.id, `Org handle without @: ${originalHandle}`);
      }
    }

    // Sort patterns by length (longest first) to handle overlapping patterns correctly
    this.patterns.sort((a, b) => {
      const aLen = a.pattern.source.length;
      const bLen = b.pattern.source.length;
      return bLen - aLen;
    });
  }

  private addPattern(original: string, replacement: string, description: string): void {
    // Escape special regex characters in the original string
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Create patterns for different cases
    const cases = [
      { pattern: escaped, replacement },  // Original case
      { pattern: escaped.toLowerCase(), replacement: replacement.toLowerCase() },  // lowercase
      { pattern: escaped.toUpperCase(), replacement: replacement.toUpperCase() },  // UPPERCASE
      // Title Case
      { 
        pattern: escaped[0]?.toUpperCase() + escaped.slice(1).toLowerCase(), 
        replacement: replacement[0]?.toUpperCase() + replacement.slice(1).toLowerCase() 
      }
    ];

    for (const { pattern, replacement: rep } of cases) {
      // Use word boundaries to avoid partial matches, except for @handles
      const boundaryPattern = pattern.startsWith('@') 
        ? new RegExp(pattern, 'g')
        : new RegExp(`\\b${pattern}\\b`, 'g');
      
      this.patterns.push({
        pattern: boundaryPattern,
        replacement: rep,
        description: `${description} (case: ${pattern})`
      });
    }
  }

  public replaceInText(text: string): string {
    let result = text;
    
    for (const { pattern, replacement } of this.patterns) {
      result = result.replace(pattern, replacement);
    }
    
    return result;
  }

  public replaceInFile(filePath: string): { changed: boolean; original: string; modified: string } {
    const original = fs.readFileSync(filePath, 'utf-8');
    const modified = this.replaceInText(original);
    const changed = original !== modified;
    
    if (changed) {
      fs.writeFileSync(filePath, modified, 'utf-8');
    }
    
    return { changed, original, modified };
  }

  public getPatterns(): ReplacementPattern[] {
    return this.patterns;
  }
}

// CLI functionality
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx tsx name-replacer.ts <file-or-directory>');
    console.log('       npx tsx name-replacer.ts --test "text to test"');
    process.exit(1);
  }

  const actorsPath = path.join(process.cwd(), 'public/data/actors.json');
  const replacer = new NameReplacer(actorsPath);

  if (args[0] === '--test') {
    const testText = args.slice(1).join(' ');
    console.log('Original:', testText);
    console.log('Replaced:', replacer.replaceInText(testText));
  } else if (args[0] === '--show-patterns') {
    const patterns = replacer.getPatterns();
    console.log(`Total patterns: ${patterns.length}`);
    patterns.slice(0, 20).forEach(p => {
      console.log(`  ${p.pattern.source} -> ${p.replacement}`);
    });
    console.log('  ...');
  } else {
    const targetPath = path.resolve(args[0]);
    
    if (fs.statSync(targetPath).isDirectory()) {
      const files = getAllFiles(targetPath);
      let changedCount = 0;
      
      for (const file of files) {
        const result = replacer.replaceInFile(file);
        if (result.changed) {
          changedCount++;
          console.log(`✓ ${path.relative(process.cwd(), file)}`);
        }
      }
      
      console.log(`\n${changedCount} of ${files.length} files modified`);
    } else {
      const result = replacer.replaceInFile(targetPath);
      if (result.changed) {
        console.log(`✓ File modified: ${path.relative(process.cwd(), targetPath)}`);
      } else {
        console.log('No changes needed');
      }
    }
  }
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

export default NameReplacer;

