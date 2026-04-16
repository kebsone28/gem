#!/usr/bin/env node
/**
 * Fix PV Automation Permissions
 * Grants GERER_PV permission to all users with admin/DG roles
 */

import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLES } from './src/core/config/permissions.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing PV Automation Permissions...\n');

  try {
    // 1. Ensure GERER_PV permission exists
    console.log('1️⃣ Creating GERER_PV permission...');
    const permission = await prisma.permission.upsert({
      where: { key: PERMISSIONS.GERER_PV },
      update: {},
      create: {
        key: PERMISSIONS.GERER_PV,
        label: 'Gérer PV',
        description: 'Permission pour gérer l\'automatisation des procès-verbaux'
      }
    });
    console.log('✅ Permission GERER_PV ready\n');

    // 2. Grant to admin users
    console.log('2️⃣ Granting permissions to ADMIN role...');
    const adminRole = await prisma.role.findUnique({ where: { name: ROLES.ADMIN } });
    if (adminRole) {
      const rolePermExists = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id
          }
        }
      });
      
      if (!rolePermExists) {
        await prisma.rolePermission.create({
          data: {
            roleId: adminRole.id,
            permissionId: permission.id
          }
        });
        console.log(`✅ Added GERER_PV to ${ROLES.ADMIN}\n`);
      } else {
        console.log(`✅ ${ROLES.ADMIN} already has GERER_PV\n`);
      }
    } else {
      console.warn(`⚠️ ADMIN role not found\n`);
    }

    // 3. Grant to DG users
    console.log('3️⃣ Granting permissions to DG role...');
    const dgRole = await prisma.role.findUnique({ where: { name: ROLES.DG } });
    if (dgRole) {
      const rolePermExists = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: dgRole.id,
            permissionId: permission.id
          }
        }
      });
      
      if (!rolePermExists) {
        await prisma.rolePermission.create({
          data: {
            roleId: dgRole.id,
            permissionId: permission.id
          }
        });
        console.log(`✅ Added GERER_PV to ${ROLES.DG}\n`);
      } else {
        console.log(`✅ ${ROLES.DG} already has GERER_PV\n`);
      }
    } else {
      console.warn(`⚠️ DG role not found\n`);
    }

    // 4. List users with these roles
    console.log('4️⃣ Current authorized users:');
    const authorizedRoles = [ROLES.ADMIN, ROLES.DG, ROLES.CHEF_PROJET];
    
    for (const roleName of authorizedRoles) {
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (role) {
        const users = await prisma.user.findMany({
          where: { roleId: role.id },
          select: { email: true, name: true }
        });
        if (users.length > 0) {
          console.log(`\n📧 ${roleName}:`);
          users.forEach(u => console.log(`   • ${u.email} (${u.name})`));
        }
      }
    }

    console.log('\n\n✅ PV Automation permissions fixed successfully!');
    console.log('ℹ️  Users will need to refresh their browser to see the changes.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
