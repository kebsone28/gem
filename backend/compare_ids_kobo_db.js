import prisma from './src/core/utils/prisma.js';

const KOBO_API_URL = process.env.KOBO_API_URL || 'https://kf.kobotoolbox.org';
const KOBO_TOKEN   = process.env.KOBO_TOKEN || '';
const KOBO_FORM_ID = process.env.KOBO_FORM_ID || '';

console.log('\n🔍 === COMPARAISON DES IDs: KOBO vs BASE DE DONNÉES ===\n');

try {
  // 1. Get Kobo submissions from API
  console.log('📡 Récupération des soumissions Kobo...');
  let koboSubmissions = [];
  
  if (KOBO_TOKEN && KOBO_FORM_ID) {
    const url = `${KOBO_API_URL}/api/v2/assets/${KOBO_FORM_ID}/data/?format=json&limit=5000`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Token ${KOBO_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      koboSubmissions = data.results || [];
      console.log(`✅ ${koboSubmissions.length} soumissions Kobo trouvées\n`);
    } else {
      console.log('⚠️ Impossible de récupérer les soumissions Kobo\n');
    }
  }

  // 2. Get households from database
  console.log('🗄️ Récupération des ménages Kobo en BD...');
  const bdHouseholds = await prisma.household.findMany({
    where: { source: 'Kobo' },
    select: {
      id: true,
      name: true,
      phone: true,
      koboSubmissionId: true
    }
  });
  console.log(`✅ ${bdHouseholds.length} ménages Kobo en BD\n`);

  // 3. Compare
  console.log('📊 === COMPARAISON ===\n');
  
  if (koboSubmissions.length > 0) {
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ Kobo ID (dans API) │ BD koboSubmissionId │ BD id (UUID)          │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    
    koboSubmissions.forEach(sub => {
      const koboId = sub['_id'];
      const matched = bdHouseholds.find(h => 
        h.koboSubmissionId === BigInt(koboId)
      );
      
      const koboIdStr = String(koboId).padEnd(18);
      const bdIdStr = matched ? String(matched.koboSubmissionId).padEnd(18) : 'NOT FOUND'.padEnd(18);
      const uuidStr = matched ? matched.id.substring(0, 20).padEnd(21) : '-'.padEnd(21);
      
      console.log(
        `│ ${koboIdStr} │ ${bdIdStr} │ ${uuidStr} │`
      );
    });
    
    console.log('└─────────────────────────────────────────────────────────────────┘');
  }

  // 4. Summary
  console.log('\n📈 RÉSUMÉ:');
  const matched = bdHouseholds.filter(h => 
    koboSubmissions.some(s => BigInt(s['_id']) === h.koboSubmissionId)
  );
  
  console.log(`  - Soumissions Kobo: ${koboSubmissions.length}`);
  console.log(`  - Ménages en BD: ${bdHouseholds.length}`);
  console.log(`  - IDs synchronisés correctement: ${matched.length}`);
  console.log(`  - Écart: ${Math.abs(koboSubmissions.length - bdHouseholds.length)}`);

  // 5. Detailed comparison
  if (koboSubmissions.length > 0 && bdHouseholds.length > 0) {
    console.log('\n\n📋 DÉTAIL DES MÉNAGES:\n');
    
    koboSubmissions.forEach((sub, i) => {
      const koboId = sub['_id'];
      const matched = bdHouseholds.find(h => 
        h.koboSubmissionId === BigInt(koboId)
      );
      
      console.log(`${i + 1}. Kobo ID: ${koboId}`);
      console.log(`   Nom: ${sub['nom_prenom'] || sub['chef_menage'] || '(pas de nom)'}`);
      console.log(`   Téléphone: ${sub['telephone'] || sub['phone'] || '(pas de tel)'}`);
      
      if (matched) {
        console.log(`   ✅ BD ID (UUID): ${matched.id}`);
        console.log(`   ✅ Synchronisé`);
      } else {
        console.log(`   ❌ Non synchronisé en BD`);
      }
      console.log('');
    });
  }

} catch (err) {
  console.error('❌ Erreur:', err.message);
}

process.exit(0);
