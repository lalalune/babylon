/**
 * Swagger/OpenAPI Utilities
 * 
 * @module lib/swagger
 */

export { swaggerDefinition, swaggerOptions } from './config';
export { generateOpenApiSpec } from './generator'; // Manual generator (legacy)
export { generateAutoSpec } from './auto-generator'; // Automated generator (preferred)
export type { OpenAPIRoute, OpenAPIParameter, OpenAPIResponse } from './types';



