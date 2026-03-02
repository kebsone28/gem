import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    // Base public path when served in development or production.
    // For Electron, relative paths are often preferred.
    base: './',
    // serve the vendor folder as static assets during dev and copy to dist
    publicDir: 'vendor',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                logistique: resolve(__dirname, 'logistique.html'),
                aide: resolve(__dirname, 'aide.html'),
                audit: resolve(__dirname, 'audit_systeme.html'),
                bordereau: resolve(__dirname, 'bordereau.html'),
                cahier: resolve(__dirname, 'cahier-equipes.html'),
                charges: resolve(__dirname, 'charges.html'),
                login: resolve(__dirname, 'login.html'),
                parametres: resolve(__dirname, 'parametres.html'),
                rapports: resolve(__dirname, 'rapports.html'),
                simulation: resolve(__dirname, 'simulation.html'),
                terrain: resolve(__dirname, 'terrain.html')
            }
        }
    },
    server: {
        port: 3001,
        strictPort: false,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
    }
});
