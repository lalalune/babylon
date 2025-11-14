import { createRequire } from 'module';

const require = createRequire(import.meta.url);

try {
  const { config: loadEnv } = require('dotenv');
  loadEnv();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') {
    throw error;
  }
}

const config = {
  schema: './prisma/schema.prisma',
};

export default config;
