import prisma from '../core/utils/prisma.js';

console.log('Prisma keys:', Object.keys(prisma).filter(k => k.toLowerCase().includes('memory')));
process.exit(0);
