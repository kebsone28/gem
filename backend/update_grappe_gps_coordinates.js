import prisma from './src/core/utils/prisma.js';

async function updateGrappeGpsCoordinates() {
  try {
    console.log('=== Mise à jour des coordonnées GPS des grappes ===\n');

    const organizationId = 'c15a8abb-8e28-44f4-9c65-a73f72bdc836';

    // Coordonnées GPS des centroïdes calculés depuis le script de synchronisation
    const grappeGpsCoordinates = {
      'KAF_G001': { lat: 14.193452, lon: -15.482235 },
      'KAF_G002': { lat: 14.223507, lon: -15.438862 },
      'KAF_G003': { lat: 14.228686, lon: -15.405225 },
      'KAF_G004': { lat: 14.275439, lon: -15.342173 },
      'KAF_G005': { lat: 14.291424, lon: -15.335124 },
      'KAF_G006': { lat: 14.210866, lon: -15.384051 },
      'TAM_G001': { lat: 13.442218, lon: -13.694104 },
      'TAM_G002': { lat: 13.471670, lon: -13.713139 },
      'TAM_G003': { lat: 13.411199, lon: -13.673952 }
    };

    // Récupérer toutes les grappes
    const grappes = await prisma.cartoGrappe.findMany({
      where: { organizationId, active: true },
      include: { region: true }
    });

    console.log(`Grappes trouvées: ${grappes.length}\n`);

    // Mettre à jour les coordonnées GPS pour chaque grappe
    for (const grappe of grappes) {
      const coords = grappeGpsCoordinates[grappe.grappeKey];
      
      if (coords) {
        await prisma.cartoGrappe.update({
          where: { id: grappe.id },
          data: {
            gpsLat: coords.lat,
            gpsLng: coords.lon
          }
        });
        
        console.log(`✓ ${grappe.grappeKey} (${grappe.region.name}): ${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`);
      } else {
        console.log(`⚠ ${grappe.grappeKey}: Pas de coordonnées GPS disponibles`);
      }
    }

    console.log('\n✅ Mise à jour des coordonnées GPS terminée');

  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateGrappeGpsCoordinates();