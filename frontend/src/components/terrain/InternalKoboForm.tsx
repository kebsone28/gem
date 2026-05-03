import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Copy,
  Database,
  Download,
  ImagePlus,
  Loader2,
  Lock,
  LockKeyhole,
  MapPin,
  RefreshCcw,
  Search,
  X,
} from 'lucide-react';
import apiClient from '../../api/client';
import { fetchInternalKoboFormDefinition } from '../../services/internalKoboSubmissionService';
import type {
  InternalKoboAttachment,
  InternalKoboLocalDraft,
  InternalKoboQueuedSubmission,
  InternalKoboSubmissionRecord,
} from '../../services/internalKoboSubmissionService';
import { compressImage } from '../../utils/imageUtils';
import { stringifyHouseholdValue } from '../../utils/householdDisplay';
import {
  formatInternalKoboValue,
  getInternalKoboFieldValue,
  getVisibleInternalKoboFields,
  hasInternalKoboRequiredValue,
  hasInternalKoboValue,
  INTERNAL_KOBO_CHOICES,
  INTERNAL_KOBO_FORM_SETTINGS,
  INTERNAL_KOBO_SECTIONS,
  isInternalKoboFieldVisible,
  isTruthyKoboValue,
  validateInternalKoboFields,
  validateInternalKoboRequiredFields,
} from './internalKoboFormDefinition';
import type { InternalKoboField } from './internalKoboFormDefinition';

type InternalKoboFormProps = {
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  onSave: () => void;
  onClose: () => void;
  isSaving?: boolean;
  onPhotoUpload?: (file: File) => Promise<string>;
  onResolvedHousehold?: (household: Record<string, any> | null) => void;
  resolveHouseholdByNumero?: (numeroOrdre: string) => Record<string, any> | null;
  queueCount?: number;
  queueItems?: InternalKoboQueuedSubmission[];
  isQueueFlushing?: boolean;
  onFlushQueue?: () => void;
  localDraft?: InternalKoboLocalDraft | null;
  onClearLocalDraft?: () => void;
  isOnline?: boolean;
  submissions?: InternalKoboSubmissionRecord[];
  isHistoryLoading?: boolean;
  historyError?: string;
  onRefreshHistory?: () => void;
};

const asArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) return value.split(/\s+/);
  return [];
};

const progressFor = (values: Record<string, unknown>) => {
  const visibleFields = getVisibleInternalKoboFields(values).filter((field) => !field.readOnly && field.type !== 'note');
  const filled = visibleFields.filter((field) => hasInternalKoboRequiredValue(field, values)).length;
  return {
    filled,
    total: visibleFields.length,
    percent: visibleFields.length ? Math.round((filled / visibleFields.length) * 100) : 0,
  };
};

const getToneForValue = (value: unknown) => {
  const str = String(value ?? '').toLowerCase();
  if (['non', 'non_conforme', 'nc', 'probleme', 'menage_non_eligible', 'probleme_a_signaler'].includes(str)) {
    return 'border-rose-300/75 bg-rose-400/22 text-white shadow-lg shadow-rose-500/15 ring-1 ring-rose-200/20';
  }
  if (['oui', 'conforme', 'c', 'termine', 'terminee', 'realise', 'menage_eligible'].includes(str)) {
    return 'border-emerald-300/75 bg-emerald-400/22 text-white shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-200/20';
  }
  return 'border-blue-300/70 bg-blue-400/20 text-white shadow-lg shadow-blue-500/15 ring-1 ring-blue-200/20';
};

const ROLE_SECTION_BY_VALUE: Record<string, string> = {
  livreur: 'preparation_livraison',
  __pr_parateur: 'preparation_livraison',
  macon: 'macon',
  reseau: 'reseau',
  interieur: 'interieur',
  controleur: 'controle_branchement',
};

const maxPixelsFromParameters = (parameters?: string) => {
  const match = parameters?.match(/max-pixels\s*=\s*(\d+)/i);
  return match ? Number(match[1]) : undefined;
};

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const makeAttachmentId = () =>
  globalThis.crypto?.randomUUID?.() || `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Lecture de fichier impossible'));
    reader.readAsDataURL(file);
  });

const getAttachmentMeta = (values: Record<string, unknown>, fieldName: string): InternalKoboAttachment | null => {
  const value = values[`_gem_attachment_${fieldName}`];
  return isRecord(value) ? (value as InternalKoboAttachment) : null;
};

const getImagePreviewSource = (fieldValue: unknown, attachment: InternalKoboAttachment | null) => {
  const value = String(fieldValue || '');
  if (value.startsWith('data:image/')) return value;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('/api/')) return value;
  if (attachment?.dataUrl?.startsWith('data:image/')) return attachment.dataUrl;
  if (attachment?.url) return attachment.url;
  return '';
};

const formatHistoryDate = (value?: string | null) => {
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

const CLIENT_METADATA_LABELS: Record<string, string> = {
  _gem_collection_app: 'Application',
  _gem_collection_engine: 'Moteur',
  _gem_collection_mode: 'Mode',
  _gem_client_timezone: 'Fuseau horaire',
  _gem_client_language: 'Langue',
  _gem_client_platform: 'Appareil',
  _gem_client_user_agent: 'Navigateur',
  _gem_client_network: 'Reseau',
  _gem_client_touch: 'Ecran tactile',
  _gem_client_viewport: 'Fenetre',
  _gem_client_gps_accuracy_m: 'Precision GPS',
  _gem_client_gps_captured_at: 'Capture GPS',
  _gem_client_gps_source: 'Source GPS',
  _gem_session_started_at: 'Debut session',
  _gem_session_duration_s: 'Duree session',
};

const formatMetadataLabel = (key: string) => CLIENT_METADATA_LABELS[key] || key.replace(/^_gem_/, '').replace(/_/g, ' ');

const getClientCollectionMetadata = (isOnline: boolean): Record<string, string> => {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const connection = nav ? (nav as Navigator & { connection?: { effectiveType?: string; type?: string } }).connection : null;
  const viewport = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '';
  const timezone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      : '';

  return {
    _gem_collection_app: 'gem-terrain-internal',
    _gem_collection_engine: 'xlsform-native',
    _gem_collection_mode: isOnline ? 'online' : 'offline',
    _gem_client_timezone: timezone,
    _gem_client_language: nav?.language || '',
    _gem_client_platform: nav?.platform || '',
    _gem_client_user_agent: nav?.userAgent || '',
    _gem_client_network: connection?.effectiveType || connection?.type || '',
    _gem_client_touch: String((nav?.maxTouchPoints || 0) > 0),
    _gem_client_viewport: viewport,
  };
};

const submissionStatusClass = (status: string) => {
  if (status === 'submitted' || status === 'validated') {
    return 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100';
  }
  if (status === 'rejected') {
    return 'border-rose-300/25 bg-rose-400/10 text-rose-100';
  }
  return 'border-amber-300/25 bg-amber-400/10 text-amber-100';
};

const submissionStatusLabel = (status: string) => {
  if (status === 'submitted') return 'Soumis';
  if (status === 'validated') return 'Valide';
  if (status === 'rejected') return 'Rejete';
  return 'Brouillon';
};

const queueStatusClass = (status: string) => {
  if (status === 'failed') return 'border-rose-300/25 bg-rose-400/10 text-rose-100';
  return 'border-sky-300/25 bg-sky-400/10 text-sky-100';
};

const queueStatusLabel = (status: string, retryCount = 0) => {
  if (status === 'failed' && retryCount >= 6) return 'Bloque';
  if (status === 'failed') return 'A relancer';
  return 'En attente';
};

export const InternalKoboForm: React.FC<InternalKoboFormProps> = ({
  values,
  onChange,
  onSave,
  onClose,
  isSaving = false,
  onPhotoUpload,
  onResolvedHousehold,
  resolveHouseholdByNumero,
  queueCount = 0,
  queueItems = [],
  isQueueFlushing = false,
  onFlushQueue,
  localDraft = null,
  onClearLocalDraft,
  isOnline = true,
  submissions = [],
  isHistoryLoading = false,
  historyError = '',
  onRefreshHistory,
}) => {
  const [activeSectionId, setActiveSectionId] = useState(INTERNAL_KOBO_SECTIONS[0]?.id || '');
  const [query, setQuery] = useState('');
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [locatingField, setLocatingField] = useState<string | null>(null);
  const [locationError, setLocationError] = useState('');
  const [isSubmitReviewOpen, setIsSubmitReviewOpen] = useState(false);
  const [receiptSubmission, setReceiptSubmission] = useState<InternalKoboSubmissionRecord | null>(null);
  const [copiedReceiptId, setCopiedReceiptId] = useState('');
  const [householdLookup, setHouseholdLookup] = useState<{
    status: 'idle' | 'loading' | 'found' | 'missing' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const [serverFormStatus, setServerFormStatus] = useState<{
    status: 'idle' | 'loading' | 'ok' | 'mismatch' | 'error';
    version?: string;
    message?: string;
  }>({ status: 'idle' });
  const lastResolvedNumeroRef = useRef('');
  const onChangeRef = useRef(onChange);
  const onResolvedHouseholdRef = useRef(onResolvedHousehold);
  const resolveHouseholdByNumeroRef = useRef(resolveHouseholdByNumero);
  const validationIssues = useMemo(() => validateInternalKoboFields(values), [values]);
  const missingRequired = useMemo(() => validateInternalKoboRequiredFields(values), [values]);
  const constraintIssues = useMemo(
    () => validationIssues.filter((issue) => issue.type === 'constraint'),
    [validationIssues]
  );
  const progress = useMemo(() => progressFor(values), [values]);
  const collectionMetadata = useMemo(() => getClientCollectionMetadata(isOnline), [isOnline]);
  const normalizedQuery = query.trim().toLowerCase();
  const numeroOrdre = String(values.Numero_ordre || '').trim();
  const selectedRole = String(values.role || '').trim();
  const selectedRoleSectionId = ROLE_SECTION_BY_VALUE[selectedRole] || '';
  const lastAutoActivatedRoleRef = useRef('');
  const fieldLabelByName = useMemo(() => {
    const entries = INTERNAL_KOBO_SECTIONS.flatMap((section) =>
      section.fields.map((field) => [field.name, field.label] as const)
    );
    return new Map(entries);
  }, []);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onResolvedHouseholdRef.current = onResolvedHousehold;
  }, [onResolvedHousehold]);

  useEffect(() => {
    resolveHouseholdByNumeroRef.current = resolveHouseholdByNumero;
  }, [resolveHouseholdByNumero]);

  useEffect(() => {
    if (!isOnline) {
      setServerFormStatus({ status: 'idle' });
      return undefined;
    }

    let cancelled = false;
    setServerFormStatus((current) => current.status === 'ok' ? current : { status: 'loading' });

    fetchInternalKoboFormDefinition()
      .then((form) => {
        if (cancelled) return;
        if (!form) {
          setServerFormStatus({ status: 'error', message: 'Definition VPS indisponible' });
          return;
        }

        setServerFormStatus({
          status: form.formVersion === INTERNAL_KOBO_FORM_SETTINGS.version ? 'ok' : 'mismatch',
          version: form.formVersion,
          message:
            form.formVersion === INTERNAL_KOBO_FORM_SETTINGS.version
              ? 'Version VPS verifiee'
              : `Version VPS ${form.formVersion}`,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setServerFormStatus({
          status: 'error',
          message: error instanceof Error ? error.message : 'Definition VPS indisponible',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  useEffect(() => {
    const now = new Date();
    const startValue = String(values.start || values._gem_session_started_at || now.toISOString());
    const nextMetadata: Record<string, unknown> = {
      ...collectionMetadata,
      start: startValue,
      today: values.today || now.toISOString().slice(0, 10),
      _gem_session_started_at: startValue,
    };

    Object.entries(nextMetadata).forEach(([key, value]) => {
      if (String(values[key] ?? '') !== String(value ?? '')) {
        onChangeRef.current(key, value);
      }
    });
  }, [collectionMetadata, values]);

  useEffect(() => {
    const startedAt = String(values._gem_session_started_at || values.start || '');
    if (!startedAt) return undefined;

    const updateDuration = () => {
      const startedTime = new Date(startedAt).getTime();
      if (Number.isNaN(startedTime)) return;
      const durationSeconds = Math.max(0, Math.round((Date.now() - startedTime) / 1000));
      onChangeRef.current('_gem_session_duration_s', String(durationSeconds));
    };

    updateDuration();
    const intervalId = window.setInterval(updateDuration, 15000);
    return () => window.clearInterval(intervalId);
  }, [values._gem_session_started_at, values.start]);

  useEffect(() => {
    if (!numeroOrdre) {
      setHouseholdLookup({ status: 'idle', message: '' });
      onResolvedHouseholdRef.current?.(null);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      if (lastResolvedNumeroRef.current === numeroOrdre) return;

      const applyResolvedHousehold = (household: Record<string, any>, source: 'server' | 'local') => {
        const coordinates = Array.isArray(household.location?.coordinates)
          ? household.location.coordinates
          : null;
        const longitude =
          stringifyHouseholdValue(household.longitude) ||
          stringifyHouseholdValue(coordinates?.[0]) ||
          stringifyHouseholdValue(household.koboData?.longitude_key) ||
          stringifyHouseholdValue(household.koboData?.C4);
        const latitude =
          stringifyHouseholdValue(household.latitude) ||
          stringifyHouseholdValue(coordinates?.[1]) ||
          stringifyHouseholdValue(household.koboData?.latitude_key) ||
          stringifyHouseholdValue(household.koboData?.C2);
        const displayName =
          stringifyHouseholdValue(household.name) ||
          stringifyHouseholdValue(household.owner) ||
          stringifyHouseholdValue(household.koboData?.nom_key) ||
          stringifyHouseholdValue(household.koboData?.C1);
        const phone =
          stringifyHouseholdValue(household.phone) ||
          stringifyHouseholdValue(household.ownerPhone) ||
          stringifyHouseholdValue(household.koboData?.telephone_key) ||
          stringifyHouseholdValue(household.koboData?.C3) ||
          stringifyHouseholdValue(household.koboSync?.tel);
        const region =
          stringifyHouseholdValue(household.region) ||
          stringifyHouseholdValue(household.koboData?.region_key) ||
          stringifyHouseholdValue(household.koboData?.region);

        onChangeRef.current('nom_key', String(displayName));
        onChangeRef.current('telephone_key', String(phone));
        onChangeRef.current('latitude_key', String(latitude));
        onChangeRef.current('longitude_key', String(longitude));
        onChangeRef.current('region_key', String(region));
        onChangeRef.current('LOCALISATION_CLIENT', latitude && longitude ? `${latitude} ${longitude}` : '');

        lastResolvedNumeroRef.current = numeroOrdre;
        onResolvedHouseholdRef.current?.(household);
        setHouseholdLookup({
          status: 'found',
          message:
            source === 'server'
              ? `Menage trouve sur le VPS: ${displayName || household.numeroordre || numeroOrdre}`
              : `Menage trouve dans les donnees chargees: ${displayName || household.numeroordre || numeroOrdre}`,
        });
      };

      setHouseholdLookup({ status: 'loading', message: 'Recherche du menage sur le serveur VPS...' });
      try {
        const response = await apiClient.get(`households/by-numero/${encodeURIComponent(numeroOrdre)}`);
        const household = response.data?.household || response.data;
        if (!household?.id) {
          throw new Error('Household response missing id');
        }

        applyResolvedHousehold(household, 'server');
      } catch (error: any) {
        lastResolvedNumeroRef.current = '';
        const fallbackHousehold = resolveHouseholdByNumeroRef.current?.(numeroOrdre);
        if (fallbackHousehold?.id) {
          applyResolvedHousehold(fallbackHousehold, 'local');
          return;
        }

        const status = error?.response?.status;
        onResolvedHouseholdRef.current?.(null);
        setHouseholdLookup({
          status: status === 404 ? 'missing' : 'error',
          message:
            status === 404
              ? `Aucun menage trouve pour le numero ${numeroOrdre}`
              : status === 401
                ? 'Recherche impossible: session expiree, reconnectez-vous'
                : status === 403
                  ? 'Recherche impossible: droit insuffisant pour lire les menages'
                  : status
                    ? `Recherche impossible: erreur API VPS ${status}`
                    : 'Recherche impossible: API VPS injoignable',
        });
      }
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [numeroOrdre]);

  useEffect(() => {
    if (!selectedRole || !selectedRoleSectionId) {
      lastAutoActivatedRoleRef.current = '';
      setActiveSectionId('menage');
      return;
    }

    if (lastAutoActivatedRoleRef.current !== selectedRole) {
      lastAutoActivatedRoleRef.current = selectedRole;
      setActiveSectionId(selectedRoleSectionId);
    }
  }, [selectedRole, selectedRoleSectionId]);

  const visibleSections = INTERNAL_KOBO_SECTIONS.map((section) => ({
    ...section,
    activeFields: section.fields.filter((field) => isInternalKoboFieldVisible(field, values)),
  })).map((section) => ({
    ...section,
    fields: section.activeFields.filter((field) => {
      const visible = isInternalKoboFieldVisible(field, values);
      if (!visible) return false;
      if (!normalizedQuery) return true;
      return `${field.label} ${field.name}`.toLowerCase().includes(normalizedQuery);
    }),
  })).filter((section) => {
    if (!selectedRole) return section.id === 'menage' && section.fields.length > 0;
    if (!normalizedQuery) return true;
    return section.fields.length > 0 || `${section.title} ${section.subtitle}`.toLowerCase().includes(normalizedQuery);
  });

  let previousBlockingSectionId = '';
  const navigableSections = visibleSections.map((section) => {
    const missingFields = section.activeFields.filter(
      (field) =>
        field.type !== 'note' &&
        field.required &&
        !hasInternalKoboValue(getInternalKoboFieldValue(field, values))
    );
    const roleLocked = Boolean(
      selectedRole &&
      section.role &&
      section.role !== selectedRole &&
      section.id !== selectedRoleSectionId
    );
    const sequenceLocked = Boolean(previousBlockingSectionId && section.activeFields.length > 0);
    const locked = roleLocked || sequenceLocked;
    const lockedReason = roleLocked ? 'role' : sequenceLocked ? 'sequence' : '';
    const blockedBySectionId = sequenceLocked ? previousBlockingSectionId : '';

    if (!roleLocked && !sequenceLocked && missingFields.length > 0) {
      previousBlockingSectionId = section.id;
    }

    return {
      ...section,
      locked,
      lockedReason,
      blockedBySectionId,
      missingFields,
    };
  });

  const activeSection =
    navigableSections.find((section) => section.id === activeSectionId && !section.locked) ||
    navigableSections.find((section) => section.id === selectedRoleSectionId && !section.locked) ||
    navigableSections.find((section) => !section.locked) ||
    navigableSections[0];
  const mobileSectionOptions = navigableSections.filter((section) => !section.locked);
  const validationIssueDetails = validationIssues.map((issue) => {
    const section = navigableSections.find((item) =>
      item.activeFields.some((sectionField) => sectionField.name === issue.field.name)
    );
    return { ...issue, section };
  });
  const firstActionableIssue = validationIssueDetails.find((item) => item.section && !item.section.locked);
  const requiredStatusText = validationIssues.length ? `${validationIssues.length} a corriger` : 'Pret';
  const requiredStatusClass = validationIssues.length
    ? 'border-amber-400/35 bg-amber-400/12 text-amber-100'
    : 'border-emerald-400/30 bg-emerald-400/12 text-emerald-100';

  const blockedByTitle = (sectionId: string) =>
    navigableSections.find((section) => section.id === sectionId)?.title || 'l etape precedente';

  const getSectionStatus = (section: typeof navigableSections[number]) => {
    const fillableCount = section.activeFields.filter((field) => field.type !== 'note' && !field.readOnly).length;
    if (section.locked) {
      const isRoleLock = section.lockedReason === 'role';
      return {
        label: isRoleLock ? 'Non concerne' : 'Verrouille',
        detail: isRoleLock
          ? `Role actif: ${formatInternalKoboValue(selectedRole, 'roles')}`
          : `Terminer ${blockedByTitle(section.blockedBySectionId)}`,
        className: 'border-white/5 bg-white/[0.02] text-slate-600',
        icon: <LockKeyhole size={13} />,
      };
    }
    if (section.missingFields.length > 0) {
      return {
        label: `${section.missingFields.length} requis`,
        detail: `${fillableCount} champs actifs`,
        className: 'border-amber-300/25 bg-amber-400/10 text-amber-100',
        icon: <AlertCircle size={13} />,
      };
    }
    if (fillableCount > 0) {
      return {
        label: 'Termine',
        detail: `${fillableCount} champs actifs`,
        className: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
        icon: <CheckCircle2 size={13} />,
      };
    }
    return {
      label: 'Disponible',
      detail: 'Aucun champ actif',
      className: 'border-white/8 bg-white/[0.03] text-slate-400',
      icon: <ChevronRight size={13} />,
    };
  };

  const focusRequiredField = (fieldName: string, sectionId?: string) => {
    if (sectionId) setActiveSectionId(sectionId);
    window.setTimeout(() => {
      document.getElementById(`internal-kobo-field-${fieldName}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 120);
  };

  const handlePrimarySave = () => {
    if (validationIssues.length === 0) {
      setIsSubmitReviewOpen(true);
      return;
    }
    onSave();
  };

  const confirmFinalSubmission = () => {
    setIsSubmitReviewOpen(false);
    onSave();
  };

  const copyReceiptId = async (submission: InternalKoboSubmissionRecord) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(submission.clientSubmissionId);
    setCopiedReceiptId(submission.clientSubmissionId);
    window.setTimeout(() => setCopiedReceiptId(''), 1400);
  };

  const downloadReceiptJson = (submission: InternalKoboSubmissionRecord) => {
    const safeNumero = String(submission.numeroOrdre || 'menage').replace(/[^a-z0-9_-]+/gi, '-');
    const blob = new Blob([JSON.stringify(submission, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `recu-kobo-${safeNumero}-${submission.clientSubmissionId}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadSubmissionHistoryJson = () => {
    if (submissions.length === 0) return;
    const safeNumero = String(numeroOrdre || submissions[0]?.numeroOrdre || 'menage').replace(/[^a-z0-9_-]+/gi, '-');
    const blob = new Blob([JSON.stringify(submissions, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `historique-kobo-${safeNumero}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const setOption = (field: InternalKoboField, optionName: string) => {
    if (field.type === 'select_multiple') {
      const current = new Set(asArray(values[field.name]));
      if (current.has(optionName)) current.delete(optionName);
      else current.add(optionName);
      onChange(field.name, Array.from(current));
      return;
    }

    onChange(field.name, optionName);
    if (field.name === 'role') {
      const targetSectionId = ROLE_SECTION_BY_VALUE[optionName];
      if (targetSectionId) {
        lastAutoActivatedRoleRef.current = optionName;
        setActiveSectionId(targetSectionId);
      }
    }
  };

  const handleFile = async (field: InternalKoboField, file?: File) => {
    if (!file) return;
    setUploadingField(field.name);
    try {
      const maxPixels = maxPixelsFromParameters(field.parameters);
      const uploadFile = maxPixels ? await compressImage(file, { maxWidth: maxPixels, maxHeight: maxPixels }) : file;
      const capturedAt = new Date().toISOString();
      const dataUrl = await fileToDataUrl(uploadFile);
      const baseAttachment: InternalKoboAttachment = {
        id: makeAttachmentId(),
        fieldName: field.name,
        fileName: file.name,
        mimeType: file.type || uploadFile.type || 'image/jpeg',
        originalBytes: file.size,
        storedBytes: uploadFile.size,
        capturedAt,
        source: 'gem-internal-kobo',
      };
      let fieldValue = dataUrl;
      let attachment: InternalKoboAttachment = {
        ...baseAttachment,
        dataUrl,
        storage: isOnline ? 'embedded-fallback' : 'embedded-offline',
        status: 'queued',
      };

      if (isOnline && onPhotoUpload) {
        try {
          const uploaded = await onPhotoUpload(uploadFile);
          if (uploaded) {
            fieldValue = uploaded;
            attachment = {
              ...baseAttachment,
              url: uploaded,
              storage: 'remote',
              status: 'uploaded',
            };
          }
        } catch {
          fieldValue = dataUrl;
        }
      }

      onChange(field.name, fieldValue);
      onChange(`_gem_attachment_${field.name}`, attachment);
      onChange(`_gem_photo_${field.name}_original_name`, file.name);
      onChange(`_gem_photo_${field.name}_mime`, attachment.mimeType || '');
      onChange(`_gem_photo_${field.name}_original_bytes`, String(file.size));
      onChange(`_gem_photo_${field.name}_stored_bytes`, String(uploadFile.size));
      onChange(`_gem_photo_${field.name}_compressed`, String(uploadFile.size < file.size));
      onChange(`_gem_photo_${field.name}_storage`, attachment.storage || '');
      onChange(`_gem_photo_${field.name}_captured_at`, capturedAt);
    } finally {
      setUploadingField(null);
    }
  };

  const clearFile = (field: InternalKoboField) => {
    onChange(field.name, '');
    onChange(`_gem_attachment_${field.name}`, '');
    onChange(`_gem_photo_${field.name}_original_name`, '');
    onChange(`_gem_photo_${field.name}_mime`, '');
    onChange(`_gem_photo_${field.name}_original_bytes`, '');
    onChange(`_gem_photo_${field.name}_stored_bytes`, '');
    onChange(`_gem_photo_${field.name}_compressed`, '');
    onChange(`_gem_photo_${field.name}_storage`, '');
    onChange(`_gem_photo_${field.name}_captured_at`, '');
  };

  const captureLocation = (field: InternalKoboField) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError("GPS indisponible sur cet appareil ou ce navigateur.");
      return;
    }

    setLocationError('');
    setLocatingField(field.name);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(7);
        const longitude = position.coords.longitude.toFixed(7);
        const capturedAt = new Date(position.timestamp || Date.now()).toISOString();

        onChange(field.name, `${latitude} ${longitude}`);
        if (field.name === 'LOCALISATION_CLIENT') {
          onChange('latitude_key', latitude);
          onChange('longitude_key', longitude);
        }
        onChange('_gem_client_gps_accuracy_m', String(Math.round(position.coords.accuracy || 0)));
        onChange('_gem_client_gps_captured_at', capturedAt);
        onChange('_gem_client_gps_source', 'browser-geolocation-high-accuracy');
        setLocatingField(null);
      },
      (error) => {
        setLocationError(error.message || 'Capture GPS impossible.');
        setLocatingField(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  };

  const renderField = (field: InternalKoboField) => {
    const value = getInternalKoboFieldValue(field, values);
    const fieldIssues = validationIssues.filter((issue) => issue.field.name === field.name);
    const missing = fieldIssues.some((issue) => issue.type === 'required');
    const invalid = fieldIssues.some((issue) => issue.type === 'constraint');
    const shellClass = `rounded-2xl border p-4 space-y-3 shadow-sm ${
      missing || invalid ? 'border-amber-300/35 bg-amber-400/[0.08]' : 'border-white/[0.09] bg-white/[0.055]'
    }`;

    if (field.type === 'note') {
      return (
        <div key={field.name} className="rounded-2xl border border-blue-300/20 bg-blue-400/[0.1] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-100">{field.label}</p>
          {field.hint || field.guidanceHint ? (
            <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-300">{field.hint || field.guidanceHint}</p>
          ) : null}
        </div>
      );
    }

    if (field.type === 'acknowledge') {
      const checked = isTruthyKoboValue(value);
      return (
        <button
          key={field.name}
          id={`internal-kobo-field-${field.name}`}
          type="button"
          onClick={() => onChange(field.name, !checked)}
          className={`${shellClass} flex w-full items-center justify-between gap-4 text-left transition-all active:scale-[0.99]`}
        >
          <div className="min-w-0">
            <p className="text-[14px] font-black leading-snug text-white">{field.label}</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-500">Code Kobo: {field.name}</p>
          </div>
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${
            checked ? 'border-emerald-300 bg-emerald-400 text-slate-950' : 'border-white/15 bg-slate-950/50 text-slate-500'
          }`}>
            <CheckCircle2 size={17} />
          </span>
        </button>
      );
    }

    return (
      <div key={field.name} id={`internal-kobo-field-${field.name}`} className={shellClass}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-black leading-snug text-white">{field.label}</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-500">Code Kobo: {field.name}</p>
            {field.hint || field.guidanceHint ? (
              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">{field.hint || field.guidanceHint}</p>
            ) : null}
          </div>
          {field.required ? (
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
              missing ? 'bg-amber-300 text-slate-950' : 'bg-amber-400/10 text-amber-100'
            }`}>
              Obligatoire
            </span>
          ) : null}
        </div>

        {fieldIssues.length > 0 ? (
          <div className="space-y-1">
            {fieldIssues.map((issue) => (
              <p
                key={`${field.name}-${issue.type}`}
                className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-[10px] font-bold leading-snug text-amber-50"
              >
                {issue.message}
              </p>
            ))}
          </div>
        ) : null}

        {field.readOnly ? (
          <div className="flex h-12 items-center gap-2 rounded-2xl border border-white/8 bg-slate-950/35 px-4 text-[12px] font-black text-slate-300">
            <Lock size={13} className="text-slate-600" />
            <span className="truncate">{String(value || 'Non renseigne')}</span>
          </div>
        ) : null}

        {(field.type === 'integer' || field.type === 'text' || field.type === 'geopoint') && !field.readOnly ? (
          field.type === 'text' ? (
            <textarea
              value={String(value || '')}
              onChange={(event) => onChange(field.name, event.target.value)}
              rows={field.appearance === 'multiline' || field.name === 'notes_generales' ? 3 : 2}
              placeholder="Saisir la valeur..."
              className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900/45 px-4 py-3 text-sm font-semibold leading-relaxed text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-blue-400/50"
            />
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type={field.type === 'integer' ? 'number' : 'text'}
                  inputMode={field.type === 'integer' ? 'numeric' : 'text'}
                  value={String(value || '')}
                  onChange={(event) => onChange(field.name, event.target.value)}
                  placeholder={field.type === 'geopoint' ? 'lat lon' : 'Saisir la valeur...'}
                  className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-900/50 px-4 text-sm font-bold text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-400/50"
                />
                {field.type === 'geopoint' ? (
                  <button
                    type="button"
                    onClick={() => captureLocation(field)}
                    disabled={locatingField === field.name}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-100 transition-all hover:bg-emerald-400/18 active:scale-95 disabled:opacity-60"
                    title="Capturer la position GPS actuelle"
                    aria-label="Capturer la position GPS actuelle"
                  >
                    {locatingField === field.name ? <Loader2 size={17} className="animate-spin" /> : <MapPin size={17} />}
                  </button>
                ) : null}
              </div>
              {field.type === 'geopoint' && locationError ? (
                <p className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-[10px] font-bold text-rose-100">
                  {locationError}
                </p>
              ) : null}
            </div>
          )
        ) : null}

        {(field.type === 'select_one' || field.type === 'select_multiple') && field.listName ? (
          <div className={`grid grid-cols-1 gap-2 ${field.appearance === 'minimal' ? '' : 'sm:grid-cols-2'}`}>
            {(INTERNAL_KOBO_CHOICES[field.listName] || []).map((option) => {
              const active = field.type === 'select_multiple'
                ? asArray(value).includes(option.name)
                : value === option.name;

              return (
                <button
                  key={option.name}
                  type="button"
                  onClick={() => setOption(field, option.name)}
                  className={`relative overflow-hidden ${field.appearance === 'quick' ? 'min-h-10' : 'min-h-12'} flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 pl-4 text-left text-[12px] font-black uppercase tracking-[0.08em] transition-all active:scale-95 ${
                    active ? getToneForValue(option.name) : 'border-white/10 bg-slate-950/35 text-slate-300 hover:border-blue-300/30 hover:bg-blue-400/[0.08] hover:text-white'
                  }`}
                >
                  <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full transition-all ${
                    active ? 'bg-white shadow-[0_0_16px_rgba(255,255,255,0.8)]' : 'bg-white/10'
                  }`} />
                  <span className="min-w-0">{option.label}</span>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-all ${
                    active ? 'border-white/70 bg-white text-slate-950' : 'border-white/15 bg-white/[0.03] text-transparent'
                  }`}>
                    {active ? <CheckCircle2 size={15} /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {field.type === 'image' ? (() => {
          const attachment = getAttachmentMeta(values, field.name);
          const previewSource = getImagePreviewSource(value, attachment);
          const isQueuedPhoto = attachment?.status === 'queued' || attachment?.storage?.startsWith('embedded');

          return (
            <div className="rounded-2xl border border-dashed border-white/12 bg-slate-900/45 p-3">
              {previewSource ? (
                <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50">
                  <img src={previewSource} alt={field.label} className="max-h-56 w-full object-cover" />
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-blue-300/20 bg-blue-400/10 px-4 text-center text-blue-100 transition-all hover:bg-blue-400/18 active:scale-[0.98]">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => handleFile(field, event.target.files?.[0])}
                  />
                  {hasInternalKoboValue(value) ? <Camera size={18} /> : <ImagePlus size={18} />}
                  <span className="text-[10px] font-black uppercase tracking-[0.14em]">
                    {uploadingField === field.name ? 'Traitement photo...' : hasInternalKoboValue(value) ? 'Remplacer la photo' : 'Ajouter une photo'}
                  </span>
                </label>
                {hasInternalKoboValue(value) ? (
                  <button
                    type="button"
                    onClick={() => clearFile(field)}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-rose-100 transition-all hover:bg-rose-400/18 active:scale-[0.98]"
                  >
                    <X size={16} />
                    Retirer
                  </button>
                ) : null}
              </div>
              {hasInternalKoboValue(value) ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
                    isQueuedPhoto
                      ? 'border-amber-300/25 bg-amber-400/10 text-amber-100'
                      : 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
                  }`}>
                    {isQueuedPhoto ? 'Photo en file locale' : 'Photo serveur'}
                  </span>
                  <span className="max-w-full truncate text-[10px] font-semibold text-slate-500">
                    {attachment?.fileName || String(value)}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })() : null}

        {hasInternalKoboValue(value) && field.type !== 'image' && !field.readOnly ? (
          <p className="text-[10px] font-bold text-slate-500">
            Valeur Kobo: <span className="text-slate-300">{formatInternalKoboValue(value, field.listName)}</span>
          </p>
        ) : null}
      </div>
    );
  };

  const renderSubmissionHistory = (compact = false) => (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.045] ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-100">Historique VPS</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">
            {submissions.length ? `${submissions.length} derniere(s) soumission(s)` : 'Aucune soumission serveur'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {submissions.length > 0 ? (
            <button
              type="button"
              onClick={downloadSubmissionHistoryJson}
              className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-slate-950/35 text-slate-300 transition-colors hover:text-white"
              aria-label="Exporter l'historique Kobo"
              title="Exporter l'historique JSON"
            >
              <Download size={14} />
            </button>
          ) : null}
          {onRefreshHistory ? (
            <button
              type="button"
              onClick={onRefreshHistory}
              disabled={isHistoryLoading}
              className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-slate-950/35 text-slate-300 transition-colors hover:text-white disabled:opacity-40"
              aria-label="Actualiser l'historique VPS"
            >
              <RefreshCcw size={14} className={isHistoryLoading ? 'animate-spin' : ''} />
            </button>
          ) : null}
        </div>
      </div>

      {historyError ? (
        <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-[10px] font-bold text-amber-100">
          {historyError}
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {isHistoryLoading && submissions.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-slate-950/30 px-3 py-3 text-[10px] font-bold text-slate-400">
            Chargement de l'historique...
          </div>
        ) : null}

        {submissions.slice(0, compact ? 2 : 4).map((submission) => {
          const missingCount = Array.isArray(submission.requiredMissing) ? submission.requiredMissing.length : 0;
          return (
            <div key={submission.id} className="rounded-xl border border-white/[0.07] bg-slate-950/35 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-black text-white">
                    {formatInternalKoboValue(submission.role || 'role non defini', 'roles')}
                  </p>
                  <p className="mt-1 text-[9px] font-semibold text-slate-500">
                    {formatHistoryDate(submission.savedAt)} - v{submission.formVersion}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${submissionStatusClass(submission.status)}`}>
                  {submissionStatusLabel(submission.status)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-bold text-slate-400">
                <span className="rounded-full bg-white/[0.05] px-2 py-1">
                  {missingCount ? `${missingCount} requis manquant(s)` : 'Complet'}
                </span>
                {submission.submittedBy?.name || submission.submittedBy?.email ? (
                  <span className="rounded-full bg-white/[0.05] px-2 py-1">
                    {String(submission.submittedBy.name || submission.submittedBy.email)}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setReceiptSubmission(submission)}
                  className="rounded-full border border-blue-200/20 bg-blue-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-blue-100 hover:bg-blue-300/18"
                >
                  Voir recu
                </button>
              </div>
            </div>
          );
        })}

        {!isHistoryLoading && submissions.length === 0 && !historyError ? (
          <div className="rounded-xl border border-white/8 bg-slate-950/30 px-3 py-3 text-[10px] font-bold text-slate-500">
            Aucun envoi interne trouve pour ce menage.
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderLocalQueue = (compact = false) => {
    if (queueItems.length === 0) return null;

    const visibleQueueItems = queueItems.slice(0, compact ? 2 : 4);

    return (
      <div className={`rounded-2xl border border-sky-300/15 bg-sky-400/[0.055] ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-100">File locale</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-500">
              {queueItems.length} saisie(s) gardee(s) sur cet appareil
            </p>
          </div>
          {onFlushQueue ? (
            <button
              type="button"
              onClick={onFlushQueue}
              disabled={isQueueFlushing || !isOnline}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border border-sky-300/20 bg-sky-300/10 px-2.5 text-[9px] font-black uppercase tracking-[0.1em] text-sky-100 transition-colors hover:bg-sky-300/18 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RefreshCcw size={13} className={isQueueFlushing ? 'animate-spin' : ''} />
              Envoyer
            </button>
          ) : null}
        </div>

        <div className="mt-3 space-y-2">
          {visibleQueueItems.map((item) => (
            <div key={`${item.id || item.clientSubmissionId}`} className="rounded-xl border border-white/[0.07] bg-slate-950/35 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-black text-white">
                    {item.numeroOrdre ? `Menage ${item.numeroOrdre}` : 'Menage non renseigne'}
                  </p>
                  <p className="mt-1 text-[9px] font-semibold text-slate-500">
                    {formatInternalKoboValue(item.role || 'role non defini', 'roles')} - {formatHistoryDate(new Date(item.timestamp).toISOString())}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${queueStatusClass(item.status)}`}>
                  {queueStatusLabel(item.status, item.retryCount)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-bold text-slate-400">
                <span className="rounded-full bg-white/[0.05] px-2 py-1">
                  {submissionStatusLabel(item.submissionStatus)}
                </span>
                <span className="rounded-full bg-white/[0.05] px-2 py-1">
                  {item.retryCount} tentative(s)
                </span>
                {item.lastError ? (
                  <span className="max-w-full truncate rounded-full bg-rose-400/10 px-2 py-1 text-rose-100">
                    {item.lastError}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
          {queueItems.length > visibleQueueItems.length ? (
            <div className="rounded-xl border border-white/8 bg-slate-950/25 px-3 py-2 text-[10px] font-bold text-slate-500">
              +{queueItems.length - visibleQueueItems.length} autre(s) saisie(s) en file.
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderValidationAssistant = () => {
    if (validationIssues.length === 0) {
      return (
        <div className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.08] p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-300/12 text-emerald-100">
              <CheckCircle2 size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-black uppercase tracking-[0.14em] text-emerald-100">Validation Kobo prete</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-300">
                Tous les champs visibles requis sont remplis. La prochaine action soumettra la fiche au serveur VPS.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mb-4 rounded-2xl border border-amber-300/25 bg-amber-400/[0.08] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-black uppercase tracking-[0.14em] text-amber-100">Validation Kobo incomplete</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-300">
              {missingRequired.length} requis et {constraintIssues.length} valeur(s) a corriger avant la soumission finale.
            </p>
          </div>
          {firstActionableIssue?.section ? (
            <button
              type="button"
              onClick={() => focusRequiredField(firstActionableIssue.field.name, firstActionableIssue.section?.id)}
              className="rounded-full border border-amber-200/30 bg-amber-300/15 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-amber-50 hover:bg-amber-300/25"
            >
              Premiere action
            </button>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {validationIssueDetails.slice(0, 4).map(({ field, section, type, message }) => {
            const canOpen = Boolean(section && !section.locked);
            return (
              <button
                key={`${field.name}-${type}`}
                type="button"
                disabled={!canOpen}
                onClick={() => section && focusRequiredField(field.name, section.id)}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  canOpen
                    ? 'border-amber-200/20 bg-slate-950/25 text-amber-50 hover:border-amber-200/40'
                    : 'cursor-not-allowed border-white/8 bg-slate-950/15 text-slate-500 opacity-60'
                }`}
              >
                <p className="truncate text-[10px] font-black uppercase tracking-[0.1em]">
                  {section?.title || 'Etape inconnue'}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug">
                  {field.label}
                </p>
                <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-snug text-amber-100/75">
                  {message}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderReceiptModal = () => {
    if (!receiptSubmission) return null;

    const valueEntries = Object.entries(receiptSubmission.values || {})
      .filter(([key, value]) => {
        if (key.startsWith('_')) return false;
        if (Array.isArray(value)) return value.length > 0;
        return value !== undefined && value !== null && String(value).trim() !== '';
      })
      .slice(0, 14);
    const missingItems = Array.isArray(receiptSubmission.requiredMissing)
      ? receiptSubmission.requiredMissing
      : [];
    const metadataEntries = Object.entries(receiptSubmission.metadata || {})
      .filter(([key, value]) => {
        if (!key || value === undefined || value === null) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        return true;
      })
      .slice(0, 8);
    const clientMetadataEntries = Object.entries(receiptSubmission.values || {})
      .filter(([key, value]) => {
        const isClientMetadata =
          key.startsWith('_gem_collection_') ||
          key.startsWith('_gem_client_') ||
          key.startsWith('_gem_session_');
        if (!isClientMetadata) return false;
        if (value === undefined || value === null) return false;
        return String(value).trim().length > 0;
      })
      .slice(0, 12);

    return (
      <div className="absolute inset-0 z-40 flex items-end justify-center bg-slate-950/72 p-3 backdrop-blur-sm sm:items-center sm:p-6">
        <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-[1.5rem] border border-blue-300/20 bg-[#0B1728] shadow-2xl shadow-blue-950/30">
          <div className="shrink-0 border-b border-white/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">Recu Kobo interne</p>
                <h4 className="mt-2 truncate text-xl font-black uppercase tracking-tight text-white">
                  {receiptSubmission.numeroOrdre ? `Menage ${receiptSubmission.numeroOrdre}` : 'Soumission terrain'}
                </h4>
                <p className="mt-2 text-[12px] font-semibold leading-relaxed text-slate-300">
                  Identifiant: <span className="font-black text-blue-100">{receiptSubmission.clientSubmissionId}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyReceiptId(receiptSubmission)}
                  className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 hover:text-white"
                  aria-label="Copier l'identifiant du recu"
                  title={copiedReceiptId === receiptSubmission.clientSubmissionId ? 'Copie' : "Copier l'identifiant"}
                >
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => downloadReceiptJson(receiptSubmission)}
                  className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 hover:text-white"
                  aria-label="Telecharger le recu JSON"
                  title="Telecharger le recu JSON"
                >
                  <Download size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptSubmission(null)}
                  className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"
                  aria-label="Fermer le recu de soumission"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            {copiedReceiptId === receiptSubmission.clientSubmissionId ? (
              <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100">
                Identifiant copie
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Statut</p>
                <p className="mt-1 truncate text-sm font-black text-white">{submissionStatusLabel(receiptSubmission.status)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Role</p>
                <p className="mt-1 truncate text-sm font-black text-white">{formatInternalKoboValue(receiptSubmission.role || '', 'roles') || 'Non defini'}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Date</p>
                <p className="mt-1 truncate text-sm font-black text-white">{formatHistoryDate(receiptSubmission.savedAt)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Version</p>
                <p className="mt-1 truncate text-sm font-black text-white">v{receiptSubmission.formVersion}</p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5 custom-scrollbar">
            {missingItems.length > 0 ? (
              <div className="mb-4 rounded-2xl border border-amber-300/25 bg-amber-400/[0.08] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">Requis manquants au moment de l'envoi</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {missingItems.map((fieldName) => (
                    <span key={fieldName} className="rounded-full border border-amber-200/20 bg-amber-300/10 px-2.5 py-1 text-[9px] font-bold text-amber-50">
                      {fieldLabelByName.get(fieldName) || fieldName}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-100">Apercu des valeurs envoyees</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {valueEntries.map(([key, value]) => (
                  <div key={key} className="min-w-0 rounded-xl border border-white/8 bg-slate-950/25 p-3">
                    <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                      {fieldLabelByName.get(key) || key}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug text-slate-100">
                      {formatInternalKoboValue(value)}
                    </p>
                  </div>
                ))}
              </div>
              {valueEntries.length === 0 ? (
                <p className="mt-3 text-[11px] font-semibold text-slate-500">Aucune valeur exploitable dans ce recu.</p>
              ) : null}
            </div>

            {metadataEntries.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-100">Metadonnees de collecte</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {metadataEntries.map(([key, value]) => (
                    <div key={key} className="min-w-0 rounded-xl border border-white/8 bg-slate-950/25 p-3">
                      <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                        {key}
                      </p>
                      <p className="mt-1 line-clamp-3 break-words text-[11px] font-bold leading-snug text-slate-100">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {clientMetadataEntries.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.055] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">Contexte appareil</p>
                <p className="mt-1 text-[10px] font-semibold leading-relaxed text-slate-400">
                  Donnees techniques jointes automatiquement pour tracer la saisie, le mode hors-ligne et la session.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {clientMetadataEntries.map(([key, value]) => (
                    <div key={key} className="min-w-0 rounded-xl border border-cyan-200/10 bg-slate-950/25 p-3">
                      <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-cyan-200/70">
                        {formatMetadataLabel(key)}
                      </p>
                      <p className="mt-1 line-clamp-3 break-words text-[11px] font-bold leading-snug text-slate-100">
                        {key === '_gem_client_touch'
                          ? String(value) === 'true' ? 'Oui' : 'Non'
                          : key === '_gem_session_duration_s'
                            ? `${String(value)} s`
                            : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <div className="relative grid h-[100dvh] w-full max-w-7xl overflow-hidden rounded-t-[1.5rem] border border-blue-200/10 bg-[#0B1728] shadow-2xl sm:h-[92vh] sm:rounded-[1.75rem] md:grid-cols-[310px_1fr]">
        <aside className="hidden border-r border-white/10 bg-slate-950/35 p-4 md:block">
          <div className="mb-5 rounded-2xl border border-blue-400/20 bg-blue-500/[0.08] p-4">
            <div className="flex items-center gap-2 text-blue-100">
              <ClipboardList size={17} />
              <p className="text-[11px] font-black uppercase tracking-[0.18em]">Avancement</p>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <p className="text-4xl font-black text-white">{progress.percent}%</p>
              <p className="pb-1 text-right text-[11px] font-bold leading-snug text-slate-400">
                {progress.filled}/{progress.total}<br />renseignes
              </p>
            </div>
            <div className="mt-4 h-2.5 rounded-full bg-slate-950/70">
              <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="mt-3 text-[11px] font-semibold text-slate-400">
              {validationIssues.length ? `${validationIssues.length} action(s) restante(s)` : 'Tous les champs visibles sont complets'}
            </p>
          </div>

          <div className="mb-5">
            {renderSubmissionHistory()}
          </div>
          {queueItems.length > 0 ? (
            <div className="mb-5">
              {renderLocalQueue()}
            </div>
          ) : null}

          <div className="space-y-2">
            {navigableSections.map((section) => {
              const status = getSectionStatus(section);
              const isActive = activeSection?.id === section.id;
              const inactiveStatusClass = section.locked
                ? 'border-white/5 bg-white/[0.02] text-slate-600'
                : 'border-white/8 bg-white/[0.025] text-slate-500';
              return (
                <button
                  key={section.id}
                  type="button"
                  disabled={section.locked}
                  onClick={() => {
                    if (!section.locked) setActiveSectionId(section.id);
                  }}
                  aria-disabled={section.locked}
                  className={`relative w-full overflow-hidden rounded-2xl border p-3 text-left transition-all ${
                    isActive
                      ? 'border-blue-300/70 bg-blue-500/18 text-white shadow-lg shadow-blue-500/10 ring-1 ring-blue-300/25'
                      : section.locked
                        ? 'cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-600 opacity-45 grayscale'
                        : 'border-white/8 bg-white/[0.025] text-slate-500 opacity-50 grayscale hover:opacity-75 hover:grayscale-0'
                  }`}
                >
                  {isActive ? <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-blue-300 shadow-[0_0_18px_rgba(96,165,250,0.9)]" /> : null}
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className={`block truncate text-[12px] font-black uppercase tracking-[0.1em] ${isActive ? 'text-white' : 'text-slate-500'}`}>
                        {section.title}
                      </span>
                      <span className={`mt-1 block truncate text-[10px] font-semibold ${isActive ? 'text-blue-100/80' : 'text-slate-600'}`}>
                        {isActive ? 'Etape choisie - saisie en cours' : status.detail}
                      </span>
                    </span>
                    <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${isActive ? 'border-blue-200/45 bg-blue-300/18 text-blue-50' : inactiveStatusClass}`}>
                      {isActive ? <CheckCircle2 size={13} /> : status.icon}
                      {isActive ? 'Etape active' : status.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="flex min-h-0 flex-col">
          <header className="shrink-0 border-b border-blue-300/15 bg-[#0A1830] p-4 shadow-[inset_0_-1px_0_rgba(96,165,250,0.08)] sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-300">Saisie terrain VPS</p>
                <h3 className="mt-1 truncate text-xl font-black uppercase tracking-tight text-white sm:text-2xl">
                  Formulaire du menage
                </h3>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <p className="min-w-0 truncate text-[12px] font-semibold text-slate-300">
                    {numeroOrdre ? `Numero ordre ${numeroOrdre}` : 'Renseignez le numero ordre'}{selectedRole ? ` - ${formatInternalKoboValue(selectedRole, 'roles')}` : ''}
                  </p>
                  <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] sm:hidden ${requiredStatusClass}`}>
                    {requiredStatusText}
                  </span>
                  {queueCount > 0 ? (
                    <span className="inline-flex shrink-0 rounded-full border border-sky-300/30 bg-sky-400/12 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-sky-100">
                      {queueCount} local
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"
                aria-label="Fermer le formulaire Kobo interne"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 hidden grid-cols-1 gap-3 sm:mt-4 sm:grid sm:grid-cols-[1fr_auto_auto]">
              <div className="hidden h-12 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/45 px-3 sm:flex">
                <Search size={15} className="text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher une question..."
                  className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-white outline-none placeholder:text-slate-600"
                />
              </div>
              <div className={`rounded-2xl border px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.13em] sm:flex sm:items-center ${requiredStatusClass}`}>
                {validationIssues.length ? `${validationIssues.length} a corriger` : 'Pret a soumettre'}
              </div>
              {queueCount > 0 ? (
                <div className="rounded-2xl border border-sky-300/25 bg-sky-400/10 px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.13em] text-sky-100 sm:flex sm:items-center">
                  {queueCount} en attente locale
                </div>
              ) : null}
            </div>

            {queueCount > 0 && !isOnline ? (
              <div className="mt-3 rounded-2xl border border-sky-300/25 bg-sky-400/10 px-4 py-3 text-[11px] font-bold text-sky-100">
                Mode hors-ligne: les saisies sont gardees sur cet appareil et seront envoyees au retour du reseau.
              </div>
            ) : null}

            {serverFormStatus.status === 'mismatch' ? (
              <div className="mt-3 hidden rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-[11px] font-bold text-amber-100 sm:block">
                Version XLSForm a verifier: locale {INTERNAL_KOBO_FORM_SETTINGS.version}, VPS {serverFormStatus.version || 'inconnue'}.
              </div>
            ) : null}

            {serverFormStatus.status === 'error' && isOnline ? (
              <div className="mt-3 hidden rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-[11px] font-bold text-rose-100 sm:block">
                Controle de version VPS indisponible: la saisie reste possible, la validation serveur tranchera a l'envoi.
              </div>
            ) : null}

            {localDraft ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-300/20 bg-blue-400/10 px-4 py-3 text-[11px] font-bold text-blue-100">
                <span>
                  Brouillon local sauvegarde - {formatHistoryDate(localDraft.updatedAt)}
                </span>
                {onClearLocalDraft ? (
                  <button
                    type="button"
                    onClick={onClearLocalDraft}
                    className="rounded-full border border-blue-200/25 bg-blue-200/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-blue-50 hover:bg-blue-200/18"
                  >
                    Effacer
                  </button>
                ) : null}
              </div>
            ) : null}

            {householdLookup.message ? (
              <div className={`mt-3 rounded-2xl border px-4 py-3 text-[11px] font-bold ${
                householdLookup.status === 'found'
                  ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
                  : householdLookup.status === 'loading'
                    ? 'border-blue-400/25 bg-blue-500/10 text-blue-100'
                    : 'border-rose-400/25 bg-rose-500/10 text-rose-100'
              }`}>
                {householdLookup.message}
              </div>
            ) : null}

            {!selectedRole ? (
              <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-[11px] font-bold text-amber-100">
                Passage obligatoire: choisissez d'abord le role dans Menage pour activer le formulaire metier correspondant.
              </div>
            ) : null}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#0E1B2D] p-4 custom-scrollbar sm:p-5">
            <div className="mb-4 md:hidden">
              <select
                value={activeSection?.id || ''}
                onChange={(event) => setActiveSectionId(event.target.value)}
                className="h-12 w-full rounded-2xl border border-blue-300/25 bg-[#0B1728] px-4 text-[12px] font-black uppercase tracking-[0.1em] text-white outline-none"
              >
                {mobileSectionOptions.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
                ))}
              </select>
              <div className="mt-3">
                {renderSubmissionHistory(true)}
              </div>
              {queueItems.length > 0 ? (
                <div className="mt-3">
                  {renderLocalQueue(true)}
                </div>
              ) : null}
            </div>

            {renderValidationAssistant()}

            {activeSection ? (
              <section className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">{activeSection.title}</h4>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">{activeSection.subtitle}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${getSectionStatus(activeSection).className}`}>
                      {activeSection.missingFields.length ? `${activeSection.missingFields.length} a completer` : 'Section complete'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {activeSection.fields.length ? (
                    activeSection.fields.map(renderField)
                  ) : (
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-6 text-center">
                      <p className="text-sm font-black text-white">Aucun champ actif pour ce role.</p>
                      <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
                        Changez le role dans Menage pour remplir cette etape, ou utilisez-la comme consultation.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-8 text-center text-sm font-semibold text-slate-400">
                Aucun champ visible pour cette recherche.
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-blue-300/12 bg-[#0A1830] p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.6fr]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="h-[52px] rounded-2xl border border-white/10 bg-white/[0.045] text-[11px] font-black uppercase tracking-[0.16em] text-slate-300 transition-colors hover:bg-white/[0.08] disabled:opacity-50"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handlePrimarySave}
                disabled={isSaving}
                className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-blue-600 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-xl shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-95 disabled:opacity-50"
              >
                <Database size={16} />
                {isSaving ? 'Enregistrement...' : validationIssues.length ? 'Enregistrer brouillon' : 'Soumettre au serveur'}
              </button>
            </div>
          </footer>
        </main>

        {isSubmitReviewOpen ? (
          <div className="absolute inset-0 z-30 flex items-end justify-center bg-slate-950/72 p-3 backdrop-blur-sm sm:items-center sm:p-6">
            <div className="w-full max-w-lg rounded-[1.5rem] border border-emerald-300/20 bg-[#0B1728] p-5 shadow-2xl shadow-emerald-950/30">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">Revue finale</p>
                  <h4 className="mt-2 text-xl font-black uppercase tracking-tight text-white">Soumettre au VPS</h4>
                  <p className="mt-2 text-[12px] font-semibold leading-relaxed text-slate-300">
                    Cette fiche est complete. Confirmez l'envoi final vers le serveur GEM.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSubmitReviewOpen(false)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"
                  aria-label="Fermer la revue finale"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Menage</p>
                  <p className="mt-1 truncate text-sm font-black text-white">{numeroOrdre || 'Non renseigne'}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Role</p>
                  <p className="mt-1 truncate text-sm font-black text-white">{formatInternalKoboValue(selectedRole || 'role non defini', 'roles')}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Progression</p>
                  <p className="mt-1 text-sm font-black text-white">{progress.filled}/{progress.total} champs</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Version XLSForm</p>
                  <p className="mt-1 truncate text-sm font-black text-white">v{INTERNAL_KOBO_FORM_SETTINGS.version}</p>
                  {serverFormStatus.version ? (
                    <p className={`mt-1 truncate text-[10px] font-bold ${
                      serverFormStatus.status === 'mismatch' ? 'text-amber-200' : 'text-emerald-200'
                    }`}>
                      VPS {serverFormStatus.version}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-300/18 bg-emerald-400/[0.07] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">Sections pretes</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {navigableSections
                    .filter((section) => !section.locked && section.activeFields.length > 0)
                    .map((section) => (
                      <span key={section.id} className="rounded-full border border-emerald-200/20 bg-emerald-200/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-emerald-50">
                        {section.title}
                      </span>
                    ))}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.3fr]">
                <button
                  type="button"
                  onClick={() => setIsSubmitReviewOpen(false)}
                  disabled={isSaving}
                  className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] text-[10px] font-black uppercase tracking-[0.14em] text-slate-300 hover:bg-white/[0.08] disabled:opacity-50"
                >
                  Revoir
                </button>
                <button
                  type="button"
                  onClick={confirmFinalSubmission}
                  disabled={isSaving}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-[10px] font-black uppercase tracking-[0.14em] text-slate-950 shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
                >
                  <Database size={15} />
                  Confirmer l'envoi VPS
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {renderReceiptModal()}
      </div>
    </div>
  );
};
