#!/usr/bin/env node

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith('--')) continue;
  const key = arg.slice(2);
  const next = process.argv[index + 1];
  if (next && !next.startsWith('--')) {
    args.set(key, next);
    index += 1;
  } else {
    args.set(key, 'true');
  }
}

const apiUrl = String(
  args.get('api-url') ||
    process.env.GEM_API_URL ||
    process.env.VITE_API_URL ||
    'https://proquelec.sn/api'
).replace(/\/+$/, '');
const numeroOrdre = String(args.get('numero') || process.env.GEM_TEST_NUMERO_ORDRE || '').trim();
const email = String(args.get('email') || process.env.GEM_EMAIL || '').trim();
const password = String(args.get('password') || process.env.GEM_PASSWORD || '').trim();
let authToken = String(args.get('token') || process.env.GEM_AUTH_TOKEN || process.env.GEM_SMOKE_TOKEN || '').trim();

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
  });

  const bodyText = await response.text();
  let body = null;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = bodyText;
  }

  if (!response.ok) {
    const message = typeof body === 'object' && body?.message ? body.message : bodyText;
    throw new Error(`${response.status} ${response.statusText} on ${path}: ${message}`);
  }

  return body;
}

async function loginIfNeeded() {
  if (authToken) return;
  if (!email || !password) {
    throw new Error(
      'Missing auth. Provide GEM_AUTH_TOKEN, or GEM_EMAIL and GEM_PASSWORD for the smoke test.'
    );
  }

  const response = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: {},
  });

  if (!response?.accessToken) {
    throw new Error('Login succeeded but no accessToken was returned.');
  }
  authToken = response.accessToken;
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[SMOKE] Internal Kobo smoke test`);
  console.log(`[SMOKE] API: ${apiUrl}`);

  await loginIfNeeded();

  const form = await request('/internal-kobo/form-definition');
  console.log(`[SMOKE] Form definition OK: ${form?.form?.formKey} ${form?.form?.formVersion}`);

  let household = null;
  if (numeroOrdre) {
    const householdResponse = await request(`/households/by-numero/${encodeURIComponent(numeroOrdre)}`);
    household = householdResponse?.household || householdResponse;
    console.log(`[SMOKE] Household OK: ${household?.numeroordre || numeroOrdre} ${household?.name || ''}`.trim());
  } else {
    console.log('[SMOKE] GEM_TEST_NUMERO_ORDRE not provided, household lookup skipped.');
  }

  const clientSubmissionId = `smoke-internal-kobo-${Date.now()}`;
  const payload = {
    clientSubmissionId,
    householdId: household?.id || null,
    numeroOrdre: household?.numeroordre || numeroOrdre || null,
    formKey: 'terrain_internal',
    formVersion: form?.form?.formVersion || 'unknown',
    role: '__pr_parateur',
    status: 'draft',
    values: {
      Numero_ordre: household?.numeroordre || numeroOrdre || '',
      nom_key: household?.name || 'SMOKE TEST',
      telephone_key: household?.phone || '',
      role: '__pr_parateur',
      notes_generales: `Smoke test interne Kobo ${startedAt}`,
      _gem_smoke_test: true,
      _gem_smoke_started_at: startedAt,
    },
    metadata: {
      smokeTest: true,
      source: 'scripts/internal-kobo-smoke.mjs',
      startedAt,
    },
    requiredMissing: ['smoke_test_draft_not_final'],
  };

  const saved = await request('/internal-kobo/submissions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  console.log(`[SMOKE] Draft saved OK: ${saved?.submission?.id || clientSubmissionId}`);

  const lookup = await request(`/internal-kobo/submissions?clientSubmissionId=${encodeURIComponent(clientSubmissionId)}&limit=1`);
  if (!lookup?.submissions?.length) {
    throw new Error('Saved draft not found through submissions endpoint.');
  }
  console.log('[SMOKE] Submission lookup OK');

  const diagnostics = await request('/internal-kobo/diagnostics');
  console.log(
    `[SMOKE] Diagnostics OK: health=${diagnostics?.diagnostics?.health || 'unknown'} total=${diagnostics?.diagnostics?.total ?? 'n/a'}`
  );

  console.log('[SMOKE] Internal Kobo smoke test completed successfully.');
}

main().catch((error) => {
  console.error(`[SMOKE] Failed: ${error.message}`);
  process.exitCode = 1;
});
