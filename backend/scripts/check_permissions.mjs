import crypto from 'crypto';
import prisma from '../src/core/utils/prisma.js';

function base64url(input) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function signJwt(payload, secret = process.env.JWT_SECRET || 'secret') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest();
  return `${data}.${base64url(signature)}`;
}

const BACKEND = process.env.BACKEND_BASE || 'http://localhost:5005';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admingem';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD || 'suprime';
const ADMIN_2FA = process.env.ADMIN_2FA || process.env.INITIAL_ADMIN_2FA_ANSWER || 'CORAN';

async function run() {
  console.log('Testing backend at', BACKEND);
  // 1) Login as admin to retrieve a valid access token
  console.log('-> Attempting login as', ADMIN_EMAIL);
  let accessToken = null;
  try {
    const loginRes = await fetch(`${BACKEND}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, twoFactorCode: ADMIN_2FA })
    });

    const loginBody = await loginRes.json().catch(() => null);
    if (loginRes.ok && loginBody && loginBody.accessToken) {
      accessToken = loginBody.accessToken;
      console.log('-> Login successful, access token retrieved');
    } else if (loginRes.ok && loginBody && loginBody.user && loginBody.accessToken) {
      accessToken = loginBody.accessToken;
      console.log('-> Login success (alt response), token retrieved');
    } else if (loginRes.ok && loginBody && loginBody.user && !loginBody.accessToken) {
      console.warn('-> Login returned user object but no token; attempt /api/auth/refresh or verify flow');
    } else {
      console.error('-> Login failed', loginRes.status, loginBody);
    }
  } catch (err) {
    console.error('-> Login request failed:', err.message);
  }

  if (!accessToken) {
    console.log('-> No access token obtained. Falling back to signed test tokens (may be rejected by server)');
  }

  const cases = [
    { name: 'create_without_permission', token: accessToken || signJwt({ id: 't1', email: 'user@example.com', organizationId: 'org1', role: 'CHEF_PROJET', permissions: [] }), method: 'POST', url: `${BACKEND}/api/missions`, body: { title: 'test' } },
    { name: 'create_with_permission', token: accessToken || signJwt({ id: 't2', email: 'creator@example.com', organizationId: 'org1', role: 'CHEF_PROJET', permissions: ['creer_mission'] }), method: 'POST', url: `${BACKEND}/api/missions`, body: { title: 'test allowed' } },
    { name: 'delete_without_permission', token: accessToken || signJwt({ id: 't3', email: 'deleter@example.com', organizationId: 'org1', role: 'CHEF_PROJET', permissions: [] }), method: 'DELETE', url: `${BACKEND}/api/missions/some-id` },
    { name: 'delete_with_permission', token: accessToken || signJwt({ id: 't4', email: 'deleter2@example.com', organizationId: 'org1', role: 'ADMIN_PROQUELEC', permissions: ['supprimer_missions'] }), method: 'DELETE', url: `${BACKEND}/api/missions/some-id` }
  ];

  for (const c of cases) {
    try {
      const opts = { method: c.method, headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' } };
      if (c.body) opts.body = JSON.stringify(c.body);
      const res = await fetch(c.url, opts);
      const text = await res.text();
      console.log(`${c.name}: status=${res.status} ${res.statusText}`);
      try { console.log('body:', JSON.parse(text)); } catch { console.log('body:', text.slice(0, 400)); }
    } catch (err) {
      console.error(`${c.name}: request failed:`, err.message);
    }
  }

  // === Test: create mission then attempt delete with non-admin then admin ===
  try {
    console.log('\n=== Workflow: create mission as admin, delete as non-admin then admin ===');
    // Create mission as admin (we already created two above, but create again to have a known id)
    const createRes = await fetch(`${BACKEND}/api/missions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'workflow-test-mission' })
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      console.error('Failed to create mission in workflow test', createRes.status, created);
    } else {
      const missionId = created.id;
      console.log('Mission created id=', missionId);

      // Find a non-admin user to test (cp_gem or any non-admin)
      const nonAdminEmails = ['cp_gem', 'compta_gem', 'maçongem', 'electriciengem', 'reseaugem', 'lsegem', 'livreurgem'];
      let nonAdmin = null;
      for (const e of nonAdminEmails) {
        const u = await prisma.user.findUnique({ where: { email: e } });
        if (u && u.role !== null && (u.role?.name || u.roleLegacy) !== 'ADMIN_PROQUELEC') { nonAdmin = u; break; }
      }

      if (!nonAdmin) {
        console.warn('No non-admin user found for workflow deletion test; skipping');
      } else {
        console.log('Using non-admin user for delete attempt:', nonAdmin.email, nonAdmin.id);
        const tokenNonAdmin = signJwt({ id: nonAdmin.id, email: nonAdmin.email, organizationId: nonAdmin.organizationId, role: nonAdmin.role?.name || nonAdmin.roleLegacy, permissions: nonAdmin.permissions || [] }, process.env.JWT_SECRET || 'secret');

        const del1 = await fetch(`${BACKEND}/api/missions/${missionId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tokenNonAdmin}` } });
        console.log('Delete attempt by non-admin:', del1.status, del1.statusText);
        try { console.log('body:', await del1.json()); } catch { console.log('no json body'); }

        // Now delete with admin token
        const del2 = await fetch(`${BACKEND}/api/missions/${missionId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
        console.log('Delete attempt by admin:', del2.status, del2.statusText);
        try { console.log('body:', await del2.json()); } catch { console.log('no json body'); }
      }
    }
  } catch (err) {
    console.error('Workflow test failed:', err.message);
  }
}

run();
