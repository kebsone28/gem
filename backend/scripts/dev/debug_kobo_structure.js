import prisma from './src/core/utils/prisma.js';

console.log('\n🔍 === STRUCTURE COMPLÈTE DU MÉNAGE KOBO ===\n');

try {
  const household = await prisma.household.findFirst({
    where: { source: 'Kobo' }
  });

  if (household) {
    console.log('ID:', household.id);
    console.log('Nom:', household.name);
    console.log('Téléphone:', household.phone);
    console.log('Région:', household.region);
    console.log('Latitude:', household.latitude);
    console.log('Longitude:', household.longitude);
    console.log('Status:', household.status);
    console.log('\nLocation (GeoJSON):');
    console.log(JSON.stringify(household.location, null, 2));
    console.log('\nKoboData (extrait):');
    const kobo = household.koboData;
    if (kobo) {
      console.log('  _id:', kobo._id);
      console.log('  _geolocation:', kobo._geolocation);
      console.log('  nom_prenom:', kobo.nom_prenom);
      console.log('  telephone:', kobo.telephone);
      console.log('  region:', kobo.region);
    }
  } else {
    console.log('Aucun ménage Kobo trouvé');
  }

} catch (err) {
  console.error('❌ Erreur:', err.message);
}

process.exit(0);
