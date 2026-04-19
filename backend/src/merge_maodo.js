import prisma from './core/utils/prisma.js';

async function mergeMaodo() {
    console.log('--- 🛡️ Fusion Chirurgicale : Maodo Diallo (Secure) ---');
    try {
        // 1. Identifier le "Vrai" Maodo
        const realMaodo = await prisma.household.findFirst({
            where: { name: { contains: 'MAODO DIALLO', mode: 'insensitive' } }
        });

        if (!realMaodo) {
            console.warn('⚠️ Maodo Diallo original introuvable.');
            return;
        }

        // 2. Identifier le "Fantôme" (ID 3536)
        const ghost3536 = await prisma.household.findUnique({
            where: { id: '3536' }
        });

        if (!ghost3536) {
            console.warn('⚠️ Le record cible (3536) est introuvable.');
            return;
        }

        console.log(`🚀 Fusion de [${realMaodo.id}] vers [3536]...`);

        // 3. Opération Atomique pour éviter les violations de contrainte UNIQUE
        await prisma.$transaction([
            // Libérer le koboSubmissionId du record source
            prisma.household.update({
                where: { id: realMaodo.id },
                data: { koboSubmissionId: null }
            }),
            // Appliquer les données au record cible
            prisma.household.update({
                where: { id: '3536' },
                data: {
                    name: realMaodo.name,
                    phone: realMaodo.phone,
                    owner: realMaodo.owner,
                    status: realMaodo.status,
                    koboSubmissionId: realMaodo.koboSubmissionId,
                    koboData: realMaodo.koboData,
                    location: realMaodo.location,
                    latitude: realMaodo.latitude,
                    longitude: realMaodo.longitude,
                    region: realMaodo.region,
                    departement: realMaodo.departement,
                    village: realMaodo.village,
                    source: 'SYNCHRONIZED_FIX'
                }
            }),
            // Supprimer la source
            prisma.household.delete({
                where: { id: realMaodo.id }
            })
        ]);

        console.log('✅ Fusion réussie : Maodo Diallo est maintenant sur le record 3536.');

        // 4. Nettoyage de l'extra 3537 s'il est vide
        const ghost3537 = await prisma.household.findUnique({ where: { id: '3537' } });
        if (ghost3537 && !ghost3537.name) {
            console.log('🗑️ Suppression du record extra 3537 (sans nom)');
            await prisma.household.delete({ where: { id: '3537' } });
        }

        const count = await prisma.household.count({ where: { deletedAt: null } });
        console.log(`📊 Nouveau total des ménages : ${count}`);

    } catch (e) {
        console.error('❌ Erreur Critique pendant la fusion:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

mergeMaodo();
