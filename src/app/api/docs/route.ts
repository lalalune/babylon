/**
 * OpenAPI Specification API Route
 * 
 * @description Serves the generated OpenAPI specification in JSON format
 * 
 * @route GET /api/docs
 * @access Public
 * @returns {object} OpenAPI 3.0 specification
 */

import { NextResponse } from 'next/server';
import { generateOpenApiSpec } from '@/lib/swagger';

/**
 * GET /api/docs
 * 
 * @description Returns the complete OpenAPI specification for all API routes
 * 
 * @returns {NextResponse} OpenAPI specification in JSON format
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/docs');
 * const spec = await response.json();
 * console.log(spec.paths); // All API paths
 * ```
 */
export async function GET() {
  const spec = generateOpenApiSpec();
  
  return NextResponse.json(spec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
}

