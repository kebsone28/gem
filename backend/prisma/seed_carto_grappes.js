/**
 * Seed script for Cartographie Grappes module
 * 
 * Creates:
 * 1. PROQUELEC organization (if not exists)
 * 2. Admin user PROQUELEC with full carto permissions
 * 3. Prestataire users per lot (A, B, C) with limited permissions
 * 
 * Usage:
 *   node prisma/seed_carto_grappes.js
 * 
 * Environment variables (optional):
 *   INITIAL_ADMIN_PASSWORD — admin password (default: 'admin2025')
 */

import { basePrisma as prisma } from '../src/core/utils/prisma.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const ORG_ID = 'proquelec-org-id';
const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'admin2025';

const CARTO_PERMISSIONS = [
    'terrain.read',
    'terrain.map',
    'terrain.zones',
    'terrain.menages',
];

const ADMIN_PERMISSIONS = [
    ...CARTO_PERMISSIONS,
    'terrain.terminal',
    'terrain.reject',
    'gerer_utilisateurs',
    'gerer_parametres',
];

async function ensureOrg() {
    return prisma.organization.upsert({
        where: { id: ORG_ID },
        update: {},
        create: { id: ORG_ID, name: 'PROQUELEC' },
    });
}

async function ensureUser(email, password, name, roleLegacy, permissions) {
    const passwordHash = await bcrypt.hash(password, 10);
    return prisma.user.upsert({
        where: {
            email_organizationId: { email, organizationId: ORG_ID },
        },
        update: {
            passwordHash,
            name,
            roleLegacy,
            permissions,
            active: true,
        },
        create: {
            email,
            name,
            passwordHash,
            roleLegacy,
            organizationId: ORG_ID,
            permissions,
            active: true,
        },
    });
}

async function main() {
    console.log('🌱 Seeding carto_grappes users...');

    const org = await ensureOrg();
    console.log(`  ✅ Organization: ${org.name} (${org.id})`);

    // 1. Admin user
    const admin = await ensureUser(
        'proquelec',
        ADMIN_PASSWORD,
        'PROQUELEC Admin',
        'ADMIN_PROQUELEC',
        ADMIN_PERMISSIONS,
    );
    console.log(`  ✅ Admin: ${admin.email} (id: ${admin.id})`);

    // 2. Prestataire users per lot
    const lots = [
        { lot: 'A', email: 'prestataire.a@proquelec.sn', name: 'Prestataire Lot A' },
        { lot: 'B', email: 'prestataire.b@proquelec.sn', name: 'Prestataire Lot B' },
        { lot: 'C', email: 'prestataire.c@proquelec.sn', name: 'Prestataire Lot C' },
    ];

    for (const { email, name } of lots) {
        const user = await ensureUser(
            email,
            ADMIN_PASSWORD, // Same password as admin for simplicity
            name,
            'CHEF_EQUIPE',
            CARTO_PERMISSIONS,
        );
        console.log(`  ✅ User: ${user.email} (id: ${user.id})`);
    }

    console.log('🏁 Carto grappes seed completed!');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
