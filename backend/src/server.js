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

    const server = http.createServer(app);
    socketService.init(server);

    // Phase 2 : Initialisation des Workers de tâche de fond
    initSimulationWorker();

    server.listen(config.port, () => {
      console.log(`🚀 Serveur PROQUELEC démarré en mode ${config.env} sur le port ${config.port}`);
      console.log(`📡 Santé API : http://localhost:${config.port}/health`);
    });
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
