import { PrismaClient } from './client/index.js';
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

    const users = [
        {
            email: 'admingem',
            password: '1995@PROQUELEC@2026',
            name: 'Admin PROQUELEC',
            role: 'ADMIN_PROQUELEC',
            requires2FA: true,
            secret2FAQuestion: 'Question de sécurité',
            secret2FAAnswer: 'CORAN'
        },
        { email: 'maçongem', password: 'GEMMA2026', name: 'Chef Maçons', role: 'CHEF_EQUIPE' },
        { email: 'reseaugem', password: 'GEMRE2026', name: 'Chef Réseau', role: 'CHEF_EQUIPE' },
        { email: 'electriciengem', password: 'GEMELEC2026', name: 'Chef Électricien', role: 'CHEF_EQUIPE' },
        { email: 'livreurgem', password: 'gemliv2026', name: 'Chef Livreur', role: 'CHEF_EQUIPE' },
        { email: 'dggem', password: 'GEMDG2026', name: 'DG PROQUELEC', role: 'DG_PROQUELEC' }
    ];

    for (const u of users) {
        const hashedPassword = await bcrypt.hash(u.password, 10);
        await prisma.user.upsert({
            where: { email: u.email },
            update: {
                passwordHash: hashedPassword,
                role: u.role,
                name: u.name,
                requires2FA: u.requires2FA || false,
                secret2FAQuestion: u.secret2FAQuestion || null,
                secret2FAAnswer: u.secret2FAAnswer || null
            },
            create: {
                email: u.email,
                name: u.name,
                passwordHash: hashedPassword,
                role: u.role,
                organizationId: org.id,
                requires2FA: u.requires2FA || false,
                secret2FAQuestion: u.secret2FAQuestion || null,
                secret2FAAnswer: u.secret2FAAnswer || null
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
