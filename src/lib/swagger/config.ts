/**
 * Swagger/OpenAPI Configuration
 * 
 * @module lib/swagger/config
 */

/**
 * Base OpenAPI specification definition
 */
export const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Babylon API',
    version: '1.0.0',
    description: 'API documentation for Babylon social conspiracy game',
    contact: {
      name: 'API Support',
      url: 'https://github.com/elizaos/babylon',
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      PrivyAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Privy authentication token',
      },
      CronSecret: {
        type: 'http',
        scheme: 'bearer',
        description: 'Cron secret for scheduled jobs (CRON_SECRET environment variable)',
      },
    },
  },
};

/**
 * Swagger UI options
 */
export const swaggerOptions = {
  swaggerDefinition,
  apis: ['./src/app/api/**/*.ts'],
};

