#!/usr/bin/env bun
/**
 * Comprehensive Data Validation Script
 * 
 * Validates all individual actor, organization, and relationship files
 * Ensures they all work together with no problems:
 * - Index file references match actual files
 * - All files are valid JSON
 * - All required fields are present
 * - All relationships reference valid actors
 * - Alphabetical ordering of relationship filenames
 * - No orphaned files
 * - Data consistency across all files
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { logger } from '../src/lib/logger';
import { z } from 'zod';

// Schemas
const ActorSchema = z.object({
  id: z.string(),
  name: z.string(),
  realName: z.string(),
  username: z.string(),
  description: z.string(),
  profileDescription: z.string().optional(),
  domain: z.array(z.string()),
  personality: z.string(),
  tier: z.string(),
  affiliations: z.array(z.string()),
  postStyle: z.string(),
  postExample: z.array(z.string()),
  hasPool: z.boolean(),
  physicalDescription: z.string().optional(),
  profileBanner: z.string().optional(),
  originalFirstName: z.string(),
  originalLastName: z.string(),
  originalHandle: z.string(),
});

const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  profileDescription: z.string().optional(),
  type: z.string(), // Allow any type string - we have: company, media, government, financial, vc, movement, social_platform, organization
  canBeInvolved: z.boolean().optional(),
  postStyle: z.string().optional(),
  postExample: z.array(z.string()).optional(),
  initialPrice: z.number().optional(),
  pfpDescription: z.string().optional(),
  bannerDescription: z.string().optional(),
  originalName: z.string().optional(),
  originalHandle: z.string().optional(),
});

const RelationshipSchema = z.object({
  actor1Id: z.string(),
  actor2Id: z.string(),
  relationshipType: z.string(),
  strength: z.number().min(0).max(1),
  sentiment: z.number().min(-1).max(1),
  history: z.string(),
  actor1FollowsActor2: z.boolean(),
  actor2FollowsActor1: z.boolean(),
});

const IndexReferenceSchema = z.object({
  id: z.string(),
  file: z.string(),
});

const ActorsIndexSchema = z.object({
  actors: z.array(IndexReferenceSchema),
  organizations: z.array(IndexReferenceSchema),
  relationships: z.array(IndexReferenceSchema).optional(),
});

interface ValidationError {
  type: 'error' | 'warning';
  category: string;
  message: string;
  file?: string;
}

class DataValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private dataDir: string;

  constructor() {
    this.dataDir = join(process.cwd(), 'public', 'data');
  }

  /**
   * Add an error
   */
  private addError(category: string, message: string, file?: string) {
    this.errors.push({ type: 'error', category, message, file });
    logger.error(`[${category}] ${message}`, { file }, 'DataValidator');
  }

  /**
   * Add a warning
   */
  private addWarning(category: string, message: string, file?: string) {
    this.warnings.push({ type: 'warning', category, message, file });
    logger.warn(`[${category}] ${message}`, { file }, 'DataValidator');
  }

  /**
   * Validate index file exists and is valid JSON
   */
  validateIndexFile(): z.infer<typeof ActorsIndexSchema> | null {
    const indexPath = join(this.dataDir, 'actors.json');

    if (!existsSync(indexPath)) {
      this.addError('INDEX', 'actors.json not found', indexPath);
      return null;
    }

    let indexData: unknown;
    try {
      indexData = JSON.parse(readFileSync(indexPath, 'utf-8'));
    } catch (error) {
      this.addError('INDEX', `Invalid JSON: ${error}`, indexPath);
      return null;
    }

    try {
      return ActorsIndexSchema.parse(indexData);
    } catch (error) {
      this.addError('INDEX', `Schema validation failed: ${error}`, indexPath);
      return null;
    }
  }

  /**
   * Validate all actor files
   */
  validateActors(actorRefs: z.infer<typeof IndexReferenceSchema>[]): Set<string> {
    const validActorIds = new Set<string>();
    const actorsDir = join(this.dataDir, 'actors');

    logger.info(`Validating ${actorRefs.length} actor files...`, undefined, 'DataValidator');

    // Check directory exists
    if (!existsSync(actorsDir)) {
      this.addError('ACTORS', 'actors/ directory not found', actorsDir);
      return validActorIds;
    }

    // Validate each actor from index
    for (const ref of actorRefs) {
      const filePath = join(this.dataDir, ref.file);

      // Check file exists
      if (!existsSync(filePath)) {
        this.addError('ACTORS', `File not found for actor ${ref.id}`, ref.file);
        continue;
      }

      // Validate JSON
      let actorData: unknown;
      try {
        actorData = JSON.parse(readFileSync(filePath, 'utf-8'));
      } catch (error) {
        this.addError('ACTORS', `Invalid JSON for actor ${ref.id}: ${error}`, ref.file);
        continue;
      }

      // Validate schema
      try {
        const actor = ActorSchema.parse(actorData);

        // Verify ID matches filename
        if (actor.id !== ref.id) {
          this.addError('ACTORS', `Actor ID mismatch: file has ${ref.id}, data has ${actor.id}`, ref.file);
        }

        // Verify filename matches expected pattern
        const expectedFile = `./actors/${ref.id}.json`;
        if (ref.file !== expectedFile) {
          this.addWarning('ACTORS', `File path mismatch: expected ${expectedFile}, got ${ref.file}`, ref.file);
        }

        validActorIds.add(actor.id);
      } catch (error) {
        this.addError('ACTORS', `Schema validation failed for ${ref.id}: ${error}`, ref.file);
      }
    }

    // Check for orphaned files (files not in index)
    const filesOnDisk = readdirSync(actorsDir).filter(f => f.endsWith('.json'));
    const referencedFiles = actorRefs.map(ref => ref.file.replace('./actors/', ''));

    for (const file of filesOnDisk) {
      if (!referencedFiles.includes(file)) {
        this.addWarning('ACTORS', `Orphaned file not referenced in index: ${file}`, `actors/${file}`);
      }
    }

    logger.info(`✓ Validated ${validActorIds.size} actors`, undefined, 'DataValidator');
    return validActorIds;
  }

  /**
   * Validate all organization files
   */
  validateOrganizations(orgRefs: z.infer<typeof IndexReferenceSchema>[]): Set<string> {
    const validOrgIds = new Set<string>();
    const orgsDir = join(this.dataDir, 'organizations');

    logger.info(`Validating ${orgRefs.length} organization files...`, undefined, 'DataValidator');

    if (!existsSync(orgsDir)) {
      this.addError('ORGANIZATIONS', 'organizations/ directory not found', orgsDir);
      return validOrgIds;
    }

    for (const ref of orgRefs) {
      const filePath = join(this.dataDir, ref.file);

      if (!existsSync(filePath)) {
        this.addError('ORGANIZATIONS', `File not found for org ${ref.id}`, ref.file);
        continue;
      }

      let orgData: unknown;
      try {
        orgData = JSON.parse(readFileSync(filePath, 'utf-8'));
      } catch (error) {
        this.addError('ORGANIZATIONS', `Invalid JSON for org ${ref.id}: ${error}`, ref.file);
        continue;
      }

      try {
        const org = OrganizationSchema.parse(orgData);

        if (org.id !== ref.id) {
          this.addError('ORGANIZATIONS', `Org ID mismatch: file has ${ref.id}, data has ${org.id}`, ref.file);
        }

        const expectedFile = `./organizations/${ref.id}.json`;
        if (ref.file !== expectedFile) {
          this.addWarning('ORGANIZATIONS', `File path mismatch: expected ${expectedFile}, got ${ref.file}`, ref.file);
        }

        validOrgIds.add(org.id);
      } catch (error) {
        this.addError('ORGANIZATIONS', `Schema validation failed for ${ref.id}: ${error}`, ref.file);
      }
    }

    // Check for orphaned files
    const filesOnDisk = readdirSync(orgsDir).filter(f => f.endsWith('.json'));
    const referencedFiles = orgRefs.map(ref => ref.file.replace('./organizations/', ''));

    for (const file of filesOnDisk) {
      if (!referencedFiles.includes(file)) {
        this.addWarning('ORGANIZATIONS', `Orphaned file not referenced in index: ${file}`, `organizations/${file}`);
      }
    }

    logger.info(`✓ Validated ${validOrgIds.size} organizations`, undefined, 'DataValidator');
    return validOrgIds;
  }

  /**
   * Validate all relationship files
   */
  validateRelationships(
    relRefs: z.infer<typeof IndexReferenceSchema>[] | undefined,
    validActorIds: Set<string>
  ): number {
    if (!relRefs || relRefs.length === 0) {
      logger.info('No relationships to validate (optional)', undefined, 'DataValidator');
      return 0;
    }

    const relsDir = join(this.dataDir, 'relationships');

    logger.info(`Validating ${relRefs.length} relationship files...`, undefined, 'DataValidator');

    if (!existsSync(relsDir)) {
      this.addError('RELATIONSHIPS', 'relationships/ directory not found', relsDir);
      return 0;
    }

    let validCount = 0;

    for (const ref of relRefs) {
      const filePath = join(this.dataDir, ref.file);

      if (!existsSync(filePath)) {
        this.addError('RELATIONSHIPS', `File not found for relationship ${ref.id}`, ref.file);
        continue;
      }

      let relData: unknown;
      try {
        relData = JSON.parse(readFileSync(filePath, 'utf-8'));
      } catch (error) {
        this.addError('RELATIONSHIPS', `Invalid JSON for relationship ${ref.id}: ${error}`, ref.file);
        continue;
      }

      try {
        const rel = RelationshipSchema.parse(relData);

        // Verify actor IDs exist
        if (!validActorIds.has(rel.actor1Id)) {
          this.addError('RELATIONSHIPS', `actor1Id "${rel.actor1Id}" not found in actors`, ref.file);
        }
        if (!validActorIds.has(rel.actor2Id)) {
          this.addError('RELATIONSHIPS', `actor2Id "${rel.actor2Id}" not found in actors`, ref.file);
        }

        // Verify alphabetical ordering of filename
        const ids = [rel.actor1Id, rel.actor2Id].sort();
        const expectedFileName = `${ids[0]}_${ids[1]}.json`;
        const actualFileName = ref.file.replace('./relationships/', '');

        if (actualFileName !== expectedFileName) {
          this.addError(
            'RELATIONSHIPS',
            `Filename not alphabetically ordered: expected ${expectedFileName}, got ${actualFileName}`,
            ref.file
          );
        }

        // Verify ID matches filename pattern
        const expectedId = expectedFileName.replace('.json', '');
        if (ref.id !== expectedId) {
          this.addError('RELATIONSHIPS', `ID mismatch: expected ${expectedId}, got ${ref.id}`, ref.file);
        }

        // Verify actor IDs in file match the alphabetical order
        if (rel.actor1Id > rel.actor2Id) {
          this.addError(
            'RELATIONSHIPS',
            `Actor IDs not in alphabetical order in file: ${rel.actor1Id} should come after ${rel.actor2Id}`,
            ref.file
          );
        }

        validCount++;
      } catch (error) {
        this.addError('RELATIONSHIPS', `Schema validation failed for ${ref.id}: ${error}`, ref.file);
      }
    }

    // Check for orphaned files
    const filesOnDisk = readdirSync(relsDir).filter(f => f.endsWith('.json'));
    const referencedFiles = relRefs.map(ref => ref.file.replace('./relationships/', ''));

    for (const file of filesOnDisk) {
      if (!referencedFiles.includes(file)) {
        this.addWarning('RELATIONSHIPS', `Orphaned file not referenced in index: ${file}`, `relationships/${file}`);
      }
    }

    logger.info(`✓ Validated ${validCount} relationships`, undefined, 'DataValidator');
    return validCount;
  }

  /**
   * Validate actor affiliations reference valid organizations
   */
  validateAffiliations(actorRefs: z.infer<typeof IndexReferenceSchema>[], validOrgIds: Set<string>) {
    logger.info('Validating actor affiliations...', undefined, 'DataValidator');

    let checkedCount = 0;

    for (const ref of actorRefs) {
      const filePath = join(this.dataDir, ref.file);

      if (!existsSync(filePath)) continue;

      try {
        const actor = ActorSchema.parse(JSON.parse(readFileSync(filePath, 'utf-8')));

        if (actor.affiliations && Array.isArray(actor.affiliations)) {
          for (const orgId of actor.affiliations) {
            if (!validOrgIds.has(orgId)) {
              this.addError(
                'AFFILIATIONS',
                `Actor ${actor.name} (${actor.id}) has invalid affiliation: "${orgId}"`,
                ref.file
              );
            }
          }
        }
        checkedCount++;
      } catch {
        // Skip actors that failed schema validation (already reported)
      }
    }

    logger.info(`✓ Validated affiliations for ${checkedCount} actors`, undefined, 'DataValidator');
  }

  /**
   * Validate no duplicate IDs
   */
  validateUniqueIds(
    actorRefs: z.infer<typeof IndexReferenceSchema>[],
    orgRefs: z.infer<typeof IndexReferenceSchema>[],
    relRefs: z.infer<typeof IndexReferenceSchema>[] | undefined
  ) {
    logger.info('Validating unique IDs...', undefined, 'DataValidator');

    // Check actor ID uniqueness
    const actorIds = new Set<string>();
    const actorDuplicates: string[] = [];
    for (const ref of actorRefs) {
      if (actorIds.has(ref.id)) {
        actorDuplicates.push(ref.id);
      }
      actorIds.add(ref.id);
    }
    if (actorDuplicates.length > 0) {
      this.addError('UNIQUE_IDS', `Duplicate actor IDs: ${actorDuplicates.join(', ')}`);
    }

    // Check organization ID uniqueness
    const orgIds = new Set<string>();
    const orgDuplicates: string[] = [];
    for (const ref of orgRefs) {
      if (orgIds.has(ref.id)) {
        orgDuplicates.push(ref.id);
      }
      orgIds.add(ref.id);
    }
    if (orgDuplicates.length > 0) {
      this.addError('UNIQUE_IDS', `Duplicate organization IDs: ${orgDuplicates.join(', ')}`);
    }

    // Check relationship ID uniqueness
    if (relRefs) {
      const relIds = new Set<string>();
      const relDuplicates: string[] = [];
      for (const ref of relRefs) {
        if (relIds.has(ref.id)) {
          relDuplicates.push(ref.id);
        }
        relIds.add(ref.id);
      }
      if (relDuplicates.length > 0) {
        this.addError('UNIQUE_IDS', `Duplicate relationship IDs: ${relDuplicates.join(', ')}`);
      }
    }

    logger.info('✓ Unique IDs validated', undefined, 'DataValidator');
  }

  /**
   * Validate relationship consistency
   */
  validateRelationshipConsistency(
    relRefs: z.infer<typeof IndexReferenceSchema>[] | undefined,
    validActorIds: Set<string>
  ) {
    if (!relRefs || relRefs.length === 0) return;

    logger.info('Validating relationship consistency...', undefined, 'DataValidator');

    const relationshipPairs = new Set<string>();

    for (const ref of relRefs) {
      const filePath = join(this.dataDir, ref.file);
      if (!existsSync(filePath)) continue;

      try {
        const rel = RelationshipSchema.parse(JSON.parse(readFileSync(filePath, 'utf-8')));

        // Check for duplicate relationships (same pair)
        const ids = [rel.actor1Id, rel.actor2Id].sort();
        const pairKey = `${ids[0]}_${ids[1]}`;

        if (relationshipPairs.has(pairKey)) {
          this.addError('RELATIONSHIPS', `Duplicate relationship for pair: ${pairKey}`, ref.file);
        }
        relationshipPairs.add(pairKey);

        // Verify both actors exist
        if (!validActorIds.has(rel.actor1Id)) {
          this.addError('RELATIONSHIPS', `Unknown actor1Id: ${rel.actor1Id}`, ref.file);
        }
        if (!validActorIds.has(rel.actor2Id)) {
          this.addError('RELATIONSHIPS', `Unknown actor2Id: ${rel.actor2Id}`, ref.file);
        }

        // Verify actor IDs are different (no self-relationships)
        if (rel.actor1Id === rel.actor2Id) {
          this.addError('RELATIONSHIPS', `Self-relationship detected: ${rel.actor1Id}`, ref.file);
        }

        // Verify valid relationship type
        const validTypes = [
          'mentor-student',
          'industry-leader-follower',
          'influencer-fan',
          'allies',
          'collaborators',
          'co-founders',
          'business-partners',
          'rivals',
          'competitors',
          'frenemies',
          'critic-subject',
          'watchdog-target',
          'regulator-regulated',
          'friends',
          'acquaintances',
          'former-colleagues',
        ];

        if (!validTypes.includes(rel.relationshipType)) {
          this.addWarning('RELATIONSHIPS', `Unknown relationship type: ${rel.relationshipType}`, ref.file);
        }

        // Validate value ranges
        if (rel.strength < 0 || rel.strength > 1) {
          this.addError('RELATIONSHIPS', `Invalid strength value: ${rel.strength} (must be 0-1)`, ref.file);
        }
        if (rel.sentiment < -1 || rel.sentiment > 1) {
          this.addError('RELATIONSHIPS', `Invalid sentiment value: ${rel.sentiment} (must be -1 to 1)`, ref.file);
        }

      } catch {
        // Skip relationships that failed schema validation (already reported)
      }
    }

    logger.info('✓ Relationship consistency validated', undefined, 'DataValidator');
  }

  /**
   * Validate file structure integrity
   */
  validateFileStructure() {
    logger.info('Validating file structure...', undefined, 'DataValidator');

    const requiredDirs = ['actors', 'organizations'];
    const optionalDirs = ['relationships'];

    for (const dir of requiredDirs) {
      const dirPath = join(this.dataDir, dir);
      if (!existsSync(dirPath)) {
        this.addError('STRUCTURE', `Required directory missing: ${dir}`, dirPath);
      } else if (!statSync(dirPath).isDirectory()) {
        this.addError('STRUCTURE', `Expected directory but found file: ${dir}`, dirPath);
      }
    }

    for (const dir of optionalDirs) {
      const dirPath = join(this.dataDir, dir);
      if (existsSync(dirPath) && !statSync(dirPath).isDirectory()) {
        this.addError('STRUCTURE', `Expected directory but found file: ${dir}`, dirPath);
      }
    }

    logger.info('✓ File structure validated', undefined, 'DataValidator');
  }

  /**
   * Run all validations
   */
  async validateAll(): Promise<boolean> {
    logger.info('====================================', undefined, 'DataValidator');
    logger.info('COMPREHENSIVE DATA VALIDATION', undefined, 'DataValidator');
    logger.info('====================================', undefined, 'DataValidator');

    // 1. Validate file structure
    this.validateFileStructure();

    // 2. Validate index file
    const index = this.validateIndexFile();
    if (!index) {
      logger.error('❌ Index file validation failed - cannot continue', undefined, 'DataValidator');
      return false;
    }

    // 3. Validate actors
    const validActorIds = this.validateActors(index.actors);

    // 4. Validate organizations
    const validOrgIds = this.validateOrganizations(index.organizations);

    // 5. Validate affiliations
    this.validateAffiliations(index.actors, validOrgIds);

    // 6. Validate relationships (if present)
    if (index.relationships) {
      this.validateRelationships(index.relationships, validActorIds);
      this.validateRelationshipConsistency(index.relationships, validActorIds);
    }

    // 7. Validate unique IDs
    this.validateUniqueIds(index.actors, index.organizations, index.relationships);

    // Print summary
    logger.info('====================================', undefined, 'DataValidator');
    logger.info('VALIDATION SUMMARY', undefined, 'DataValidator');
    logger.info('====================================', undefined, 'DataValidator');
    logger.info(`Actors validated: ${validActorIds.size}/${index.actors.length}`, undefined, 'DataValidator');
    logger.info(`Organizations validated: ${validOrgIds.size}/${index.organizations.length}`, undefined, 'DataValidator');
    logger.info(`Relationships validated: ${index.relationships?.length || 0}`, undefined, 'DataValidator');
    logger.info(`Errors: ${this.errors.length}`, undefined, 'DataValidator');
    logger.info(`Warnings: ${this.warnings.length}`, undefined, 'DataValidator');

    if (this.errors.length > 0) {
      logger.error('====================================', undefined, 'DataValidator');
      logger.error('ERRORS FOUND', undefined, 'DataValidator');
      logger.error('====================================', undefined, 'DataValidator');
      this.errors.forEach(err => {
        logger.error(`[${err.category}] ${err.message}`, { file: err.file }, 'DataValidator');
      });
    }

    if (this.warnings.length > 0) {
      logger.warn('====================================', undefined, 'DataValidator');
      logger.warn('WARNINGS', undefined, 'DataValidator');
      logger.warn('====================================', undefined, 'DataValidator');
      this.warnings.forEach(warn => {
        logger.warn(`[${warn.category}] ${warn.message}`, { file: warn.file }, 'DataValidator');
      });
    }

    if (this.errors.length === 0) {
      logger.info('====================================', undefined, 'DataValidator');
      logger.info('✅ ALL VALIDATIONS PASSED', undefined, 'DataValidator');
      logger.info('====================================', undefined, 'DataValidator');
      return true;
    } else {
      logger.error('====================================', undefined, 'DataValidator');
      logger.error('❌ VALIDATION FAILED', undefined, 'DataValidator');
      logger.error('====================================', undefined, 'DataValidator');
      return false;
    }
  }
}

// Run validation
async function main() {
  const validator = new DataValidator();
  const success = await validator.validateAll();

  if (!success) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  logger.error('Validation script failed', { error }, 'DataValidator');
  process.exit(1);
});

