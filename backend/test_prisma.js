import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

console.log('--- Prisma Test ---');
console.log('DATABASE_URL:', process.env.DATABASE_URL);

try {
    const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });
    console.log('✅ PrismaClient instantiated successfully');

    // Try a simple query
    // const users = await prisma.user.findMany();
    // console.log('Users found:', users.length);

    await prisma.$disconnect();
} catch (error) {
    console.error('❌ Prisma Test Failed:', error);
}
