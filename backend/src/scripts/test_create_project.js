import prisma from '../core/utils/prisma.js';
import { workflowService } from '../core/services/workflow.service.js';
import { securityService } from '../core/services/security.service.js';
import { getModuleMetadata } from '../core/config/modules.js';

async function testCreateProject() {
  const organizationId = 'proquelec-org-id';
  const userId = '1c300e86-3919-4d5b-a85e-2f2bb39fcdd2';
  const projectName = `Test Project ${Date.now()}`;
  const enabledModules = ['terrain', 'mission', 'charges'];
  const sector = 'elec_bt';

  console.log(`🚀 Starting Test: Creation of project "${projectName}"`);

  try {
    const project = await prisma.$transaction(async (tx) => {
      // 1. Create base project
      const newProject = await tx.project.create({
        data: {
          name: projectName,
          status: 'active',
          budget: 1000000,
          duration: 12,
          totalHouses: 100,
          config: {
            sector,
            enabledModules,
            client: 'GEM SAAS TESTER'
          },
          organizationId,
          updatedById: userId,
        },
      });

      console.log('✅ Base project created:', newProject.id);

      // 2. Instantiate modules
      console.log('📦 Instantiating modules:', enabledModules);
      for (const moduleKey of enabledModules) {
        const meta = getModuleMetadata(moduleKey);
        await tx.projectModule.create({
          data: {
            projectId: newProject.id,
            key: moduleKey,
            name: meta.name,
            enabled: true,
            config: {
              initializedAt: new Date(),
              sector: sector,
              dynamicMetadata: {
                isPackage: meta.isPackage,
                packageCategory: meta.packageCategory,
                global: meta.global
              }
            }
          }
        });
        console.log(`   - Module ${moduleKey} instantiated with metadata:`, meta.packageCategory);
      }

      // 3. Seed Default Workflow
      console.log('🔄 Seeding default workflow...');
      await workflowService.seedDefaultWorkflow(newProject.id, sector, organizationId, tx);

      // 4. Seed Security Policies
      console.log('🛡️ Seeding security policies...');
      await securityService.seedDefaultPolicies(organizationId, tx);

      return newProject;
    });

    console.log('\n🏆 SUCCESS: Project fully created with all dynamic components!');
    console.log('Project ID:', project.id);

    // Final verification
    const modules = await prisma.projectModule.findMany({
      where: { projectId: project.id }
    });
    console.log('\n🔍 VERIFICATION - Project Modules in DB:');
    modules.forEach(m => {
      console.log(`- ${m.key}: ${m.name} (Metadata: ${JSON.stringify(m.config?.dynamicMetadata)})`);
    });

    const workflows = await prisma.workflow.findMany({
      where: { projectId: project.id }
    });
    console.log(`\n🔍 VERIFICATION - Workflows: ${workflows.length} created.`);

  } catch (error) {
    console.error('\n❌ FAILURE:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCreateProject();
