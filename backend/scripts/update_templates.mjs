#!/usr/bin/env node

import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

const TEMPLATE_UPDATES = [
  {
    key: 'supervision-senelec',
    config: {
      client: 'SENELEC',
      icon: 'Shield',
      category: 'supervision',
      defaultUsers: ['SENELEC_SUPERVISEUR', 'SENELEC_CONTROLEUR'],
      defaultSettings: {
        technicalSupervision: true,
        complianceReporting: true,
        realTimeMonitoring: true
      }
    }
  },
  {
    key: 'kobo-formation',
    config: {
      client: 'GENERIC',
      icon: 'Target',
      category: 'data-collection',
      defaultUsers: [],
      defaultSettings: {}
    }
  },
  {
    key: 'audit-technique',
    config: {
      client: 'GENERIC',
      icon: 'CheckCircle2',
      category: 'audit',
      defaultUsers: [],
      defaultSettings: {}
    }
  },
  {
    key: 'erp-chantier',
    config: {
      client: 'GENERIC',
      icon: 'Wrench',
      category: 'project-management',
      defaultUsers: [],
      defaultSettings: {}
    }
  }
];

async function updateTemplates() {
  try {
    console.log('🔄 Updating template configurations...\n');

    for (const update of TEMPLATE_UPDATES) {
      const updated = await prisma.$executeRaw`
        UPDATE "ProjectTemplate"
        SET config = ${JSON.stringify(update.config)}::jsonb
        WHERE key = ${update.key}
      `;

      console.log(`✅ Updated ${update.key}`);
    }

    console.log('\n✅ Template updates complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateTemplates();
