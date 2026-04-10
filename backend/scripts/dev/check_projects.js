import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const projects = await prisma.project.findMany();
    console.log('--- PROJECTS IN SERVER DB ---');
    console.log(JSON.stringify(projects, null, 2));
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
