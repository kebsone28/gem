import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: dirname,
  test: {
    include: ['tests/**/*.test.{ts,tsx,js,jsx}', 'src/**/*.test.{ts,tsx,js,jsx}'],
    exclude: ['e2e/**', 'tmp_ai_test/**', 'node_modules/**'],
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
