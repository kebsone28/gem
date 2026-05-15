#!/usr/bin/env node

import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

const DEFAULT_TEMPLATES = [
  {
    key: 'supervision-senelec',
    name: 'Supervision Senelec',
    description: 'Projet de supervision technique pour Senelec',
    modules: ['dashboard', 'missions', 'planning', 'analytics'],
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
    name: 'Kobo Formation',
    description: 'Projet de collecte de données Kobo pour formation',
    modules: ['kobo-sync', 'households', 'analytics'],
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
    name: 'Audit Technique',
    description: 'Projet d\'audit technique des installations',
    modules: ['missions', 'checklists', 'reports', 'analytics'],
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
    name: 'ERP Chantier',
    description: 'Gestion de chantier et des ressources',
    modules: ['planning', 'teams', 'missions', 'logistics', 'analytics'],
    config: {
      client: 'GENERIC',
      icon: 'Wrench',
      category: 'project-management',
      defaultUsers: [],
      defaultSettings: {}
    }
  }
];

async function seedTemplates() {
  try {
    console.log('🌱 Seeding ProjectTemplates...\n');

    for (const tpl of DEFAULT_TEMPLATES) {
      const existing = await prisma.projectTemplate.findUnique({
        where: { key: tpl.key }
      });

      if (existing) {
        console.log(`✅ Template "${tpl.name}" already exists`);
      } else {
        await prisma.projectTemplate.create({
          data: {
            key: tpl.key,
            name: tpl.name,
            description: tpl.description,
            modules: tpl.modules,
            config: tpl.config,
            active: true
          }
        });
        console.log(`✅ Created template: ${tpl.name}`);
      }
    }

    console.log('\n✅ Template seeding complete!');

    const allTemplates = await prisma.projectTemplate.findMany();
    console.log('\n📊 All templates:');
    allTemplates.forEach(t => console.log(`  - ${t.key}: ${t.name}`));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedTemplates();
