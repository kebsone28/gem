import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const user = await prisma.user.findFirst({ 
        where: { email: 'admingem' }
    });
    if (user) {
        console.log('Fields:', Object.keys(user));
        console.log('Values:', JSON.stringify(user, null, 2));
    } else {
        console.log('User not found');
    }
    process.exit(0);
}
run();
