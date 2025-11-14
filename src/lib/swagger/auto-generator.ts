/**
 * Automated OpenAPI Specification Generator
 * 
 * @module lib/swagger/auto-generator
 * @description Automatically generates OpenAPI spec from @openapi tags in route files
 */

import swaggerJsdoc from 'swagger-jsdoc';
import { swaggerDefinition } from './config';
import type { Options } from 'swagger-jsdoc';

const options: Options = {
  definition: swaggerDefinition,
  // Scan all route files for @openapi JSDoc comments
  apis: [
    './src/app/api/**/*.ts',
    './src/app/api/**/*.tsx',
  ],
};

/**
 * Generate OpenAPI specification automatically from JSDoc comments
 * 
 * @description Scans all API route files for @openapi tags and generates
 * a complete OpenAPI 3.0 specification. This eliminates the need for manual
 * spec maintenance.
 * 
 * @returns {object} Complete OpenAPI 3.0 specification
 * 
 * @example
 * ```typescript
 * import { generateAutoSpec } from '@/lib/swagger/auto-generator';
 * 
 * const spec = generateAutoSpec();
 * console.log(spec.paths); // All documented paths
 * ```
 */
export async function generateAutoSpec() {
  try {
    return swaggerJsdoc(options);
  } catch (error) {
    console.error('Error generating OpenAPI spec:', error);
    
    // Fallback to manual spec if auto-generation fails
    console.warn('Falling back to manual specification');
    const { generateOpenApiSpec } = await import('./generator');
    return generateOpenApiSpec();
  }
}

