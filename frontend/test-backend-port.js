/**
 * Script pour tester les ports du backend
 * Exécuter dans la console du navigateur
 */

(async () => {
  const ports = [5009, 5011, 5005, 5008, 8888, 3001];

  for (const port of ports) {
    try {
      const response = await fetch(`http://localhost:${port}/api/projects`);
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Backend accessible sur le port ${port}`);
        console.log(`📊 Nombre de projets:`, data.projects?.length || 0);
        return;
      }
    } catch (error) {
      console.log(`❌ Port ${port} inaccessible`);
    }
  }

  console.log('❌ Aucun port backend accessible');
})();
