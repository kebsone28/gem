/**
 * fix_kobo_region_gps_mismatch.js
 * 
 * Ce script identifie et corrige les ménages Kobo où la région ne correspond pas au GPS.
 * Il utilise une mapping simple région ↔ bbox GPS pour détecter et corriger les incohérences.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Bounding boxes for Senegal regions (lat1, lat2, lon1, lon2)
const REGION_GPS_BOUNDS = {
  'Dakar': { latMin: 14.5, latMax: 15.0, lonMin: -17.8, lonMax: -17.3 },
  'Thiès': { latMin: 14.0, latMax: 15.0, lonMin: -16.8, lonMax: -15.8 },
  'Kaolack': { latMin: 13.1, latMax: 14.2, lonMin: -15.9, lonMax: -14.9 },
  'Tambacounda': { latMin: 13.7, latMax: 14.9, lonMin: -13.7, lonMax: -12.5 },
  'Matam': { latMin: 14.2, latMax: 15.9, lonMin: -12.8, lonMax: -11.5 },
  'Kolda': { latMin: 12.9, latMax: 13.9, lonMin: -15.3, lonMax: -14.0 },
  'Ziguinchor': { latMin: 13.0, latMax: 13.8, lonMin: -15.6, lonMax: -15.0 },
  'Région de Saint-Louis': { latMin: 15.0, latMax: 16.8, lonMin: -16.5, lonMax: -13.5 },
  'Kaffrine': { latMin: 13.1, latMax: 14.2, lonMin: -15.0, lonMax: -14.1 },
  'Louga': { latMin: 14.8, latMax: 15.9, lonMin: -15.4, lonMax: -14.2 }
};

/**
 * Determine region from GPS coordinates using bounding boxes
 */
function determineRegionFromGPS(latitude, longitude) {
  for (const [region, bounds] of Object.entries(REGION_GPS_BOUNDS)) {
    if (
      latitude >= bounds.latMin && latitude <= bounds.latMax &&
      longitude >= bounds.lonMin && longitude <= bounds.lonMax
    ) {
      return region;
    }
  }
  return null;
}

/**
 * Check if GPS is within the expected region bounds
 */
function isGPSInRegion(latitude, longitude, region) {
  const bounds = REGION_GPS_BOUNDS[region];
  if (!bounds) return false; // Unknown region
  
  return (
    latitude >= bounds.latMin && latitude <= bounds.latMax &&
    longitude >= bounds.lonMin && longitude <= bounds.lonMax
  );
}

async function analyzeAndFixMismatches() {
  try {
    console.log('=== ANALYSE ET CORRECTION: RÉGION ↔ GPS ===\n');

    // Get all households with GPS from Kobo source
    const koboHouseholds = await prisma.household.findMany({
      where: {
        source: 'Kobo',
        deletedAt: null,
        OR: [
          { latitude: { not: null } },
          { longitude: { not: null } }
        ]
      },
      select: {
        id: true,
        region: true,
        latitude: true,
        longitude: true,
        village: true,
        name: true,
        phone: true
      }
    });

    console.log(`📊 Analysant ${koboHouseholds.length} ménages Kobo avec GPS\n`);

    const mismatches = [];
    const corrections = [];

    for (const h of koboHouseholds) {
      if (!h.latitude || !h.longitude) continue;

      const isValid = isGPSInRegion(h.latitude, h.longitude, h.region);
      
      if (!isValid) {
        const actualRegion = determineRegionFromGPS(h.latitude, h.longitude);
        
        mismatches.push({
          id: h.id,
          assignedRegion: h.region,
          actualRegion: actualRegion || '(Inconnu)',
          gps: `${h.latitude}, ${h.longitude}`,
          name: h.name,
          phone: h.phone
        });

        if (actualRegion) {
          corrections.push({ id: h.id, newRegion: actualRegion });
        }
      }
    }

    // Display mismatches
    console.log(`⚠️ MISMATCHES DÉTECTÉS : ${mismatches.length}\n`);
    mismatches.forEach(m => {
      console.log(`ID: ${m.id}`);
      console.log(`  Région assignée: ${m.assignedRegion}`);
      console.log(`  Région GPS réelle: ${m.actualRegion}`);
      console.log(`  Coordonnées: ${m.gps}`);
      console.log(`  Nom: ${m.name}`);
      console.log(`  Téléphone: ${m.phone}\n`);
    });

    // Show correction summary
    if (corrections.length > 0) {
      console.log(`✅ CORRECTIONS POSSIBLES : ${corrections.length}\n`);
      corrections.forEach(c => {
        console.log(`  ${c.id} → ${c.newRegion}`);
      });

      // Ask for confirmation and apply
      console.log(`\n🔧 Application des corrections...\n`);
      
      let corrected = 0;
      for (const { id, newRegion } of corrections) {
        try {
          await prisma.household.update({
            where: { id },
            data: { region: newRegion }
          });
          corrected++;
          console.log(`  ✅ ${id} → ${newRegion}`);
        } catch (err) {
          console.error(`  ❌ Erreur pour ${id}:`, err.message);
        }
      }

      console.log(`\n${corrected}/${corrections.length} ménages corrigés`);
    } else {
      console.log('\n❌ Aucune région GPS n\'a pu être déterminée pour les mismatches détectés');
      console.log('💡 Solution: Vérifiez les coordonnées ou étendez REGION_GPS_BOUNDS');
    }

    // Summary
    console.log(`\n📈 RÉSUMÉ:`);
    console.log(`  Ménages Kobo avec GPS: ${koboHouseholds.length}`);
    console.log(`  Avec mismatch région: ${mismatches.length}`);
    console.log(`  Corrigés: ${corrections.length}`);

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeAndFixMismatches();
