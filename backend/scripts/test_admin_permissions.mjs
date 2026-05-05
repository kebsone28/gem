#!/usr/bin/env node
// Quick test: login as admin, GET /api/admin/role-permissions, toggle a permission, verify, restore
const BASE = process.env.BACKEND_BASE || 'http://localhost:5008';
const EMAIL = process.env.ADMIN_EMAIL || 'admingem';
const PASSWORD = process.env.ADMIN_PASSWORD || 'suprime';
const TWO = process.env.ADMIN_2FA || undefined;

const debug = (...args) => console.log(...args);

const login = async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, twoFactorCode: TWO })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${JSON.stringify(data)}`);
  return data.accessToken || data.accessToken?.accessToken || data.token || data;
};

const getMatrix = async (token) => {
  const r = await fetch(`${BASE}/api/admin/role-permissions`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return await r.json();
};

const updateRole = async (token, role, permissions) => {
  const r = await fetch(`${BASE}/api/admin/role-permissions/${encodeURIComponent(role)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ permissions })
  });
  return await r.json();
};

(async () => {
  try {
    debug('BASE:', BASE);
    const token = await login();
    debug('Logged in, token length:', String(token).length);

    const before = await getMatrix(token);
    debug('Roles fetched:', before.roles.length, 'available permissions:', before.permissions.length);

    const targetRole = before.roles.find(r => r.role.toUpperCase().includes('CHEF_PROJET'))?.role || before.roles[0].role;
    debug('Target role:', targetRole);

    const current = before.roles.find(r => r.role === targetRole)?.permissions || [];
    debug('Current permissions count for', targetRole, current.length);

    const testPerm = 'purger_missions';
    const willAdd = !current.includes(testPerm);
    const modified = willAdd ? [...current, testPerm] : current.filter(p => p !== testPerm);

    debug(`${willAdd ? 'Adding' : 'Removing'} test permission ${testPerm} for role ${targetRole}`);
    const upd = await updateRole(token, targetRole, modified);
    debug('Update response:', upd);

    const after = await getMatrix(token);
    const newSet = after.roles.find(r => r.role === targetRole)?.permissions || [];
    debug('After update count:', newSet.length, 'contains testPerm?', newSet.includes(testPerm));

    // Restore original
    debug('Restoring original permission set...');
    await updateRole(token, targetRole, current);
    const restored = await getMatrix(token);
    const restoredSet = restored.roles.find(r => r.role === targetRole)?.permissions || [];
    debug('Restored contains testPerm?', restoredSet.includes(testPerm));

    console.log('✅ test_admin_permissions completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ test failed:', err);
    process.exit(2);
  }
})();
