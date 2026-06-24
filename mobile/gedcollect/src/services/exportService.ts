import { loadSubmissions } from './storage';

export async function exportSubmissionsJson(): Promise<string> {
  const subs = await loadSubmissions();
  const synced = subs.filter((s) => s.status === 'synced');
  return JSON.stringify({ exportedAt: new Date().toISOString(), count: synced.length, submissions: synced }, null, 2);
}

export async function exportSubmissionsCsv(): Promise<string> {
  const subs = await loadSubmissions();
  const synced = subs.filter((s) => s.status === 'synced');
  if (synced.length === 0) return '';

  const allKeys = new Set<string>();
  for (const s of synced) {
    if (s.values && typeof s.values === 'object') {
      Object.keys(s.values as Record<string, unknown>).forEach((k) => allKeys.add(k));
    }
  }
  const keys = Array.from(allKeys);
  const header = ['id', 'formKey', 'formVersion', 'status', 'createdAt', ...keys];
  const rows = synced.map((s) => {
    const vals = (s.values as Record<string, unknown>) || {};
    return [s.id, s.formKey, s.formVersion, s.status, s.createdAt || '', ...keys.map((k) => String(vals[k] ?? ''))];
  });
  return [header.join(','), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
}
