/**
 * Swagger UI Documentation Page
 * 
 * @description Interactive API documentation using Swagger UI
 * 
 * @page /api-docs
 * @access Public
 */

'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

/**
 * API Documentation Page Component
 * 
 * @description Renders the Swagger UI with the generated OpenAPI specification
 * 
 * @returns {JSX.Element} Swagger UI documentation page
 */
export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Babylon API Documentation</h1>
          <p className="text-muted-foreground">
            Complete API reference for the Babylon social conspiracy game
          </p>
        </div>
        
        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          <SwaggerUI 
            url="/api/docs" 
            docExpansion="list"
            defaultModelsExpandDepth={1}
            defaultModelExpandDepth={1}
            displayRequestDuration={true}
            filter={true}
            showExtensions={true}
            showCommonExtensions={true}
            tryItOutEnabled={true}
          />
        </div>
      </div>
    </div>
  );
}







