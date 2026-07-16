import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

/* ── Must import prisma BEFORE vi.mock so the mock replaces the real module ── */
import prisma from '../../../core/utils/prisma.js';

/* ── Mock Prisma (must include basePrisma for audit.service.js) ── */
vi.mock('../../../core/utils/prisma.js', () => {
  const model = (methods) => Object.fromEntries(methods.map((k) => [k, vi.fn()]));

  const cartoModels = {
    $transaction: vi.fn(),
    cartoHouseholdEntry: model(['findMany', 'upsert', 'findFirst']),
    cartoHistory: model(['create', 'findMany', 'deleteMany']),
    cartoEntrepreneur: model(['findMany', 'create', 'deleteMany', 'upsert']),
    cartoVillageOverride: model(['findMany', 'upsert']),
    cartoSettings: model(['findUnique', 'create', 'upsert', 'findFirst']),
    cartoWorkflow: model(['findMany', 'create', 'update']),
    cartoArchive: model(['findMany', 'create']),
    cartoStatsSnapshot: model(['findMany']),
    cartoPlanningParams: model(['findUnique', 'findFirst']),
    cartoGantt: model(['findMany']),
    cartoFiche: model(['findMany', 'count', 'create']),
    cartoPhoto: model(['findUnique', 'findFirst']),
    cartoContractTemplate: model(['findMany']),
    cartoAlerts: model(['findUnique', 'create', 'upsert', 'findFirst']),
  };

  const basePrismaModels = {};
  const modelNames = Object.keys(cartoModels).filter(k => k !== '$transaction');
  for (const name of modelNames) {
    basePrismaModels[name] = model(Object.keys(cartoModels[name]));
  }
  basePrismaModels.auditLog = model(['create']);

  return { basePrisma: basePrismaModels, default: cartoModels };
});

/* ── Mock Auth ── */
vi.mock('../../../api/middlewares/auth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    authProtect: (req, _res, next) => {
      req.user = {
        id: 'user-1',
        organizationId: 'org-1',
        email: 'test@local',
        role: 'ADMIN_PROQUELEC',
        permissions: [],
      };
      next();
    },
    authorize: (..._args) => (req, _res, next) => next(),
  };
});

/* ── Mock Socket Service ── */
vi.mock('../../../services/socket.service.js', () => ({
  socketService: {
    emit: vi.fn(),
    emitToUser: vi.fn(),
    emitToRole: vi.fn(),
    init: vi.fn(),
    close: vi.fn(),
    registerPresence: vi.fn(),
    unregisterPresence: vi.fn(),
    getOrganizationPresence: vi.fn(),
    broadcastPresence: vi.fn(),
  },
}));

const { default: app } = await import('../../../app.js');
const { socketService } = await import('../../../services/socket.service.js');

const BASE = '/api/carto-grappes';

describe('Carto-Grappes WebSocket Emissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /entries (upsertHouseholdEntry)', () => {
    it('emits carto:updated after creating an entry', async () => {
      vi.mocked(prisma.cartoHouseholdEntry.findMany).mockResolvedValue([]);
      vi.mocked(prisma.cartoHistory.create).mockResolvedValue({});

      const payload = { householdOrdre: 1, lot: 'A', status: 'fait' };
      const res = await request(app).post(`${BASE}/entries`).send(payload);

      expect(res.status).toBe(200);
      expect(socketService.emit).toHaveBeenCalledWith(
        'carto:updated',
        { type: 'entries', householdOrdre: 1 },
        'org_org-1',
      );
    });
  });

  describe('POST /entries/bulk (bulkUpsertEntries)', () => {
    it('emits carto:updated after bulk upsert', async () => {
      vi.mocked(prisma.cartoHouseholdEntry.findMany).mockResolvedValue([]);

      const payload = {
        entries: [
          { householdOrdre: 1, lotA: { status: 'fait', justif: '' } },
          { householdOrdre: 2, lotB: { status: 'en_cours', justif: '' } },
        ],
      };
      const res = await request(app).post(`${BASE}/entries/bulk`).send(payload);

      expect(res.status).toBe(200);
      expect(socketService.emit).toHaveBeenCalledWith(
        'carto:updated',
        { type: 'entries', count: 2 },
        'org_org-1',
      );
    });
  });

  describe('POST /entrepreneurs (upsertEntrepreneur)', () => {
    it('emits carto:updated after creating an entrepreneur', async () => {
      vi.mocked(prisma.cartoEntrepreneur.upsert).mockResolvedValue({ id: 'ent-1' });

      const payload = { lot: 'A', entreprise: 'Test SARL', societe: 'Test', telephone: '77', email: 't@t.com', adresse: 'Dakar', mode: 'global' };
      const res = await request(app).post(`${BASE}/entrepreneurs`).send(payload);

      expect(res.status).toBe(200);
      expect(socketService.emit).toHaveBeenCalledWith(
        'carto:updated',
        { type: 'entrepreneur', id: 'ent-1', lot: 'A' },
        'org_org-1',
      );
    });
  });

  describe('DELETE /entrepreneurs/:id (deleteEntrepreneur)', () => {
    it('emits carto:updated after deleting', async () => {
      vi.mocked(prisma.cartoEntrepreneur.deleteMany).mockResolvedValue({ count: 1 });

      const res = await request(app).delete(`${BASE}/entrepreneurs/ent-1`).send({ lot: 'A' });

      expect(res.status).toBe(200);
      expect(socketService.emit).toHaveBeenCalledWith(
        'carto:updated',
        { type: 'entrepreneur', id: 'ent-1', deleted: true },
        'org_org-1',
      );
    });
  });

  describe('POST /overrides (setVillageOverride)', () => {
    it('emits carto:updated after setting override', async () => {
      vi.mocked(prisma.cartoVillageOverride.findMany).mockResolvedValue([]);

      const payload = { villageKey: 'Kaffrine|Nguelou', grappeNumber: 5 };
      const res = await request(app).post(`${BASE}/overrides`).send(payload);

      expect(res.status).toBe(200);
      expect(socketService.emit).toHaveBeenCalledWith(
        'carto:updated',
        { type: 'villageOverride', villageKey: 'Kaffrine|Nguelou', grappeNumber: 5 },
        'org_org-1',
      );
    });
  });

  describe('PUT /settings (updateSettings)', () => {
    it('emits carto:updated after updating settings', async () => {
      vi.mocked(prisma.cartoSettings.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.cartoSettings.create).mockResolvedValue({ organizationId: 'org-1' });

      const payload = { lotModes: { A: 'manuel', B: 'manuel', C: 'manuel' } };
      const res = await request(app).put(`${BASE}/settings`).send(payload);

      expect(res.status).toBe(200);
      expect(socketService.emit).toHaveBeenCalledWith(
        'carto:updated',
        { type: 'settings' },
        'org_org-1',
      );
    });
  });

  describe('DELETE /history (clearHistory)', () => {
    it('emits carto:updated after clearing history', async () => {
      vi.mocked(prisma.cartoHistory.deleteMany).mockResolvedValue({ count: 10 });

      const res = await request(app).delete(`${BASE}/history`);

      expect(res.status).toBe(200);
      expect(socketService.emit).toHaveBeenCalledWith(
        'carto:updated',
        { type: 'history', cleared: true },
        'org_org-1',
      );
    });
  });

  describe('POST /alerts (updateAlertsConfig)', () => {
    it('emits carto:updated after updating alerts', async () => {
      vi.mocked(prisma.cartoAlerts.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.cartoAlerts.create).mockResolvedValue({ organizationId: 'org-1' });

      const payload = { enabled: true };
      const res = await request(app).put(`${BASE}/alerts`).send(payload);

      expect(res.status).toBe(200);
      expect(socketService.emit).toHaveBeenCalledWith(
        'carto:updated',
        { type: 'alertsConfig' },
        'org_org-1',
      );
    });
  });
});
