import { PrismaClient } from '@prisma/client';
import { ROLES, PERMISSIONS, ROLE_PERMISSIONS } from '../src/core/config/permissions.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 DÉMARRAGE DU SEEDING RBAC...');

  // 1. CRÉER LES PERMISSIONS
  console.log('--- 🔑 Création des permissions ---');
  const permissionEntries = Object.entries(PERMISSIONS);
  for (const [name, key] of permissionEntries) {
    await prisma.permission.upsert({
      where: { key },
      update: { label: name.replace(/_/g, ' ') },
      create: {
        key,
        label: name.replace(/_/g, ' '),
        description: `Permission pour ${name}`
      }
    });
  }
  console.log(`✅ ${permissionEntries.length} permissions synchronisées.`);

  // 2. CRÉER LES RÔLES ET LEURS PERMISSIONS
  console.log('--- 🛡️ Création des rôles et liaisons ---');
  const roleEntries = Object.entries(ROLE_PERMISSIONS);
  for (const [roleName, permissions] of roleEntries) {
    // Créer le rôle
    const roleRecord = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `Rôle standard ${roleName}`
      }
    });

    console.log(`🔨 Configuration du rôle : ${roleName}`);

    // Liaison Pivot (RolePermission)
    for (const permKey of permissions) {
      const permRecord = await prisma.permission.findUnique({ where: { key: permKey } });
      if (permRecord) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: roleRecord.id,
              permissionId: permRecord.id
            }
          },
          update: {},
          create: {
            roleId: roleRecord.id,
            permissionId: permRecord.id
          }
        });
      }
    }
  }
  console.log('✅ Rôles et liaisons terminés.');

  // 3. MIGRATION DES UTILISATEURS EXISTANTS
  console.log('--- 🔄 Migration des utilisateurs existants ---');
  const users = await prisma.user.findMany({ where: { roleId: null } });
  console.log(`👤 ${users.length} utilisateurs à migrer.`);

  for (const user of users) {
    let targetRoleName = user.roleLegacy;
    
    // Cas particulier : l'admin par défaut avait le rôle textuel 'user'
    if (user.email === 'admingem' || user.roleLegacy === 'user') {
        targetRoleName = ROLES.ADMIN;
    }

    const matchingRole = await prisma.role.findUnique({ where: { name: targetRoleName } });
    if (matchingRole) {
      await prisma.user.update({
        where: { id: user.id },
        data: { roleId: matchingRole.id }
      });
      console.log(`✅ Utilisateur ${user.email} -> Rôle ${matchingRole.id} (${matchingRole.name})`);
    } else {
      console.warn(`⚠️ Aucun rôle correspondant trouvé pour ${user.email} (Recherche: ${targetRoleName})`);
    }
  }

  console.log('🏁 SEEDING RBAC TERMINÉ AVEC SUCCÈS !');
}

main()
  .catch((e) => {
    console.error('❌ ERREUR LORS DU SEEDING :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
