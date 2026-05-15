import http from 'http';
import { config } from './core/config/config.js';

const PORT = config.port || 5005;

/**
 * Auto-create admin user if none exists
 */
async function ensureAdminUser() {
  const bootstrapEnabled = process.env.ENABLE_BOOTSTRAP_ADMIN === 'true';
  if (!bootstrapEnabled) {
    console.log('ℹ️ Bootstrap admin creation disabled.');
    return;
  }

  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const bootstrapSecurityAnswer = process.env.BOOTSTRAP_ADMIN_SECURITY_ANSWER;
  const bootstrapOrganization = process.env.BOOTSTRAP_ADMIN_ORGANIZATION || 'PROQUELEC';

  if (!bootstrapEmail || !bootstrapPassword || !bootstrapSecurityAnswer) {
    console.warn(
      '⚠️ Bootstrap admin skipped: missing BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD/BOOTSTRAP_ADMIN_SECURITY_ANSWER.'
    );
    return;
  }

  try {
    console.log('🔍 Checking for admin user...');
    const { default: prisma } = await import('./core/utils/prisma.js');
    const bcrypt = (await import('bcryptjs')).default;

    // Create organization first if not exists
    let org = await prisma.organization.findFirst({ where: { name: bootstrapOrganization } });
    if (!org) {
      org = await prisma.organization.create({ data: { name: bootstrapOrganization } });
    }

    // Check if admin exists with email + organizationId (composite unique constraint)
    const existingAdmin = await prisma.user.findFirst({
      where: {
        email: bootstrapEmail,
        organizationId: org.id,
      },
    });

    if (!existingAdmin) {
      console.log('🌱 Creating bootstrap admin user...');

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(bootstrapPassword, salt);
      const answerHash = await bcrypt.hash(bootstrapSecurityAnswer.toLowerCase(), salt);

      // Create admin user
      await prisma.user.create({
        data: {
          email: bootstrapEmail,
          passwordHash,
          name: 'Administrateur',
          roleLegacy: 'ADMIN_PROQUELEC',
          organizationId: org.id,
          requires2FA: true,
          securityQuestion: 'Votre référence spirituelle',
          securityAnswerHash: answerHash,
        },
      });

      console.log('✅ Bootstrap admin user created.');
    } else {
      console.log('🔄 Updating bootstrap admin credentials...');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(bootstrapPassword, salt);
      const answerHash = await bcrypt.hash(bootstrapSecurityAnswer.toLowerCase(), salt);
      
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          passwordHash,
          securityAnswerHash: answerHash,
          requires2FA: true
        }
      });
      console.log('✅ Bootstrap admin user updated with current .env credentials');
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
  console.log(`🚀 Bootstrapping GED OS Server on port ${PORT}...`);

  const server = http.createServer((req, res) => {
    // Add basic CORS for bootstrap phase debugging
    // 🛡️ [SECURITY sec_001] Restricted CORS during bootstrap
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:8889', 'http://127.0.0.1:8889', 'http://0.0.0.0:8889',
      'http://localhost:8890', 'http://localhost:8891',
      'https://ged-os.proquelec.sn', 'https://www.ged-os.proquelec.sn'
    ];
    
    // Add custom env origins if present
    const envOrigins = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
    const finalAllowed = [...new Set([...allowedOrigins, ...envOrigins])];

    if (origin && (finalAllowed.includes(origin) || process.env.NODE_ENV !== 'production')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (!origin) {
      // For non-browser requests or same-origin
      res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:8889');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-project-id, x-organization-id, x-impersonate-user-id'
    );

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (req.url === '/api/ping' || req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'BOOTING', port: PORT }));
    }

    // Default response during initialization for any other route
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Serveur en cours d\'initialisation. Veuillez patienter.' }));
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

      // Démarrage du système d'escalade des alertes
      const { startAlertEscalationAgent, startIGPPAlertAgent } =
        await import('./services/alertEscalationAgent.js');
      const alertEscalationCleanup = startAlertEscalationAgent();
      const igppAlertCleanup = startIGPPAlertAgent();
      if (alertEscalationCleanup)
        cleanupFunctions.push(() => clearInterval(alertEscalationCleanup));
      if (igppAlertCleanup) cleanupFunctions.push(() => clearInterval(igppAlertCleanup));

      // 🤖 ACTIVATION DU MOTEUR D'AUTOMATISATION (PHASE 5)
      const { automationService } = await import('./core/services/automation.service.js');
      console.log('🤖 Automation Engine initialized (Human-in-the-loop active).');

      console.log('💎 GED OS Server is now fully operational.');

      // ✅ IMPROVED: Complete graceful shutdown
      const gracefulShutdown = async () => {
        console.log('📥 Signal reçu. Fermeture des ressources...');

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
      };

      process.on('SIGTERM', gracefulShutdown);
      process.on('SIGINT', gracefulShutdown);
    } catch (error) {
      console.error('🔥 FATAL INITIALIZATION ERROR:', error);

      // Fallback handler to show the error in the browser/curl
      server.removeAllListeners('request');
      server.on('request', (req, res) => {
        const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:8889';
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-project-id, x-organization-id, x-impersonate-user-id');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          return res.end();
        }

        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Service temporairement indisponible (BOOT_ERROR)',
          details: error.message,
          stack: error.stack
        }));
      });
    }
  });

  // Global error handlers
  process.on('uncaughtException', (err) => {
    console.error('🔥 UNCAUGHT EXCEPTION:', err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('☄️ UNHANDLED REJECTION:', reason);
  });
}

bootstrap();
