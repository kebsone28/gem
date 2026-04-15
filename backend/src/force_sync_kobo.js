import { syncKoboToDatabase } from './services/kobo.service.js';
import prisma from './core/utils/prisma.js';
import dotenv from 'dotenv';

dotenv.config();

async function forceFullSync() {
    console.log('🚀 DÉMARRAGE DE LA SYNCHRONISATION TOTALE (FORCE)...');
    
    try {
        // 1. Obtenir ou créer l'organisation
        let org = await prisma.organization.findFirst();
        if (!org) {
            console.log('🏗️ Création organisation PROQUELEC...');
            org = await prisma.organization.create({
                data: { id: 'proquelec-org-id', name: 'PROQUELEC' }
            });
        }

        // 2. Obtenir ou créer un projet par défaut
        let project = await prisma.project.findFirst({ where: { organizationId: org.id } });
        if (!project) {
            console.log('🏗️ Création projet MFR PROQUELEC...');
            project = await prisma.project.create({
                data: {
                    name: 'MFR PROQUELEC',
                    status: 'active',
                    organizationId: org.id,
                    budget: 1000000,
                    duration: 12,
                    totalHouses: 5000,
                    config: {
                        kobo: {
                            token: process.env.KOBO_TOKEN,
                            assetUid: process.env.KOBO_FORM_ID
                        }
                    }
                }
            });
        }

        // 3. Obtenir ou créer une zone par défaut
        let zone = await prisma.zone.findFirst({ where: { projectId: project.id } });
        if (!zone) {
            console.log('🏗️ Création zone PILOTE...');
            zone = await prisma.zone.create({
                data: {
                    name: 'PILOTE',
                    projectId: project.id,
                    organizationId: org.id
                }
            });
        }

        // 4. Lancer la synchronisation
        // On passe 'new Date(0)' pour forcer Kobo à renvoyer TOUTES les données depuis 1970
        const results = await syncKoboToDatabase(org.id, zone.id, new Date(0));

        console.log('✅ SYNCHRONISATION TERMINÉE !');
        console.log(`Résultats : ${results.applied} appliqués, ${results.skipped} ignorés, ${results.errors} erreurs.`);
        
    } catch (error) {
        console.error('❌ ERREUR SYNC:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

forceFullSync();
