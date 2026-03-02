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
    proxy: {
      '/api/kobo': {
        target: 'https://kf.kobotoolbox.org/api/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kobo/, ''),
        secure: true,
      }
    }
  },
})
