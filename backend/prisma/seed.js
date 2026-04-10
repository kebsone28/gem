import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // 1. Create Organization
    const org = await prisma.organization.upsert({
        where: { id: 'proquelec-org-id' }, // Static ID for seed stability
        update: {},
        create: {
            id: 'proquelec-org-id',
            name: 'PROQUELEC'
        }
    });

    console.log('✅ Organization PROQUELEC ready');

    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'CHANGE_ME_IMMEDIATELY';
    const admin2FAAnswer = process.env.INITIAL_ADMIN_2FA_ANSWER || 'CHANGE_ME';

    const users = [
        {
            email: 'admingem',
            password: adminPassword,
            name: 'Admin PROQUELEC',
            role: 'ADMIN_PROQUELEC',
            requires2FA: true,
            secret2FAQuestion: 'Question de sécurité',
            secret2FAAnswer: admin2FAAnswer
        },
        {
            email: 'maçongem',
            password: process.env.INITIAL_MAÇON_PASSWORD || 'CHANGE_ME',
            name: 'Chef Maçons',
            role: 'CHEF_EQUIPE'
        },
        {
            email: 'reseaugem',
            password: process.env.INITIAL_RESEAU_PASSWORD || 'CHANGE_ME',
            name: 'Chef Réseau',
            role: 'CHEF_EQUIPE'
        },
        {
            email: 'electriciengem',
            password: process.env.INITIAL_ELEC_PASSWORD || 'CHANGE_ME',
            name: 'Chef Électricien',
            role: 'CHEF_EQUIPE'
        },
        {
            email: 'livreurgem',
            password: process.env.INITIAL_LIVREUR_PASSWORD || 'CHANGE_ME',
            name: 'Chef Livreur',
            role: 'CHEF_EQUIPE'
        },
        {
            email: 'dggem',
            password: adminPassword,
            name: 'DG PROQUELEC',
            role: 'DG_PROQUELEC'
        },
        {
            email: 'cp_gem',
            password: 'password123',
            name: 'Chef de Projet Vision',
            role: 'CHEF_PROJET'
        },
        {
            email: 'compta_gem',
            password: 'password123',
            name: 'Responsable Comptabilité',
            role: 'COMPTABLE'
        }
    ];

    for (const u of users) {
        const hashedPassword = await bcrypt.hash(u.password, 10);
        const hashed2FAAnswer = u.secret2FAAnswer ? await bcrypt.hash(u.secret2FAAnswer.trim().toLowerCase(), 10) : null;

        await prisma.user.upsert({
            where: { email: u.email },
            update: {
                passwordHash: hashedPassword,
                roleLegacy: u.role,
                name: u.name,
                requires2FA: u.requires2FA || false,
                securityQuestion: u.secret2FAQuestion || null,
                securityAnswerHash: hashed2FAAnswer
            },
            create: {
                email: u.email,
                name: u.name,
                passwordHash: hashedPassword,
                roleLegacy: u.role,
                organizationId: org.id,
                requires2FA: u.requires2FA || false,
                securityQuestion: u.secret2FAQuestion || null,
                securityAnswerHash: hashed2FAAnswer
            }
        });
        console.log(`👤 User ${u.email} created/updated`);
    }

    console.log('🏁 Seed completed!');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
