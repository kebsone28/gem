import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const mockTracerAction = vi.fn();

vi.mock('../../services/audit.service.js', () => ({
  tracerAction: mockTracerAction,
}));

const { auditLog } = await import('../auditLog.js');

function createApp(user = null) {
  const app = express();
  const router = express.Router();
  app.use(express.json());
  app.use((req, res, next) => {
    if (user) req.user = user;
    next();
  });
  app.use(auditLog);
  app.use('/api', router);
  router.get('/test', (req, res) => res.json({ ok: true }));
  router.get('/test/:id', (req, res) => res.json({ id: req.params.id }));
  router.post('/test', (req, res) => res.status(201).json({ created: true }));
  app.get('/error', (req, res) => res.status(500).json({ error: 'fail' }));
  return app;
}

describe('auditLog middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls tracerAction with request details on GET', async () => {
    const app = createApp({ id: 'user-1', organizationId: 'org-1' });
    await request(app).get('/api/test?foo=bar').expect(200);

    expect(mockTracerAction).toHaveBeenCalledTimes(1);

    const callArg = mockTracerAction.mock.calls[0][0];
    expect(callArg.organizationId).toBe('org-1');
    expect(callArg.userId).toBe('user-1');
    expect(callArg.action).toBe('GET /api/test');
    expect(callArg.resource).toBe('/api');
    expect(callArg.resourceId).toBeNull();
    expect(callArg.details.status).toBe(200);
    expect(callArg.details).toHaveProperty('responseTimeMs');
    expect(typeof callArg.details.responseTimeMs).toBe('number');
    expect(callArg.details.query).toEqual({ foo: 'bar' });
    expect(callArg.details.body).toEqual({});
    expect(callArg.req).toBeDefined();
  });

  it('includes resourceId from route params', async () => {
    const app = createApp({ id: 'user-1', organizationId: 'org-1' });
    await request(app).get('/api/test/abc-123').expect(200);

    expect(mockTracerAction).toHaveBeenCalledTimes(1);
    const callArg = mockTracerAction.mock.calls[0][0];
    expect(callArg.resourceId).toBe('abc-123');
    expect(callArg.action).toBe('GET /api/test/abc-123');
  });

  it('includes status code from response', async () => {
    const app = createApp({ id: 'user-1', organizationId: 'org-1' });
    await request(app).post('/api/test').send({ name: 'test' }).expect(201);

    expect(mockTracerAction).toHaveBeenCalledTimes(1);
    const callArg = mockTracerAction.mock.calls[0][0];
    expect(callArg.details.status).toBe(201);
    expect(callArg.details.body).toEqual({ name: 'test' });
  });

  it('includes error status codes', async () => {
    const app = createApp({ id: 'user-1', organizationId: 'org-1' });
    await request(app).get('/error').expect(500);

    expect(mockTracerAction).toHaveBeenCalledTimes(1);
    const callArg = mockTracerAction.mock.calls[0][0];
    expect(callArg.details.status).toBe(500);
  });

  it('handles unauthenticated requests (null org/user)', async () => {
    const app = createApp(null);
    await request(app).get('/api/test').expect(200);

    expect(mockTracerAction).toHaveBeenCalledTimes(1);
    const callArg = mockTracerAction.mock.calls[0][0];
    expect(callArg.organizationId).toBeNull();
    expect(callArg.userId).toBeNull();
  });

  it('includes responseTimeMs as a positive number', async () => {
    const app = createApp({ id: 'user-1', organizationId: 'org-1' });
    await request(app).get('/api/test').expect(200);

    const callArg = mockTracerAction.mock.calls[0][0];
    expect(callArg.details.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('does not break the request-response cycle on tracerAction error', async () => {
    mockTracerAction.mockRejectedValueOnce(new Error('Audit DB down'));
    const app = createApp({ id: 'user-1', organizationId: 'org-1' });
    await request(app).get('/api/test').expect(200);
  });
});
