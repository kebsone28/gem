import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import prisma from '../../../core/utils/prisma.js';

vi.mock('../../../core/utils/prisma.js', () => {
  const model = (methods) => Object.fromEntries(methods.map((k) => [k, vi.fn()]));

  const cartoModels = {
    $transaction: vi.fn((ops) => Promise.all(ops)),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    household: model(['findMany']),
    cartoHouseholdEntry: model(['findMany', 'upsert', 'findFirst']),
    cartoHistory: model(['create', 'findMany', 'deleteMany']),
    cartoEntrepreneur: model(['findMany', 'create', 'deleteMany', 'upsert']),
    cartoVillageOverride: model(['findMany', 'upsert']),
    cartoSettings: model(['findUnique', 'create', 'upsert', 'findFirst']),
    cartoWorkflow: model(['findMany', 'create', 'update']),
    cartoArchive: model(['findMany', 'create']),
    cartoStatsSnapshot: model(['findMany', 'upsert']),
    cartoPlanningParams: model(['findUnique', 'upsert']),
    cartoGantt: model(['findMany', 'upsert']),
    cartoFiche: model(['findMany', 'count', 'create', 'findUnique', 'delete']),
    cartoPhoto: model(['findUnique', 'findFirst', 'upsert']),
    cartoContractTemplate: model(['findMany', 'upsert']),
    cartoAlerts: model(['findUnique', 'create', 'upsert', 'findFirst']),
    cartoRegion: model(['findMany', 'create', 'update', 'upsert']),
    cartoGrappe: model(['findMany', 'create', 'update', 'upsert']),
    cartoLot: model(['findMany', 'create', 'update', 'upsert']),
  };

  const basePrismaModels = {};
  for (const name of Object.keys(cartoModels).filter(k => k !== '$transaction' && k !== '$queryRaw' && k !== '$executeRaw')) {
    basePrismaModels[name] = model(Object.keys(cartoModels[name]));
  }
  basePrismaModels.auditLog = model(['create']);

  return { basePrisma: basePrismaModels, default: cartoModels };
});

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
        name: 'Test User',
        permissions: [],
      };
      next();
    },
    authorize: (..._args) => (req, _res, next) => next(),
  };
});

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
const BASE = '/api/carto-grappes';

describe('Carto-Grappes API — Regions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /regions returns regions', async () => {
    prisma.cartoRegion.findMany.mockResolvedValue([{ id: 'r1', name: 'Kaffrine', code: 'KAFF' }]);
    const res = await request(app).get(`${BASE}/regions`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(prisma.cartoRegion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-1' }) })
    );
  });

  it('POST /regions creates a region without id', async () => {
    prisma.cartoRegion.create.mockResolvedValue({ id: 'r2', name: 'Tamba', code: 'TAMBA' });
    const res = await request(app).post(`${BASE}/regions`).send({ name: 'Tamba', code: 'TAMBA' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('r2');
    expect(prisma.cartoRegion.create).toHaveBeenCalled();
  });

  it('POST /regions updates a region with id', async () => {
    prisma.cartoRegion.update.mockResolvedValue({ id: 'r1', name: 'Kaffrine Updated' });
    const res = await request(app).post(`${BASE}/regions`).send({ id: 'r1', name: 'Kaffrine Updated' });
    expect(res.status).toBe(200);
    expect(prisma.cartoRegion.update).toHaveBeenCalled();
  });
});

describe('Carto-Grappes API — Grappes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /grappes returns grappes with region', async () => {
    prisma.cartoGrappe.findMany.mockResolvedValue([{ id: 'g1', grappeNumber: 1, region: { name: 'Kaffrine' } }]);
    const res = await request(app).get(`${BASE}/grappes`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /grappes creates a grappe', async () => {
    prisma.cartoGrappe.create.mockResolvedValue({ id: 'g1', grappeNumber: 1 });
    const res = await request(app).post(`${BASE}/grappes`).send({ regionId: 'r1', grappeNumber: 1, grappeKey: 'Kaffrine|1' });
    expect(res.status).toBe(200);
    expect(prisma.cartoGrappe.create).toHaveBeenCalled();
  });
});

describe('Carto-Grappes API — Lots', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /lots returns lots', async () => {
    prisma.cartoLot.findMany.mockResolvedValue([{ id: 'l1', lotKey: 'A' }]);
    const res = await request(app).get(`${BASE}/lots`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /lots creates a lot', async () => {
    prisma.cartoLot.create.mockResolvedValue({ id: 'l1', lotKey: 'A' });
    const res = await request(app).post(`${BASE}/lots`).send({ lotKey: 'A', title: 'Lot A' });
    expect(res.status).toBe(200);
    expect(prisma.cartoLot.create).toHaveBeenCalled();
  });
});

describe('Carto-Grappes API — Household Entries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /entries returns mapped entries', async () => {
    prisma.cartoHouseholdEntry.findMany.mockResolvedValue([
      { householdOrdre: 1, lotAStatus: 'fait', lotAJustif: 'ok', lotAUpdatedAt: new Date(), lotBStatus: '', lotBJustif: '', lotBUpdatedAt: null, lotCStatus: '', lotCJustif: '', lotCUpdatedAt: null, conforme: true, obs: '' },
    ]);
    const res = await request(app).get(`${BASE}/entries`);
    expect(res.status).toBe(200);
    expect(res.body['1']).toBeDefined();
    expect(res.body['1'].A.status).toBe('fait');
  });

  it('POST /entries upserts a household entry', async () => {
    prisma.cartoHouseholdEntry.upsert.mockResolvedValue({ id: 'e1' });
    prisma.cartoHistory.create.mockResolvedValue({});
    const res = await request(app).post(`${BASE}/entries`).send({ householdOrdre: 1, lot: 'A', status: 'fait' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(prisma.cartoHouseholdEntry.upsert).toHaveBeenCalled();
    expect(prisma.cartoHistory.create).toHaveBeenCalled();
  });

  it('POST /entries returns 400 without householdOrdre', async () => {
    const res = await request(app).post(`${BASE}/entries`).send({ lot: 'A', status: 'fait' });
    expect(res.status).toBe(400);
  });

  it('POST /entries/bulk upserts multiple entries', async () => {
    prisma.cartoHouseholdEntry.upsert.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);
    const res = await request(app).post(`${BASE}/entries/bulk`).send({
      entries: [
        { householdOrdre: 1, lotA: { status: 'fait' } },
        { householdOrdre: 2, lotB: { status: 'en_cours' } },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });

  it('POST /entries/bulk returns 400 without entries array', async () => {
    const res = await request(app).post(`${BASE}/entries/bulk`).send({});
    expect(res.status).toBe(400);
  });
});

describe('Carto-Grappes API — Entrepreneurs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /entrepreneurs returns list', async () => {
    prisma.cartoEntrepreneur.findMany.mockResolvedValue([{ id: 'ent-1', grappeKey: '__global' }]);
    const res = await request(app).get(`${BASE}/entrepreneurs`);
    expect(res.status).toBe(200);
    expect(res.body[0].grappeKey).toBeNull();
  });

  it('POST /entrepreneurs creates one', async () => {
    prisma.cartoEntrepreneur.upsert.mockResolvedValue({ id: 'ent-1' });
    const res = await request(app).post(`${BASE}/entrepreneurs`).send({ lot: 'A', mode: 'global', entreprise: 'SARL' });
    expect(res.status).toBe(200);
    expect(prisma.cartoEntrepreneur.upsert).toHaveBeenCalled();
  });

  it('POST /entrepreneurs returns 400 without lot', async () => {
    const res = await request(app).post(`${BASE}/entrepreneurs`).send({ mode: 'global' });
    expect(res.status).toBe(400);
  });

  it('DELETE /entrepreneurs/:id deletes', async () => {
    prisma.cartoEntrepreneur.deleteMany.mockResolvedValue({ count: 1 });
    const res = await request(app).delete(`${BASE}/entrepreneurs/ent-1`).send({ lot: 'A' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('Carto-Grappes API — Village Overrides', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /overrides returns map', async () => {
    prisma.cartoVillageOverride.findMany.mockResolvedValue([{ villageKey: 'Kaffrine|Nguelou', grappeNumber: 5 }]);
    const res = await request(app).get(`${BASE}/overrides`);
    expect(res.status).toBe(200);
    expect(res.body['Kaffrine|Nguelou']).toBe(5);
  });

  it('POST /overrides upserts', async () => {
    prisma.cartoVillageOverride.upsert.mockResolvedValue({ villageKey: 'Kaffrine|Nguelou', grappeNumber: 5 });
    const res = await request(app).post(`${BASE}/overrides`).send({ villageKey: 'Kaffrine|Nguelou', grappeNumber: 5 });
    expect(res.status).toBe(200);
    expect(prisma.cartoVillageOverride.upsert).toHaveBeenCalled();
  });
});

describe('Carto-Grappes API — History', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /history returns history entries', async () => {
    prisma.cartoHistory.findMany.mockResolvedValue([{ id: 'h1', lot: 'A', toStatus: 'fait' }]);
    const res = await request(app).get(`${BASE}/history`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('DELETE /history clears history', async () => {
    prisma.cartoHistory.deleteMany.mockResolvedValue({ count: 10 });
    const res = await request(app).delete(`${BASE}/history`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('Carto-Grappes API — Settings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /settings creates default if absent', async () => {
    prisma.cartoSettings.findUnique.mockResolvedValue(null);
    prisma.cartoSettings.create.mockResolvedValue({ organizationId: 'org-1', lotModes: {} });
    const res = await request(app).get(`${BASE}/settings`);
    expect(res.status).toBe(200);
    expect(prisma.cartoSettings.create).toHaveBeenCalled();
  });

  it('PUT /settings upserts', async () => {
    prisma.cartoSettings.upsert.mockResolvedValue({ organizationId: 'org-1' });
    const res = await request(app).put(`${BASE}/settings`).send({ lotModes: { A: 'manuel' } });
    expect(res.status).toBe(200);
    expect(prisma.cartoSettings.upsert).toHaveBeenCalled();
  });
});

describe('Carto-Grappes API — Workflow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /workflow returns queue', async () => {
    prisma.cartoWorkflow.findMany.mockResolvedValue([{ id: 'w1', status: 'pending' }]);
    const res = await request(app).get(`${BASE}/workflow`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /workflow submits a new entry', async () => {
    prisma.cartoWorkflow.create.mockResolvedValue({ id: 'w1' });
    const res = await request(app).post(`${BASE}/workflow`).send({ householdOrdre: 1, nom: 'Test', village: 'Nguelou', region: 'Kaffrine', grappe: 1 });
    expect(res.status).toBe(200);
    expect(prisma.cartoWorkflow.create).toHaveBeenCalled();
  });

  it('PUT /workflow/:id/approve approves', async () => {
    prisma.cartoWorkflow.update.mockResolvedValue({ id: 'w1', status: 'approved' });
    const res = await request(app).put(`${BASE}/workflow/w1/approve`);
    expect(res.status).toBe(200);
    expect(prisma.cartoWorkflow.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'approved' }) })
    );
  });
});

describe('Carto-Grappes API — Archives', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /archives returns list', async () => {
    prisma.cartoArchive.findMany.mockResolvedValue([{ id: 'a1', grappeKey: 'Kaffrine|1' }]);
    const res = await request(app).get(`${BASE}/archives`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /archives creates one', async () => {
    prisma.cartoArchive.create.mockResolvedValue({ id: 'a1' });
    const res = await request(app).post(`${BASE}/archives`).send({ grappeKey: 'Kaffrine|1', region: 'Kaffrine', grappe: 1, totalMenages: 50, totalConformes: 45, snapshot: [] });
    expect(res.status).toBe(200);
    expect(prisma.cartoArchive.create).toHaveBeenCalled();
  });
});

describe('Carto-Grappes API — Stats Snapshots', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /stats returns snapshots', async () => {
    prisma.cartoStatsSnapshot.findMany.mockResolvedValue([{ snapshotDate: '2026-01-01', conforme: 100 }]);
    const res = await request(app).get(`${BASE}/stats`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /stats/snapshot upserts snapshot', async () => {
    prisma.cartoStatsSnapshot.upsert.mockResolvedValue({ snapshotDate: '2026-07-15' });
    const res = await request(app).post(`${BASE}/stats/snapshot`).send({ conforme: 100, lotA: 30, lotB: 40, lotC: 30, bloques: 5 });
    expect(res.status).toBe(200);
    expect(prisma.cartoStatsSnapshot.upsert).toHaveBeenCalled();
  });
});

describe('Carto-Grappes API — Planning Params', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /planning returns params', async () => {
    prisma.cartoPlanningParams.findUnique.mockResolvedValue({ params: { workDays: [1, 2, 3, 4, 5] } });
    const res = await request(app).get(`${BASE}/planning`);
    expect(res.status).toBe(200);
    expect(res.body.workDays).toEqual([1, 2, 3, 4, 5]);
  });

  it('PUT /planning upserts params', async () => {
    prisma.cartoPlanningParams.upsert.mockResolvedValue({});
    const res = await request(app).put(`${BASE}/planning`).send({ params: { workDays: [1, 2, 3, 4, 5] } });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('Carto-Grappes API — Gantt', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /gantt returns entries', async () => {
    prisma.cartoGantt.findMany.mockResolvedValue([{ grappeKey: 'Kaffrine|1', phase: 'A' }]);
    const res = await request(app).get(`${BASE}/gantt`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /gantt upserts entry', async () => {
    prisma.cartoGantt.upsert.mockResolvedValue({ grappeKey: 'Kaffrine|1', phase: 'A' });
    const res = await request(app).post(`${BASE}/gantt`).send({ grappeKey: 'Kaffrine|1', phase: 'A', startDate: '2026-01-01', endDate: '2026-01-15', status: 'done' });
    expect(res.status).toBe(200);
    expect(prisma.cartoGantt.upsert).toHaveBeenCalled();
  });
});

describe('Carto-Grappes API — Fiches', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /fiches returns fiches', async () => {
    prisma.cartoFiche.findMany.mockResolvedValue([{ ficheKey: 'F01', entryIndex: 0, data: {} }]);
    const res = await request(app).get(`${BASE}/fiches`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /fiches adds entry', async () => {
    prisma.cartoFiche.count.mockResolvedValue(2);
    prisma.cartoFiche.create.mockResolvedValue({ id: 'f1', ficheKey: 'F01', entryIndex: 2 });
    const res = await request(app).post(`${BASE}/fiches`).send({ ficheKey: 'F01', data: { note: 'test' } });
    expect(res.status).toBe(200);
    expect(res.body.entryIndex).toBe(2);
  });

  it('DELETE /fiches/:id deletes entry', async () => {
    prisma.cartoFiche.findUnique.mockResolvedValue({ id: 'f1', organizationId: 'org-1' });
    prisma.cartoFiche.delete.mockResolvedValue({});
    const res = await request(app).delete(`${BASE}/fiches/f1`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('DELETE /fiches/:id returns 404 for wrong org', async () => {
    prisma.cartoFiche.findUnique.mockResolvedValue({ id: 'f1', organizationId: 'other-org' });
    const res = await request(app).delete(`${BASE}/fiches/f1`);
    expect(res.status).toBe(404);
  });
});

describe('Carto-Grappes API — Photos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /photos returns photo', async () => {
    prisma.cartoPhoto.findUnique.mockResolvedValue({ householdOrdre: 1, lot: 'A', data: 'base64...' });
    const res = await request(app).get(`${BASE}/photos?householdOrdre=1&lot=A`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBe('base64...');
  });

  it('POST /photos saves photo', async () => {
    prisma.cartoPhoto.upsert.mockResolvedValue({ householdOrdre: 1, lot: 'A' });
    const res = await request(app).post(`${BASE}/photos`).send({ householdOrdre: 1, lot: 'A', data: 'base64...' });
    expect(res.status).toBe(200);
    expect(prisma.cartoPhoto.upsert).toHaveBeenCalled();
  });
});

describe('Carto-Grappes API — Contract Templates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /templates returns map', async () => {
    prisma.cartoContractTemplate.findMany.mockResolvedValue([{ lot: 'A', htmlContent: '<h1>Contract A</h1>' }]);
    const res = await request(app).get(`${BASE}/templates`);
    expect(res.status).toBe(200);
    expect(res.body['A']).toBe('<h1>Contract A</h1>');
  });

  it('POST /templates upserts', async () => {
    prisma.cartoContractTemplate.upsert.mockResolvedValue({ lot: 'A', htmlContent: '<h1>Contract A</h1>' });
    const res = await request(app).post(`${BASE}/templates`).send({ lot: 'A', htmlContent: '<h1>Contract A</h1>' });
    expect(res.status).toBe(200);
    expect(prisma.cartoContractTemplate.upsert).toHaveBeenCalled();
  });
});

describe('Carto-Grappes API — Alerts Config', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /alerts creates default if absent', async () => {
    prisma.cartoAlerts.findUnique.mockResolvedValue(null);
    prisma.cartoAlerts.create.mockResolvedValue({ organizationId: 'org-1', enabled: false });
    const res = await request(app).get(`${BASE}/alerts`);
    expect(res.status).toBe(200);
    expect(prisma.cartoAlerts.create).toHaveBeenCalled();
  });

  it('PUT /alerts upserts config', async () => {
    prisma.cartoAlerts.upsert.mockResolvedValue({ enabled: true, delayDays: 7 });
    const res = await request(app).put(`${BASE}/alerts`).send({ enabled: true, delayDays: 7 });
    expect(res.status).toBe(200);
    expect(prisma.cartoAlerts.upsert).toHaveBeenCalled();
  });
});

describe('Carto-Grappes API — Dashboard Stats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /dashboard-stats returns full stats', async () => {
    prisma.cartoRegion.findMany.mockResolvedValue([{ id: 'r1', name: 'Kaffrine', code: 'KAFF' }]);
    prisma.cartoGrappe.findMany.mockResolvedValue([{ id: 'g1', grappeKey: 'Kaffrine|1', regionId: 'r1', region: { name: 'Kaffrine' }, menageCount: 50 }]);
    prisma.cartoLot.findMany.mockResolvedValue([{ id: 'l1', lotKey: 'A' }]);
    prisma.cartoEntrepreneur.findMany.mockResolvedValue([]);

    const res = await request(app).get(`${BASE}/dashboard-stats`);
    expect(res.status).toBe(200);
    expect(res.body.totalRegions).toBe(1);
    expect(res.body.totalGrappes).toBe(1);
    expect(res.body.totalLots).toBe(1);
    expect(res.body.lotStats['A']).toBeDefined();
  });
});

describe('Carto-Grappes API — Reference Data', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET /villages returns raw query result', async () => {
    prisma.$queryRaw.mockResolvedValue([{ region: 'Kaffrine', village: 'Nguelou', n: 10, lat: 14.0, lon: -16.0 }]);
    const res = await request(app).get(`${BASE}/villages`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('GET /menages returns raw query result', async () => {
    prisma.$queryRaw.mockResolvedValue([{ ordre: 1, nom: 'Diallo', tel: '77', village: 'Nguelou', commune: 'Kaffrine', region: 'Kaffrine' }]);
    const res = await request(app).get(`${BASE}/menages`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('GET /gps returns raw query result', async () => {
    prisma.$queryRaw.mockResolvedValue([{ ordre: 1, lat: 14.0, lon: -16.0, accuracy: 5 }]);
    const res = await request(app).get(`${BASE}/gps`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('GET /prestataires returns raw query result', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 1, nom: 'SARL Test', entreprise: 'Test', societe: 'Test', telephone: '77', email: 't@t.com', adresse: 'Dakar', lot: 'A', region: 'Kaffrine' }]);
    const res = await request(app).get(`${BASE}/prestataires`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /prestataires/bulk upserts array', async () => {
    prisma.$executeRaw.mockResolvedValue(1);
    const res = await request(app).post(`${BASE}/prestataires/bulk`).send({ prestataires: [{ nom: 'P1', entreprise: 'E1' }] });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it('POST /prestataires/bulk returns 400 without array', async () => {
    const res = await request(app).post(`${BASE}/prestataires/bulk`).send({});
    expect(res.status).toBe(400);
  });
});

describe('Carto-Grappes API — Initialize Default Data', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /initialize creates defaults', async () => {
    prisma.cartoLot.upsert.mockResolvedValue({});
    prisma.household.findMany.mockResolvedValue([{ region: 'Kaffrine' }]);
    prisma.cartoRegion.upsert.mockResolvedValue({});
    const res = await request(app).post(`${BASE}/initialize`);
    expect(res.status).toBe(200);
    expect(res.body.lots).toBe(3);
    expect(res.body.regions).toBe(1);
  });
});
