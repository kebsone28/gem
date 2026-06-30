/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
import path from 'node:path';
import type { IncomingMessage } from 'node:http';
import { fileURLToPath } from 'node:url';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// Robust env file loader to ensure the correct ports are loaded in vite.config.ts
import fs from 'node:fs';
const loadEnvFile = (filePath: string) => {
  if (!fs.existsSync(filePath)) return;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index === -1) return;
      const key = trimmed.substring(0, index).trim();
      let val = trimmed.substring(index + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    });
  } catch (e) {
    console.error(`Error loading env file ${filePath}:`, e);
  }
};

// Load env files in order of priority (local configs override parent configs)
loadEnvFile(path.resolve(dirname, '.env.local'));
loadEnvFile(path.resolve(dirname, '.env'));
loadEnvFile(path.resolve(dirname, '../backend/.env'));
loadEnvFile(path.resolve(dirname, '../.env'));

const apiProxyTarget = (
  process.env.VITE_API_PROXY_TARGET ||
  process.env.GEM_API_PROXY_TARGET ||
  `http://127.0.0.1:${process.env.GEM_API_PORT || process.env.PORT || '8888'}`
).replace(/\/$/, '');

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  root: dirname,
  publicDir: path.resolve(dirname, 'public'),
  cacheDir: path.resolve(dirname, 'node_modules/.vite'),
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-proquelec.png'],
      manifest: {
        name: 'PROQUELEC — GEM SaaS',
        short_name: 'PROQUELEC',
        description: "Plateforme d'Électrification de Masse — Mobile & Offline Ready",
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'logo-proquelec.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'logo-proquelec.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'logo-proquelec.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        skipWaiting: true,
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/@vite\//,
          /^\/@react-refresh$/,
          /^\/src\//,
          /^\/node_modules\//,
        ],
        // Exclure les images très volumineuses du precache
        globIgnores: [
          'assets/images/**/*.png',
          'assets/images/**/*.jpg',
          'assets/images/**/*.webp',
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/kf\.kobotoolbox\.org\/api\/v2\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'kobo-api-cache',
              matchOptions: {
                ignoreVary: true,
              },
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
          {
            // Cache pour nos propres tuiles vectorielles (MVT Households)
            urlPattern: /\/api\/geo\/mvt\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'households-mvt-cache',
              matchOptions: {
                ignoreVary: true,
              },
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              matchOptions: {
                ignoreVary: true,
              },
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
          {
            // Cache pour les fonds de carte (OpenFreeMap)
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  server: {
    port: 8889, // Isolated port for GEM frontend
    strictPort: true,
    allowedHosts: true,
    hmr: {
      host: 'localhost',
      port: 8889,
      protocol: 'ws',
    },
    proxy: {
      // Proxy all /api calls to the backend → eliminates CORS
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: '',
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes: IncomingMessage) => {
            // Ensure cookies are properly set for cross-origin development scenario
            const setCookieHeaders = proxyRes.headers['set-cookie'];
            if (setCookieHeaders) {
              const rewrittenCookies = (
                Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]
              ).map((cookie: string) => {
                // Remove Domain restriction for dev, keep other attributes
                return cookie.replace(/Domain=[^;]+;?\s*/i, '').replace(/; *$/, '');
              });
              proxyRes.headers['set-cookie'] = rewrittenCookies;
            }
          });
        },
      },
      // Proxy WebSocket connections for Socket.io
      '/socket.io': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying
      },
      // Keep Kobo proxy as-is
      '/api/kobo': {
        target: 'https://kf.kobotoolbox.org/api/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kobo/, ''),
        secure: true,
      },
    },
  },
  preview: {
    port: 8890, // Isolated port for GEM preview
    allowedHosts: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  build: {
    target: ['es2020', 'chrome90', 'edge90', 'firefox88', 'safari14'],
    cssTarget: ['chrome90', 'edge90', 'firefox88', 'safari14'],
    // Raise the chunk size warning threshold (MapLibre is unavoidably large)
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      onLog(level, log, handler) {
        if (log.code === 'PLUGIN_TIMINGS') return;
        handler(level, log);
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('maplibre-gl')) return 'maplibre';
            if (id.includes('leaflet')) return 'leaflet';
            if (
              id.includes('jspdf') ||
              id.includes('jspdf-autotable') ||
              id.includes('html2canvas')
            )
              return 'pdf';
            if (id.includes('framer-motion')) return 'animation';
            if (id.includes('dexie')) return 'dexie';
            if (id.includes('docx')) return 'docx';
            if (id.includes('xlsx')) return 'xlsx';
            if (id.includes('qrcode')) return 'qrcode';
            if (id.includes('axios')) return 'axios';
            if (id.includes('socket.io-client')) return 'socketio';
            if (id.includes('date-fns')) return 'date-fns';
            if (id.includes('@turf')) return 'turf';
            if (id.includes('supercluster')) return 'supercluster';
            if (id.includes('dompurify')) return 'dompurify';
            if (id.includes('react-window')) return 'virtual';
            return 'vendor';
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'qrcode',
      'lodash/debounce',
      'react-window',
      'react-virtualized-auto-sizer',
      'jspdf',
      'jspdf-autotable',
      'framer-motion',
      'lucide-react',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
      xlsx: path.resolve(dirname, './src/utils/safeExcel.ts'),
      '@core': path.resolve(dirname, './src/core'),
      '@shared': path.resolve(dirname, './src/shared'),
      '@modules': path.resolve(dirname, './src/modules'),
      '@components': path.resolve(dirname, './src/components'),
      '@lib': path.resolve(dirname, './src/lib'),
      '@hooks': path.resolve(dirname, './src/hooks'),
      '@utils': path.resolve(dirname, './src/utils'),
      '@types': path.resolve(dirname, './src/types'),
      '@assets': path.resolve(dirname, './src/assets'),
      '@pages': path.resolve(dirname, './src/pages'),
      '@services': path.resolve(dirname, './src/services'),
      '@contexts': path.resolve(dirname, './src/contexts'),
      '@stores': path.resolve(dirname, './src/stores'),
      '@analytics': path.resolve(dirname, './src/analytics'),
      '@design-system': path.resolve(dirname, './src/design-system'),
    },
  },
});
