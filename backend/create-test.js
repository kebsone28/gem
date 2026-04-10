import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const orgId = 'proquelec-org-id';
  const mission = await prisma.mission.create({
    data: {
      organizationId: orgId,
      projectId: 'd9d6dd53-e600-4dbd-ac74-f18b933cbb11', 
      title: 'MISSION DE TEST DG - AXE SUD',
      status: 'en_attente_validation',
      budget: 1550000,
      description: 'Test du Hub de Decision par le DG. Validation technique et budgetaire deja effectuée.',
      approvalWorkflow: {
        create: {
          currentStep: 3,
          overallStatus: 'pending',
          approvalSteps: {
            create: [
              { role: 'CHEF_PROJET', label: 'Validation CP', sequence: 1, status: 'APPROUVE' },
              { role: 'COMPTABLE', label: 'Validation Compta', sequence: 2, status: 'APPROUVE' },
              { role: 'DIRECTEUR', label: 'Approbation DG', sequence: 3, status: 'EN_ATTENTE' }
            ]
          }
        }
      },
      data: {
        team: [ { name: 'Expert GEM', role: 'Support' } ],
        strategy: 'Test rapid de validation.',
        itinerary: 'Dakar -> Thies'
      }
    }
  });
  console.log('✅ Mission test DG creee !');
}
main().finally(() => prisma.$disconnect());
