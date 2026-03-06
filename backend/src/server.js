import http from 'http';
import { config } from './core/config/config.js';

const PORT = config.port || 5005;

/**
 * Robust bootstrapping process.
 * 1. Binds the port immediately to satisfy Railway's health check.
 * 2. Loads heavy dependencies asynchronously.
 * 3. Provides error feedback if the boot fails.
 */
async function bootstrap() {
  console.log(`🚀 Bootstrapping PROQUELEC Server on port ${PORT}...`);

  const server = http.createServer((req, res) => {
    if (req.url === '/api/ping' || req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'BOOTING', port: PORT }));
    }
  });

  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅ Port ${PORT} bound. Initializing application modules...`);

    try {
      // Asynchronous loading to isolate import failures
      const { default: app } = await import('./app.js');
      const { socketService } = await import('./services/socket.service.js');
      const { initSimulationWorker } = await import('./modules/simulation/simulation.worker.js');
      const { default: prisma } = await import('./core/utils/prisma.js');

      // Swap request handler to Express
      server.removeAllListeners('request');
      server.on('request', app);

      // Shared services initialization
      socketService.init(server);
      initSimulationWorker();

      console.log('💎 PROQUELEC Server is now fully operational.');

      // Graceful shutdown
      process.on('SIGTERM', async () => {
        console.log('📥 SIGTERM received. Closing resources...');
        await prisma.$disconnect();
        process.exit(0);
      });

    } catch (error) {
      console.error('🔥 FATAL INITIALIZATION ERROR:', error);

      // Fallback handler to show the error in the browser/curl
      server.removeAllListeners('request');
      server.on('request', (req, res) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`BOOT_ERROR: ${error.message}\n${error.stack}`);
      });
    }
  });

  // Global error handlers
  process.on('uncaughtException', (err) => {
    console.error('🔥 UNCAUGHT EXCEPTION:', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('☄️ UNHANDLED REJECTION:', reason);
  });
}

bootstrap();
