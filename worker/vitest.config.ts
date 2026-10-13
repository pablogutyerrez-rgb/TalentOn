import { defineConfig } from 'vitest/config';

// The Worker installs and tests independently of the React application in CI.
export default defineConfig({ test: { environment: 'node', include: ['tests/**/*.test.ts'] } });
