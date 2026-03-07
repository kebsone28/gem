import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'PROQUELEC — GEM SaaS',
        short_name: 'PROQUELEC',
        description: 'Plateforme d\'Électrification de Masse — Mobile & Offline Ready',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'logo-proquelec.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo-proquelec.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'logo-proquelec.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 5000000, // Augmenté à 5 Mo pour supporter les gros bundles/images
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/kf\.kobotoolbox\.org\/api\/v2\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'kobo-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          },
          {
            // Cache pour les fonds de carte (OpenFreeMap)
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache pour nos propres tuiles vectorielles (MVT Households)
            urlPattern: /\/api\/geo\/mvt\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'households-mvt-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  server: {
    port: 3000,
    strictPort: false,
    allowedHosts: true,
    proxy: {
      // Proxy all /api calls to the backend → eliminates CORS
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        secure: false,
      },
      // Proxy WebSocket connections for Socket.io
      '/socket.io': {
        target: 'http://localhost:5005',
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
      }
    }
  },
  preview: {
    port: 4173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:5005',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    }
  }
})

