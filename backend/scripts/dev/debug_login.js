import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function test() {
    const email = 'admin@proquelec.com';
    const password = 'admin123';

    console.log('Testing login for:', email);

    const user = await prisma.user.findUnique({
        where: { email },
        include: { organization: true }
    });

    if (!user) {
        console.log('❌ User not found in DB');
        return;
    }

    console.log('✅ User found:', user.email);
    console.log('Stored Hash:', user.passwordHash);

    const match = await bcrypt.compare(password, user.passwordHash);
    if (match) {
        console.log('✅ Password MATCH');
    } else {
        console.log('❌ Password DOES NOT match');

        // Let's see what hash we get now for 'admin123'
        const newHash = await bcrypt.hash(password, 10);
        console.log('New hash for same password:', newHash);
        const secondMatch = await bcrypt.compare(password, newHash);
        console.log('Self-comparison match:', secondMatch);
    }
}

test().finally(() => prisma.$disconnect());
