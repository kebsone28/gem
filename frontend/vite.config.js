import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function maskSecrets(text) {
  return text
    .replace(/(OPENAI_API_KEY:\s*)(\S+)/gi, '$1REDACTED')
    .replace(/(apiKey:\s*)(\S+)/gi, '$1REDACTED')
    .replace(/(sk-[A-Za-z0-9-_]+)/g, 'REDACTED')
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({ registerType: 'autoUpdate', injectRegister: 'auto' }),
    {
      name: 'expose-redacted-continue',
      configureServer(server) {
        const userContinue = path.resolve(process.env.USERPROFILE || process.env.HOME || __dirname, '.continue')

        server.middlewares.use(async (req, res, next) => {
          if (req.method === 'GET' && req.url === '/__internal/config.json') {
            try {
              const filePath = path.join(userContinue, 'config.yaml')
              const txt = fs.readFileSync(filePath, 'utf8')
              const masked = maskSecrets(txt)
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ redacted: true, content: masked }))
            } catch (err) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'not found' }))
            }
          } else {
            next()
          }
        })
      }
    }
  ]
})
