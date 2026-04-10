
import 'dotenv/config';
import prisma from './src/core/utils/prisma.js';
import { recalculateProjectGrappes } from './src/services/project_config.service.js';

/**
 * MISSION CRITIQUE: AGENT DE SYNCHRONISATION KOBO HAUTEMENT SPÉCIALISÉ V2 (Production-Ready)
 * Form ID: aEYZwPujJiFBTNb6mxMGCB
 */

const KOBO_API_URL = 'https://kf.kobotoolbox.org';
const KOBO_TOKEN   = process.env.KOBO_TOKEN;
const KOBO_FORM_ID = 'aEYZwPujJiFBTNb6mxMGCB';

// --- ⚙️ 1. DICTIONNAIRES (BASE SÉMANTIQUE) ---
const WALL_TYPES = {
    "mur standard": "STANDARD",
    "mur-standard": "STANDARD",
    "mur_standard": "STANDARD",
    "mur standard (2 poteaux)": "STANDARD",
    "mur en forme de cheminée": "CHIMNEY",
    "banco": "BANCO"
};

const KIT_STATUS = {
    "complet": "COMPLETE",
    "oui": "COMPLETE",
    "incomplet": "INCOMPLETE",
    "non": "INCOMPLETE",
    "non disponible": "UNAVAILABLE"
};

const VISIT_ROLES = {
    "livreur": "LIVRAISON",
    "elec": "INTERIEUR",
    "electricien": "INTERIEUR",
    "reseau": "RESEAU",
    "audit": "AUDIT",
    "controleur": "AUDIT"
};

const SITUATION_MENAGE = {
    "menage_non_eligible": "NON_ELIGIBLE",
    "desistement_du_menage": "DESISTEMENT"
};

const PROBLEM_KEYWORDS = ["probleme", "anomalie", "defaut", "erreur", "fissure", "fuite"];

// --- 🔄 2. NORMALISATION UNIFIÉE ---
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

function extractCoordinatesFromKeys(submission, latKeys, lonKeys) {
    let lat = null;
    let lon = null;

    for (const key of latKeys) {
        if (submission[key] != null) {
            const value = toNumber(submission[key]);
            if (Number.isFinite(value)) {
                lat = value;
                break;
            }
        }
    }

    for (const key of lonKeys) {
        if (submission[key] != null) {
            const value = toNumber(submission[key]);
            if (Number.isFinite(value)) {
                lon = value;
                break;
            }
        }
    }

    return { lat, lon };
}

function extractGpsArray(submission) {
    const gps = submission['GPS'] || submission['gps'] || submission['_geolocation'];
    if (!gps) return { lat: null, lon: null };

    if (Array.isArray(gps) && gps.length >= 2) {
        return { lat: toNumber(gps[0]), lon: toNumber(gps[1]) };
    }

    if (typeof gps === 'string') {
        const parts = gps.trim().split(/[ ,]+/);
        if (parts.length >= 2) {
            return { lat: toNumber(parts[0]), lon: toNumber(parts[1]) };
        }
    }

    return { lat: null, lon: null };
}

function computeDistanceMeters(lat1, lon1, lat2, lon2) {
    if ([lat1, lon1, lat2, lon2].some(v => v === null || v === undefined)) return Infinity;
    const toRad = (deg) => deg * Math.PI / 180;
    const R = 6371000; // rayon de la Terre en mètres
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function chooseBestCoordinates(baseGps, manualCoords, thresholdMeters = 30) {
    const hasBase = baseGps.lat !== null && baseGps.lon !== null;
    const hasManual = manualCoords.lat !== null && manualCoords.lon !== null;

    if (hasManual && !hasBase) return manualCoords;
    if (hasBase && !hasManual) return baseGps;
    if (!hasBase && !hasManual) return { lat: null, lon: null };

    const distance = computeDistanceMeters(baseGps.lat, baseGps.lon, manualCoords.lat, manualCoords.lon);
    if (process.env.DEBUG_SYNC) {
        console.log(`[DEBUG-SYNC] GPS vs manuel distance=${distance.toFixed(1)}m`, { baseGps, manualCoords });
    }

    return distance <= thresholdMeters ? manualCoords : baseGps;
}

// --- 🧠 3. DÉTECTION + MAPPING INTELLIGENT (ADAPTIVE) ---
function mapKoboToConstruction(submission) {
    const data = {
        kit: { status: "UNKNOWN", details: "" },
        audit: { branchement_conforme: "UNKNOWN" },
        wallType: "UNKNOWN",
        problems: [],
        installerTeam: "UNKNOWN",
        role: "UNKNOWN",
        situation: "UNKNOWN",
        networkStatus: "PLANNED",
        others: []
    };

    Object.entries(submission).forEach(([key, value]) => {
        if (!value) return;

        const k = key.toLowerCase();
        const v = String(value).toLowerCase();

        if (k.includes('kit') || k.includes('materiel')) data.kit.status = normalizeValue(value, KIT_STATUS);
        if (k.includes('mur') || k.includes('paroi')) data.wallType = normalizeValue(value, WALL_TYPES);
        if (k.includes('conforme')) data.audit.branchement_conforme = v.includes('oui') || v.includes('ok') ? "conforme" : "non-conforme";
        if (k.includes('equipe') || k.includes('team')) data.installerTeam = value;
        if (k.includes('role')) data.role = normalizeValue(value, VISIT_ROLES);
        if (k.includes('situation')) data.situation = normalizeValue(value, SITUATION_MENAGE);
        
        if (PROBLEM_KEYWORDS.some(word => k.includes(word) || v.includes(word))) {
            data.problems.push({ key, value });
        }

        if (!['kit', 'mur', 'conforme', 'equipe'].some(term => k.includes(term))) {
            data.others.push({ key, value, type: typeof value });
        }
    });

    return data;
}

function computeGlobalStatus(constructionData) {
    // 1. Priorité aux arrêts ou non-éligibilité
    if (constructionData.situation === "NON_ELIGIBLE") return "Non éligible";
    if (constructionData.situation === "DESISTEMENT") return "Désistement";
    
    // 2. Priorité à l'audit (L'étape finale)
    if (constructionData.audit.branchement_conforme === "conforme") return "Contrôle conforme";
    if (constructionData.audit.branchement_conforme === "non-conforme") return "Non conforme";
    
    // 3. Rôles opérationnels (Marqueurs d'étapes franchies)
    if (constructionData.role === "LIVRAISON") return "Livraison effectuée";
    if (constructionData.role === "INTERIEUR") return "Intérieur terminé";
    if (constructionData.role === "RESEAU") return "Réseau terminé";
    
    // 4. Murs (Étape initiale de construction)
    if (constructionData.wallType !== "UNKNOWN") return "Murs terminés";
    
    // Fallback par défaut
    return "Non encore commencé";
}

function calculateAlerts(constructionData) {
    const alerts = [];
    if (constructionData.wallType === "BANCO") alerts.push({ type: "CRITICAL", message: "Structure Banco détectée - Risque technique" });
    if (constructionData.problems.length > 0) alerts.push({ type: "WARNING", message: `${constructionData.problems.length} anomalies signalées` });
    return alerts;
}

function processKoboRecord(submission, existing = null) {
    const constructionData = mapKoboToConstruction(submission);
    const alerts = calculateAlerts(constructionData);
    
    if (existing) {
        const history = (existing.constructionData?.meta?.history || []);
        history.push({ timestamp: new Date(), confidence: 0 });
        constructionData.meta = { ...existing.constructionData?.meta, history, mergedAt: new Date() };
    }

    return { constructionData, alerts };
}

function mapCoreIdentity(submission) {
    const idKeys = ['Numero_ordre', 'numero_ordre', 'id_menage', 'numero_menage', 'identifiant_menage', 'NUMERO_ORDRE', 'MENAGE_ID'];
    let numeroOrdreStr = '';
    
    for (const key of idKeys) {
        if (submission[key]) {
            numeroOrdreStr = String(submission[key]).trim();
            break;
        }
    }

    if (!numeroOrdreStr || numeroOrdreStr === 'undefined') return null;

    const manualLatKeys = ['C2', 'TYPE_DE_VISITE/latitude_key', 'TYPE_DE_VISITE/latitude', 'latitude_key', 'latitude', 'Latitude', '_latitude'];
    const manualLonKeys = ['C4', 'TYPE_DE_VISITE/longitude_key', 'TYPE_DE_VISITE/longitude', 'longitude_key', 'longitude', 'Longitude', '_longitude'];
    const gpsLatKeys = ['gps/latitude'];
    const gpsLonKeys = ['gps/longitude'];

    const manualCoords = extractCoordinatesFromKeys(submission, manualLatKeys, manualLonKeys);
    let baseGpsCoords = extractGpsArray(submission);

    if ((baseGpsCoords.lat === null || baseGpsCoords.lon === null)) {
        baseGpsCoords = extractCoordinatesFromKeys(submission, gpsLatKeys, gpsLonKeys);
    }

    const chosenCoords = chooseBestCoordinates(baseGpsCoords, manualCoords, 100);

    return {
        id: String(submission['_id']),
        numeroordre: numeroOrdreStr,
        name: submission['TYPE_DE_VISITE/nom_key'] || submission['nom'] || submission['owner_name'] || 'Maodo Diallo',
        phone: submission['TYPE_DE_VISITE/telephone_key'] || submission['telephone'] || submission['phone'],
        region: submission['TYPE_DE_VISITE/region_key'] || submission['region'],
        latitude: chosenCoords.lat,
        longitude: chosenCoords.lon
    };
}

async function fetchAllKoboData() {
    const url = `${KOBO_API_URL}/api/v2/assets/${KOBO_FORM_ID}/data.json`;
    const response = await fetch(url, { headers: { 'Authorization': `Token ${KOBO_TOKEN}` } });
    if (!response.ok) throw new Error(`Kobo API Error: ${response.statusText}`);
    const data = await response.json();
    return data.results || [];
}

// --- ⚙️ 6. EXÉCUTION (API ou CLI) ---

export async function syncKoboData(orgIdOverride = null) {
    try {
        console.log("🚀 [KOBO-AGENT] DÉMARRAGE DE LA SYNCHRONISATION...");
        if (!KOBO_TOKEN) throw new Error("KOBO_TOKEN manquant");
        
        const submissions = await fetchAllKoboData();
        console.log(`[KOBO-AGENT] 📥 ${submissions.length} soumissions récupérées.`);

        const project = await prisma.project.findFirst({ where: { deletedAt: null } });
        if (!project) throw new Error("Aucun projet actif");
        const orgId = orgIdOverride || project.organizationId;
        const zoneCache = {};

        let applied = 0; let errors = 0;

        for (const raw of submissions) {
            try {
                const identity = mapCoreIdentity(raw);
                if (!identity) continue;

                let existing = await prisma.household.findUnique({ where: { numeroordre: identity.numeroordre } });
                if (!existing && identity.numeroordre) {
                    existing = await prisma.household.findFirst({
                        where: { OR: [ { id: identity.numeroordre }, { name: { equals: identity.name, mode: 'insensitive' } } ] }
                    });
                }

                const { constructionData, alerts } = processKoboRecord(raw, existing);
                const globalStatus = computeGlobalStatus(constructionData);
                const regionName = identity.region || 'Zone Inconnue';
                
                let zoneId = null;
                try {
                    if (!zoneCache[regionName]) {
                        let zone = await prisma.zone.findFirst({ where: { name: regionName, projectId: project.id } });
                        if (!zone) {
                            zone = await prisma.zone.create({ data: { name: regionName, projectId: project.id, organizationId: orgId } });
                        }
                        zoneCache[regionName] = zone.id;
                    }
                    zoneId = zoneCache[regionName];
                } catch (zoneError) {
                    console.warn(`[KOBO-SYNC] ⚠️ Unable to resolve zone "${regionName}": ${zoneError.message}. Using null zoneId.`);
                    zoneId = null;
                }

                const data = {
                    numeroordre: identity.numeroordre,
                    name: identity.name,
                    phone: identity.phone,
                    region: identity.region,
                    latitude: identity.latitude,
                    longitude: identity.longitude,
                    constructionData,
                    alerts,
                    status: globalStatus,
                    koboData: raw,
                    koboSync: {}, // Nettoyage de l'ancien mapping pour éviter les conflits de statut
                    koboSubmissionId: identity.id,
                    ...(zoneId && { zoneId }), // Only set zoneId if it's truthy
                    updatedAt: new Date(),
                    location: { type: 'Point', coordinates: [identity.longitude || 0, identity.latitude || 0] }
                };

                let household;
                if (existing) {
                    household = await prisma.household.update({ where: { id: existing.id }, data });
                } else {
                    household = await prisma.household.create({ data: { ...data, organizationId: orgId, owner: { nom: identity.name, telephone: identity.phone } } });
                }

                if (identity.latitude && identity.longitude) {
                    await prisma.$executeRaw`UPDATE "Household" SET location_gis = ST_SetSRID(ST_MakePoint(${identity.longitude}, ${identity.latitude}), 4326) WHERE id = ${household.id}`;
                }

                applied++;
            } catch (e) {
                console.error(`[KOBO-SYNC] ❌ Error applying submission ${raw._id}: ${e.message}`);
                errors++;
            }
        }

        console.log(`[KOBO-AGENT] ✅ Synchro terminée. Appliqués: ${applied}, Erreurs: ${errors}`);
        await recalculateProjectGrappes(project.id, orgId);
        return { applied, errors };
    } catch (error) {
        console.error("❌ [KOBO-AGENT] CRITICAL FAILURE:", error.message);
        throw error;
    }
}

if (process.argv[1] && process.argv[1].endsWith('kobo_specialized_sync_agent.js')) {
    syncKoboData().catch(console.error).finally(() => prisma.$disconnect());
}
