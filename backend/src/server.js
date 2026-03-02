import app from './app.js';
import { config } from './core/config/config.js';
import prisma from './core/utils/prisma.js';

async function startServer() {
  try {
    // In a real SaaS, we would test DB connection here
    // await prisma.$connect();
    // console.log('✅ Connected to PostgreSQL database');

    app.listen(config.port, () => {
      console.log(`🚀 Server running in ${config.env} mode on port ${config.port}`);
      console.log(`📡 API Health: http://localhost:${config.port}/health`);
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
