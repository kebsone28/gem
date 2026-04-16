/**
 * Vitest Configuration for Alerts Module
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/modules/alerts/__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/modules/alerts/**/*.js',
        '!src/modules/alerts/__tests__/**',
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
});
