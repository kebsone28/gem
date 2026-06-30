import { Platform, PermissionsAndroid, Alert, Vibration } from 'react-native';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';

// ─── BIOMETRY ──────────────────────────────────────────────────────────
let Biometrics: any = null;
try { Biometrics = require('react-native-biometrics'); } catch {}
const BiometricsClass = Biometrics ? (Biometrics.default || Biometrics) : null;
const rnBiometrics = BiometricsClass ? new BiometricsClass({ allowDeviceCredentials: true }) : null;

export async function isBiometricAvailable(): Promise<boolean> {
  if (!rnBiometrics) return false;
  const { available } = await rnBiometrics.isSensorAvailable();
  return available;
}

export async function authenticateBiometric(reason = 'Vérifier votre identité'): Promise<boolean> {
  if (!rnBiometrics) return false;
  const { success } = await rnBiometrics.simplePrompt({ promptMessage: reason });
  return success;
}

// ─── HAPTICS ────────────────────────────────────────────────────────────
let HapticFeedback: any = null;
try { HapticFeedback = require('react-native-haptic-feedback'); } catch {}

export function hapticLight() {
  try {
    if (HapticFeedback?.default) HapticFeedback.default.trigger('impactLight');
    else Vibration.vibrate(10);
  } catch {}
}

export function hapticMedium() {
  try {
    if (HapticFeedback?.default) HapticFeedback.default.trigger('impactMedium');
    else Vibration.vibrate(20);
  } catch {}
}

export function hapticSuccess() {
  try {
    if (HapticFeedback?.default) HapticFeedback.default.trigger('notificationSuccess');
    else Vibration.vibrate(30);
  } catch {}
}

export function hapticError() {
  try {
    if (HapticFeedback?.default) HapticFeedback.default.trigger('notificationError');
    else Vibration.vibrate([0, 30, 50, 30]);
  } catch {}
}

// ─── SPEECH TO TEXT (@react-native-community/voice) ──────────────────────
let VoiceModule: any = null;
try { VoiceModule = require('@react-native-community/voice'); } catch {}

export async function startSpeechToText(lang = 'fr-FR'): Promise<string | null> {
  if (!VoiceModule) { Alert.alert('Indisponible', 'Module vocal non disponible. Reconstruisez avec @react-native-community/voice.'); return null; }
  try {
    await VoiceModule.default.start(lang);
    return null;
  } catch { return null; }
}

export async function stopSpeechToText(): Promise<string | null> {
  if (!VoiceModule) return null;
  try {
    const result = await VoiceModule.default.stop();
    return result?.value?.[0] || null;
  } catch { return null; }
}

export function onSpeechResults(callback: (text: string) => void) {
  if (!VoiceModule) return () => {};
  const sub = VoiceModule.default.onSpeechResults((e: any) => {
    if (e.value?.[0]) callback(e.value[0]);
  });
  return () => sub?.remove?.();
}

export function onSpeechError(callback: (error: string) => void) {
  if (!VoiceModule) return () => {};
  const sub = VoiceModule.default.onSpeechError((e: any) => callback(e.error?.message || 'Erreur vocale'));
  return () => sub?.remove?.();
}

// ─── NFC ────────────────────────────────────────────────────────────────
let NfcManager: any = null;
try { NfcManager = require('react-native-nfc-manager'); } catch {}
let nfcInitialized = false;

export async function initNfc(): Promise<boolean> {
  if (!NfcManager) return false;
  try {
    await NfcManager.default.start();
    nfcInitialized = true;
    return true;
  } catch { return false; }
}

export async function readNfcTag(timeoutMs = 10000): Promise<string | null> {
  if (!nfcInitialized) await initNfc();
  if (!NfcManager) return null;
  return new Promise((resolve) => {
    const timer = setTimeout(() => { try { NfcManager.default.unregisterTagEvent(); } catch {} resolve(null); }, timeoutMs);
    (async () => {
      try {
        await NfcManager.default.registerTagEvent();
        NfcManager.default.setEventListener('NfcManagerDiscoverTag', (tag: any) => {
          clearTimeout(timer);
          const id = tag?.id || tag?.ndefMessage?.[0]?.payload || '';
          const text = typeof id === 'string' ? id : String.fromCharCode(...new Uint8Array(id));
          resolve(text);
        });
      } catch { clearTimeout(timer); resolve(null); }
    })();
  });
}

export async function stopNfc() {
  if (!NfcManager || !nfcInitialized) return;
  try {
    NfcManager.default.setEventListener('NfcManagerDiscoverTag', null);
    await NfcManager.default.unregisterTagEvent();
  } catch {}
}

// ─── DOCUMENT PICKER ────────────────────────────────────────────────────
let DocumentPicker: any = null;
try { DocumentPicker = require('react-native-document-picker'); } catch {}

export interface PickedDocument {
  uri: string;
  name: string;
  type: string;
  size: number;
}

export async function pickDocument(): Promise<PickedDocument | null> {
  if (!DocumentPicker) { Alert.alert('Indisponible', 'react-native-document-picker non installé. Rebuild requis.'); return null; }
  try {
    const result = await DocumentPicker.default.pick({ type: [DocumentPicker.default.types.allFiles] });
    const file = result[0];
    if (!file?.uri) return null;
    return { uri: file.uri, name: file.name || 'document', type: file.type || 'application/octet-stream', size: file.size || 0 };
  } catch { return null; }
}

export async function pickImageDocument(): Promise<PickedDocument | null> {
  if (!DocumentPicker) return null;
  try {
    const result = await DocumentPicker.default.pick({ type: [DocumentPicker.default.types.images] });
    const file = result[0];
    if (!file?.uri) return null;
    return { uri: file.uri, name: file.name || 'image', type: file.type || 'image/jpeg', size: file.size || 0 };
  } catch { return null; }
}

// ─── LOCAL ENCRYPTION (AES-256 via crypto-js, 100% pur JS, zéro dépendance native) ─────
let CryptoJS: any = null;
try { CryptoJS = require('crypto-js'); } catch {}

const ENCRYPTION_KEY = '@gedcollect/encryption_key';
const STORAGE_PREFIX = '@gedcollect/enc_v3_'; // v3 = crypto-js

function generateKey(): string {
  const chars = 'abcdef0123456789';
  let key = '';
  for (let i = 0; i < 64; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

async function getOrCreateKey(): Promise<string> {
  let key = await AsyncStorage.getItem(ENCRYPTION_KEY);
  if (!key) { key = generateKey(); await AsyncStorage.setItem(ENCRYPTION_KEY, key); }
  return key;
}

export async function encryptData(plaintext: string): Promise<string> {
  if (!CryptoJS) return plaintext;
  try {
    const key = await getOrCreateKey();
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(plaintext, CryptoJS.enc.Hex.parse(key), {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    // Store iv + ciphertext as hex
    const ivHex = CryptoJS.enc.Hex.stringify(iv);
    const ctHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);
    return STORAGE_PREFIX + ivHex + '.' + ctHex;
  } catch { return plaintext; }
}

export async function decryptData(ciphertext: string): Promise<string> {
  if (!ciphertext.startsWith(STORAGE_PREFIX)) return ciphertext;
  if (!CryptoJS) return ciphertext;
  try {
    const key = await getOrCreateKey();
    const payload = ciphertext.slice(STORAGE_PREFIX.length);
    const dotIdx = payload.indexOf('.');
    const ivHex = payload.slice(0, dotIdx);
    const ctHex = payload.slice(dotIdx + 1);
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const ct = CryptoJS.enc.Hex.parse(ctHex);
    const decrypted = CryptoJS.AES.decrypt(
      CryptoJS.lib.CipherParams.create({ ciphertext: ct }),
      CryptoJS.enc.Hex.parse(key),
      { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );
    return decrypted.toString(CryptoJS.enc.Utf8) || ciphertext;
  } catch { return ciphertext; }
}

// ─── PDF EXPORT (HTML → fichier, zero dépendance native) ───────────────
export async function exportToPdf(html: string, fileName = 'soumission'): Promise<string | null> {
  try {
    // Generate HTML file using react-native-fs (déjà installé)
    const path = `${RNFS.DocumentDirectoryPath}/${fileName}.html`;
    await RNFS.writeFile(path, html, 'utf8');
    return path;
  } catch { return null; }
}

function submissionToHtml(values: Record<string, any>, title = 'Soumission'): string {
  const rows = Object.entries(values || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `<tr><td style="font-weight:700;padding:6px 12px;border:1px solid #ccc">${k}</td><td style="padding:6px 12px;border:1px solid #ccc">${v}</td></tr>`)
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:sans-serif;padding:20px"><h1>${title}</h1><table style="border-collapse:collapse;width:100%">${rows}</table></body></html>`;
}

export { submissionToHtml };

// ─── ALTIMETER + COMPASS ───────────────────────────────────────────────
export async function getAltitudeAndHeading(): Promise<{ altitude: number | null; heading: number | null }> {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve({ altitude: pos.coords.altitude, heading: pos.coords.heading }),
      () => resolve({ altitude: null, heading: null }),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  });
}

// ─── QR CODE GENERATION ────────────────────────────────────────────────
let QR: any = null;
try { QR = require('react-native-qrcode-svg'); } catch {}

export { QR as QRCodeComponent };
export function isQRCodeAvailable(): boolean { return !!QR; }
