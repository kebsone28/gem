import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../../app.js';
import prisma from '../../../core/utils/prisma.js';
import { generateTokens } from '../../../core/utils/jwt.js';

// Probe DB availability at top level; skip suite if unavailable
let dbAvailable = false;
try {
  await prisma.$connect();
  await prisma.organization.findFirst();
  dbAvailable = true;
} catch (e) {
  // DB not available — suite will be skipped
} finally {
  await prisma.$disconnect().catch(() => {});
}

const describeOrSkip = dbAvailable ? describe : describe.skip;

describeOrSkip('assignUserToProjects - Enhanced Security & Validation', () => {
  let adminUser;
  let testUser;
  let org;
  let project1, project2, project3;
  let adminToken;

  beforeAll(async () => {
    // Create test organization
    org = await prisma.organization.create({
      data: { name: 'Test Org', slug: `test-org-${Date.now()}` }
    });

    // Create admin user
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        name: 'Admin Test',
        organizationId: org.id,
        roleLegacy: 'ADMIN_PROQUELEC',
        passwordHash: 'hashed_password'
      }
    });

    // Generate JWT for admin
    const tokens = generateTokens(adminUser);
    adminToken = tokens.accessToken;

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'user@test.com',
        name: 'Test User',
        organizationId: org.id,
        roleLegacy: 'Chef Projet',
        passwordHash: 'hashed_password'
      }
    });

    // Create test projects
    project1 = await prisma.project.create({
      data: {
        name: 'Project 1',
        organizationId: org.id,
        status: 'active',
        budget: 0,
        duration: 0,
        totalHouses: 0,
        config: { assignedUsers: [] }
      }
    });

    project2 = await prisma.project.create({
      data: {
        name: 'Project 2',
        organizationId: org.id,
        status: 'active',
        budget: 0,
        duration: 0,
        totalHouses: 0,
        config: { assignedUsers: [] }
      }
    });

    project3 = await prisma.project.create({
      data: {
        name: 'Project 3',
        organizationId: org.id,
        status: 'active',
        budget: 0,
        duration: 0,
        totalHouses: 0,
        config: { assignedUsers: [] }
      }
    });
  });

  afterAll(async () => {
    if (!org?.id) return;
    // Cleanup: delete audit logs first to avoid FK constraints
    await prisma.auditLog.deleteMany({ where: { organizationId: org.id } });
    await prisma.project.deleteMany({ where: { organizationId: org.id } });
    await prisma.user.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  });

  describe('Improvement 1: Input Validation', () => {
    it('🛑 should reject empty projectIds array', async () => {
      const res = await request(app)
        .post('/api/projects/assign-user')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testUser.id,
          projectIds: [] // Empty!
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('au moins un projet');
    });

    it('🛑 should reject non-array projectIds', async () => {
      const res = await request(app)
        .post('/api/projects/assign-user')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testUser.id,
          projectIds: 'not-an-array' // String instead of array!
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('tableau');
    });

    it('🛑 should reject invalid userId', async () => {
      const res = await request(app)
        .post('/api/projects/assign-user')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: null,
          projectIds: [project1.id]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('invalide');
    });
  });

  describe('Improvement 2: Permission Check', () => {
    it('🔒 should reject user without SYSTEM_USERS permission', async () => {
      // Create non-admin user
      const limitedUser = await prisma.user.create({
        data: {
          email: 'limited@test.com',
          name: 'Limited User',
          organizationId: org.id,
          roleLegacy: 'Superviseur',
          passwordHash: 'hashed',
          permissions: ['MISSIONS_READ'] // No SYSTEM_USERS
        }
      });

      // Generate JWT for limited user
      const limitedTokens = generateTokens(limitedUser);

      const res = await request(app)
        .post('/api/projects/assign-user')
        .set('Authorization', `Bearer ${limitedTokens.accessToken}`)
        .send({
          userId: testUser.id,
          projectIds: [project1.id]
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('permission');

      await prisma.user.delete({ where: { id: limitedUser.id } });
    });
  });

  describe('Improvement 3: Project Validation', () => {
    it('🛑 should reject invalid projectIds from different org', async () => {
      // Create project in different org
      const otherOrg = await prisma.organization.create({
        data: { name: 'Other Org', slug: `other-org-${Date.now()}` }
      });
      const otherProject = await prisma.project.create({
        data: {
          name: 'Other Project',
          organizationId: otherOrg.id,
          status: 'active',
          budget: 0,
          duration: 0,
          totalHouses: 0,
          config: { assignedUsers: [] }
        }
      });

      const res = await request(app)
        .post('/api/projects/assign-user')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testUser.id,
          projectIds: [otherProject.id] // Different org!
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('invalides');

      await prisma.project.delete({ where: { id: otherProject.id } });
      await prisma.auditLog.deleteMany({ where: { organizationId: otherOrg.id } });
      await prisma.organization.delete({ where: { id: otherOrg.id } });
    });

    it('✅ should succeed with valid projectIds', async () => {
      const res = await request(app)
        .post('/api/projects/assign-user')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testUser.id,
          projectIds: [project1.id, project2.id]
        });

      expect(res.status).toBe(200);
      expect(res.body.summary.assignedProjects).toBe(2);
      expect(res.body.summary.success).toBe(true);

      // Verify assignment in DB
      const updated1 = await prisma.project.findUnique({
        where: { id: project1.id }
      });
      expect((updated1.config.assignedUsers || []).includes(testUser.id)).toBe(true);
    });
  });

  describe('Improvement 4: Response Details', () => {
    it('✅ should include detailed summary in response', async () => {
      const res = await request(app)
        .post('/api/projects/assign-user')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testUser.id,
          projectIds: [project1.id, project2.id, project3.id]
        });

      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.totalProjects).toBeGreaterThanOrEqual(3);
      expect(res.body.summary.assignedProjects).toBe(3);
      expect(res.body.summary.changesCount).toBeGreaterThan(0);
    });
  });
});
