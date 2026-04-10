
import prisma from './src/core/utils/prisma.js';

// --- COPIE DE LA LOGIQUE DE L'AGENT POUR LE TEST (CAR NON EXPORTÉE) ---

const WALL_TYPES = { "mur standard": "STANDARD", "banco": "BANCO", "mur en forme de cheminée": "CHIMNEY" };
const KIT_STATUS = { "complet": "COMPLETE", "oui": "COMPLETE", "incomplet": "INCOMPLETE" };

function normalizeValue(value, dictionary) {
    if (!value) return null;
    const v = String(value).toLowerCase().trim();
    return dictionary[v] || "UNKNOWN";
}

function toNumber(value) {
    if (value === null || value === undefined) return null;
    const cleaned = String(value).replace(',', '.');
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
}

function mapKoboToConstruction(kobo) {
    let result = { problems: [], others: [], meta: { source: "test_scenario", timestamp: new Date().toISOString() } };

    // Wall
    if (kobo['mur']) result.wallType = normalizeValue(kobo['mur'], WALL_TYPES);
    
    // Kit
    if (kobo['kit']) result.kit = { status: normalizeValue(kobo['kit'], KIT_STATUS) };

    // Earth
    if (kobo['resistance_terre']) result.earthResistance = toNumber(kobo['resistance_terre']);

    // Interior/Network
    if (kobo['etat_installation']) result.interiorStatus = normalizeValue(kobo['etat_installation'], { "terminee": "COMPLETE", "non_terminee": "IN_PROGRESS" });
    if (kobo['etat_branchement']) result.networkStatus = normalizeValue(kobo['etat_branchement'], { "termine": "COMPLETE", "en_cours": "IN_PROGRESS" });

    // Audits
    result.audit = {
        wall_conforme: kobo['wall_audit'] || 'conforme',
        branchement_conforme: kobo['network_audit'] || 'conforme',
        installation_conforme: kobo['interior_audit'] || 'conforme'
    };

    return result;
}

function calculateAlerts(data) {
    const alerts = [];
    if (data.earthResistance > 1500) alerts.push({ type: 'TERRE_DANGEREUSE', severity: 'HIGH', message: `Resistance excessive: ${data.earthResistance} Ohms` });
    if (data.wallType === "BANCO" || data.audit?.wall_conforme === "non_conforme") alerts.push({ type: 'MUR_NON_CONFORME', severity: 'HIGH', message: "Maçonnerie non conforme ou sur support banco." });
    if (data.audit?.branchement_conforme === "non_conforme") alerts.push({ type: 'BRANCHEMENT_ANOMALIE', severity: 'HIGH', message: "Défaut majeur lors du branchement réseau." });
    if (data.kit?.status === "INCOMPLETE") alerts.push({ type: 'KIT_MANQUANT', severity: 'MEDIUM', message: "Accessoires ou kit incomplet." });
    return alerts;
}

function computeGlobalStatus(data, alerts) {
    if (alerts && alerts.some(a => a.severity === 'HIGH')) return "BLOQUE";
    if (data.interiorStatus === "COMPLETE") return "TERMINE";
    if (data.networkStatus === "COMPLETE") return "BRANCHEMENT";
    if (data.wallType === "STANDARD") return "MUR";
    if (data.kit?.status === "COMPLETE") return "LIVRE";
    return "NON_DEMARRE";
}

// --- SCÉNARIOS DE TEST ---

const SCENARIOS = [
    {
        name: "1. LIVRAISON OK",
        kobo: { kit: "complet" }
    },
    {
        name: "2. MUR BANCO (BLOCAGE)",
        kobo: { kit: "complet", mur: "banco" }
    },
    {
        name: "3. MUR OK + RÉSEAU BLOQUÉ",
        kobo: { kit: "complet", mur: "mur standard", network_audit: "non_conforme" }
    },
    {
        name: "4. RÉUSSITE TOTALE",
        kobo: { kit: "complet", mur: "mur standard", etat_branchement: "termine", etat_installation: "terminee", resistance_terre: 45 }
    },
    {
        name: "5. TERRE DANGEREUSE (>1500 Ohms)",
        kobo: { kit: "complet", mur: "mur standard", etat_branchement: "termine", etat_installation: "terminee", resistance_terre: 1850 }
    }
];

async function runTest() {
    const NUMERO_ORDRE = "4526";
    console.log(`\n🚀 DÉMARRAGE DES TESTS POUR LE MÉNAGE: ${NUMERO_ORDRE}\n`);

    let household = await prisma.household.findUnique({ where: { numeroordre: NUMERO_ORDRE } });
    if (!household) {
        console.log(`⚠️ Ménage ${NUMERO_ORDRE} non trouvé. Création d'un ménage de test...`);
        const project = await prisma.project.findFirst();
        const zone = await prisma.zone.findFirst({ where: { projectId: project.id } });
        
        household = await prisma.household.create({
            data: {
                numeroordre: NUMERO_ORDRE,
                name: "Ménage Test 4526",
                status: "NON_DEMARRE",
                organizationId: project.organizationId,
                zoneId: zone.id,
                location: { type: "Point", coordinates: [-13.2, 14.5] },
                owner: { nom: "Test User", telephone: "770000000" }
            }
        });
        console.log(`✅ Ménage ${NUMERO_ORDRE} créé avec ID: ${household.id}`);
    }

    let currentConstructionData = {}; // On repart de zéro pour chaque test ou on accumule ?
    // Ici on repart de zéro pour voir l'effet de chaque soumission "cumulée"

    for (const scenario of SCENARIOS) {
        console.log(`-------------------------------------------`);
        console.log(`📂 SCÉNARIO: ${scenario.name}`);
        
        const freshMapping = mapKoboToConstruction(scenario.kobo);
        
        // Simulation du Merge (Accumulation des données terrain)
        currentConstructionData = {
            ...currentConstructionData,
            ...freshMapping,
            audit: { ...(currentConstructionData.audit || {}), ...freshMapping.audit }
        };

        const alerts = calculateAlerts(currentConstructionData);
        const globalStatus = computeGlobalStatus(currentConstructionData, alerts);

        console.log(`📊 STATUT FINAL : ${globalStatus}`);
        if (alerts.length > 0) {
            console.log(`🚨 ALERTES      : ${alerts.map(a => `[${a.severity}] ${a.type}: ${a.message}`).join(', ')}`);
        } else {
            console.log(`✅ AUCUNE ALERTE`);
        }
        
        // Mise à jour réelle en DB pour voir sur le dashboard
        await prisma.household.update({
            where: { id: household.id },
            data: {
                constructionData: currentConstructionData,
                alerts: alerts,
                status: globalStatus
            }
        });
        console.log(`💾 Mise à jour DB effectuée.`);
    }

    console.log(`\n🏁 FIN DES TESTS SCÉNARIOS.\n`);
}

runTest().catch(console.error).finally(() => prisma.$disconnect());
