import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '../../store/db': path.resolve(__dirname, 'db-stub.js'),
      '../../store/db.ts': path.resolve(__dirname, 'db-stub.js'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    lib: {
      entry: path.resolve(__dirname, 'ai-test-entry.ts'),
      name: 'aiTestEntry',
      fileName: 'ai-test',
    },
    rollupOptions: {
      external: [],
    },
    target: 'es2022',
    minify: false,
    sourcemap: false,
  },
});
