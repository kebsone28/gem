import { vi, describe, it, expect } from 'vitest';
import { domainContext } from '../domainContext.js';

vi.mock('../../services/domain/DomainConfigService.js', () => ({
  DomainConfigService: {
    getConfig: vi.fn(async (organizationId, domainType) => ({
      id: 'cfg1',
      organizationId,
      domainType,
      entityFields: { fields: ['name'] },
      statusEnum: ['planning'],
      priorityRules: {},
      validationSchemas: {},
      projectTemplates: [],
      missionTemplates: [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  },
}));

describe('domainContext middleware', () => {
  it('attaches domainType, domainConfig and domainAdapter when org id and supported domain exist', async () => {
    const req = {
      query: { domainType: 'gem' },
      headers: { 'x-org-id': 'org-123' },
      user: null,
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await domainContext(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.domainType).toBe('gem');
    expect(req.domainConfig).toEqual(expect.objectContaining({ organizationId: 'org-123' }));
    expect(req.domainAdapter).toBeDefined();
  });

  it('calls next when organization id is missing (unauthenticated routes allowed)', async () => {
    const req = {
      query: { domainType: 'gem' },
      headers: {},
      user: null,
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await domainContext(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
