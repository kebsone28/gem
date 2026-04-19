import prisma from './core/utils/prisma.js';

async function findMaodo() {
    console.log('--- 🔍 Recherche de Maodo Diallo ---');
    try {
        const households = await prisma.household.findMany({
            where: {
                OR: [
                    { name: { contains: 'MAODO', mode: 'insensitive' } },
                    { name: { contains: 'DIALLO', mode: 'insensitive' } },
                    { numeroordre: { in: ['3536', '3537', '03536', '03537'] } }
                ]
            },
            orderBy: { numeroordre: 'asc' }
        });

        console.log(`Trouvé ${households.length} résultats :`);
        households.forEach(h => {
            console.log(`- ID: ${h.id}, Name: ${h.name}, NumeroOrdre: [${h.numeroordre}], KoboID: ${h.koboSubmissionId}, CreatedAt: ${h.createdAt}`);
        });

    } catch (e) {
        console.error('Erreur:', e);
    } finally {
        await prisma.$disconnect();
    }
}

findMaodo();
