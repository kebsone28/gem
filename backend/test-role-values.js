import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const user = await prisma.user.findFirst({ 
        where: { email: 'admingem' }
    });
    if (user) {
        console.log('ID:', user.id);
        console.log('Email:', user.email);
        console.log('roleLegacy:', user.roleLegacy);
        console.log('roleId:', user.roleId);
        console.log('Permissions Type:', typeof user.permissions);
        console.log('Permissions:', user.permissions);
    } else {
        console.log('User not found');
    }
    process.exit(0);
}
run();
