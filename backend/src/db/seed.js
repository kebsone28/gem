import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const passwordHash = await bcrypt.hash('admin123', 10);

    // 1. Create Organization
    const org = await prisma.organization.create({
        data: {
            name: 'PROQUELEC TEST',
        },
    });

    // 2. Create User
    const user = await prisma.user.create({
        data: {
            email: 'admin@proquelec.com',
            passwordHash,
            role: 'admin',
            organizationId: org.id,
        },
    });

    // 3. Create Project
    const project = await prisma.project.create({
        data: {
            name: 'Projet Test Electrification 2026',
            status: 'active',
            budget: 500000,
            duration: 12,
            totalHouses: 150,
            config: {},
            organizationId: org.id,
            updatedById: user.id,
        },
    });

    console.log('✅ Seed successful');
    console.log('Org ID:', org.id);
    console.log('User:', 'admin@proquelec.com / admin123');
    console.log('Project ID:', project.id);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
