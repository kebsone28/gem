
import 'dotenv/config';
import prisma from './src/core/utils/prisma.js';

// --- LOGIQUE EXTRAITE DE L'AGENT ---
function toNumber(value) {
    if (value === null || value === undefined) return null;
    const cleaned = String(value).replace(',', '.');
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
}

function mapCoreIdentity(submission) {
    const koboId = 999999; // Mock
    const numeroOrdreStr = "4526";

    const latKeys = ['TYPE_DE_VISITE/latitude_key', 'TYPE_DE_VISITE/latitude', 'latitude_key', 'latitude', 'Latitude', '_latitude', 'gps/latitude'];
    const lonKeys = ['TYPE_DE_VISITE/longitude_key', 'TYPE_DE_VISITE/longitude', 'longitude_key', 'longitude', 'Longitude', '_longitude', 'gps/longitude'];

    let lat = null;
    let lon = null;

    for (const key of latKeys) {
        const val = toNumber(submission[key]);
        if (val !== null) { lat = val; break; }
    }
    for (const key of lonKeys) {
        const val = toNumber(submission[key]);
        if (val !== null) { lon = val; break; }
    }

    if (lat === null || lon === null) return null;

    return {
        id: koboId,
        numeroordre: numeroOrdreStr,
        name: submission['Prenom et Nom'] || 'Unknown',
        latitude: lat,
        longitude: lon
    };
}

async function runTest() {
    // DONNÉES EXACTES DE LA CAPTURE D'ÉCRAN KOBO
    const rawKoboSubmission = {
        "Numero_ordre": "4526",
        "Prenom et Nom": "MAODO DIALLO",
        "Telephone": "784050111",
        "Latitude": "13.3259006",
        "Longitude": "-13.5493017"
    };

    console.log("🧪 Test de mapping avec les données de la capture d'écran...");
    const identity = mapCoreIdentity(rawKoboSubmission);

    if (identity) {
        console.log("✅ Mapping RÉUSSI !");
        console.log(`📍 Latitude extraite  : ${identity.latitude}`);
        console.log(`📍 Longitude extraite : ${identity.longitude}`);
        console.log(`👤 Nom               : ${identity.name}`);
        
        // Mise à jour en DB pour confirmer
        await prisma.household.update({
            where: { numeroordre: "4526" },
            data: {
                latitude: identity.latitude,
                longitude: identity.longitude,
                location: { type: 'Point', coordinates: [identity.longitude, identity.latitude] }
            }
        });
        
        // PostGIS update
        await prisma.$executeRaw`UPDATE "Household" SET location_gis = ST_SetSRID(ST_MakePoint(${identity.longitude}, ${identity.latitude}), 4326) WHERE numeroordre = '4526'`;
        
        console.log("💾 Base de données mise à jour avec les coordonnées RÉELLES de Kobo.");
    } else {
        console.error("❌ Échec du mapping. Coordonnées non trouvées.");
    }
}

runTest().catch(console.error).finally(() => prisma.$disconnect());
