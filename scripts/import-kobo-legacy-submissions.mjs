#!/usr/bin/env node

import crypto from 'node:crypto';

const DEFAULT_ASSET_UID = 'aEYZwPujJiFBTNb6mxMGCB';
const DEFAULT_API_URL = 'http://localhost:5005/api';
const INTERNAL_FORM_KEY = 'terrain_internal';

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

const read = (key, fallback = '') => String(args.get(key) || process.env[key.toUpperCase().replace(/-/g, '_')] || fallback).trim();

const koboUsername = read('kobo-username') || process.env.KOBO_USERNAME || '';
const koboPassword = read('kobo-password') || process.env.KOBO_PASSWORD || '';
const assetUid = read('kobo-asset-uid', process.env.KOBO_ASSET_UID || DEFAULT_ASSET_UID);
const apiUrl = read('gem-api-url', process.env.GEM_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
const authToken = read('gem-auth-token', process.env.GEM_AUTH_TOKEN || '');
const dryRun = read('kobo-import-dry-run', process.env.KOBO_IMPORT_DRY_RUN || '1') !== '0';
const importStatus = read('kobo-import-status', process.env.KOBO_IMPORT_STATUS || 'draft');
const importLimit = Number(read('kobo-import-limit', process.env.KOBO_IMPORT_LIMIT || '0')) || 0;
const pageSize = Math.min(Math.max(Number(read('kobo-import-page-size', process.env.KOBO_IMPORT_PAGE_SIZE || '100')) || 100, 1), 1000);
const skipExisting = read('kobo-import-skip-existing', process.env.KOBO_IMPORT_SKIP_EXISTING || '1') !== '0';
const mediaMode = read('kobo-import-media', process.env.KOBO_IMPORT_MEDIA || 'external').toLowerCase();
const maxInlineMediaBytes = Number(read('kobo-import-max-media-bytes', process.env.KOBO_IMPORT_MAX_MEDIA_BYTES || `${6 * 1024 * 1024}`)) || 6 * 1024 * 1024;

function requireConfig() {
  const missing = [];
  if (!koboUsername) missing.push('KOBO_USERNAME');
  if (!koboPassword) missing.push('KOBO_PASSWORD');
  if (!authToken && !dryRun) missing.push('GEM_AUTH_TOKEN');
  if (missing.length) {
    throw new Error(`Configuration manquante: ${missing.join(', ')}`);
  }
}

function authHeader() {
  return `Basic ${Buffer.from(`${koboUsername}:${koboPassword}`).toString('base64')}`;
}

async function readJson(response, context) {
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message = typeof body === 'object' && body?.message ? body.message : text;
    throw new Error(`${context}: ${response.status} ${response.statusText} ${message}`.trim());
  }
  return body;
}

async function koboGet(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: authHeader(),
    },
  });
  return readJson(response, `Kobo GET ${url}`);
}

async function gemRequest(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      ...(options.headers || {}),
    },
  });
  return readJson(response, `GEM ${options.method || 'GET'} ${path}`);
}

function normalizeKey(key) {
  return String(key || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w/.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function leafKey(key) {
  return normalizeKey(String(key || '').split('/').pop() || key);
}

function normalizeRole(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}_]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return null;
  if (normalized.includes('preparateur') || normalized.includes('pr parateur')) return '__pr_parateur';
  if (normalized.includes('livreur')) return 'livreur';
  if (normalized.includes('macon')) return 'macon';
  if (normalized.includes('controleur') || normalized.includes('controlleur')) return 'controleur';
  if (normalized.includes('installateur') || normalized.includes('interieur')) return 'interieur';
  if (normalized.includes('reseau')) return 'reseau';
  return null;
}

function findFirst(record, candidates) {
  for (const candidate of candidates) {
    if (record[candidate] !== undefined && record[candidate] !== null && String(record[candidate]).trim() !== '') {
      return record[candidate];
    }
  }
  const normalizedCandidates = new Set(candidates.map(normalizeKey));
  for (const [key, value] of Object.entries(record)) {
    if (normalizedCandidates.has(normalizeKey(key)) && value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}

function flattenKoboValues(record) {
  const values = {};
  const originalPaths = {};

  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('_') || key.startsWith('__') || key === 'meta/audit') continue;
    if (value === undefined || value === null || typeof value === 'object') continue;

    const pathKey = normalizeKey(key).replace(/\//g, '__');
    const leaf = leafKey(key);
    originalPaths[key] = value;
    values[pathKey] = value;
    if (leaf && values[leaf] === undefined) values[leaf] = value;
  }

  const numeroOrdre = findFirst(record, [
    'Numero_ordre',
    'Num_ro_d_ordre',
    'numeroordre',
    'ADRESSE_ou_NUMERO_D_ORDRE',
    'TYPE_DE_VISITE/ADRESSE_ou_NUMERO_D_ORDRE',
  ]);
  const role = normalizeRole(findFirst(record, ['TYPE_DE_VISITE/role', 'role', 'Votre Role', 'Votre_Role']));

  values.Numero_ordre = numeroOrdre ? String(numeroOrdre).trim() : values.Numero_ordre || '';
  if (role) values.role = role;
  values.nom_key = values.nom_key || findFirst(record, ['TYPE_DE_VISITE/nom_key', 'TYPE_DE_VISITE/NOM', 'NOM', 'Nom']);
  values.prenom_key = values.prenom_key || findFirst(record, ['TYPE_DE_VISITE/prenom_key', 'TYPE_DE_VISITE/PRENOM', 'PRENOM', 'Prénom']);
  values.telephone_key = values.telephone_key || findFirst(record, ['TYPE_DE_VISITE/telephone_key', 'TYPE_DE_VISITE/TELEPHONE', 'TELEPHONE']);
  values.region_key = values.region_key || findFirst(record, ['TYPE_DE_VISITE/region_key', 'TYPE_DE_VISITE/Region', 'Region']);
  values.LOCALISATION_CLIENT = values.LOCALISATION_CLIENT || findFirst(record, ['LOCALISATION_CLIENT', 'TYPE_DE_VISITE/POSITION_CLIENT', 'POSITION_CLIENT']);

  return { values, originalPaths, role };
}

function findAttachmentField(values, fileName) {
  const name = String(fileName || '').split('/').pop();
  if (!name) return 'media';
  for (const [key, value] of Object.entries(values)) {
    if (String(value || '').includes(name)) return key;
  }
  return 'media';
}

async function buildAttachment(record, rawAttachment, values) {
  const fileName = rawAttachment.filename || rawAttachment.download_url?.split('/').pop() || rawAttachment.name || 'piece-jointe';
  const fieldName = findAttachmentField(values, fileName);
  const base = {
    id: rawAttachment.id ? String(rawAttachment.id) : undefined,
    fieldName,
    fieldCode: fieldName,
    fileName,
    mimeType: rawAttachment.mimetype || rawAttachment.mime_type || 'application/octet-stream',
    originalBytes: Number(rawAttachment.bytes || rawAttachment.size || 0) || undefined,
    capturedAt: record._submission_time || record.start || new Date().toISOString(),
    source: 'kobotoolbox-legacy',
  };

  const downloadUrl = rawAttachment.download_url || rawAttachment.download_large_url || rawAttachment.download_small_url || rawAttachment.url;
  if (mediaMode !== 'inline' || !downloadUrl) {
    return { ...base, url: downloadUrl || String(values[fieldName] || '') || undefined, storage: downloadUrl ? 'external' : 'client-reference' };
  }

  const response = await fetch(downloadUrl, { headers: { Authorization: authHeader() } });
  if (!response.ok) {
    return { ...base, url: downloadUrl, storage: 'external', status: 'unresolved' };
  }
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > maxInlineMediaBytes) {
    return { ...base, url: downloadUrl, storage: 'external', status: 'too-large-for-inline' };
  }
  const mimeType = response.headers.get('content-type') || base.mimeType;
  const dataUrl = `data:${mimeType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
  return { ...base, mimeType, originalBytes: arrayBuffer.byteLength, dataUrl, storage: 'inline' };
}

async function mapKoboRecord(record) {
  const { values, originalPaths, role } = flattenKoboValues(record);
  const koboSubmissionId = record._id || record['meta/instanceID'] || record._uuid || crypto.randomUUID();
  const rawAttachments = Array.isArray(record._attachments) ? record._attachments : [];
  const attachments = [];

  for (const rawAttachment of rawAttachments) {
    if (!rawAttachment || typeof rawAttachment !== 'object') continue;
    attachments.push(await buildAttachment(record, rawAttachment, values));
  }

  return {
    clientSubmissionId: `kobo-legacy-${koboSubmissionId}`,
    householdId: null,
    numeroOrdre: values.Numero_ordre ? String(values.Numero_ordre).trim() : null,
    formKey: INTERNAL_FORM_KEY,
    formVersion: String(record.__version__ || record._version || 'kobo-legacy'),
    role,
    status: importStatus,
    values,
    attachments,
    metadata: {
      source: 'kobotoolbox-legacy-import',
      koboAssetUid: assetUid,
      koboSubmissionId,
      koboInstanceId: record['meta/instanceID'] || null,
      koboVersion: record.__version__ || record._version || null,
      koboSubmissionTime: record._submission_time || null,
      originalPathValues: originalPaths,
      mediaMode,
      importedAt: new Date().toISOString(),
    },
    requiredMissing: importStatus === 'draft' ? ['legacy_kobo_import_requires_review'] : [],
  };
}

async function fetchKoboRecords() {
  const records = [];
  let next = `https://kf.kobotoolbox.org/api/v2/assets/${encodeURIComponent(assetUid)}/data/?format=json&page_size=${pageSize}`;
  while (next) {
    const page = await koboGet(next);
    const results = Array.isArray(page?.results) ? page.results : [];
    records.push(...results);
    console.log(`[IMPORT] Kobo page: +${results.length}, total=${records.length}`);
    if (importLimit && records.length >= importLimit) return records.slice(0, importLimit);
    next = page?.next || '';
  }
  return records;
}

async function existsInGem(clientSubmissionId) {
  if (!skipExisting || dryRun) return false;
  const response = await gemRequest(`/internal-kobo/submissions?clientSubmissionId=${encodeURIComponent(clientSubmissionId)}&limit=1`);
  return Array.isArray(response?.submissions) && response.submissions.length > 0;
}

async function main() {
  requireConfig();
  console.log('[IMPORT] Kobo legacy submissions -> GEM internal Kobo');
  console.log(`[IMPORT] asset=${assetUid} api=${apiUrl} dryRun=${dryRun ? 'yes' : 'no'} media=${mediaMode}`);

  const records = await fetchKoboRecords();
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of records) {
    const payload = await mapKoboRecord(record);
    if (await existsInGem(payload.clientSubmissionId)) {
      skipped += 1;
      console.log(`[IMPORT] skip existing ${payload.clientSubmissionId}`);
      continue;
    }

    if (dryRun) {
      imported += 1;
      console.log(`[IMPORT] dry-run ${payload.clientSubmissionId} numero=${payload.numeroOrdre || '-'} role=${payload.role || '-'}`);
      continue;
    }

    try {
      await gemRequest('/internal-kobo/submissions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      imported += 1;
      console.log(`[IMPORT] saved ${payload.clientSubmissionId}`);
    } catch (error) {
      failed += 1;
      console.error(`[IMPORT] failed ${payload.clientSubmissionId}: ${error.message}`);
    }
  }

  console.log(`[IMPORT] done fetched=${records.length} imported=${imported} skipped=${skipped} failed=${failed}`);
  if (dryRun) {
    console.log('[IMPORT] Dry-run only. Relancez avec KOBO_IMPORT_DRY_RUN=0 pour importer dans GEM.');
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[IMPORT] fatal: ${error.message}`);
  process.exitCode = 1;
});
