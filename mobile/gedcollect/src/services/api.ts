import AsyncStorage from '@react-native-async-storage/async-storage';

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

export async function sendOtp(phone: string): Promise<{ message: string; code?: string }> {
  const baseUrl = await getBaseUrl();
  const resp = await fetch(`${baseUrl}/api/gedcollect/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Erreur envoi code');
  return data;
}

export async function verifyOtp(phone: string, code: string): Promise<{ accessToken: string; user: any }> {
  const baseUrl = await getBaseUrl();
  const resp = await fetch(`${baseUrl}/api/gedcollect/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Code invalide');
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
}): Promise<{ success: boolean; submission: any }> {
  const resp = await apiFetch('/api/gedcollect/submissions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Erreur soumission');
  return data;
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
