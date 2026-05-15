/**
 * Script pour compter les projets dans la base de données locale IndexedDB
 * Exécuter dans la console du navigateur:
 * 
 * 1. Ouvrir les DevTools (F12)
 * 2. Aller dans l'onglet Console
 * 3. Copier et coller ce script
 */

(async () => {
  try {
    // Accéder à la base de données Dexie avec la version correcte
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('ProquelecDB', 160); // Version actuelle: 160

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    // Compter les projets
    const transaction = db.transaction(['projects'], 'readonly');
    const objectStore = transaction.objectStore('projects');
    const count = await new Promise((resolve, reject) => {
      const request = objectStore.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    console.log(`📊 Nombre de projets dans la base de données locale: ${count}`);

    // Lister les projets (optionnel)
    const projects = await new Promise((resolve, reject) => {
      const request = objectStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    console.table(projects.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      organizationId: p.organizationId
    })));

    db.close();
  } catch (error) {
    console.error('❌ Erreur lors de l\'accès à la base de données:', error);
  }
})();
