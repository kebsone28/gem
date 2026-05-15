
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanup() {
  try {
    console.log('🚀 Démarrage du nettoyage des projets...');

    // 1. Délier les entités qui ont projectId optionnel
    await prisma.household.updateMany({
      where: {},
      data: { projectId: null }
    });
    
    await prisma.mission.updateMany({
      where: {},
      data: { projectId: null }
    });

    // 2. Supprimer les entités qui ont projectId obligatoire (Zone, Team)
    // On doit supprimer les teams avant les zones car les teams peuvent dépendre de zones
    const deletedTeams = await prisma.team.deleteMany({});
    console.log(`✅ ${deletedTeams.count} équipes supprimées.`);

    const deletedZones = await prisma.zone.deleteMany({});
    console.log(`✅ ${deletedZones.count} zones supprimées.`);

    // 3. Supprimer tous les anciens projets
    const deletedProjects = await prisma.project.deleteMany({});
    console.log(`✅ ${deletedProjects.count} anciens projets supprimés.`);

    // 4. Créer "PROJET KOBO GLOBAL" avec les champs obligatoires
    const newProject = await prisma.project.create({
      data: {
        id: 'project-kobo-global-001',
        name: 'PROJET KOBO GLOBAL',
        status: 'active',
        budget: 0,
        duration: 36,
        totalHouses: 1000,
        organizationId: 'proquelec-org-id',
        config: {
          assignedUsers: ['admingem', 'a5a3cb76-5312-4b61-a6c1-26fca9d671c5'],
          enabledModules: [
            'dashboard', 'simulation', 'charges', 'bordereau', 'cahier', 
            'terrain', 'communication', 'planning', 'logistique', 'atelier',
            'approval', 'mission', 'users', 'diagnostic', 'kobo_terminal',
            'gem_toolbox', 'gem_collect', 'organization', 'settings', 'security', 'ai_config'
          ],
          koboFormId: 'aEYZwPujJiFBTNb6mxMGCB',
          description: 'Espace de centralisation des données KoboToolbox'
        }
      }
    });
    console.log(`✅ Projet "${newProject.name}" créé avec succès.`);

    // 5. Rallier les ménages à ce nouveau projet
    const householdCount = await prisma.household.updateMany({
      where: { organizationId: 'proquelec-org-id' },
      data: { projectId: newProject.id }
    });
    console.log(`✅ ${householdCount.count} ménages rattachés au nouveau projet.`);

    // 6. Mettre à jour l'organisation pour définir ce projet par défaut
    await prisma.organization.update({
      where: { id: 'proquelec-org-id' },
      data: { defaultProjectId: newProject.id }
    });
    console.log(`✅ Projet par défaut configuré pour l'organisation.`);

  } catch (e) {
    console.error('❌ Erreur lors du nettoyage:', e);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
