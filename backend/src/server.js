import http from 'http';
import { config } from './core/config/config.js';

const PORT = config.port || 5005;

/**
 * Auto-create admin user if none exists
 */
async function ensureAdminUser() {
  try {
    console.log('🔍 Checking for admin user...');
    const { default: prisma } = await import('./core/utils/prisma.js');
    const bcrypt = (await import('bcryptjs')).default;

    // Check if admin exists
    const existingAdmin = await prisma.user.findUnique({ where: { email: 'admingem' } });

    if (!existingAdmin) {
      console.log('🌱 Creating default admin user...');

      const password = 'suprime';
      const answer2FA = 'coran';

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const answerHash = await bcrypt.hash(answer2FA.toLowerCase(), salt);

      // Create organization if not exists
      let org = await prisma.organization.findFirst({ where: { name: 'PROQUELEC' } });
      if (!org) {
        org = await prisma.organization.create({ data: { name: 'PROQUELEC' } });
      }

      // Create admin user
      await prisma.user.create({
        data: {
          email: 'admingem',
          passwordHash,
          name: 'Administrateur PROQUELEC',
          roleLegacy: 'ADMIN_PROQUELEC',
          organizationId: org.id,
          requires2FA: true,
          securityQuestion: 'Votre référence spirituelle',
          securityAnswerHash: answerHash,
        }
      });

      console.log('✅ Admin user created!');
      console.log('   Login: admingem');
      console.log('   Password: suprime');
      console.log('   2FA: coran');
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Error ensuring admin user:', error.message);
  }
}

/**
 * Robust bootstrapping process.
 * 1. Binds the port immediately to satisfy Railway's health check.
 * 2. Loads heavy dependencies asynchronously.
 * 3. Provides error feedback if the boot fails.
 */
async function bootstrap() {
  console.log(`🚀 Bootstrapping PROQUELEC Server on port ${PORT}...`);

  const server = http.createServer((req, res) => {
    // Add basic CORS for bootstrap phase debugging
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

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

      // Ensure admin user exists
      await ensureAdminUser();

      // ✅ Declare cleanup registry BEFORE using it
      const cleanupFunctions = [];

      const simulationCleanup = initSimulationWorker();
      if (simulationCleanup) cleanupFunctions.push(simulationCleanup);

      // Démarrage de la synchronisation automatique KoboToolbox en arrière-plan
      const { startKoboAutoSync } = await import('./services/kobo.cron.js');
      const koboCleanup = startKoboAutoSync();
      if (koboCleanup) cleanupFunctions.push(koboCleanup);

      // Démarrage du système de rappels automatiques (Missions)
      const { startMissionCron } = await import('./services/mission.cron.js');
      const missionCleanup = startMissionCron();
      if (missionCleanup) cleanupFunctions.push(missionCleanup);

      // Démarrage du Superviseur Silencieux (Délais Équipes)
      const { startSilentSupervisor } = await import('./core/workers/supervisor.worker.js');
      const supervisorCleanup = startSilentSupervisor();
      if (supervisorCleanup) cleanupFunctions.push(supervisorCleanup);

      console.log('💎 PROQUELEC Server is now fully operational.');

      // ✅ IMPROVED: Complete graceful shutdown
      process.on('SIGTERM', async () => {
        console.log('📥 SIGTERM received. Closing all resources...');
        
        // Stop all background services
        for (const cleanup of cleanupFunctions) {
          try {
            await cleanup();
          } catch (e) {
            console.error('❌ Error during cleanup:', e.message);
          }
        }
        
        // Close Socket.IO connections
        try {
          socketService.close();
        } catch (e) {
          console.error('❌ Error closing Socket.IO:', e.message);
        }
        
        // Disconnect from database
        await prisma.$disconnect();
        
        console.log('✅ All resources closed. Exiting gracefully.');
        process.exit(0);
      });

    } catch (error) {
      console.error('🔥 FATAL INITIALIZATION ERROR:', error);

      // Fallback handler to show the error in the browser/curl
      server.removeAllListeners('request');
      server.on('request', (req, res) => {
        const origin = req.headers.origin || '*';
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
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
