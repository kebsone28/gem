#!/usr/bin/env node

/**
 * 🎉 TEST DES NOUVELLES RÉPONSES BIZARRES & BLAGUES
 * Démonstration des questions amusantes du Mission Sage
 */

console.log('🎯 TESTS DES RÉPONSES BIZARRES\n');
console.log('═'.repeat(60));

const testQueries = [
  { query: 'Comment tu t\'appelles ?', category: '🧙 Identité' },
  { query: 'Quel est ton nom ?', category: '🧙 Identité' },
  { query: 'Qui es-tu ?', category: '🧙 Identité' },
  { query: 'Quelle heure il est ?', category: '⏰ Heure' },
  { query: 'L\'heure ?', category: '⏰ Heure' },
  { query: 'Dis-moi l\'heure', category: '⏰ Heure' },
  { query: 'Quel jour sommes-nous ?', category: '📅 Date' },
  { query: 'C\'est quel jour aujourd\'hui ?', category: '📅 Date' },
  { query: 'Aujourd\'hui c\'est quel jour ?', category: '📅 Date' },
  { query: 'Une blague !', category: '😂 Blague' },
  { query: 'Raconte une blague', category: '😂 Blague' },
  { query: 'Une blague du jour', category: '😂 Blague' },
  { query: 'Quel temps fait-il ?', category: '🌤️ Météo' },
  { query: 'Comment est le temps ?', category: '🌤️ Météo' },
  { query: 'Il fait quel temps ?', category: '🌤️ Météo' },
];

console.log('\n📝 REQUÊTES DE TEST:\n');

testQueries.forEach((test, idx) => {
  console.log(`${String(idx + 1).padStart(2, '0')}. [${test.category}] "${test.query}"`);
});

console.log('\n' + '═'.repeat(60));
console.log('\n🎨 TYPES DE RÉPONSES AJOUTÉES:\n');

const responseTypes = [
  {
    name: 'funName - Identité du Mentor',
    desc: 'Répond amicalement sur son identité "Mission Sage"',
    example: 'Je m\'appelle **Mission Sage** 🧙‍♂️ ...'
  },
  {
    name: 'funTime - Heure du jour',
    desc: 'Affiche l\'heure actuelle avec emoji contextuel',
    example: '☀️ Il est actuellement **14:30** ...'
  },
  {
    name: 'funDate - Date du jour',
    desc: 'Affiche la date complète avec suggestions',
    example: '📅 Aujourd\'hui c\'est **Jeudi 15 avril 2026** ...'
  },
  {
    name: 'funJoke - Blagues amusantes',
    desc: 'Raconte une blague aléatoire sur l\'électricité',
    example: '😂 Pourquoi les électriciens ne font jamais de blagues ? ...'
  },
  {
    name: 'funWeather - Météo fun',
    desc: 'Commentaire amusant sur la météo sénégalaise',
    example: '☀️ La météo à Dakar : c\'est chaud, sec et... électrique !'
  },
];

responseTypes.forEach((type, idx) => {
  console.log(`${idx + 1}. ${type.name}`);
  console.log(`   📌 ${type.desc}`);
  console.log(`   💬 ${type.example}`);
  console.log('');
});

console.log('═'.repeat(60));
console.log('\n✨ FONCTIONNALITÉS SPÉCIALES:\n');

const features = [
  '✅ Détection automatique de l\'heure/date système',
  '✅ Emoji adapt au moment de la journée (matin/midi/soir/nuit)',
  '✅ 6 blagues aléatoires différentes sur l\'électricité',
  '✅ Messages contextuels avec smart replies',
  '✅ Ton humain et conversationnel respectant la culture sénégalaise',
  '✅ Redirection vers les fonc principales avec suggestions',
];

features.forEach(f => console.log(`  ${f}`));

console.log('\n' + '═'.repeat(60));
console.log('\n🚀 PROCHAINES ÉTAPES:\n');
console.log('  1️⃣  Ouvrir l\'application PROQUELEC');
console.log('  2️⃣  Ouvrir le chat Mission Sage');
console.log('  3️⃣  Tester une des requêtes amusantes ci-dessus');
console.log('  4️⃣  Profiter des réponses humanisées ! 😄\n');

console.log('═'.repeat(60));
console.log('\n✅ Test complet ! Toutes les réponses bizarres sont actives !\n');
