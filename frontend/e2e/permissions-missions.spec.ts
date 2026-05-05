import { test, expect, request } from '@playwright/test';
import crypto from 'crypto';

// Helper: create a JWT (HS256) without external deps
function base64url(input: Buffer | string) {
  const b = typeof input === 'string' ? Buffer.from(input) : input;
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJwt(payload: object, secret = 'secret') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest();
  return `${data}.${base64url(signature)}`;
}

const BACKEND_BASE = process.env.E2E_BACKEND_BASE || 'http://localhost:5005';

test.describe('Permissions middleware - missions', () => {
  test('POST /api/missions should return 403 when token lacks creer_mission', async () => {
    const token = signJwt({
      id: 't1',
      email: 'user@example.com',
      organizationId: 'org1',
      role: 'CHEF_PROJET',
      permissions: [],
    });
    const req = await request.newContext();
    const resp = await req.post(`${BACKEND_BASE}/api/missions`, {
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      data: { title: 'E2E test mission' },
    });

    expect(resp.status()).toBe(403);
    const body = await resp.json().catch(() => ({}));
    expect(body.error || body.message).toBeTruthy();
  });

  test('POST /api/missions should not return 403 when token includes creer_mission', async () => {
    const token = signJwt({
      id: 't2',
      email: 'creator@example.com',
      organizationId: 'org1',
      role: 'CHEF_PROJET',
      permissions: ['creer_mission'],
    });
    const req = await request.newContext();
    const resp = await req.post(`${BACKEND_BASE}/api/missions`, {
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      data: { title: 'E2E test mission allowed' },
    });

    // We only assert that it's not a 403 (controller may return 400/201/500 depending on DB)
    expect(resp.status()).not.toBe(403);
  });

  test('DELETE /api/missions/:id should return 403 without supprimer_missions', async () => {
    const token = signJwt({
      id: 't3',
      email: 'deleter@example.com',
      organizationId: 'org1',
      role: 'CHEF_PROJET',
      permissions: [],
    });
    const req = await request.newContext();
    const resp = await req.delete(`${BACKEND_BASE}/api/missions/some-id`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status()).toBe(403);
  });

  test('DELETE /api/missions/:id should not return 403 with supprimer_missions', async () => {
    const token = signJwt({
      id: 't4',
      email: 'deleter2@example.com',
      organizationId: 'org1',
      role: 'ADMIN_PROQUELEC',
      permissions: ['supprimer_missions'],
    });
    const req = await request.newContext();
    const resp = await req.delete(`${BACKEND_BASE}/api/missions/some-id`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resp.status()).not.toBe(403);
  });
});
