import { defineConfig } from 'vite'
import path from 'path'
import serveStatic from 'serve-static'

export default defineConfig({
  plugins: [
    {
      name: 'serve-dot-continue',
      configureServer(server) {
        const staticMiddleware = serveStatic(path.resolve(__dirname, '.continue'), {
          index: false,
          dotfiles: 'allow'
        })
        server.middlewares.use('/.continue', staticMiddleware)
      }
    }
  ]
})
