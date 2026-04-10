import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const orgId = 'proquelec-org-id';
  
  // 1. S'assurer que le projet existe pour l'organisation du DG
  let project = await prisma.project.findFirst({ where: { organizationId: orgId } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        id: 'dg-test-project',
        name: 'PROJET DG SENEGAL',
        organizationId: orgId,
        status: 'active',
        budget: 5000000,
        duration: 12,
        totalHouses: 500,
        config: {}
      }
    });
  }
  
  // 2. Créer la mission stratégique
  const mission = await prisma.mission.create({
    data: {
      organizationId: orgId,
      projectId: project.id,
      title: 'MISSION VALIDATION - EXTRÊME NORD',
      status: 'en_attente_validation',
      budget: 850000,
      description: 'Dernière étape de validation budgétaire et stratégique par le DG.',
      approvalWorkflow: {
        create: {
          currentStep: 3,
          overallStatus: 'pending',
          approvalSteps: {
            create: [
              { role: 'CHEF_PROJET', label: 'Validation CP', sequence: 1, status: 'APPROUVE', decidedAt: new Date(), comment: 'Ok technique' },
              { role: 'COMPTABLE', label: 'Validation Compta', sequence: 2, status: 'APPROUVE', decidedAt: new Date(), comment: 'Fonds vérifiés' },
              { role: 'DIRECTEUR', label: 'Approbation DG', sequence: 3, status: 'EN_ATTENTE' }
            ]
          }
        }
      },
      data: {
        team: [ { name: 'Oumar SY', role: 'Superviseur' } ],
        strategy: 'Supervision critique des travaux.',
        itinerary: 'Dakar -> Podor'
      }
    }
  });
  
  console.log('✅ Mission test DG creee avec succes ! ID:', mission.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
