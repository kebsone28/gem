import { basePrisma as prisma } from './src/core/utils/prisma.js';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🚀 Setting up GEM SAAS Production Architecture...\n');

  // 1. Fix Organization slug if missing
  const org = await prisma.organization.findFirst({ where: { id: 'proquelec-org-id' } });
  if (org && !org.slug) {
    await prisma.organization.update({
      where: { id: 'proquelec-org-id' },
      data: { slug: 'proquelec-admin' }
    });
    console.log('✅ Organization slug set to: proquelec-admin');
  } else {
    console.log('✅ Organization slug OK:', org?.slug || org?.id);
  }

  // 2. Ensure ProjectTemplates exist
  const templates = [
    {
      key: 'supervision-senelec',
      name: 'Supervision Senelec',
      description: 'Projet de supervision des travaux électriques Senelec',
      config: {
        theme: 'electric',
        region: 'Sénégal',
        category: 'supervision',
        modules: ['dashboard', 'terrain', 'bordereau', 'simulation', 'planning', 'mission', 'communication']
      },
      modules: ['dashboard', 'terrain', 'bordereau', 'simulation', 'planning', 'mission', 'communication']
    },
    {
      key: 'kobo-formation',
      name: 'Kobo Formation',
      description: 'Collecte de données terrain via KoboToolbox',
      config: {
        category: 'data-collection',
        modules: ['dashboard', 'kobo_terminal', 'ged_os_collect', 'formation']
      },
      modules: ['dashboard', 'kobo_terminal', 'ged_os_collect', 'formation']
    },
    {
      key: 'audit-technique',
      name: 'Audit Technique',
      description: "Audit et diagnostic d'installations électriques",
      config: {
        category: 'audit',
        modules: ['dashboard', 'mission', 'diagnostic', 'pv_automation', 'sharedoc']
      },
      modules: ['dashboard', 'mission', 'diagnostic', 'pv_automation', 'sharedoc']
    },
    {
      key: 'erp-chantier',
      name: 'ERP Chantier',
      description: 'Gestion complète de chantier',
      config: {
        category: 'project-management',
        modules: ['dashboard', 'simulation', 'charges', 'bordereau', 'cahier', 'planning', 'logistique', 'atelier', 'organization']
      },
      modules: ['dashboard', 'simulation', 'charges', 'bordereau', 'cahier', 'planning', 'logistique', 'atelier', 'organization']
    }
  ];

  for (const tpl of templates) {
    await prisma.projectTemplate.upsert({
      where: { key: tpl.key },
      update: { name: tpl.name, description: tpl.description, config: tpl.config, modules: tpl.modules, active: true },
      create: { key: tpl.key, name: tpl.name, description: tpl.description, config: tpl.config, modules: tpl.modules, active: true }
    });
    console.log(`✅ Template upserted: ${tpl.key}`);
  }

  // 3. Create "Supervision Senelec" as a real persisted Project
  const existingProject = await prisma.project.findFirst({
    where: { organizationId: 'proquelec-org-id', templateKey: 'supervision-senelec' }
  });

  if (!existingProject) {
    const project = await prisma.project.create({
      data: {
        organizationId: 'proquelec-org-id',
        templateKey: 'supervision-senelec',
        templateVersion: 1,
        name: 'Supervision Senelec',
        status: 'active',
        budget: 0,
        duration: 365,
        totalHouses: 0,
        config: {
          description: 'Projet de supervision des travaux électriques Senelec',
          category: 'supervision',
          region: 'Sénégal',
          modules: ['dashboard', 'terrain', 'bordereau', 'simulation', 'planning', 'mission', 'communication']
        }
      }
    });
    console.log(`✅ Project "Supervision Senelec" created with ID: ${project.id}`);

    // Add default pages for the project
    const pages = [
      { key: 'dashboard', name: 'Tableau de Bord', icon: 'LayoutDashboard', route: '/dashboard', order: 0 },
      { key: 'terrain', name: 'Terrain', icon: 'Map', route: '/terrain', order: 1 },
      { key: 'bordereau', name: 'Bordereau', icon: 'FileText', route: '/bordereau', order: 2 },
      { key: 'simulation', name: 'Simulation', icon: 'Calculator', route: '/simulation', order: 3 },
      { key: 'planning', name: 'Planning', icon: 'Calendar', route: '/planning', order: 4 },
      { key: 'mission', name: 'Missions', icon: 'Briefcase', route: '/mission', order: 5 },
      { key: 'communication', name: 'Communication', icon: 'MessageSquare', route: '/communication', order: 6 },
    ];

    for (const page of pages) {
      await prisma.projectPage.create({ data: { projectId: project.id, ...page } });
    }
    console.log(`✅ Created ${pages.length} ProjectPages for Supervision Senelec`);

    // Set as default project
    await prisma.organization.update({
      where: { id: 'proquelec-org-id' },
      data: { defaultProjectId: project.id }
    });
    console.log(`✅ Organization defaultProjectId set to Supervision Senelec`);
  } else {
    console.log(`✅ Project "Supervision Senelec" already exists (ID: ${existingProject.id})`);
  }

  // 4. Ensure Atomic Permissions seeded in DB
  const permissions = [
    { key: 'project.view', label: 'View projects' },
    { key: 'project.create', label: 'Create projects' },
    { key: 'project.edit', label: 'Edit projects' },
    { key: 'project.delete', label: 'Delete projects' },
    { key: 'project.template.manage', label: 'Manage templates' },
    { key: 'mission.view', label: 'View missions' },
    { key: 'mission.create', label: 'Create missions' },
    { key: 'mission.edit', label: 'Edit missions' },
    { key: 'mission.delete', label: 'Delete missions' },
    { key: 'mission.approve', label: 'Approve missions' },
    { key: 'household.view', label: 'View households' },
    { key: 'household.edit', label: 'Edit households' },
    { key: 'household.export', label: 'Export households' },
    { key: 'team.view', label: 'View teams' },
    { key: 'team.create', label: 'Create teams' },
    { key: 'team.edit', label: 'Edit teams' },
    { key: 'user.view', label: 'View users' },
    { key: 'user.create', label: 'Create users' },
    { key: 'user.manage.roles', label: 'Manage roles' },
    { key: 'report.view', label: 'View reports' },
    { key: 'report.export', label: 'Export reports' },
    { key: 'audit.view', label: 'View audit logs' },
    { key: 'chat.send', label: 'Send messages' },
    { key: 'chat.view', label: 'View messages' },
    { key: 'data.export', label: 'Export data' },
    { key: 'kobo.sync', label: 'Trigger Kobo sync' },
  ];

  let permCount = 0;
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { label: perm.label },
      create: { key: perm.key, label: perm.label }
    });
    permCount++;
  }
  console.log(`✅ ${permCount} atomic permissions seeded in DB`);

  console.log('\n🎉 Setup complete! GEM SAAS architecture is ready.');
  console.log('');
  console.log('Summary:');
  console.log('  ✅ Organization slug: proquelec-admin');
  console.log('  ✅ 4 ProjectTemplates in DB');
  console.log('  ✅ "Supervision Senelec" as real Project in DB');
  console.log('  ✅ 26 Atomic Permissions seeded in DB');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
