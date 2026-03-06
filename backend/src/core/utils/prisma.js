import { PrismaClient } from '@prisma/client';
import { config } from '../config/config.js';

console.log('🔧 Initializing Prisma for DB:', config.dbUrl);

const prisma = new PrismaClient();

export default prisma;
