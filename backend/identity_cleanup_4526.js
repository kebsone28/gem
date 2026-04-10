
import prisma from './src/core/utils/prisma.js';

async function cleanup() {
    console.log("🧹 DÉBUT DU NETTOYAGE D'IDENTITÉ POUR 4526...");

    // 1. Trouver le doublon sans Numero d'ordre (Import manuel incomplet)
    const manualImport = await prisma.household.findFirst({
        where: { name: { contains: "Maodo Diallo" }, numeroordre: null }
    });

    // 2. Trouver le record synchronisé Kobo (Avec ID UUID)
    const koboSync = await prisma.household.findUnique({
        where: { numeroordre: "4526" }
    });

    if (manualImport && koboSync) {
        console.log(`⚠️ Trouvé : Doublon manuel (${manualImport.id}) et Doublon Kobo (${koboSync.id})`);
        
        // Fusionner : On garde le record Kobo (car il a les audits réels) mais on lui donne le nom propre
        await prisma.household.update({
            where: { id: koboSync.id },
            data: { name: "MAODO DIALLO" }
        });

        // Supprimer le doublon manuel incomplet pour éviter la confusion
        await prisma.household.delete({
            where: { id: manualImport.id }
        });

        console.log("✅ FUSION RÉUSSIE : Maodo Diallo est maintenant consolidé sous le Numero d'ordre 4526.");
    } else {
        console.log("ℹ️ Pas de doublon direct trouvé à fusionner.");
        
        // Au moins s'assurer que le record 4526 a le bon nom
        if (koboSync) {
             await prisma.household.update({
                where: { id: koboSync.id },
                data: { name: "MAODO DIALLO" }
            });
            console.log("✅ Nom mis à jour pour 4526.");
        }
    }
}

cleanup().catch(console.error).finally(() => prisma.$disconnect());
