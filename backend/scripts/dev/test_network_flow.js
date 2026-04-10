
import prisma from './src/core/utils/prisma.js';

// Configuration du dictionnaire (Extraite de l'agent industriel)
const DICTIONARIES = {
    KIT_STATUS: { "complet": "COMPLETE", "oui": "COMPLETE", "incomplet": "INCOMPLETE" },
    WALL_TYPES: { "mur standard": "STANDARD", "banco": "BANCO" },
    NETWORK_STATUS: { "termine": "COMPLETE", "en_cours": "IN_PROGRESS" },
    AUDIT_SENSE: { "conforme": "conforme", "non_conforme": "non_conforme" }
};

const NUMERO_ORDRE = "4526"; // Le ménage cible

async function simulateNetworkStep(koboSubmission, stepName) {
    console.log(`\n--- ÉTAPE RÉSEAU: ${stepName} ---`);
    
    // Fetch current
    const hh = await prisma.household.findUnique({ where: { numeroordre: NUMERO_ORDRE } });
    let data = (hh.constructionData || {}) ;

    // Map
    if (koboSubmission.etat_branchement) data.networkStatus = DICTIONARIES.NETWORK_STATUS[koboSubmission.etat_branchement.toLowerCase()] || "UNKNOWN";
    if (koboSubmission.network_audit) {
        data.audit = { 
            ...(data.audit || {}), 
            branchement_conforme: DICTIONARIES.AUDIT_SENSE[koboSubmission.network_audit.toLowerCase()] || "non_conforme"
        };
    }

    // Rules
    const alerts = [];
    if (data.audit?.branchement_conforme === "non_conforme") {
        alerts.push({ type: 'BRANCHEMENT_ANOMALIE', severity: 'HIGH', message: "Défaut majeur réseau (Audit)." });
    }

    // Status
    let status = hh.status;
    if (alerts.some(a => a.severity === 'HIGH')) status = "BLOQUE";
    else if (data.networkStatus === "COMPLETE") status = "BRANCHEMENT";

    // Persist
    await prisma.household.update({
        where: { id: hh.id },
        data: { constructionData: data, alerts: alerts, status: status }
    });
    console.log(`✅ [${stepName}] Persisté. Statut: ${status}`);
}

async function runDetailedTest() {
    console.log("🚀 Simulation TRANSITION RÉSEAU...");

    // 1. D'abord un blocage
    await simulateNetworkStep({ 
        etat_branchement: "en_cours", 
        network_audit: "non_conforme" 
    }, "DÉTECTION DÉFAUT");

    // 2. Puis résolution
    await simulateNetworkStep({ 
        etat_branchement: "termine", 
        network_audit: "conforme" 
    }, "CORRECTION RÉUSSIE");

    console.log("\n🏁 Test Réseau OK.");
}

runDetailedTest().catch(console.error).finally(() => prisma.$disconnect());
