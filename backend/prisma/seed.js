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
        { email: 'admingem', password: '1995@PROQUELEC@2026', name: 'Admin PROQUELEC', role: 'admin' },
        { email: 'maçongem', password: 'GEMMA2026', name: 'Chef Maçons', role: 'chef_macon' },
        { email: 'reseaugem', password: 'GEMRE2026', name: 'Chef Réseau', role: 'chef_reseau' },
        { email: 'electriciengem', password: 'GEMELEC2026', name: 'Chef Électricien', role: 'chef_electricien' },
        { email: 'livreurgem', password: 'gemliv2026', name: 'Chef Livreur', role: 'chef_livreur' },
        { email: 'dggem', password: 'GEMDG2026', name: 'DG PROQUELEC', role: 'dg' }
    ];

    for (const u of users) {
        const hashedPassword = await bcrypt.hash(u.password, 10);
        await prisma.user.upsert({
            where: { email: u.email },
            update: {
                passwordHash: hashedPassword,
                role: u.role,
                name: u.name
            },
            create: {
                email: u.email,
                name: u.name,
                passwordHash: hashedPassword,
                role: u.role,
                organizationId: org.id
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
