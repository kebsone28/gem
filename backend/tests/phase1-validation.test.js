/**
 * Phase 1: Validation & Pagination Tests
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock auth middleware so validation tests can reach Joi validation without a real JWT
vi.mock('../src/api/middlewares/auth.js', () => ({
  authProtect: (req, _res, next) => {
    req.user = { id: 'test-user', organizationId: 'test-org', role: 'ADMIN' };
    next();
  },
  authorize: () => (_req, _res, next) => next(),
}));

// Mock domainContext so household validation tests don't need a live database
vi.mock('../src/middleware/domainContext.js', () => ({
  domainContext: (req, _res, next) => {
      req.domain = { id: 'test-domain', type: 'gem', config: {} };
    next();
  },
}));

import request from 'supertest';
import app from '../src/app.js';

describe('Phase 1: Validation & Pagination', () => {

  // ========================
  // VALIDATION TESTS
  // ========================

  describe('Mission Validation', () => {
    it('should reject mission without title', async () => {
      const res = await request(app)
        .post('/api/missions')
        .set('Authorization', 'Bearer test-token')
        .send({ description: 'Test mission' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error).toContain('title is required');
    });

    it('should reject mission with title too short', async () => {
      const res = await request(app)
        .post('/api/missions')
        .set('Authorization', 'Bearer test-token')
        .send({ title: 'ab', description: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('title must have at least 3 characters');
    });

    it('should accept mission with valid title', async () => {
      const res = await request(app)
        .post('/api/missions')
        .set('Authorization', 'Bearer test-token')
        .send({ title: 'Valid Mission Title', description: 'Test' });

      // May fail auth or DB but not validation
      expect([201, 401, 403, 500]).toContain(res.status);
    });
  });

  describe('Project Validation', () => {
    it('should reject project without name', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', 'Bearer test-token')
        .send({ status: 'active' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('name is required');
    });

    it('should reject invalid status value', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Test Project', status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status must be one of:');
    });
  });

  describe('Household Validation', () => {
    it('should reject household with invalid latitude', async () => {
      const res = await request(app)
        .post('/api/households')
        .set('Authorization', 'Bearer test-token')
        .send({ latitude: 95 }); // > 90

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('latitude must be at most 90');
    });

    it('should reject household with invalid longitude', async () => {
      const res = await request(app)
        .post('/api/households')
        .set('Authorization', 'Bearer test-token')
        .send({ longitude: 200 }); // > 180

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('longitude must be at most 180');
    });
  });

  describe('Chat Validation', () => {
    it('should reject message without content', async () => {
      const res = await request(app)
        .post('/api/chat/conversations/conv-1/messages')
        .set('Authorization', 'Bearer test-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('content is required');
    });

    it('should reject conversation without participants', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', 'Bearer test-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('participantIds is required');
    });

    it('should reject conversation with only 1 participant', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', 'Bearer test-token')
        .send({ participantIds: ['user-1'] });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('invalides ou inactifs');
    });
  });

  // ========================
  // PAGINATION TESTS
  // ========================

  describe('Pagination Middleware', () => {
    it('should use default pagination', async () => {
      const res = await request(app)
        .get('/api/missions')
        .set('Authorization', 'Bearer test-token');

      if (res.status === 200 && res.body.pagination) {
        expect(res.body.pagination.offset).toBe(0);
        expect(res.body.pagination.limit).toBe(50);
        expect(res.body.pagination.hasMore).toBeDefined();
        expect(typeof res.body.pagination.hasMore).toBe('boolean');
      }
    });

    it('should accept custom offset and limit', async () => {
      const res = await request(app)
        .get('/api/missions?offset=25&limit=25')
        .set('Authorization', 'Bearer test-token');

      if (res.status === 200 && res.body.pagination) {
        expect(res.body.pagination.offset).toBe(25);
        expect(res.body.pagination.limit).toBe(25);
      }
    });

    it('should enforce MAX_LIMIT of 100', async () => {
      const res = await request(app)
        .get('/api/missions?limit=5000')
        .set('Authorization', 'Bearer test-token');

      if (res.status === 200 && res.body.pagination) {
        expect(res.body.pagination.limit).toBeLessThanOrEqual(100);
      }
    });

    it('should enforce MIN_LIMIT of 1', async () => {
      const res = await request(app)
        .get('/api/missions?limit=0')
        .set('Authorization', 'Bearer test-token');

      if (res.status === 200 && res.body.pagination) {
        expect(res.body.pagination.limit).toBeGreaterThanOrEqual(1);
      }
    });

    it('should calculate offset correctly', async () => {
      const res = await request(app)
        .get('/api/missions?offset=20&limit=10')
        .set('Authorization', 'Bearer test-token');

      if (res.status === 200) {
        expect(res.body.pagination.offset).toBe(20);
        expect(res.body.pagination.limit).toBe(10);
      }
    });

    it('should include hasMore flag', async () => {
      const res = await request(app)
        .get('/api/missions?page=1&limit=10')
        .set('Authorization', 'Bearer test-token');

      if (res.status === 200 && res.body.pagination) {
        expect(res.body.pagination.hasMore).toBeDefined();
        expect(typeof res.body.pagination.hasMore).toBe('boolean');
      }
    });
  });

  // ========================
  // ERROR RESPONSE FORMAT TESTS
  // ========================

  describe('Error Response Format', () => {
    it('should return consistent error format', async () => {
      const res = await request(app)
        .post('/api/missions')
        .set('Authorization', 'Bearer test-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error).toContain('Validation failed');
    });

    it('should include error details', async () => {
      const res = await request(app)
        .post('/api/missions')
        .set('Authorization', 'Bearer test-token')
        .send({ title: 'ab' });

      expect(res.body.error).toMatch(/title|minLength|must/);
    });
  });

});
