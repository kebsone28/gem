import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function finalDiagnosis() {
  try {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║         DIAGNOSTIC FINAL: DIVERGENCE MÉNAGES 3536 vs 10879  ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    // 1. Comptage total
    const totalCount = await prisma.household.count({ where: { deletedAt: null } });
    console.log(`1. NOMBRE TOTAL DE MÉNAGES: ${totalCount}\n`);

    // 2. Comptage par région
    const byRegion = await prisma.household.groupBy({
      by: ['region'],
      where: { deletedAt: null },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });

    console.log('2. RÉPARTITION PAR RÉGION:');
    byRegion.forEach(r => {
      const pct = ((r._count.id / totalCount) * 100).toFixed(1);
      console.log(`   ${(r.region || '(Sans région)').padEnd(20)} : ${r._count.id.toString().padStart(5)} (${pct}%)`);
    });

    // 3. Vérifier les ménages avec données manquantes
    const incompletes = await prisma.household.count({
      where: { deletedAt: null, name: null }
    });

    const withName = await prisma.household.count({
      where: { deletedAt: null, name: { not: null } }
    });

    console.log(`\n3. QUALITÉ DES DONNÉES:`);
    console.log(`   Ménages avec NOM: ${withName} (${((withName / totalCount) * 100).toFixed(1)}%)`);
    console.log(`   Ménages SANS NOM: ${incompletes} (${((incompletes / totalCount) * 100).toFixed(1)}%)`);

    // 4. Distribution par source
    const bySource = await prisma.household.groupBy({
      by: ['source'],
      where: { deletedAt: null },
      _count: { id: true }
    });

    console.log(`\n4. SOURCE DES MÉNAGES:`);
    bySource.forEach(s => {
      console.log(`   ${(s.source || '(null)').padEnd(15)} : ${s._count.id}`);
    });

    // 5. Calcul de l'écart
    console.log(`\n5. ANALYSE DE L'ÉCART:`);
    console.log(`   Ménages rapporté comme importé: 3,536`);
    console.log(`   Ménages affichés: ${totalCount}`);
    console.log(`   Différence: +${totalCount - 3536} ménages`);
    console.log(`   Ratio: ${(totalCount / 3536).toFixed(2)}x`);

    // 6. Recommandations
    console.log(`\n6. HYPOTHÈSES POSSIBLES:`);
    console.log(`   a) Import 3,536 + Anciennes données 7,343 = 10,879 (ADDITION)`);
    console.log(`   b) Import 3,536 × 3 = 10,608 ≈ 10,879 (3 RÉIMPORTATIONS)`);
    console.log(`   c) Import partiel (3,536 ménages avec NOM sur 10,879 total)`);

    console.log(`\n7. RECOMMANDATIONS:`);
    console.log(`   • Si l'hypothèse est (a): Nettoyer les ANCIENNES données (9,343)`);
    console.log(`   • Si l'hypothèse est (b): Nettoyer les DOUBLONS (garder 1 seule version)`);
    console.log(`   • Si l'hypothèse est (c): Vérifier s'il y a des données mal importées`);

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

finalDiagnosis();
