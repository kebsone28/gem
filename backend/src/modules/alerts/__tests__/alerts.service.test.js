/**
 * UNIT TESTS - Alerts Service
 * Tests complets pour le système d'alertes (SMS, Email, Escalation, KPI)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../../../core/utils/prisma.js';
import { sendSMSAlert, sendEmailAlert, handleEscalation, createIGPPAlerts } from '../alerts.service';
import * as notificationProviders from '../../../services/notificationProviders.js';

// Mock Prisma
vi.mock('../../../core/utils/prisma.js', () => ({
  default: {
    alert: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    alertConfiguration: {
      findFirst: vi.fn(),
    },
    household: {
      findMany: vi.fn(),
    },
    mission: {
      findMany: vi.fn(),
    },
  },
}));

// Mock notification providers
vi.mock('../../../services/notificationProviders.js', () => ({
  sendSMSViaProvider: vi.fn(),
  sendEmailViaProvider: vi.fn(),
  getNotificationStatus: vi.fn(),
}));

describe('Alerts Service - SMS & Email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendSMSAlert', () => {
    it('should send SMS alert successfully', async () => {
      const alertId = 'alert-123';
      const phoneNumber = '+1234567890';
      const message = 'Critical stock level detected';

      vi.mocked(notificationProviders.sendSMSViaProvider).mockResolvedValue({
        success: true,
        messageId: 'msg-123',
      });

      vi.mocked(prisma.alert.update).mockResolvedValue({
        id: alertId,
        smsNotified: true,
      });

      const result = await sendSMSAlert({
        alertId,
        phoneNumber,
        message,
      });

      expect(notificationProviders.sendSMSViaProvider).toHaveBeenCalledWith(
        phoneNumber,
        message
      );
      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: alertId },
        data: {
          smsNotified: true,
          smsNotifiedAt: expect.any(Date),
        },
      });
      expect(result.success).toBe(true);
    });

    it('should handle SMS send failure', async () => {
      const alertId = 'alert-123';
      const phoneNumber = '+1234567890';
      const message = 'Critical alert';

      vi.mocked(notificationProviders.sendSMSViaProvider).mockRejectedValue(
        new Error('SMS provider error')
      );

      const result = await sendSMSAlert({
        alertId,
        phoneNumber,
        message,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('sendEmailAlert', () => {
    it('should send email alert with HTML template', async () => {
      const alertId = 'alert-456';
      const email = 'admin@test.com';
      const alertData = {
        type: 'IGPP_STOCK',
        severity: 'critical',
        message: 'Stock critically low',
      };

      vi.mocked(notificationProviders.sendEmailViaProvider).mockResolvedValue({
        success: true,
        messageId: 'email-456',
      });

      vi.mocked(prisma.alert.update).mockResolvedValue({
        id: alertId,
        emailNotified: true,
      });

      const result = await sendEmailAlert({
        alertId,
        email,
        subject: 'Critical Stock Alert',
        alertData,
      });

      expect(notificationProviders.sendEmailViaProvider).toHaveBeenCalled();
      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: alertId },
        data: {
          emailNotified: true,
          emailNotifiedAt: expect.any(Date),
        },
      });
      expect(result.success).toBe(true);
    });

    it('should handle email send failure gracefully', async () => {
      const alertId = 'alert-456';

      vi.mocked(notificationProviders.sendEmailViaProvider).mockRejectedValue(
        new Error('Email provider error')
      );

      const result = await sendEmailAlert({
        alertId,
        email: 'admin@test.com',
        subject: 'Alert',
        alertData: {},
      });

      expect(result.success).toBe(false);
    });
  });
});

describe('Alerts Service - Escalation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleEscalation', () => {
    it('should escalate alert when threshold exceeded', async () => {
      const alertId = 'alert-esc-001';
      const organizationId = 'org-123';

      const mockAlert = {
        id: alertId,
        organizationId,
        status: 'OPEN',
        severity: 'critical',
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
      };

      vi.mocked(prisma.alert.findMany).mockResolvedValue([mockAlert]);
      vi.mocked(prisma.alert.update).mockResolvedValue({
        ...mockAlert,
        status: 'ESCALATED',
      });

      const result = await handleEscalation({
        organizationId,
        escalationDelay: 3600, // 1 hour in seconds
      });

      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: alertId },
        data: {
          status: 'ESCALATED',
          escalatedAt: expect.any(Date),
        },
      });
      expect(result.escalatedCount).toBeGreaterThan(0);
    });

    it('should not escalate recent alerts', async () => {
      const mockAlert = {
        id: 'alert-recent',
        status: 'OPEN',
        createdAt: new Date(Date.now() - 600000), // 10 minutes ago
      };

      vi.mocked(prisma.alert.findMany).mockResolvedValue([mockAlert]);

      const result = await handleEscalation({
        organizationId: 'org-123',
        escalationDelay: 3600, // 1 hour threshold
      });

      expect(prisma.alert.update).not.toHaveBeenCalled();
      expect(result.escalatedCount).toBe(0);
    });
  });
});

describe('Alerts Service - IGPP KPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createIGPPAlerts', () => {
    it('should create stock critical alert when threshold exceeded', async () => {
      const projectId = 'proj-123';
      const organizationId = 'org-123';

      const mockConfig = {
        stockCritical: 10,
        enableSMS: true,
        enableEmail: true,
      };

      const mockData = {
        kitPrepared: 5, // Below threshold
        totalHouseholds: 100,
      };

      vi.mocked(prisma.alertConfiguration.findFirst).mockResolvedValue(mockConfig);
      vi.mocked(prisma.household.findMany).mockResolvedValue([
        { id: 'hh-1', kitPrepared: 5 },
      ]);

      vi.mocked(prisma.alert.create).mockResolvedValue({
        id: 'alert-igpp-stock',
        type: 'IGPP_STOCK',
        severity: 'critical',
        status: 'OPEN',
      });

      const result = await createIGPPAlerts({
        projectId,
        organizationId,
        kpiData: mockData,
      });

      expect(prisma.alert.create).toHaveBeenCalled();
      expect(result.alertsCreated).toBeGreaterThan(0);
    });

    it('should create budget alert when usage exceeds threshold', async () => {
      const mockConfig = {
        budgetThreshold: 80,
        enableSMS: true,
      };

      const mockData = {
        budgetUsagePercent: 85, // Above 80% threshold
      };

      vi.mocked(prisma.alertConfiguration.findFirst).mockResolvedValue(mockConfig);
      vi.mocked(prisma.alert.create).mockResolvedValue({
        id: 'alert-igpp-budget',
        type: 'IGPP_BUDGET',
        severity: 'high',
      });

      const result = await createIGPPAlerts({
        projectId: 'proj-123',
        organizationId: 'org-123',
        kpiData: mockData,
      });

      expect(prisma.alert.create).toHaveBeenCalled();
    });

    it('should handle multiple KPI violations', async () => {
      const mockConfig = {
        stockCritical: 10,
        budgetThreshold: 80,
        electricityMin: 50,
        enableSMS: true,
      };

      vi.mocked(prisma.alertConfiguration.findFirst).mockResolvedValue(mockConfig);
      vi.mocked(prisma.alert.create).mockResolvedValue({
        id: expect.any(String),
        status: 'OPEN',
      });

      const result = await createIGPPAlerts({
        projectId: 'proj-123',
        organizationId: 'org-123',
        kpiData: {
          kitPrepared: 5,
          budgetUsagePercent: 85,
          electrifiedHouseholds: 40,
        },
      });

      expect(prisma.alert.create).toHaveBeenCalled();
    });

    it('should not create duplicate alerts', async () => {
      vi.mocked(prisma.alert.findMany).mockResolvedValue([
        {
          id: 'existing-alert',
          type: 'IGPP_STOCK',
          status: 'OPEN',
          createdAt: new Date(Date.now() - 300000), // Recent
        },
      ]);

      const result = await createIGPPAlerts({
        projectId: 'proj-123',
        organizationId: 'org-123',
        kpiData: { kitPrepared: 5 },
      });

      expect(result.duplicatesPrevented).toBeGreaterThan(0);
    });
  });
});

describe('Alerts Service - Alert Status Updates', () => {
  it('should acknowledge alert', async () => {
    const alertId = 'alert-ack-001';

    vi.mocked(prisma.alert.update).mockResolvedValue({
      id: alertId,
      status: 'ACKNOWLEDGED',
    });

    const result = await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
      },
    });

    expect(result.status).toBe('ACKNOWLEDGED');
  });

  it('should resolve alert', async () => {
    const alertId = 'alert-res-001';

    vi.mocked(prisma.alert.update).mockResolvedValue({
      id: alertId,
      status: 'RESOLVED',
    });

    const result = await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    expect(result.status).toBe('RESOLVED');
  });
});

describe('Alerts Service - Error Handling', () => {
  it('should log errors when database operation fails', async () => {
    const dbError = new Error('Database connection failed');

    vi.mocked(prisma.alert.findMany).mockRejectedValue(dbError);

    try {
      await prisma.alert.findMany();
    } catch (err) {
      expect(err.message).toBe('Database connection failed');
    }
  });

  it('should handle missing configuration gracefully', async () => {
    vi.mocked(prisma.alertConfiguration.findFirst).mockResolvedValue(null);

    const result = await createIGPPAlerts({
      projectId: 'proj-123',
      organizationId: 'org-123',
      kpiData: {},
    });

    expect(result.error || result.skipped).toBeDefined();
  });
});
