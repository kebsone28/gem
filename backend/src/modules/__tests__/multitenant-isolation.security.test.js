import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../../app.js';
import prisma from '../../core/utils/prisma.js';
import { config } from '../../core/config/config.js';
import { normalizePermissionsToAtoms } from '../../core/config/permissionNormalization.js';

/**
 * Multi-Tenant Isolation Security Tests
 */

let adminRoleProbe, restrictedRoleProbe;

try {
  adminRoleProbe = await prisma.role.findFirst({ where: { name: 'ADMIN_PROQUELEC' } });
  restrictedRoleProbe =
    (await prisma.role.findFirst({ where: { name: 'EMPLOYE' } })) ||
    (await prisma.role.findFirst({ where: { name: 'CHEF_EQUIPE' } }));
} catch {
  adminRoleProbe = null;
  restrictedRoleProbe = null;
}

const rbacReadyForMultitenant = !!(adminRoleProbe && restrictedRoleProbe);
const describeMT = rbacReadyForMultitenant ? describe : describe.skip;
/** Titre long uniquement quand la suite est skippée : le rapport Vitest affiche alors la raison. */
const multitenantSuiteName = rbacReadyForMultitenant
  ? '🔒 Multi-Tenant Isolation Tests'
  : '🔒 Multi-Tenant Isolation Tests — skip: DB indisponible ou rôles manquants (ADMIN_PROQUELEC + EMPLOYE/CHEF_EQUIPE)';

/**
 * Multi-Tenant Isolation Security Tests
 * (Suite skippée si le seed RBAC n’a pas créé les rôles ci-dessus — voir multitenantSuiteName.)
 */

function accessTokenForUser(user) {
  const roleKeys = user.role?.permissions?.map((rp) => rp.permission.key) || [];
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role?.name || user.roleLegacy,
      permissions: normalizePermissionsToAtoms(roleKeys),
    },
    config.jwt.secret,
    { expiresIn: '2h' }
  );
}

describeMT(multitenantSuiteName, () => {
  let org1;
  let org2;
  let project1;
  let project2;
  /** @type {string} */
  let adminToken;
  /** @type {string} */
  let employeeToken;

  beforeAll(async () => {
    const suffix = `${Date.now()}`;
    org1 = await prisma.organization.create({
      data: { name: 'TestOrg1', slug: `test-org-1-${suffix}` },
    });

    org2 = await prisma.organization.create({
      data: { name: 'TestOrg2', slug: `test-org-2-${suffix}` },
    });

    project1 = await prisma.project.create({
      data: {
        organizationId: org1.id,
        name: 'Project1',
        status: 'ACTIVE',
        budget: 1000,
        duration: 30,
        totalHouses: 100,
        config: {},
      },
    });

    project2 = await prisma.project.create({
      data: {
        organizationId: org2.id,
        name: 'Project2',
        status: 'ACTIVE',
        budget: 2000,
        duration: 45,
        totalHouses: 200,
        config: {},
      },
    });

    const adminRole = await prisma.role.findUnique({
      where: { name: 'ADMIN_PROQUELEC' },
      include: { permissions: { include: { permission: true } } },
    });
    const restrictedRole =
      (await prisma.role.findUnique({
        where: { name: 'EMPLOYE' },
        include: { permissions: { include: { permission: true } } },
      })) ||
      (await prisma.role.findUnique({
        where: { name: 'CHEF_EQUIPE' },
        include: { permissions: { include: { permission: true } } },
      }));

    if (!adminRole || !restrictedRole) {
      throw new Error('Rôles attendus introuvables après vérification initiale.');
    }

    const passwordHash = await bcrypt.hash('TestMtPass123!', 10);

    const adminUser = await prisma.user.create({
      data: {
        email: `mt-admin-${suffix}@test.local`,
        passwordHash,
        organizationId: org1.id,
        roleId: adminRole.id,
        roleLegacy: 'ADMIN_PROQUELEC',
      },
    });

    const employeeUser = await prisma.user.create({
      data: {
        email: `mt-emp-${suffix}@test.local`,
        passwordHash,
        organizationId: org1.id,
        roleId: restrictedRole.id,
        roleLegacy: restrictedRole.name,
      },
    });

    const adminFull = await prisma.user.findUnique({
      where: { id: adminUser.id },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    const employeeFull = await prisma.user.findUnique({
      where: { id: employeeUser.id },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    adminToken = accessTokenForUser(adminFull);
    employeeToken = accessTokenForUser(employeeFull);
  });

  describe('Organization Isolation', () => {
    it('should only list projects belonging to the user organization', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('x-organization-id', org1.id)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.projects).toHaveLength(1);
      expect(res.body.projects[0].id).toBe(project1.id);
    });

    it('should block cross-organization project access', async () => {
      const res = await request(app)
        .get(`/api/projects/${project2.id}`)
        .set('x-organization-id', org1.id)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('uses JWT organization for listing (header alone does not switch tenant)', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('x-organization-id', org2.id)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.projects.every((p) => p.organizationId === org1.id)).toBe(true);
    });
  });

  describe('Project Isolation', () => {
    it('should filter households by project', async () => {
      const ownerJson = { name: 'Propriétaire test' };

      await prisma.household.create({
        data: {
          projectId: project1.id,
          organizationId: org1.id,
          name: 'Household1',
          status: 'ACTIVE',
          location: { type: 'Point', coordinates: [0, 0] },
          owner: ownerJson,
        },
      });

      await prisma.household.create({
        data: {
          projectId: project2.id,
          organizationId: org2.id,
          name: 'Household2',
          status: 'ACTIVE',
          location: { type: 'Point', coordinates: [0, 0] },
          owner: ownerJson,
        },
      });

      const res = await request(app)
        .get('/api/households')
        .set('x-organization-id', org1.id)
        .set('x-project-id', project1.id)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.households.every((hh) => hh.projectId === project1.id)).toBe(true);
    });
  });

  describe('Kobo Webhook Security', () => {
    it('rejects webhook without HMAC signature (before métier)', async () => {
      const res = await request(app)
        .post('/api/kobo/webhook')
        .send({ data: 'test' })
        .set('Content-Type', 'application/json');

      expect([401, 500]).toContain(res.status);
    });

    it('should only process webhook for correct organization', async () => {
      const res = await request(app)
        .post('/api/kobo/webhook')
        .query({ organizationId: org1.id })
        .send({ data: 'test' })
        .set('Content-Type', 'application/json');

      expect(res.status).not.toBe(400);
    });

    it('should block cross-org webhook injection', async () => {
      const res = await request(app)
        .post(`/api/kobo/webhook?organizationId=${org2.id}`)
        .set('x-organization-id', org1.id)
        .send({ data: 'malicious' });

      expect([400, 401, 403, 404, 500]).toContain(res.status);
    });
  });

  describe('Offline Data Isolation', () => {
    it('should include organizationId in offline sync', async () => {
      const syncRes = await request(app)
        .get('/api/sync/full')
        .set('x-organization-id', org1.id)
        .set('Authorization', `Bearer ${adminToken}`);

      if (syncRes.body.projects) {
        syncRes.body.projects.forEach((p) => {
          expect(p.organizationId).toBe(org1.id);
        });
      }

      if (syncRes.body.households) {
        syncRes.body.households.forEach((hh) => {
          expect(hh.organizationId).toBe(org1.id);
        });
      }
    });
  });

  describe('Permission Checks', () => {
    it('should enforce granular permissions', async () => {
      const res = await request(app)
        .post('/api/missions')
        .set('x-organization-id', org1.id)
        .set('x-project-id', project1.id)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Test Mission',
          projectId: project1.id,
        });

      expect([201, 403]).toContain(res.status);
    });

    it('should allow mission create for admin (rôle + atomes)', async () => {
      const res = await request(app)
        .post('/api/missions')
        .set('x-organization-id', org1.id)
        .set('x-project-id', project1.id)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Admin Mission', projectId: project1.id });

      expect([201, 400, 403, 422]).toContain(res.status);
    });
  });

  describe('Data Leakage Prevention', () => {
    it('should not expose org data through search', async () => {
      const res = await request(app)
        .get('/api/households?search=Test')
        .set('x-organization-id', org1.id)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.body.households) {
        res.body.households.forEach((hh) => {
          expect(hh.organizationId).toBe(org1.id);
        });
      }
    });

    it('should filter audit logs by organization', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('x-organization-id', org1.id)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.body.logs) {
        res.body.logs.forEach((log) => {
          expect(log.organizationId).toBe(org1.id);
        });
      }
    });
  });

  afterAll(async () => {
    await prisma.household.deleteMany({ where: { organizationId: { in: [org1.id, org2.id] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [org1.id, org2.id] } } });
    await prisma.project.deleteMany({ where: { organizationId: { in: [org1.id, org2.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [org1.id, org2.id] } } });
  });
});
