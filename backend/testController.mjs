import { getProjectBordereau } from './src/modules/project/project.controller.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
    const project = await prisma.project.findFirst({ where: { id: 'project_lse' } });
    if (!project) {
        console.log('Project not found in DB!');
        await prisma.$disconnect();
        return;
    }

    const req = {
        params: { id: 'project_lse' },
        user: { organizationId: project.organizationId }
    };

    const res = {
        status: (code) => {
            console.log('STATUS:', code);
            return res;
        },
        json: (data) => {
            console.log('JSON RESPONSE:', data);
        }
    }

    await getProjectBordereau(req, res);
    await prisma.$disconnect();
}

test();
