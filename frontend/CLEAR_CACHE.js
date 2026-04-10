/**
 * CACHE CLEANER - À exécuter dans la console du navigateur (F12)
 * 
 * Copie le code ci-dessous et passe-le dans la console du navigateur
 * pour vider complètement le cache frontend (IndexedDB + localStorage)
 */

(async function clearAllCache() {
  console.log('🧹 Nettoyage du cache frontend...\n');

  try {
    // 1. Vider IndexedDB (Dexie)
    const dbs = await indexedDB.databases();
    console.log(`📊 Bases IndexedDB trouvées: ${dbs.length}`);
    
    for (const db of dbs) {
      console.log(`   - Suppression de: ${db.name}`);
      indexedDB.deleteDatabase(db.name);
    }

    // 2. Vider localStorage
    const storageKeys = Object.keys(localStorage);
    console.log(`\n💾 Clés localStorage: ${storageKeys.length}`);
    localStorage.clear();
    console.log('   ✓ localStorage vidé');

    // 3. Vider sessionStorage
    sessionStorage.clear();
    console.log('✓ sessionStorage vidé');

    // 4. Vider les cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
    });
    console.log('✓ Cookies vidés');

    console.log('\n✅ CACHE COMPLÈTEMENT VIDÉ');
    console.log('\n⏳ Rechargement de la page dans 2 secondes...');
    
    setTimeout(() => window.location.reload(true), 2000);

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
})();
