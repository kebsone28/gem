import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockAuditLogCreate = vi.fn();
const mockAuditLogFindMany = vi.fn();
const mockSendMail = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('../../core/utils/prisma.js', () => ({
  basePrisma: {
    auditLog: {
      create: mockAuditLogCreate,
      findMany: mockAuditLogFindMany,
    },
  },
}));

vi.mock('../mail.service.js', () => ({
  sendMail: mockSendMail,
}));

vi.mock('../../core/utils/prismaCompat.js', () => ({
  isPrismaSchemaDriftError: vi.fn(),
}));

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

const { tracerAction, getRecentActions } = await import('../audit.service.js');
const { isPrismaSchemaDriftError } = await import('../../core/utils/prismaCompat.js');

describe('tracerAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLogCreate.mockResolvedValue({ id: 'audit-1' });
    process.env.AUDIT_NOTIF_EMAILS = '';
  });

  it('creates an audit log entry with object argument format', async () => {
    await tracerAction({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'GET /api/test',
      resource: '/api',
      resourceId: null,
      details: { status: 200, responseTimeMs: 42 },
    });

    expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'GET /api/test',
        resource: '/api',
        resourceId: null,
        details: { status: 200, responseTimeMs: 42 },
      }),
    });
    expect(mockLoggerInfo).toHaveBeenCalledWith('[AUDIT] Action tracée : GET /api/test');
  });

  it('creates an audit log entry with positional arguments', async () => {
    await tracerAction('org-2', 'user-2', 'POST /api/data', '/api', 'data-1', { body: { name: 'test' } });

    expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-2',
        userId: 'user-2',
        action: 'POST /api/data',
        resource: '/api',
        resourceId: 'data-1',
        details: { body: { name: 'test' } },
      }),
    });
  });

  it('extracts IP and user-agent from req object', async () => {
    const mockReq = { ip: '192.168.1.1', headers: { 'user-agent': 'TestAgent/1.0' } };
    await tracerAction({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'GET /api/test',
      resource: '/api',
      resourceId: null,
      details: {},
      req: mockReq,
    });

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ipAddress: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
      }),
    });
  });

  it('does not include userId when not provided', async () => {
    const { userId, ...data } = { organizationId: 'org-1', userId: null, action: 'GET /api/test', resource: '/api', resourceId: null, details: {} };
    await tracerAction({ ...data, userId: undefined });

    const callArg = mockAuditLogCreate.mock.calls[0][0].data;
    expect(callArg).not.toHaveProperty('userId');
  });

  it('skips audit log on Prisma schema drift error', async () => {
    const driftError = new Error('The column does not exist');
    driftError.code = 'P2021';
    mockAuditLogCreate.mockRejectedValue(driftError);
    vi.mocked(isPrismaSchemaDriftError).mockReturnValue(true);

    await tracerAction({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'GET /api/test',
      resource: '/api',
    });

    expect(mockLoggerWarn).toHaveBeenCalledWith(expect.stringContaining('Journalisation ignorée'));
    expect(mockLoggerError).not.toHaveBeenCalledWith(expect.stringContaining('Échec'));
  });

  it('logs error when audit log creation fails (non-drift)', async () => {
    mockAuditLogCreate.mockRejectedValue(new Error('DB connection lost'));
    vi.mocked(isPrismaSchemaDriftError).mockReturnValue(false);

    await tracerAction({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'GET /api/test',
      resource: '/api',
    });

    expect(mockLoggerError).toHaveBeenCalledWith(expect.stringContaining('Échec'), expect.stringContaining('DB connection lost'));
  });

  it('sends email notification for critical actions', async () => {
    process.env.AUDIT_NOTIF_EMAILS = 'admin@test.com';
    mockSendMail.mockResolvedValue(true);

    await tracerAction({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'SUPPRESSION_PROJET',
      resource: '/api/projects',
      resourceId: 'proj-1',
      details: { reason: 'test' },
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@test.com',
        subject: expect.stringContaining('SUPPRESSION_PROJET'),
      })
    );
  });

  it('does not send email for non-critical actions', async () => {
    process.env.AUDIT_NOTIF_EMAILS = 'admin@test.com';

    await tracerAction({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'GET /api/test',
      resource: '/api',
    });

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('handles top-level errors gracefully without throwing', async () => {
    mockAuditLogCreate.mockRejectedValue(new Error('Unexpected'));
    vi.mocked(isPrismaSchemaDriftError).mockImplementation(() => { throw new Error('compat crashed'); });

    await expect(tracerAction({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'GET /api/test',
      resource: '/api',
    })).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledWith('[ERREUR AUDIT] Échec :', expect.any(Error));
  });
});

describe('getRecentActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns recent audit actions for an organization', async () => {
    mockAuditLogFindMany.mockResolvedValue([
      { id: 'a1', action: 'GET /api/test', user: { name: 'John', role: 'ADMIN', email: 'john@test.com' } },
      { id: 'a2', action: 'POST /api/data', user: { name: 'Jane', role: 'USER', email: 'jane@test.com' } },
    ]);

    const result = await getRecentActions('org-1', 5);

    expect(result).toHaveLength(2);
    expect(mockAuditLogFindMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      include: { user: { select: { name: true, role: true, email: true } } },
      orderBy: { timestamp: 'desc' },
      take: 5,
    });
  });

  it('returns empty array on schema drift error', async () => {
    const driftError = new Error('The table does not exist');
    driftError.code = 'P2021';
    mockAuditLogFindMany.mockRejectedValue(driftError);
    vi.mocked(isPrismaSchemaDriftError).mockReturnValue(true);

    const result = await getRecentActions('org-1');
    expect(result).toEqual([]);
  });

  it('returns empty array on query error', async () => {
    mockAuditLogFindMany.mockRejectedValue(new Error('DB error'));

    const result = await getRecentActions('org-1');
    expect(result).toEqual([]);
  });
});
