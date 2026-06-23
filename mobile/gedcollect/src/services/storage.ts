import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GedSubmission } from '@types/index';

const SUBMISSIONS_KEY = '@gedcollect/submissions';

export async function saveSubmission(sub: GedSubmission): Promise<void> {
  const submissions = await loadSubmissions();
  submissions.push(sub);
  await AsyncStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
}

export async function updateSubmission(id: string, updates: Partial<GedSubmission>): Promise<void> {
  const submissions = await loadSubmissions();
  const idx = submissions.findIndex((s) => s.id === id);
  if (idx >= 0) {
    submissions[idx] = { ...submissions[idx], ...updates, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
  }
}

export async function loadSubmissions(): Promise<GedSubmission[]> {
  try {
    const raw = await AsyncStorage.getItem(SUBMISSIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export async function getSubmissionsForForm(formKey: string): Promise<GedSubmission[]> {
  const all = await loadSubmissions();
  return all.filter((s) => s.formKey === formKey);
}

export async function getPendingSubmissions(): Promise<GedSubmission[]> {
  const all = await loadSubmissions();
  return all.filter((s) => s.status === 'pending' || s.status === 'error');
}

export async function deleteSubmission(id: string): Promise<void> {
  const submissions = await loadSubmissions();
  const filtered = submissions.filter((s) => s.id !== id);
  await AsyncStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(filtered));
}

export async function clearSyncedSubmissions(): Promise<void> {
  const submissions = await loadSubmissions();
  const filtered = submissions.filter((s) => s.status !== 'synced');
  await AsyncStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(filtered));
}
