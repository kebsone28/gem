import type { XlsFormField } from '../xlsFormMobileRuntime';
import type { InternalKoboAttachment } from '../../../services/internalKoboSubmissionService';

/**
 * Utilitaires pour le formulaire interne Kobo (GedOs Collect)
 */

export const asArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) return value.split(/\s+/);
  return [];
};

export const getToneForValue = (value: unknown) => {
  const str = String(value ?? '').toLowerCase();
  if (['non', 'non_conforme', 'nc', 'probleme', 'menage_non_eligible', 'probleme_a_signaler'].includes(str)) {
    return 'border-rose-300/75 bg-rose-400/22 text-white shadow-lg shadow-rose-500/15 ring-1 ring-rose-200/20';
  }
  if (['oui', 'conforme', 'c', 'termine', 'terminee', 'realise', 'menage_eligible'].includes(str)) {
    return 'border-emerald-300/75 bg-emerald-400/22 text-white shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-200/20';
  }
  return 'border-blue-300/70 bg-blue-400/20 text-white shadow-lg shadow-blue-500/15 ring-1 ring-blue-200/20';
};

export const getRuntimeFieldInputType = (field: XlsFormField) => {
  if (field.type === 'integer' || field.type === 'decimal' || field.type === 'range') return 'number';
  if (field.type === 'date') return 'date';
  if (field.type === 'time') return 'time';
  if (field.type === 'datetime') return 'datetime-local';
  return 'text';
};

export const getRuntimeFieldAccept = (field: XlsFormField) => {
  if (field.type === 'image' || field.type === 'signature') return 'image/*';
  if (field.type === 'audio') return 'audio/*';
  if (field.type === 'video') return 'video/*';
  return undefined;
};

export const getRuntimeFieldCapture = (field: XlsFormField) => {
  if (field.type === 'image' || field.type === 'video') return 'environment';
  return undefined;
};

export const maxPixelsFromParameters = (parameters?: string) => {
  const match = parameters?.match(/max-pixels\s*=\s*(\d+)/i);
  return match ? Number(match[1]) : undefined;
};

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Lecture de fichier impossible'));
    reader.readAsDataURL(file);
  });

export const hashFileSha256 = async (file: File): Promise<string> => {
  if (!globalThis.crypto?.subtle) return '';
  const buffer = await file.arrayBuffer();
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const getImagePreviewSource = (fieldValue: unknown, attachment: InternalKoboAttachment | null) => {
  const value = String(fieldValue || '');
  if (value.startsWith('data:image/')) return value;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('/api/')) return value;
  if (attachment?.dataUrl?.startsWith('data:image/')) return attachment.dataUrl;
  if (attachment?.url) return attachment.url;
  return '';
};

export const getClientCollectionMetadata = (isOnline: boolean): Record<string, string> => {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const connection = nav ? (nav as Navigator & { connection?: { effectiveType?: string; type?: string } }).connection : null;
  const viewport = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '';
  const timezone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      : '';

  return {
    _GedOs_collection_app: 'GedOs-terrain-internal',
    _GedOs_collection_engine: 'xlsform-native',
    _GedOs_collection_mode: isOnline ? 'online' : 'offline',
    _GedOs_client_timezone: timezone,
    _GedOs_client_language: nav?.language || '',
    _GedOs_client_platform: nav?.platform || '',
    _GedOs_client_user_agent: nav?.userAgent || '',
    _GedOs_client_network: connection?.effectiveType || connection?.type || '',
    _GedOs_client_touch: String((nav?.maxTouchPoints || 0) > 0),
    _GedOs_client_viewport: viewport,
  };
};

export const formatHistoryDate = (value?: string | null) => {
  if (!value) return 'En attente';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';

  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const submissionStatusClass = (status: string) => {
  if (status === 'submitted' || status === 'validated') {
    return 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100';
  }
  if (status === 'rejected') {
    return 'border-rose-300/25 bg-rose-400/10 text-rose-100';
  }
  return 'border-amber-300/25 bg-amber-400/10 text-amber-100';
};

export const submissionStatusLabel = (status: string) => {
  if (status === 'submitted') return 'Soumis';
  if (status === 'validated') return 'Valide';
  if (status === 'rejected') return 'Rejete';
  return 'Brouillon';
};

export const queueStatusClass = (status: string) => {
  if (status === 'failed') return 'border-rose-300/25 bg-rose-400/10 text-rose-100';
  return 'border-sky-300/25 bg-sky-400/10 text-sky-100';
};

export const queueStatusLabel = (status: string, retryCount = 0) => {
  if (status === 'failed' && retryCount >= 6) return 'Bloque';
  if (status === 'failed') return 'A relancer';
  return 'En attente';
};

export const CLIENT_METADATA_LABELS: Record<string, string> = {
  _GedOs_collection_app: 'Application',
  _GedOs_collection_engine: 'Moteur',
  _GedOs_collection_mode: 'Mode',
  _GedOs_client_timezone: 'Fuseau horaire',
  _GedOs_client_language: 'Langue',
  _GedOs_client_platform: 'Appareil',
  _GedOs_client_user_agent: 'Navigateur',
  _GedOs_client_network: 'Reseau',
  _GedOs_client_touch: 'Ecran tactile',
  _GedOs_client_viewport: 'Fenetre',
  _GedOs_client_gps_accuracy_m: 'Precision GPS',
  _GedOs_client_gps_captured_at: 'Capture GPS',
  _GedOs_client_gps_source: 'Source GPS',
  _GedOs_session_started_at: 'Debut session',
  _GedOs_session_duration_s: 'Duree session',
  // Backward compatibility with _ged_os_
  _ged_os_collection_app: 'Application',
  _ged_os_collection_engine: 'Moteur',
  _ged_os_collection_mode: 'Mode',
  _ged_os_client_timezone: 'Fuseau horaire',
  _ged_os_client_language: 'Langue',
  _ged_os_client_platform: 'Appareil',
  _ged_os_client_user_agent: 'Navigateur',
  _ged_os_client_network: 'Reseau',
  _ged_os_client_touch: 'Ecran tactile',
  _ged_os_client_viewport: 'Fenetre',
  _ged_os_client_gps_accuracy_m: 'Precision GPS',
  _ged_os_client_gps_captured_at: 'Capture GPS',
  _ged_os_client_gps_source: 'Source GPS',
  _ged_os_session_started_at: 'Debut session',
  _ged_os_session_duration_s: 'Duree session',
};

export const formatMetadataLabel = (key: string) => CLIENT_METADATA_LABELS[key] || key.replace(/^(_GedOs_|_ged_os_)/, '').replace(/_/g, ' ');
