import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GedSettings } from '@types/index';

const SETTINGS_KEY = '@gedcollect/settings';

const DEFAULT_SETTINGS: GedSettings = {
  serverUrl: 'https://ged.proquelec.sn',
  autoSync: true,
  syncIntervalMinutes: 15,
  wifiOnly: false,
  language: 'fr',
  theme: 'light',
};

let cachedSettings: GedSettings | null = null;

export async function loadSettings(): Promise<GedSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      return cachedSettings;
    }
  } catch {}
  cachedSettings = { ...DEFAULT_SETTINGS };
  return cachedSettings;
}

export async function saveSettings(partial: Partial<GedSettings>): Promise<GedSettings> {
  const current = cachedSettings || (await loadSettings());
  const merged: GedSettings = { ...current, ...partial };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  cachedSettings = merged;
  return merged;
}

export function getSettings(): GedSettings {
  if (!cachedSettings) {
    throw new Error('Settings not loaded. Call loadSettings() first.');
  }
  return cachedSettings;
}

export { DEFAULT_SETTINGS, SETTINGS_KEY };
