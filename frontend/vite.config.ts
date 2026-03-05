import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
    strictPort: false, // Allow fallback to 3001, 3002... if port is busy
    proxy: {
      // Proxy all /api calls to the backend → eliminates CORS
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      // Proxy WebSocket connections for Socket.io
      '/socket.io': {
        target: 'http://localhost:5000',
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
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    }
  }
})

