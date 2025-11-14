/**
 * OpenAPI Specification Generator
 * 
 * @module lib/swagger/generator
 */

import { swaggerDefinition } from './config';

/**
 * Generate complete OpenAPI specification
 * 
 * @description Generates the OpenAPI 3.0 specification for all API routes.
 * In a full implementation, this would scan all API routes and extract
 * their documentation. For now, it returns a base specification.
 * 
 * @returns {object} Complete OpenAPI 3.0 specification
 * 
 * @example
 * ```typescript
 * const spec = generateOpenApiSpec();
 * console.log(spec.info.title); // 'Babylon API'
 * ```
 */
export function generateOpenApiSpec() {
  // Base specification from config
  const spec = {
    ...swaggerDefinition,
    paths: {
      '/api/docs': {
        get: {
          summary: 'Get OpenAPI specification',
          description: 'Returns the complete OpenAPI specification for all API routes',
          tags: ['Documentation'],
          responses: {
            200: {
              description: 'OpenAPI specification',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                  },
                },
              },
            },
          },
        },
      },
      '/api/health': {
        get: {
          summary: 'Health check',
          description: 'Check API health status',
          tags: ['System'],
          responses: {
            200: {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/posts': {
        get: {
          summary: 'Get posts feed',
          description: 'Retrieve paginated posts from the feed',
          tags: ['Posts'],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              description: 'Number of posts to return',
              schema: { type: 'integer', default: 20 },
            },
            {
              name: 'offset',
              in: 'query',
              description: 'Number of posts to skip',
              schema: { type: 'integer', default: 0 },
            },
          ],
          responses: {
            200: {
              description: 'List of posts',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      posts: {
                        type: 'array',
                        items: { type: 'object' },
                      },
                      hasMore: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: 'Create a new post',
          description: 'Create a new post in the feed',
          tags: ['Posts'],
          security: [{ PrivyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    content: { type: 'string' },
                    type: { type: 'string', enum: ['post', 'article'] },
                  },
                  required: ['content'],
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Post created successfully',
            },
            401: {
              description: 'Unauthorized',
            },
          },
        },
      },
      '/api/users/me': {
        get: {
          summary: 'Get current user',
          description: 'Get the authenticated user profile',
          tags: ['Users'],
          security: [{ PrivyAuth: [] }],
          responses: {
            200: {
              description: 'User profile',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      username: { type: 'string' },
                      displayName: { type: 'string' },
                      bio: { type: 'string' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized',
            },
          },
        },
      },
    },
    tags: [
      { name: 'Documentation', description: 'API documentation endpoints' },
      { name: 'System', description: 'System and health check endpoints' },
      { name: 'Posts', description: 'Post management endpoints' },
      { name: 'Users', description: 'User management endpoints' },
      { name: 'Markets', description: 'Prediction market endpoints' },
    ],
  };

  return spec;
}

