/* eslint-disable no-console, @typescript-eslint/no-unused-vars */
import prisma from './core/utils/prisma.js';

async function checkAndClean() {
    console.log('--- 🔍 Analyse des doublons avant verrouillage ---');
    try {
        const dups = await prisma.$queryRaw`
            SELECT numeroordre, COUNT(*) 
            FROM "Household" 
            WHERE "deletedAt" IS NULL AND numeroordre IS NOT NULL 
            GROUP BY numeroordre 
            HAVING COUNT(*) > 1
        `;

        console.log('Doublons détectés :', dups);

        if (dups.length > 0) {
            for (const d of dups) {
                const households = await prisma.household.findMany({
                    where: { numeroordre: d.numeroordre, deletedAt: null },
                    orderBy: { updatedAt: 'desc' }
                });

                // Garder le premier (plus récent), supprimer les autres
                const idsToDelete = households.slice(1).map(h => h.id);
                console.log(`Fusion de ${d.numeroordre} : Suppression des IDs [${idsToDelete.join(', ')}]`);
                
                await prisma.household.deleteMany({
                    where: { id: { in: idsToDelete } }
                });
            }
        }

        // Nettoyer auss les ménages sans numeroordre (s'il y en a plus d'un ?)
        // Ou juste les supprimer s'ils n'ont pas de coordonnées (points fantômes)
        const orphans = await prisma.household.deleteMany({
            where: {
                numeroordre: null,
                name: null,
                deletedAt: null
            }
        });
        if (orphans.count > 0) console.log(`${orphans.count} ménages orphelins supprimés.`);

    } catch (e) {
        console.error('Erreur:', e);
    } finally {
        await prisma.$disconnect();
    }
}

checkAndClean();
