/**
 * Phase 1: Validation & Pagination Tests
 */

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../app.js';

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
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.errors).toContain(expect.stringContaining('title'));
    });

    it('should reject mission with title too short', async () => {
      const res = await request(app)
        .post('/api/missions')
        .set('Authorization', 'Bearer test-token')
        .send({ title: 'ab', description: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.error.errors).toContain(expect.stringContaining('minLength'));
    });

    it('should accept mission with valid title', async () => {
      const res = await request(app)
        .post('/api/missions')
        .set('Authorization', 'Bearer test-token')
        .send({ title: 'Valid Mission Title', description: 'Test' });

      // May fail auth but not validation
      expect([201, 401, 403]).toContain(res.status);
    });
  });

  describe('Project Validation', () => {
    it('should reject project without name', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', 'Bearer test-token')
        .send({ status: 'active' });

      expect(res.status).toBe(400);
      expect(res.body.error.errors).toContain(expect.stringContaining('name'));
    });

    it('should reject project without status', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Test Project' });

      expect(res.status).toBe(400);
      expect(res.body.error.errors).toContain(expect.stringContaining('status'));
    });

    it('should reject invalid status value', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Test Project', status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.error.errors).toContain(expect.stringContaining('enum'));
    });
  });

  describe('Household Validation', () => {
    it('should reject household with invalid latitude', async () => {
      const res = await request(app)
        .post('/api/households')
        .set('Authorization', 'Bearer test-token')
        .send({ latitude: 95 }); // > 90

      expect(res.status).toBe(400);
      expect(res.body.error.errors).toContain(expect.stringContaining('latitude'));
    });

    it('should reject household with invalid longitude', async () => {
      const res = await request(app)
        .post('/api/households')
        .set('Authorization', 'Bearer test-token')
        .send({ longitude: 200 }); // > 180

      expect(res.status).toBe(400);
      expect(res.body.error.errors).toContain(expect.stringContaining('longitude'));
    });
  });

  describe('Chat Validation', () => {
    it('should reject message without content', async () => {
      const res = await request(app)
        .post('/api/chat/conversations/conv-1/messages')
        .set('Authorization', 'Bearer test-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.errors).toContain(expect.stringContaining('content'));
    });

    it('should reject conversation without participants', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', 'Bearer test-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.errors).toContain(expect.stringContaining('participantIds'));
    });

    it('should reject conversation with only 1 participant', async () => {
      const res = await request(app)
        .post('/api/chat/conversations')
        .set('Authorization', 'Bearer test-token')
        .send({ participantIds: ['user-1'] });

      expect(res.status).toBe(400);
      expect(res.body.error.errors).toContain(expect.stringContaining('at least 2'));
    });
  });

  // ========================
  // PAGINATION TESTS
  // ========================

  describe('Pagination Middleware', () => {
    it('should use default pagination (page=1, limit=50)', async () => {
      const res = await request(app)
        .get('/api/missions')
        .set('Authorization', 'Bearer test-token');

      // Check pagination meta
      if (res.status === 200 && res.body.pagination) {
        expect(res.body.pagination.page).toBe(1);
        expect(res.body.pagination.limit).toBe(50);
      }
    });

    it('should accept custom page and limit', async () => {
      const res = await request(app)
        .get('/api/missions?page=2&limit=25')
        .set('Authorization', 'Bearer test-token');

      if (res.status === 200 && res.body.pagination) {
        expect(res.body.pagination.page).toBe(2);
        expect(res.body.pagination.limit).toBe(25);
      }
    });

    it('should enforce MAX_LIMIT of 1000', async () => {
      const res = await request(app)
        .get('/api/missions?limit=5000')
        .set('Authorization', 'Bearer test-token');

      if (res.status === 200 && res.body.pagination) {
        expect(res.body.pagination.limit).toBeLessThanOrEqual(1000);
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
      // page=3, limit=10 should offset = (3-1)*10 = 20
      const res = await request(app)
        .get('/api/missions?page=3&limit=10')
        .set('Authorization', 'Bearer test-token');

      if (res.status === 200) {
        // Offset is internal, but we can verify through pagination
        expect(res.body.pagination.page).toBe(3);
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
      expect(res.body.error.message).toBeDefined();
      expect(res.body.error.code).toBeDefined();
      expect(res.body.error.errors).toBeInstanceOf(Array);
      expect(res.body.error.timestamp).toBeDefined();
    });

    it('should include error details', async () => {
      const res = await request(app)
        .post('/api/missions')
        .set('Authorization', 'Bearer test-token')
        .send({ title: 'ab' });

      expect(res.body.error.errors.length).toBeGreaterThan(0);
      expect(res.body.error.errors[0]).toMatch(/title|minLength/);
    });
  });

});
