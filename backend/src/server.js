import http from 'http';
import app from './app.js';
import { config } from './core/config/config.js';
import prisma from './core/utils/prisma.js';
import { socketService } from './services/socket.service.js';
import { initSimulationWorker } from './modules/simulation/simulation.worker.js';

async function startServer() {
  try {
    // In a real SaaS, we would test DB connection here
    // await prisma.$connect();
    // console.log('✅ Connected to PostgreSQL database');

    const port = config.port;
    const server = http.createServer(app);

    // Listen first to satisfy Railway's health check
    server.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Serveur PROQUELEC en ligne sur le port ${port}`);
    });

    socketService.init(server);
    initSimulationWorker();
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
}

startServer();

// Handle cleanup
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
