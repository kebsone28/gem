/**
 * API TESTS - Alerts Endpoints
 * Tests des 7 endpoints API d'alertes avec Supertest
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../../app';
import prisma from '../../../utils/prisma';

// Mock Prisma
vi.mock('../../../utils/prisma');

const BASE_URL = '/api/v1/alerts';
const TEST_ORG_ID = 'test-org-123';
const TEST_PROJECT_ID = 'test-proj-456';
const TEST_ALERT_ID = 'test-alert-789';

describe('Alerts API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────
  // 1. GET /api/v1/alerts
  // ──────────────────────────────────────────
  describe('GET /api/v1/alerts - List Alerts', () => {
    it('should return list of alerts for organization', async () => {
      const mockAlerts = [
        {
          id: TEST_ALERT_ID,
          organizationId: TEST_ORG_ID,
          type: 'IGPP_STOCK',
          severity: 'critical',
          status: 'OPEN',
          createdAt: new Date(),
        },
      ];

      vi.mocked(prisma.alert.findMany).mockResolvedValue(mockAlerts);

      const response = await request(app)
        .get(BASE_URL)
        .query({ organizationId: TEST_ORG_ID })
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body.alerts).toHaveLength(1);
      expect(response.body.alerts[0].type).toBe('IGPP_STOCK');
    });

    it('should filter alerts by status', async () => {
      const mockAlerts = [
        {
          id: TEST_ALERT_ID,
          status: 'OPEN',
          severity: 'critical',
        },
      ];

      vi.mocked(prisma.alert.findMany).mockResolvedValue(mockAlerts);

      const response = await request(app)
        .get(BASE_URL)
        .query({ organizationId: TEST_ORG_ID, status: 'OPEN' });

      expect(response.status).toBe(200);
      expect(response.body.alerts[0].status).toBe('OPEN');
    });

    it('should sort alerts by severity', async () => {
      const mockAlerts = [
        { id: '1', severity: 'critical' },
        { id: '2', severity: 'high' },
        { id: '3', severity: 'medium' },
      ];

      vi.mocked(prisma.alert.findMany).mockResolvedValue(mockAlerts);

      const response = await request(app)
        .get(BASE_URL)
        .query({ organizationId: TEST_ORG_ID, sortBy: 'severity' });

      expect(response.status).toBe(200);
      expect(response.body.alerts[0].severity).toBe('critical');
    });
  });

  // ──────────────────────────────────────────
  // 2. GET /api/v1/alerts/:id
  // ──────────────────────────────────────────
  describe('GET /api/v1/alerts/:id - Get Alert Details', () => {
    it('should return alert details', async () => {
      const mockAlert = {
        id: TEST_ALERT_ID,
        type: 'IGPP_STOCK',
        severity: 'critical',
        message: 'Stock level critically low',
        metadata: { kitPrepared: 5 },
      };

      vi.mocked(prisma.alert.findUnique).mockResolvedValue(mockAlert);

      const response = await request(app)
        .get(`${BASE_URL}/${TEST_ALERT_ID}`);

      expect(response.status).toBe(200);
      expect(response.body.alert.id).toBe(TEST_ALERT_ID);
      expect(response.body.alert.message).toBeDefined();
    });

    it('should return 404 if alert not found', async () => {
      vi.mocked(prisma.alert.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .get(`${BASE_URL}/non-existent-id`);

      expect(response.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────
  // 3. POST /api/v1/alerts
  // ──────────────────────────────────────────
  describe('POST /api/v1/alerts - Create Alert', () => {
    it('should create new alert', async () => {
      const alertPayload = {
        organizationId: TEST_ORG_ID,
        projectId: TEST_PROJECT_ID,
        type: 'IGPP_STOCK',
        severity: 'critical',
        message: 'Critical stock alert',
      };

      const mockCreatedAlert = {
        id: TEST_ALERT_ID,
        ...alertPayload,
        status: 'OPEN',
      };

      vi.mocked(prisma.alert.create).mockResolvedValue(mockCreatedAlert);

      const response = await request(app)
        .post(BASE_URL)
        .send(alertPayload);

      expect(response.status).toBe(201);
      expect(response.body.alert.id).toBe(TEST_ALERT_ID);
      expect(response.body.alert.status).toBe('OPEN');
    });

    it('should validate required fields', async () => {
      const invalidPayload = {
        type: 'IGPP_STOCK',
        // Missing organizationId
      };

      const response = await request(app)
        .post(BASE_URL)
        .send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should trigger SMS notification if enabled', async () => {
      const alertPayload = {
        organizationId: TEST_ORG_ID,
        type: 'IGPP_STOCK',
        enableSMS: true,
        phoneNumber: '+1234567890',
      };

      vi.mocked(prisma.alert.create).mockResolvedValue({
        id: TEST_ALERT_ID,
        ...alertPayload,
      });

      const response = await request(app)
        .post(BASE_URL)
        .send(alertPayload);

      expect(response.status).toBe(201);
      expect(response.body.notifications.sms).toBeDefined();
    });
  });

  // ──────────────────────────────────────────
  // 4. PATCH /api/v1/alerts/:id
  // ──────────────────────────────────────────
  describe('PATCH /api/v1/alerts/:id - Update Alert', () => {
    it('should acknowledge alert', async () => {
      const updatePayload = {
        status: 'ACKNOWLEDGED',
      };

      const mockUpdatedAlert = {
        id: TEST_ALERT_ID,
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
      };

      vi.mocked(prisma.alert.update).mockResolvedValue(mockUpdatedAlert);

      const response = await request(app)
        .patch(`${BASE_URL}/${TEST_ALERT_ID}`)
        .send(updatePayload);

      expect(response.status).toBe(200);
      expect(response.body.alert.status).toBe('ACKNOWLEDGED');
    });

    it('should resolve alert', async () => {
      const updatePayload = {
        status: 'RESOLVED',
        resolutionNotes: 'Issue fixed',
      };

      const mockUpdatedAlert = {
        id: TEST_ALERT_ID,
        status: 'RESOLVED',
        resolvedAt: new Date(),
      };

      vi.mocked(prisma.alert.update).mockResolvedValue(mockUpdatedAlert);

      const response = await request(app)
        .patch(`${BASE_URL}/${TEST_ALERT_ID}`)
        .send(updatePayload);

      expect(response.status).toBe(200);
      expect(response.body.alert.status).toBe('RESOLVED');
    });

    it('should prevent status downgrade', async () => {
      const response = await request(app)
        .patch(`${BASE_URL}/${TEST_ALERT_ID}`)
        .send({ status: 'OPEN' });

      expect(response.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────
  // 5. DELETE /api/v1/alerts/:id
  // ──────────────────────────────────────────
  describe('DELETE /api/v1/alerts/:id - Delete Alert', () => {
    it('should delete alert', async () => {
      vi.mocked(prisma.alert.delete).mockResolvedValue({
        id: TEST_ALERT_ID,
      });

      const response = await request(app)
        .delete(`${BASE_URL}/${TEST_ALERT_ID}`);

      expect(response.status).toBe(204);
    });

    it('should prevent deletion of critical alerts', async () => {
      const response = await request(app)
        .delete(`${BASE_URL}/${TEST_ALERT_ID}`)
        .query({ severity: 'critical' });

      expect(response.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────
  // 6. POST /api/v1/alerts/:id/acknowledge
  // ──────────────────────────────────────────
  describe('POST /api/v1/alerts/:id/acknowledge - Acknowledge Alert', () => {
    it('should acknowledge alert with comment', async () => {
      const acknowledgePayload = {
        comment: 'Acknowledged by admin',
      };

      vi.mocked(prisma.alert.update).mockResolvedValue({
        id: TEST_ALERT_ID,
        status: 'ACKNOWLEDGED',
      });

      const response = await request(app)
        .post(`${BASE_URL}/${TEST_ALERT_ID}/acknowledge`)
        .send(acknowledgePayload);

      expect(response.status).toBe(200);
      expect(response.body.alert.status).toBe('ACKNOWLEDGED');
    });

    it('should prevent acknowledging already resolved alerts', async () => {
      const response = await request(app)
        .post(`${BASE_URL}/${TEST_ALERT_ID}/acknowledge`)
        .send({ comment: 'test' });

      expect(response.status).toBe(400 || 409);
    });
  });

  // ──────────────────────────────────────────
  // 7. GET /api/v1/alerts/config/:organizationId
  // ──────────────────────────────────────────
  describe('GET /api/v1/alerts/config/:organizationId - Alert Configuration', () => {
    it('should return alert configuration', async () => {
      const mockConfig = {
        organizationId: TEST_ORG_ID,
        stockCritical: 10,
        budgetThreshold: 80,
        enableSMS: true,
        enableEmail: true,
        escalationDelay: 3600,
      };

      vi.mocked(prisma.alertConfiguration.findFirst).mockResolvedValue(mockConfig);

      const response = await request(app)
        .get(`${BASE_URL}/config/${TEST_ORG_ID}`);

      expect(response.status).toBe(200);
      expect(response.body.config.stockCritical).toBe(10);
      expect(response.body.config.enableSMS).toBe(true);
    });

    it('should return default configuration if not found', async () => {
      vi.mocked(prisma.alertConfiguration.findFirst).mockResolvedValue(null);

      const response = await request(app)
        .get(`${BASE_URL}/config/${TEST_ORG_ID}`);

      expect(response.status).toBe(200);
      expect(response.body.config).toBeDefined();
    });
  });
});

// ──────────────────────────────────────────
// INTEGRATION TESTS
// ──────────────────────────────────────────
describe('Alerts Integration Tests', () => {
  it('should create alert and send notifications', async () => {
    const alertPayload = {
      organizationId: TEST_ORG_ID,
      type: 'IGPP_STOCK',
      enableSMS: true,
      enableEmail: true,
    };

    vi.mocked(prisma.alert.create).mockResolvedValue({
      id: TEST_ALERT_ID,
      ...alertPayload,
    });

    const response = await request(app)
      .post(BASE_URL)
      .send(alertPayload);

    expect(response.status).toBe(201);
    expect(response.body.alert).toBeDefined();
  });

  it('should escalate unacknowledged alerts after timeout', async () => {
    const oldAlert = {
      id: TEST_ALERT_ID,
      status: 'OPEN',
      createdAt: new Date(Date.now() - 7200000), // 2 hours ago
    };

    vi.mocked(prisma.alert.findMany).mockResolvedValue([oldAlert]);
    vi.mocked(prisma.alert.update).mockResolvedValue({
      ...oldAlert,
      status: 'ESCALATED',
    });

    const response = await request(app)
      .post(`${BASE_URL}/escalate`)
      .send({ organizationId: TEST_ORG_ID });

    expect(response.status).toBe(200);
  });

  it('should generate alert report', async () => {
    const mockAlerts = [
      { id: '1', type: 'IGPP_STOCK', severity: 'critical', status: 'OPEN' },
      { id: '2', type: 'IGPP_BUDGET', severity: 'high', status: 'ACKNOWLEDGED' },
    ];

    vi.mocked(prisma.alert.findMany).mockResolvedValue(mockAlerts);

    const response = await request(app)
      .get(`${BASE_URL}/report`)
      .query({ organizationId: TEST_ORG_ID });

    expect(response.status).toBe(200);
    expect(response.body.totalAlerts).toBe(2);
    expect(response.body.byStatus).toBeDefined();
  });
});
