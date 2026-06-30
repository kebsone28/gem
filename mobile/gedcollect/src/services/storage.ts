import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GedSubmission } from '@types/index';
import { encryptData, decryptData } from './nativeCapabilities';

const SUBMISSIONS_KEY = '@gedcollect/submissions';

async function encryptSubmissions(data: GedSubmission[]): Promise<string> {
  return encryptData(JSON.stringify(data));
}

async function decryptSubmissions(raw: string): Promise<GedSubmission[]> {
  const decrypted = await decryptData(raw);
  try { return JSON.parse(decrypted); } catch { return []; }
}

export async function saveSubmission(sub: GedSubmission): Promise<void> {
  const submissions = await loadSubmissions();
  submissions.push(sub);
  const encrypted = await encryptSubmissions(submissions);
  await AsyncStorage.setItem(SUBMISSIONS_KEY, encrypted);
}

export async function updateSubmission(id: string, updates: Partial<GedSubmission>): Promise<void> {
  const submissions = await loadSubmissions();
  const idx = submissions.findIndex((s) => s.id === id);
  if (idx >= 0) {
    submissions[idx] = { ...submissions[idx], ...updates, updatedAt: new Date().toISOString() };
    const encrypted = await encryptSubmissions(submissions);
    await AsyncStorage.setItem(SUBMISSIONS_KEY, encrypted);
  }
}

export async function loadSubmissions(): Promise<GedSubmission[]> {
  try {
    const raw = await AsyncStorage.getItem(SUBMISSIONS_KEY);
    if (raw) return decryptSubmissions(raw);
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
  const encrypted = await encryptSubmissions(filtered);
  await AsyncStorage.setItem(SUBMISSIONS_KEY, encrypted);
}

export async function clearSyncedSubmissions(): Promise<void> {
  const submissions = await loadSubmissions();
  const filtered = submissions.filter((s) => s.status !== 'synced');
  const encrypted = await encryptSubmissions(filtered);
  await AsyncStorage.setItem(SUBMISSIONS_KEY, encrypted);
}
