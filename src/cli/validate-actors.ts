#!/usr/bin/env bun
/**
 * @fileoverview Actor Data Validation CLI
 * 
 * Validates actor database integrity before game generation. Ensures all actor
 * affiliations reference valid organizations to prevent orphaned references
 * and maintain data consistency.
 * 
 * **Validation Checks:**
 * 1. Schema validation (Zod schemas for actors and organizations)
 * 2. Affiliation integrity (all affiliations must reference existing orgs)
 * 3. Required field presence (realName, username)
 * 4. Organization ID validity
 * 
 * **Exit Codes:**
 * - 0: All validations passed
 * - 1: Validation errors found (details printed to stderr)
 * 
 * **Data Source:**
 * Loads from split actor/organization structure:
 * - `public/data/actors.json` (index file with references)
 * - `public/data/actors/*.json` (individual actor files)
 * - `public/data/organizations/*.json` (individual organization files)
 * 
 * @module cli/validate-actors
 * @category CLI - Validation
 * 
 * @example
 * ```bash
 * # Validate actors data
 * bun run src/cli/validate-actors.ts
 * 
 * # Successful output:
 * # Validating 64 actors against 52 organizations...
 * # All actor affiliations are valid!
 * # { actorsChecked: 64, organizationsVerified: 52, warnings: 0 }
 * 
 * # Failed output (exits with code 1):
 * # VALIDATION ERRORS:
 * # ❌ Actor1 has invalid affiliation: "nonexistent-org"
 * # Found 1 error(s)
 * ```
 * 
 * @see {@link generate-game.ts} which calls this validation internally
 * @since v0.1.0
 */

// readFileSync, join - not used
import { logger } from '@/lib/logger';
import { z } from 'zod';

const ActorSchema = z.object({
  id: z.string(),
  name: z.string(),
  realName: z.string().optional(),
  username: z.string().optional(),
  affiliations: z.array(z.string()),
});

const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
});

const ActorsDataSchema = z.object({
  actors: z.array(ActorSchema),
  organizations: z.array(OrganizationSchema),
});

/**
 * Main validation function that checks actor data integrity
 * 
 * Validates that all actor affiliations reference valid organization IDs
 * and checks for missing required fields.
 * 
 * **Validation Process:**
 * 1. Load actors data from split file structure (actors/, organizations/)
 * 2. Parse and validate with Zod schemas
 * 3. Build set of valid organization IDs
 * 4. Check each actor's affiliations
 * 5. Check for missing realName/username (warnings only)
 * 6. Exit with code 1 if any errors found
 * 
 * **Error Types:**
 * - Hard Errors (exit 1): Invalid affiliation references
 * - Warnings (continue): Missing optional fields
 * 
 * @throws {Error} Exits process with code 1 if validation fails
 * @returns {Promise<void>} Success (exit code 0) or error (exit code 1)
 * @example
 * ```typescript
 * // Called automatically when script runs
 * await validateActors();
 * // Checks all actors and exits with appropriate code
 * ```
 */
async function validateActors(): Promise<void> {
  let data: unknown;
  try {
    // Use the loader which handles the split file structure
    const { loadActorsData } = await import('@/lib/data/actors-loader');
    data = loadActorsData();
  } catch (error) {
    logger.error('Failed to load actors data', { error }, 'validate-actors')
    throw new Error(`Failed to load actors data: ${error}`)
  }
  const validatedData = ActorsDataSchema.parse(data);

  const { actors, organizations } = validatedData;
  
  // Build a set of valid organization IDs
  const validOrgIds = new Set(organizations.map(org => org.id));
  
  logger.info(`Validating ${actors.length} actors against ${organizations.length} organizations...`, undefined, 'CLI');

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check each actor
  for (const actor of actors) {
    // Check required fields
    if (!actor.realName) {
      warnings.push(`⚠️  ${actor.name} (${actor.id}) missing 'realName' field`);
    }
    if (!actor.username) {
      warnings.push(`⚠️  ${actor.name} (${actor.id}) missing 'username' field`);
    }

    // Check affiliations
    for (const affiliation of actor.affiliations) {
      if (!validOrgIds.has(affiliation)) {
        errors.push(
          `❌ ${actor.name} (${actor.id}) has invalid affiliation: "${affiliation}"`
        );
      }
    }
  }

  // Print warnings
  if (warnings.length > 0) {
    logger.warn('WARNINGS:', warnings, 'CLI');
  }

  // Print errors
  if (errors.length > 0) {
    logger.error('VALIDATION ERRORS:', errors, 'CLI');
    logger.error(`Found ${errors.length} error(s)`, undefined, 'CLI');
    process.exit(1);
  }

  // Success!
  logger.info('All actor affiliations are valid!', {
    actorsChecked: actors.length,
    organizationsVerified: organizations.length,
    warnings: warnings.length
  }, 'CLI');
}

// Run validation
validateActors().catch((error) => {
  logger.error('Validation failed', { error }, 'validate-actors');
  process.exit(1);
});
