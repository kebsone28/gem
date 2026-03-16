import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function debugLogin() {
    const email = 'admin@proquelec.com';
    const password = 'Admin123!';

    console.log('🔍 Starting debug login for:', email);

    try {
        console.log('--- Step 1: Find User ---');
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            include: { organization: true }
        });

        if (!user) {
            console.log('❌ User not found');
            return;
        }
        console.log('✅ User found:', user.id, 'Role:', user.role);

        console.log('--- Step 2: Compare Passwords ---');
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        console.log('🔑 Match:', isMatch);

        if (!isMatch) {
            console.log('❌ Password mismatch');
            return;
        }

        console.log('--- Step 3: Test tracerAction logic ---');
        // Mimic tracerAction call structure
        try {
            await prisma.auditLog.create({
                data: {
                    userId: user.id,
                    organizationId: user.organizationId,
                    action: 'DEBUG_LOGIN',
                    resource: 'Authentification',
                    resourceId: user.id,
                    details: { test: true },
                    timestamp: new Date()
                }
            });
            console.log('✅ Audit Log creation success');
        } catch (auditError) {
            console.error('❌ Audit Log creation FAILED:', auditError);
        }

        console.log('--- Step 4: Test Token Generation logic ---');
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '15m' }
        );
        console.log('✅ Token signed successfully');

        console.log('🚀 Login Simulation SUCCESS');

    } catch (error) {
        console.error('🔥 FATAL ERROR DURING LOGIN SIMULATION:');
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

debugLogin();
