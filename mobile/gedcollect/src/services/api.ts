import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

const TOKEN_KEY = '@gedcollect/authToken';
const BASE_URL_KEY = '@gedcollect/baseUrl';
const DEFAULT_BASE_URL = 'https://ged.proquelec.sn';

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function getBaseUrl(): Promise<string> {
  const stored = await AsyncStorage.getItem(BASE_URL_KEY);
  return stored || DEFAULT_BASE_URL;
}

export async function updateServerUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(BASE_URL_KEY, url);
}

export async function getServerUrl(): Promise<string> {
  return getBaseUrl();
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}${path}`;
  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
}

async function fileToDataUrl(uri: string): Promise<string> {
  const base64 = await RNFS.readFile(uri, 'base64');
  const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
  return `data:${mimeMap[ext] || 'image/jpeg'};base64,${base64}`;
}

export async function registerPin(phone: string, pin: string): Promise<{ message: string }> {
  const baseUrl = await getBaseUrl();
  const resp = await fetch(`${baseUrl}/api/gedcollect/auth/register-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, pin }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Erreur enregistrement PIN');
  return data;
}

export async function loginWithPin(phone: string, pin: string): Promise<{ accessToken: string; user: any }> {
  const baseUrl = await getBaseUrl();
  const resp = await fetch(`${baseUrl}/api/gedcollect/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, pin }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'PIN incorrect');
  await AsyncStorage.setItem(TOKEN_KEY, data.accessToken);
  return data;
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function fetchAssignedForms(): Promise<any[]> {
  const resp = await apiFetch('/api/gedcollect/forms');
  if (!resp.ok) throw new Error(`Erreur récupération formulaires: ${resp.status}`);
  const data = await resp.json();
  return data.forms || [];
}

export async function submitFormData(payload: {
  formKey: string;
  formVersion: string;
  clientSubmissionId: string;
  status: string;
  values: Record<string, any>;
  metadata?: Record<string, any>;
  photos?: Record<string, string[]>;
}): Promise<{ success: boolean; submission: any }> {
  const body: any = {
    formKey: payload.formKey,
    formVersion: payload.formVersion,
    clientSubmissionId: payload.clientSubmissionId,
    status: payload.status,
    values: payload.values,
    metadata: payload.metadata,
  };

  if (payload.photos) {
    const attachments: any[] = [];
    for (const [fieldName, uris] of Object.entries(payload.photos)) {
      if (!Array.isArray(uris)) continue;
      for (const uri of uris) {
        try {
          const dataUrl = await fileToDataUrl(uri);
          attachments.push({
            fieldName,
            fileName: uri.split('/').pop() || `${fieldName}.jpg`,
            dataUrl,
            capturedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn(`[api] Failed to read photo ${uri}:`, e);
        }
      }
    }
    if (attachments.length > 0) body.attachments = attachments;
  }

  const resp = await apiFetch('/api/gedcollect/submissions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Erreur soumission');
  return data;
}

/**
 * Batch submission endpoint - envoie plusieurs soumissions en une requete
 * Si le serveur ne supporte pas le batch, une erreur sera levee
 */
export async function submitBatchSubmissions(payload: {
  submissions: any[];
  compressed?: string | Uint8Array;
}): Promise<{ success: boolean; count: number; errors?: string[] }> {
  try {
    const resp = await apiFetch('/api/gedcollect/submissions/batch', {
      method: 'POST',
      body: JSON.stringify({
        submissions: payload.submissions.map((s) => ({
          formKey: s.formKey,
          formVersion: s.formVersion,
          clientSubmissionId: s.clientSubmissionId,
          status: s.status,
          values: s.values,
          metadata: s.metadata,
          photos: s.photos,
        })),
        compressed: payload.compressed,
      }),
    });
    if (!resp.ok) throw new Error(`Batch submission failed: ${resp.status}`);
    return await resp.json();
  } catch (e: any) {
    // Fallback: server doesn't support batch, throw to trigger individual sync
    throw new Error(e.message || 'Batch not supported');
  }
}

/**
 * Get a submission from the server by clientSubmissionId
 * Used for conflict detection
 */
export async function getServerSubmission(clientId: string): Promise<{
  id: string;
  updatedAt: string;
  values: Record<string, any>;
} | null> {
  try {
    const resp = await apiFetch(`/api/gedcollect/submissions/by-client-id/${encodeURIComponent(clientId)}`);
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`Failed to get server submission: ${resp.status}`);
    const data = await resp.json();
    return data.submission || data;
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  try {
    const resp = await apiFetch('/api/gedcollect/forms');
    return resp.ok;
  } catch {
    return true;
  }
}
