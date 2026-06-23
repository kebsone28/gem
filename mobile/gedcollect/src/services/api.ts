import AsyncStorage from '@react-native-async-storage/async-storage';
import { SETTINGS_KEY, DEFAULT_SETTINGS } from '@config/settings';

const TOKEN_KEY = '@gedcollect/authToken';

async function getServerUrl(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const settings = JSON.parse(raw);
      if (settings.serverUrl) return settings.serverUrl;
    }
  } catch {}
  return DEFAULT_SETTINGS.serverUrl;
}

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${await getServerUrl()}${path}`;
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
  const resp = await fetch(`${await getServerUrl()}/api/gedcollect/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Erreur envoi code');
  return data;
}

export async function verifyOtp(phone: string, code: string): Promise<{ accessToken: string; user: any }> {
  const resp = await fetch(`${await getServerUrl()}/api/gedcollect/auth/verify-otp`, {
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

export async function updateServerUrl(url: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const settings = raw ? JSON.parse(raw) : {};
    settings.serverUrl = url;
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
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
    return false;
  }
}
