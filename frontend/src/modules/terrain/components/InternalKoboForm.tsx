import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Copy,
  Database,
  Download,
  FileUp,
  ImagePlus,
  Loader2,
  Lock,
  LockKeyhole,
  MapPin,
  Minus,
  PenTool,
  Plus,
  RefreshCcw,
  Search,
  X,
} from 'lucide-react';
import apiClient from '@/api/client';
import SignatureModal from '@components/common/SignatureModal';
import { HistoryPanel } from './internal-kobo-form/HistoryPanel';
import { LocalQueuePanel } from './internal-kobo-form/LocalQueuePanel';
import { ValidationAssistantPanel, type RuntimeIssueView } from './internal-kobo-form/ValidationAssistantPanel';
import { ReceiptModal } from './internal-kobo-form/ReceiptModal';
import { useKoboFormLogic } from './hooks/useKoboFormLogic';
import {
  fetchInternalKoboFormDefinition,
  fetchInternalKoboImportedFormDefinition,
  type InternalKoboImportedFormSummary,
} from '@services/internalKoboSubmissionService';
import type {
  InternalKoboAttachment,
  InternalKoboLocalDraft,
  InternalKoboQueuedSubmission,
  InternalKoboSubmissionRecord,
} from '@services/internalKoboSubmissionService';
import {
  formatInternalGemValue,
  getInternalGemFieldValue,
  getVisibleInternalGemFields,
  hasInternalGemRequiredValue,
  hasInternalGemValue,
  INTERNAL_GED_OS_CHOICES,
  INTERNAL_GED_OS_FORM_SETTINGS,
  INTERNAL_GED_OS_SECTIONS,
  isInternalGemFieldVisible,
  isTruthyGemValue,
  validateInternalGemFields,
} from './internalKoboFormDefinition';
import type { InternalGemField } from './internalKoboFormDefinition';
import {
  applyXlsFormRuntimeCalculations,
  buildXlsFormRuntimePages,
  getFilteredXlsFormRuntimeChoices,
  getXlsFormRuntimeFieldValue,
  hasXlsFormRuntimeValue,
  isRecord as isXlsFormRecord,
  isXlsFormRuntimeFieldVisible,
  validateXlsFormRuntime,
  type XlsFormDefinition,
  type XlsFormField,
  type XlsFormPage,
  type XlsFormRuntimeIssue,
} from './xlsFormMobileRuntime';
import {
  asArray,
  getClientCollectionMetadata,
  getImagePreviewSource,
  getRuntimeFieldAccept,
  getRuntimeFieldCapture,
  getRuntimeFieldInputType,
  hashFileSha256,
  maxPixelsFromParameters,
  fileToDataUrl,
  submissionStatusClass,
  submissionStatusLabel,
  queueStatusClass,
  queueStatusLabel,
  formatMetadataLabel,
} from './internal-kobo-form/utils';
import {
  ROLE_SECTION_BY_VALUE,
  GEM_RUNTIME_MEDIA_TYPES,
  GEM_RUNTIME_FILLABLE_SKIP_TYPES,
} from './internal-kobo-form/constants';
import { stringifyHouseholdValue } from '@utils/householdDisplay';

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
  initialFormKey?: string;
  hideFormSelector?: boolean;
  inline?: boolean;
};



type RepeatContext = {
  repeatName: string;
  repeatIndex: number;
  instance: Record<string, unknown>;
};

type SignatureTarget = {
  field: XlsFormField;
  repeatContext?: RepeatContext;
};

type ProgressItem = {
  name: string;
  label: string;
  pageTitle?: string;
  filled: boolean;
};

type ProgressSummary = {
  filled: number;
  total: number;
  percent: number;
  items: ProgressItem[];
  missingItems: ProgressItem[];
};

const progressFor = (values: Record<string, unknown>): ProgressSummary => {
  const visibleFields = getVisibleInternalGemFields(values).filter((field) => !field.readOnly && field.type !== 'note');
  const items = visibleFields.map((field) => ({
    name: field.name,
    label: field.label || field.name,
    filled: hasInternalGemRequiredValue(field, values),
  }));
  const filled = items.filter((item) => item.filled).length;
  return {
    filled,
    total: visibleFields.length,
    percent: visibleFields.length ? Math.round((filled / visibleFields.length) * 100) : 0,
    items,
    missingItems: items.filter((item) => !item.filled),
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

const isRuntimeDefinition = (value: unknown): value is XlsFormDefinition =>
  isXlsFormRecord(value) &&
  (value.engine === 'gem-xlsform-universal' || value.engine === 'ged-os-xlsform-universal') &&
  typeof value.formKey === 'string' &&
  typeof value.formVersion === 'string';

const isDeployedImportedForm = (form: InternalKoboImportedFormSummary) =>
  form.active !== false && form.status !== 'draft' && form.status !== 'inactive';

const pickActiveImportedForm = (forms: InternalKoboImportedFormSummary[] = []) =>
  forms.find(isDeployedImportedForm) || null;

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const makeAttachmentId = () =>
  globalThis.crypto?.randomUUID?.() || `attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getAttachmentMeta = (values: Record<string, unknown>, fieldName: string): InternalKoboAttachment | null => {
  const value = values[`_ged_os_attachment_${fieldName}`] || values[`_ged_os_attachment_${fieldName}`];
  return isRecord(value) ? (value as InternalKoboAttachment) : null;
};

const normalizeAutofillFieldName = (value: string) =>
  String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

const hasAutofillValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
};

const NUMERO_ORDRE_FIELD_ALIASES = [
  'Numero_ordre',
  'TYPE_DE_VISITE/Numero_ordre',
  'TYPE_DE_VISITE/numero_ordre',
  'Numero ordre',
  'numero_ordre',
  'numeroOrdre',
  'numeroordre',
  'ID_MENAGE',
  'id_menage',
  'numero',
  'code_key',
  'CODE_KEY',
  'order_number',
];

const NUMERO_ORDRE_WRITE_FIELD_ALIASES = [
  'Numero_ordre',
  'TYPE_DE_VISITE/Numero_ordre',
  'TYPE_DE_VISITE/numero_ordre',
  'Numero ordre',
  'numero_ordre',
  'numeroordre',
  'ID_MENAGE',
  'id_menage',
  'numero',
  'code_key',
  'order_number',
];

const AUTOFILL_FIELD_ALIASES: Record<string, string[]> = {
  nom_key: ['TYPE_DE_VISITE/nom_key', 'C1', 'nom', 'name', 'nom_prenom', 'nom_du_menage', 'beneficiaire'],
  telephone_key: ['TYPE_DE_VISITE/telephone_key', 'C3', 'telephone', 'phone', 'tel', 'owner.phone', 'contact_phone'],
  latitude_key: ['TYPE_DE_VISITE/latitude_key', 'C2', 'latitude', 'lat', 'gps_latitude'],
  longitude_key: ['TYPE_DE_VISITE/longitude_key', 'C4', 'longitude', 'lon', 'lng', 'long', 'gps_longitude'],
  region_key: ['TYPE_DE_VISITE/region_key', 'C5', 'region', 'Region', 'REGION', 'nom_region'],
  LOCALISATION_CLIENT: ['TYPE_DE_VISITE/LOCALISATION_CLIENT', 'GPS_du_M_nage', 'Lieu_du_M_nage'],
};

const AUTOFILL_WRITE_FIELD_ALIASES: Record<string, string[]> = {
  nom_key: ['TYPE_DE_VISITE/nom_key', 'C1'],
  telephone_key: ['TYPE_DE_VISITE/telephone_key', 'C3'],
  latitude_key: ['TYPE_DE_VISITE/latitude_key', 'C2'],
  longitude_key: ['TYPE_DE_VISITE/longitude_key', 'C4'],
  region_key: ['TYPE_DE_VISITE/region_key', 'C5'],
  LOCALISATION_CLIENT: ['TYPE_DE_VISITE/LOCALISATION_CLIENT', 'GPS_du_M_nage'],
};

const getRuntimeFieldNamesMatchingAliases = (
  fields: XlsFormField[] | undefined,
  aliases: string[]
) => {
  if (!fields?.length) return [];
  const normalizedAliases = new Set(aliases.map(normalizeAutofillFieldName));
  return fields
    .filter((field) => {
      const fieldName = normalizeAutofillFieldName(field.name);
      const fieldPath = field.groupPath ? normalizeAutofillFieldName(`${field.groupPath}/${field.name}`) : '';
      return normalizedAliases.has(fieldName) || Boolean(fieldPath && normalizedAliases.has(fieldPath));
    })
    .map((field) => field.name);
};

const getAliasedRecordValue = (record: unknown, aliases: string[]) => {
  if (!isRecord(record)) return '';

  for (const alias of aliases) {
    const value = record[alias];
    if (hasAutofillValue(value)) return stringifyHouseholdValue(value);
  }

  const normalizedAliases = new Set(aliases.map(normalizeAutofillFieldName));
  const match = Object.entries(record).find(([key, value]) =>
    normalizedAliases.has(normalizeAutofillFieldName(key)) && hasAutofillValue(value)
  );

  return match ? stringifyHouseholdValue(match[1]) : '';
};

const getFormValueByAliases = (
  values: Record<string, unknown>,
  aliases: string[],
  fields?: XlsFormField[]
) => {
  const runtimeFieldNames = getRuntimeFieldNamesMatchingAliases(fields, aliases);
  return getAliasedRecordValue(values, [...runtimeFieldNames, ...aliases]);
};

const normalizeNumeroOrdreValue = (value: unknown) => {
  const normalized = stringifyHouseholdValue(value).trim();
  return normalized.endsWith('.0') ? normalized.slice(0, -2) : normalized;
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
  initialFormKey,
  hideFormSelector = false,
  inline = false,
}) => {
  const [activeSectionId, setActiveSectionId] = useState(INTERNAL_GED_OS_SECTIONS[0]?.id || '');
  const [query, setQuery] = useState('');
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [locatingField, setLocatingField] = useState<string | null>(null);
  const [locationError, setLocationError] = useState('');
  const [isSubmitReviewOpen, setIsSubmitReviewOpen] = useState(false);
  const [xlsFormDefinition, setXlsFormDefinition] = useState<XlsFormDefinition | null>(null);
  const [pendingRuntimeDefinition, setPendingRuntimeDefinition] = useState<XlsFormDefinition | null>(null);
  const [activeRuntimePageId, setActiveRuntimePageId] = useState('');
  const [activeRepeatIndexByPage, setActiveRepeatIndexByPage] = useState<Record<string, number>>({});
  const [availableRuntimeForms, setAvailableRuntimeForms] = useState<InternalKoboImportedFormSummary[]>([]);
  const [selectedRuntimeFormKey, setSelectedRuntimeFormKey] = useState(() => {
    if (initialFormKey) return initialFormKey;
    const runtimeKey = String(values._ged_os_runtime_form_key || values._ged_os_runtime_form_key || '').trim();
    return runtimeKey && runtimeKey !== 'terrain_internal' ? runtimeKey : '';
  });
  const [isRuntimeFormListLoading, setIsRuntimeFormListLoading] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState<SignatureTarget | null>(null);
  const [receiptSubmission, setReceiptSubmission] = useState<InternalKoboSubmissionRecord | null>(null);
  const [copiedReceiptId, setCopiedReceiptId] = useState('');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [householdLookup, setHouseholdLookup] = useState<{
    status: 'idle' | 'loading' | 'found' | 'missing' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const [serverFormStatus, setServerFormStatus] = useState<{
    status: 'idle' | 'loading' | 'ok' | 'mismatch' | 'error';
    version?: string;
    message?: string;
    checkedAt?: string;
  }>({ status: 'idle' });
  const lastResolvedNumeroRef = useRef('');
  const onChangeRef = useRef(onChange);
  const onResolvedHouseholdRef = useRef(onResolvedHousehold);
  const resolveHouseholdByNumeroRef = useRef(resolveHouseholdByNumero);
  const collectionMetadata = useMemo(() => getClientCollectionMetadata(isOnline), [isOnline]);
  const normalizedQuery = query.trim().toLowerCase();
  const fieldLabelByName = useMemo(() => {
    const entries = INTERNAL_GED_OS_SECTIONS.flatMap((section) =>
      section.fields.map((field) => [field.name, field.label] as const)
    );
    return new Map(entries);
  }, []);
  const numeroOrdre = normalizeNumeroOrdreValue(
    getFormValueByAliases(values, NUMERO_ORDRE_FIELD_ALIASES, xlsFormDefinition?.fields)
  );
  const selectedRole = String(values.role || '').trim();
  const selectedRoleSectionId = ROLE_SECTION_BY_VALUE[selectedRole] || '';
  const lastAutoActivatedRoleRef = useRef('');
  const progressFilledRef = useRef(0);
  const applyRuntimeDefinition = useCallback((definition: XlsFormDefinition, title?: string) => {
    setXlsFormDefinition(definition);
    setPendingRuntimeDefinition(null);
    setActiveRuntimePageId('');
    onChangeRef.current('_ged_os_runtime_form_key', definition.formKey);
    onChangeRef.current('_ged_os_runtime_form_version', definition.formVersion);
    onChangeRef.current('_ged_os_runtime_engine', definition.engine || 'gem-xlsform-universal');
    onChangeRef.current('_ged_os_runtime_title', definition.title || title || definition.formKey);
    onChangeRef.current('_ged_os_runtime_checked_at', new Date().toISOString());
    setServerFormStatus({
      status: 'ok',
      version: definition.formVersion,
      message: `XLSForm actif: ${definition.title || title || definition.formKey}`,
      checkedAt: new Date().toISOString(),
    });
  }, []);
  const isDifferentRuntimeVersion = useCallback((definition: XlsFormDefinition) => {
    const currentKey = xlsFormDefinition?.formKey || String(values._ged_os_runtime_form_key || '');
    const currentVersion = xlsFormDefinition?.formVersion || String(values._ged_os_runtime_form_version || '');
    return Boolean(currentKey && currentKey !== 'terrain_internal') &&
      (currentKey !== definition.formKey || currentVersion !== definition.formVersion);
  }, [
    values._ged_os_runtime_form_key,
    values._ged_os_runtime_form_version,
    xlsFormDefinition?.formKey,
    xlsFormDefinition?.formVersion,
  ]);
  const migrateToPendingRuntimeDefinition = () => {
    if (!pendingRuntimeDefinition) return;
    const previousKey = xlsFormDefinition?.formKey || String(values._ged_os_runtime_form_key || values._ged_os_runtime_form_key || '');
    const previousVersion = xlsFormDefinition?.formVersion || String(values._ged_os_runtime_form_version || values._ged_os_runtime_form_version || '');
    onChangeRef.current('_ged_os_runtime_migrated_from_key', previousKey);
    onChangeRef.current('_ged_os_runtime_migrated_from_version', previousVersion);
    onChangeRef.current('_ged_os_runtime_migrated_to_version', pendingRuntimeDefinition.formVersion);
    onChangeRef.current('_ged_os_runtime_migration_mode', 'preserve-values-by-field-name');
    onChangeRef.current('_ged_os_runtime_migrated_at', new Date().toISOString());
    applyRuntimeDefinition(pendingRuntimeDefinition);
  };
  const {
    runtimeValues,
    runtimeAllPages,
    runtimePages,
    runtimeValidation,
    validationIssues,
    constraintIssues,
    missingRequired,
    runtimeCalculated,
  } = useKoboFormLogic(xlsFormDefinition, values, query);
  const progress = useMemo(() => {
    if (!xlsFormDefinition) return progressFor(values);
    const items: ProgressItem[] = [];
    runtimeAllPages.forEach((page) => {
      if (page.type === 'repeat' && page.repeatName) {
        const repeatValue = runtimeValues[page.repeatName];
        const instances = Array.isArray(repeatValue) ? repeatValue.filter(isRecord) : [];
        instances.forEach((instance, repeatIndex) => {
          page.allFields.forEach((field) => {
            if (GEM_RUNTIME_FILLABLE_SKIP_TYPES.has(field.type) || !isXlsFormRuntimeFieldVisible(field, runtimeValues, instance)) return;
            const value = getXlsFormRuntimeFieldValue(field, runtimeValues, instance);
            items.push({
              name: `${page.repeatName}.${repeatIndex}.${field.name}`,
              label: `${field.label || field.name} - ligne ${repeatIndex + 1}`,
              pageTitle: page.title,
              filled: hasXlsFormRuntimeValue(value),
            });
          });
        });
        return;
      }
      page.allFields.forEach((field) => {
        if (GEM_RUNTIME_FILLABLE_SKIP_TYPES.has(field.type) || !isXlsFormRuntimeFieldVisible(field, runtimeValues)) return;
        const value = getXlsFormRuntimeFieldValue(field, runtimeValues);
        items.push({
          name: field.name,
          label: field.label || field.name,
          pageTitle: page.title,
          filled: hasXlsFormRuntimeValue(value),
        });
      });
    });
    const filled = items.filter((item) => item.filled).length;
    return {
      filled,
      total: items.length,
      percent: items.length ? Math.round((filled / items.length) * 100) : 0,
      items,
      missingItems: items.filter((item) => !item.filled),
    };
  }, [runtimeAllPages, runtimeValues, values, xlsFormDefinition]);

  useEffect(() => {
    progressFilledRef.current = progress.filled;
  }, [progress.filled]);

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
    setIsRuntimeFormListLoading(true);
    setServerFormStatus((current) => current.status === 'ok' ? current : { status: 'loading' });

    (async () => {
      try {
        const form = await fetchInternalKoboFormDefinition();
        if (cancelled) return;
        if (!form) {
          setAvailableRuntimeForms([]);
          setSelectedRuntimeFormKey('');
          setServerFormStatus({ status: 'error', message: 'Definition VPS indisponible' });
          return;
        }

        const deployedForms = (form.universalEngine?.importedForms || []).filter(isDeployedImportedForm);
        setAvailableRuntimeForms(deployedForms);

        if (deployedForms.length > 0) {
          setSelectedRuntimeFormKey((current) => {
            if (current && deployedForms.some((item) => item.formKey === current)) return current;
            return deployedForms[0]?.formKey || '';
          });
          return;
        }

        setSelectedRuntimeFormKey('');
        setXlsFormDefinition(null);
        onChangeRef.current('_ged_os_runtime_form_key', 'terrain_internal');
        onChangeRef.current('_ged_os_runtime_form_version', INTERNAL_GED_OS_FORM_SETTINGS.version);
        onChangeRef.current('_ged_os_runtime_engine', 'gem-internal-kobo');
        onChangeRef.current('_ged_os_runtime_title', 'Formulaire terrain interne');
        setServerFormStatus({
          status: form.formVersion === INTERNAL_GED_OS_FORM_SETTINGS.version ? 'ok' : 'mismatch',
          version: form.formVersion,
          message:
            form.formVersion === INTERNAL_GED_OS_FORM_SETTINGS.version
              ? 'Version VPS verifiee'
              : `Version VPS ${form.formVersion}`,
          checkedAt: new Date().toISOString(),
        });
      } catch (error) {
        if (cancelled) return;
        setAvailableRuntimeForms([]);
        setSelectedRuntimeFormKey('');
        setXlsFormDefinition(null);
        setServerFormStatus({
          status: 'error',
          message: error instanceof Error ? error.message : 'Definition VPS indisponible',
        });
      } finally {
        if (!cancelled) setIsRuntimeFormListLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline || !selectedRuntimeFormKey) return undefined;

    const selectedSummary = availableRuntimeForms.find((form) => form.formKey === selectedRuntimeFormKey);
    if (!selectedSummary) return undefined;

    let cancelled = false;
    setServerFormStatus((current) => current.status === 'mismatch' ? current : { status: 'loading' });

    (async () => {
      try {
        const importedDefinition = await fetchInternalKoboImportedFormDefinition(selectedRuntimeFormKey);
        if (cancelled) return;
        if (!isRuntimeDefinition(importedDefinition)) {
          throw new Error('Definition XLSForm active invalide');
        }

        if (isDifferentRuntimeVersion(importedDefinition) && progressFilledRef.current > 0) {
          setPendingRuntimeDefinition(importedDefinition);
          setServerFormStatus({
            status: 'mismatch',
            version: importedDefinition.formVersion,
            message: `Nouvelle version disponible: ${importedDefinition.title || importedDefinition.formKey}`,
            checkedAt: new Date().toISOString(),
          });
          return;
        }

        applyRuntimeDefinition(importedDefinition, selectedSummary.title);
      } catch (error) {
        if (cancelled) return;
        setXlsFormDefinition(null);
        setServerFormStatus({
          status: 'error',
          message: error instanceof Error ? error.message : 'Definition VPS indisponible',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    applyRuntimeDefinition,
    availableRuntimeForms,
    isDifferentRuntimeVersion,
    isOnline,
    selectedRuntimeFormKey,
  ]);

  useEffect(() => {
    if (!isOnline) return undefined;

    let cancelled = false;
    const checkActiveVersion = async () => {
      try {
        const form = await fetchInternalKoboFormDefinition();
        if (cancelled) return;
        const deployedForms = form?.universalEngine?.importedForms || [];
        const activeImportedForm =
          deployedForms.find((entry) => entry.formKey === selectedRuntimeFormKey && isDeployedImportedForm(entry)) ||
          pickActiveImportedForm(deployedForms);
        if (!activeImportedForm?.formKey) return;
        const importedDefinition = await fetchInternalKoboImportedFormDefinition(activeImportedForm.formKey);
        if (cancelled || !isRuntimeDefinition(importedDefinition)) return;

        if (isDifferentRuntimeVersion(importedDefinition)) {
          setPendingRuntimeDefinition(importedDefinition);
          setServerFormStatus({
            status: 'mismatch',
            version: importedDefinition.formVersion,
            message: `Nouvelle version XLSForm detectee: ${importedDefinition.title || importedDefinition.formKey}`,
            checkedAt: new Date().toISOString(),
          });
        } else {
          setServerFormStatus((current) => ({
            ...current,
            status: current.status === 'error' ? 'ok' : current.status,
            version: importedDefinition.formVersion,
            checkedAt: new Date().toISOString(),
          }));
        }
      } catch {
        if (!cancelled) {
          setServerFormStatus((current) => ({
            ...current,
            status: current.status === 'mismatch' ? current.status : 'error',
            message: current.message || 'Controle de version VPS indisponible',
          }));
        }
      }
    };

    const intervalId = window.setInterval(checkActiveVersion, 90_000);
    const handleFocus = () => checkActiveVersion();
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isDifferentRuntimeVersion, isOnline, selectedRuntimeFormKey]);

  useEffect(() => {
    const now = new Date();
    const startValue = String(values.start || values._ged_os_session_started_at || now.toISOString());
    const nextMetadata: Record<string, unknown> = {
      ...collectionMetadata,
      start: startValue,
      today: values.today || now.toISOString().slice(0, 10),
      _ged_os_session_started_at: startValue,
    };

    Object.entries(nextMetadata).forEach(([key, value]) => {
      if (String(values[key] ?? '') !== String(value ?? '')) {
        onChangeRef.current(key, value);
      }
    });
  }, [collectionMetadata, values]);

  useEffect(() => {
    if (!xlsFormDefinition) return;
    (xlsFormDefinition.fields || []).forEach((field) => {
      if (field.repeatPath || !hasXlsFormRuntimeValue(field.defaultValue) || hasXlsFormRuntimeValue(values[field.name])) return;
      onChangeRef.current(field.name, field.defaultValue);
    });
    Object.entries(runtimeCalculated).forEach(([fieldName, value]) => {
      if (String(values[fieldName] ?? '') !== String(value ?? '')) {
        onChangeRef.current(fieldName, value);
      }
    });
  }, [runtimeCalculated, values, xlsFormDefinition]);

  useEffect(() => {
    if (!xlsFormDefinition || !runtimeValidation) return;
    const issues = runtimeValidation.issues.map((issue) => ({
      field: issue.field.name,
      type: issue.type,
      message: issue.message,
      pageId: issue.pageId || '',
      repeatName: issue.repeatName || '',
      repeatIndex: issue.repeatIndex ?? null,
    }));
    const nextMeta: Record<string, unknown> = {
      _ged_os_runtime_required_missing: runtimeValidation.requiredMissing,
      _ged_os_runtime_validation_issues: issues,
      _ged_os_runtime_ready: issues.length === 0,
      _ged_os_runtime_page_count: runtimeAllPages.length,
    };
    Object.entries(nextMeta).forEach(([key, value]) => {
      if (JSON.stringify(values[key] ?? null) !== JSON.stringify(value ?? null)) {
        onChangeRef.current(key, value);
      }
    });
  }, [runtimeAllPages.length, runtimeValidation, values, xlsFormDefinition]);

  useEffect(() => {
    if (!xlsFormDefinition || activeRuntimePageId) return;
    const firstPage = runtimeAllPages[0];
    if (firstPage) setActiveRuntimePageId(firstPage.id);
  }, [activeRuntimePageId, runtimeAllPages, xlsFormDefinition]);

  useEffect(() => {
    const startedAt = String(values._ged_os_session_started_at || values.start || '');
    if (!startedAt) return undefined;

    const updateDuration = () => {
      const startedTime = new Date(startedAt).getTime();
      if (Number.isNaN(startedTime)) return;
      const durationSeconds = Math.max(0, Math.round((Date.now() - startedTime) / 1000));
      onChangeRef.current('_ged_os_session_duration_s', String(durationSeconds));
    };

    updateDuration();
    const intervalId = window.setInterval(updateDuration, 15000);
    return () => window.clearInterval(intervalId);
  }, [values._ged_os_session_started_at, values.start]);

  useEffect(() => {
    if (!numeroOrdre) {
      setHouseholdLookup({ status: 'idle', message: '' });
      onResolvedHouseholdRef.current?.(null);
      return;
    }

    const writeValueToTargets = (targets: string[], value: unknown) => {
      const stringValue = String(value ?? '');
      Array.from(new Set(targets)).forEach((target) => {
        onChangeRef.current(target, stringValue);
      });
    };

    const writeAutofillValue = (fieldName: string, value: unknown) => {
      writeValueToTargets([fieldName, ...(AUTOFILL_WRITE_FIELD_ALIASES[fieldName] || [])], value);
    };

    writeValueToTargets(NUMERO_ORDRE_WRITE_FIELD_ALIASES, numeroOrdre);

    const timeoutId = window.setTimeout(async () => {
      if (lastResolvedNumeroRef.current === numeroOrdre) return;

      const applyResolvedHousehold = (household: Record<string, any>, source: 'server' | 'local') => {
        const coordinates = Array.isArray(household.location?.coordinates)
          ? household.location.coordinates
          : null;

        const koboData = household.koboData || {};
        const koboSync = household.koboSync || {};

        const longitude =
          getAliasedRecordValue(household, ['longitude', 'lon', 'lng', 'long']) ||
          stringifyHouseholdValue(coordinates?.[0]) ||
          getAliasedRecordValue(koboData, ['longitude_key', ...AUTOFILL_FIELD_ALIASES.longitude_key]) ||
          getAliasedRecordValue(koboSync, ['longitude_key', ...AUTOFILL_FIELD_ALIASES.longitude_key]);

        const latitude =
          getAliasedRecordValue(household, ['latitude', 'lat']) ||
          stringifyHouseholdValue(coordinates?.[1]) ||
          getAliasedRecordValue(koboData, ['latitude_key', ...AUTOFILL_FIELD_ALIASES.latitude_key]) ||
          getAliasedRecordValue(koboSync, ['latitude_key', ...AUTOFILL_FIELD_ALIASES.latitude_key]);

        const displayName =
          getAliasedRecordValue(household, ['name', 'nom', 'fullName', 'ownerName', 'beneficiaire']) ||
          stringifyHouseholdValue(household.owner) ||
          getAliasedRecordValue(koboData, ['nom_key', ...AUTOFILL_FIELD_ALIASES.nom_key]) ||
          getAliasedRecordValue(koboSync, ['nom_key', ...AUTOFILL_FIELD_ALIASES.nom_key]);

        const phone =
          getAliasedRecordValue(household, ['phone', 'ownerPhone', 'telephone', 'tel', 'contact_phone']) ||
          getAliasedRecordValue(household.owner, ['phone', 'telephone', 'tel', 'contact_phone']) ||
          getAliasedRecordValue(koboData, ['telephone_key', ...AUTOFILL_FIELD_ALIASES.telephone_key]) ||
          getAliasedRecordValue(koboSync, ['telephone_key', ...AUTOFILL_FIELD_ALIASES.telephone_key]);

        const region =
          getAliasedRecordValue(household, ['region', 'region_key', 'Region', 'REGION']) ||
          getAliasedRecordValue(koboData, ['region_key', ...AUTOFILL_FIELD_ALIASES.region_key]) ||
          getAliasedRecordValue(koboSync, ['region_key', ...AUTOFILL_FIELD_ALIASES.region_key]);

        const locationValue =
          latitude && longitude
            ? `${latitude} ${longitude}`
            : getAliasedRecordValue(koboData, ['LOCALISATION_CLIENT', ...AUTOFILL_FIELD_ALIASES.LOCALISATION_CLIENT]) ||
              getAliasedRecordValue(koboSync, ['LOCALISATION_CLIENT', ...AUTOFILL_FIELD_ALIASES.LOCALISATION_CLIENT]);

        writeAutofillValue('nom_key', displayName);
        writeAutofillValue('telephone_key', phone);
        writeAutofillValue('latitude_key', latitude);
        writeAutofillValue('longitude_key', longitude);
        writeAutofillValue('region_key', region);
        writeAutofillValue('LOCALISATION_CLIENT', locationValue);

        onChangeRef.current('_ged_os_pulldata_Thies', {
          code_key: numeroOrdre,
          nom: String(displayName),
          telephone: String(phone),
          latitude: String(latitude),
          longitude: String(longitude),
          region: String(region),
        });

        lastResolvedNumeroRef.current = numeroOrdre;
        onResolvedHouseholdRef.current?.(household);
        setHouseholdLookup({
          status: 'found',
          message:
            source === 'server'
              ? `Ménage trouvé sur le VPS: ${displayName || household.numeroordre || numeroOrdre}`
              : `Ménage trouvé localement: ${displayName || household.numeroordre || numeroOrdre}`,
        });
      };

      setHouseholdLookup({ status: 'loading', message: 'Recherche du ménage...' });
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
        const errorData = error?.response?.data;
        console.warn('[AUTO-FILL] API error:', status, errorData, error.message);
        onResolvedHouseholdRef.current?.(null);
        setHouseholdLookup({
          status: status === 404 ? 'missing' : 'error',
          message:
            status === 404
              ? `Aucun ménage trouvé pour le numéro ${numeroOrdre}`
              : status === 401
                ? 'Session expirée, reconnectez-vous'
                : `Recherche impossible (erreur ${status || 'réseau'})`,
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

  const navigableSections = useMemo(
    () =>
      INTERNAL_GED_OS_SECTIONS.map((section) => {
        const activeFields = section.fields.filter((field) => isInternalGemFieldVisible(field, values));
        const missingFields = activeFields.filter(
          (field) => field.required && !hasInternalGemRequiredValue(field, values)
        );
        return {
          ...section,
          activeFields,
          missingFields,
        };
      }),
    [values]
  );

  let previousBlockingSectionId = '';
  const sectionsWithLocks = navigableSections.map((section) => {
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

    if (!roleLocked && !sequenceLocked && section.missingFields.length > 0) {
      previousBlockingSectionId = section.id;
    }

    return {
      ...section,
      locked,
      lockedReason,
      blockedBySectionId,
    };
  });

  const activeSection =
    sectionsWithLocks.find((section) => section.id === activeSectionId && !section.locked) ||
    sectionsWithLocks.find((section) => section.id === selectedRoleSectionId && !section.locked) ||
    sectionsWithLocks.find((section) => !section.locked) ||
    sectionsWithLocks[0];
  const mobileSectionOptions = sectionsWithLocks.filter((section) => !section.locked);
  let previousBlockingRuntimePageId = '';
  const runtimePageStates = runtimeAllPages.map((page) => {
    const activeFields = page.allFields.filter((field) => {
      if (GEM_RUNTIME_FILLABLE_SKIP_TYPES.has(field.type)) return false;
      if (page.type === 'repeat') return true;
      return isXlsFormRuntimeFieldVisible(field, runtimeValues);
    });
    const missingFields = (runtimeValidation?.issues || [])
      .filter((issue) => issue.type === 'required' && issue.pageId === page.id)
      .map((issue) => issue.field);
    const sequenceLocked = Boolean(previousBlockingRuntimePageId && activeFields.length > 0);

    if (!sequenceLocked && missingFields.length > 0) {
      previousBlockingRuntimePageId = page.id;
    }

    return {
      ...page,
      activeFields,
      missingFields,
      locked: sequenceLocked,
      lockedReason: sequenceLocked ? 'sequence' : '',
      blockedByPageId: sequenceLocked ? previousBlockingRuntimePageId : '',
      fields: (runtimePages.find((item) => item.id === page.id)?.fields || page.fields).filter((field) => {
        if (!normalizedQuery) return true;
        return `${field.label || ''} ${field.name}`.toLowerCase().includes(normalizedQuery);
      }),
    };
  });
  const runtimeNavigablePages = runtimePageStates.filter((page) => {
    if (!normalizedQuery) return page.activeFields.length > 0 || page.type === 'repeat';
    return page.fields.length > 0 || `${page.title} ${page.subtitle}`.toLowerCase().includes(normalizedQuery);
  });
  const activeRuntimePage =
    runtimeNavigablePages.find((page) => page.id === activeRuntimePageId && !page.locked) ||
    runtimeNavigablePages.find((page) => !page.locked) ||
    runtimeNavigablePages[0];
  const mobileRuntimePageOptions = runtimeNavigablePages.filter((page) => !page.locked);
  const validationIssueDetails = validationIssues.map((issue) => {
    if (xlsFormDefinition) {
      const runtimePage = runtimeNavigablePages.find((item) => item.id === issue.runtimeIssue?.pageId) ||
        runtimeNavigablePages.find((item) => item.activeFields.some((pageField) => pageField.name === issue.field.name));
      return { ...issue, section: undefined, runtimePage };
    }

    const section = sectionsWithLocks.find((item) =>
      item.activeFields.some((sectionField) => sectionField.name === issue.field.name)
    );
    return { ...issue, section, runtimePage: undefined };
  });
  const firstActionableIssue = validationIssueDetails.find(
    (item) => (item.section && !item.section.locked) || (item.runtimePage && !item.runtimePage.locked)
  );
  const requiredStatusText = validationIssues.length ? `${validationIssues.length} a corriger` : 'Pret';
  const requiredStatusClass = validationIssues.length
    ? 'border-amber-400/35 bg-amber-400/12 text-amber-100'
    : 'border-emerald-400/30 bg-emerald-400/12 text-emerald-100';
  const progressMissingPreview = progress.missingItems.slice(0, 4);
  const progressHiddenMissingCount = Math.max(0, progress.missingItems.length - progressMissingPreview.length);

  const blockedByTitle = (sectionId: string) =>
    sectionsWithLocks.find((section) => section.id === sectionId)?.title || 'l etape precedente';

  const blockedByRuntimeTitle = (pageId: string) =>
    runtimeNavigablePages.find((page) => page.id === pageId)?.title || 'l etape precedente';

  const getSectionStatus = (section: typeof sectionsWithLocks[number]) => {
    const fillableCount = section.activeFields.filter((field) => field.type !== 'note' && !field.readOnly).length;
    if (section.locked) {
      const isRoleLock = section.lockedReason === 'role';
      return {
        label: isRoleLock ? 'Non concerne' : 'Verrouille',
        detail: isRoleLock
          ? `Role actif: ${formatInternalGemValue(selectedRole, 'roles')}`
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

  const getRuntimePageStatus = (page: typeof runtimeNavigablePages[number]) => {
    const fillableCount = page.activeFields.length;
    if (page.locked) {
      return {
        label: 'Verrouille',
        detail: `Terminer ${blockedByRuntimeTitle(page.blockedByPageId)}`,
        className: 'border-white/5 bg-white/[0.02] text-slate-600',
        icon: <LockKeyhole size={13} />,
      };
    }
    if (page.missingFields.length > 0) {
      return {
        label: `${page.missingFields.length} requis`,
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

  const focusRequiredField = (fieldName: string, sectionId?: string, runtimePageId?: string) => {
    if (runtimePageId) setActiveRuntimePageId(runtimePageId);
    else if (sectionId) setActiveSectionId(sectionId);
    window.setTimeout(() => {
      document.getElementById(`internal-kobo-field-${fieldName}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 120);
  };

  const handlePrimarySave = () => {
    if (validationIssues.length === 0) {
      if (pendingRuntimeDefinition) {
        setServerFormStatus({
          status: 'mismatch',
          version: pendingRuntimeDefinition.formVersion,
          message: 'Soumission finale bloquee: migrez vers la version XLSForm active avant envoi.',
          checkedAt: new Date().toISOString(),
        });
        return;
      }
      setIsSubmitReviewOpen(true);
      return;
    }
    onSave();
  };

  const confirmFinalSubmission = () => {
    if (pendingRuntimeDefinition) {
      setIsSubmitReviewOpen(false);
      setServerFormStatus({
        status: 'mismatch',
        version: pendingRuntimeDefinition.formVersion,
        message: 'Soumission finale bloquee: migrez vers la version XLSForm active avant envoi.',
        checkedAt: new Date().toISOString(),
      });
      return;
    }
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

  const setOption = (field: InternalGemField, optionName: string) => {
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

  const handleFile = async (field: InternalGemField, file?: File) => {
    if (!file) return;
    setUploadingField(field.name);
    try {
      const maxPixels = maxPixelsFromParameters(field.parameters);
      const uploadFile = maxPixels ? await compressImage(file, { maxWidth: maxPixels, maxHeight: maxPixels }) : file;
      const capturedAt = new Date().toISOString();
      const dataUrl = await fileToDataUrl(uploadFile);
      const sha256 = await hashFileSha256(uploadFile);
      const baseAttachment: InternalKoboAttachment = {
        id: makeAttachmentId(),
        fieldName: field.name,
        fieldCode: field.name,
        valuePath: [field.name],
        fileName: file.name,
        mimeType: file.type || uploadFile.type || 'image/jpeg',
        originalBytes: file.size,
        storedBytes: uploadFile.size,
        sha256,
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
      onChange(`_ged_os_attachment_${field.name}`, attachment);
      onChange(`_ged_os_photo_${field.name}_original_name`, file.name);
      onChange(`_ged_os_photo_${field.name}_mime`, attachment.mimeType || '');
      onChange(`_ged_os_photo_${field.name}_original_bytes`, String(file.size));
      onChange(`_ged_os_photo_${field.name}_stored_bytes`, String(uploadFile.size));
      onChange(`_ged_os_photo_${field.name}_compressed`, String(uploadFile.size < file.size));
      onChange(`_ged_os_photo_${field.name}_storage`, attachment.storage || '');
      onChange(`_ged_os_photo_${field.name}_captured_at`, capturedAt);
    } finally {
      setUploadingField(null);
    }
  };

  const clearFile = (field: InternalGemField) => {
    onChange(field.name, '');
    onChange(`_ged_os_attachment_${field.name}`, '');
    onChange(`_ged_os_photo_${field.name}_original_name`, '');
    onChange(`_ged_os_photo_${field.name}_mime`, '');
    onChange(`_ged_os_photo_${field.name}_original_bytes`, '');
    onChange(`_ged_os_photo_${field.name}_stored_bytes`, '');
    onChange(`_ged_os_photo_${field.name}_compressed`, '');
    onChange(`_ged_os_photo_${field.name}_storage`, '');
    onChange(`_ged_os_photo_${field.name}_captured_at`, '');
  };

  const getRepeatInstances = (repeatName: string): Record<string, unknown>[] => {
    const current = values[repeatName];
    return Array.isArray(current) ? current.filter(isRecord).map((entry) => ({ ...entry })) : [];
  };

  const updateRuntimeField = (field: XlsFormField, value: unknown, repeatContext?: RepeatContext) => {
    if (!repeatContext) {
      onChange(field.name, value);
      return;
    }

    const instances = getRepeatInstances(repeatContext.repeatName);
    const nextInstances = instances.length > 0 ? instances : [{}];
    nextInstances[repeatContext.repeatIndex] = {
      ...(nextInstances[repeatContext.repeatIndex] || {}),
      [field.name]: value,
    };
    onChange(repeatContext.repeatName, nextInstances);
  };

  const setRuntimeOption = (field: XlsFormField, optionName: string, repeatContext?: RepeatContext) => {
    const value = getXlsFormRuntimeFieldValue(field, runtimeValues, repeatContext?.instance);
    if (field.type === 'select_multiple' || field.type === 'rank') {
      const current = new Set(asArray(value));
      if (current.has(optionName)) current.delete(optionName);
      else current.add(optionName);
      updateRuntimeField(field, Array.from(current), repeatContext);
      return;
    }

    updateRuntimeField(field, optionName, repeatContext);
    if (field.name === 'role' && !xlsFormDefinition) {
      const targetSectionId = ROLE_SECTION_BY_VALUE[optionName];
      if (targetSectionId) {
        lastAutoActivatedRoleRef.current = optionName;
        setActiveSectionId(targetSectionId);
      }
    }
  };

  const getRuntimeAttachmentKey = (field: XlsFormField, repeatContext?: RepeatContext) =>
    repeatContext ? `${repeatContext.repeatName}_${repeatContext.repeatIndex}_${field.name}` : field.name;

  const handleRuntimeFile = async (field: XlsFormField, file?: File, repeatContext?: RepeatContext) => {
    if (!file) return;
    const attachmentKey = getRuntimeAttachmentKey(field, repeatContext);
    setUploadingField(attachmentKey);
    try {
      const shouldCompress = field.type === 'image' || field.type === 'signature';
      const maxPixels = shouldCompress ? maxPixelsFromParameters(field.parameters) : undefined;
      const uploadFile = maxPixels ? await compressImage(file, { maxWidth: maxPixels, maxHeight: maxPixels }) : file;
      const capturedAt = new Date().toISOString();
      const dataUrl = await fileToDataUrl(uploadFile);
      const sha256 = await hashFileSha256(uploadFile);
      const baseAttachment: InternalKoboAttachment = {
        id: makeAttachmentId(),
        fieldName: attachmentKey,
        fieldCode: field.name,
        valuePath: repeatContext ? [repeatContext.repeatName, repeatContext.repeatIndex, field.name] : [field.name],
        fileName: file.name,
        mimeType: file.type || uploadFile.type || 'application/octet-stream',
        originalBytes: file.size,
        storedBytes: uploadFile.size,
        sha256,
        capturedAt,
        source: repeatContext ? 'gem-xlsform-repeat-runtime' : 'gem-xlsform-runtime',
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

      updateRuntimeField(field, fieldValue, repeatContext);
      onChange(`_ged_os_attachment_${attachmentKey}`, attachment);
      onChange(`_ged_os_photo_${attachmentKey}_original_name`, file.name);
      onChange(`_ged_os_photo_${attachmentKey}_mime`, attachment.mimeType || '');
      onChange(`_ged_os_photo_${attachmentKey}_original_bytes`, String(file.size));
      onChange(`_ged_os_photo_${attachmentKey}_stored_bytes`, String(uploadFile.size));
      onChange(`_ged_os_photo_${attachmentKey}_compressed`, String(uploadFile.size < file.size));
      onChange(`_ged_os_photo_${attachmentKey}_storage`, attachment.storage || '');
      onChange(`_ged_os_photo_${attachmentKey}_captured_at`, capturedAt);
    } finally {
      setUploadingField(null);
    }
  };

  const clearRuntimeFile = (field: XlsFormField, repeatContext?: RepeatContext) => {
    const attachmentKey = getRuntimeAttachmentKey(field, repeatContext);
    updateRuntimeField(field, '', repeatContext);
    onChange(`_ged_os_attachment_${attachmentKey}`, '');
    onChange(`_ged_os_photo_${attachmentKey}_original_name`, '');
    onChange(`_ged_os_photo_${attachmentKey}_mime`, '');
    onChange(`_ged_os_photo_${attachmentKey}_original_bytes`, '');
    onChange(`_ged_os_photo_${attachmentKey}_stored_bytes`, '');
    onChange(`_ged_os_photo_${attachmentKey}_compressed`, '');
    onChange(`_ged_os_photo_${attachmentKey}_storage`, '');
    onChange(`_ged_os_photo_${attachmentKey}_captured_at`, '');
  };

  const addRepeatInstance = (page: XlsFormPage) => {
    if (!page.repeatName) return;
    const instances = getRepeatInstances(page.repeatName);
    const nextIndex = instances.length;
    onChange(page.repeatName, [...instances, {}]);
    setActiveRepeatIndexByPage((current) => ({ ...current, [page.id]: nextIndex }));
  };

  const removeRepeatInstance = (page: XlsFormPage, repeatIndex: number) => {
    if (!page.repeatName) return;
    const instances = getRepeatInstances(page.repeatName).filter((_, index) => index !== repeatIndex);
    onChange(page.repeatName, instances);
    setActiveRepeatIndexByPage((current) => ({
      ...current,
      [page.id]: Math.max(0, Math.min((current[page.id] || 0), instances.length - 1)),
    }));
  };

  const captureLocation = (field: InternalGemField | XlsFormField, repeatContext?: RepeatContext) => {
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
        const pointValue = `${latitude} ${longitude}`;
        const shouldAppendPoint = field.type === 'geotrace' || field.type === 'geoshape';
        const currentValue = repeatContext
          ? getXlsFormRuntimeFieldValue(field as XlsFormField, runtimeValues, repeatContext.instance)
          : values[field.name];
        const nextValue = shouldAppendPoint && String(currentValue || '').trim()
          ? `${String(currentValue).trim()}; ${pointValue}`
          : pointValue;

        if (repeatContext) updateRuntimeField(field as XlsFormField, nextValue, repeatContext);
        else onChange(field.name, nextValue);
        if (field.name === 'LOCALISATION_CLIENT') {
          onChange('latitude_key', latitude);
          onChange('longitude_key', longitude);
        }
        onChange('_ged_os_client_gps_accuracy_m', String(Math.round(position.coords.accuracy || 0)));
        onChange('_ged_os_client_gps_captured_at', capturedAt);
        onChange('_ged_os_client_gps_source', 'browser-geolocation-high-accuracy');
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

  const getRuntimeFieldIssues = (field: XlsFormField, repeatContext?: RepeatContext) =>
    (runtimeValidation?.issues || []).filter((issue) => {
      if (issue.field.name !== field.name) return false;
      if (!repeatContext) return issue.repeatName === undefined;
      return issue.repeatName === repeatContext.repeatName && issue.repeatIndex === repeatContext.repeatIndex;
    });

  const getRuntimeGroupLabel = (groupPath?: string) => {
    if (!groupPath || !xlsFormDefinition) return '';
    const group = (xlsFormDefinition.groups || []).find((item) => (item.path || item.name) === groupPath);
    return group?.label || groupPath.split('/').pop() || groupPath;
  };

  const renderRuntimeMediaField = (
    field: XlsFormField,
    value: unknown,
    repeatContext?: RepeatContext
  ) => {
    const attachmentKey = getRuntimeAttachmentKey(field, repeatContext);
    const attachment = getAttachmentMeta(values, attachmentKey);
    const previewSource = getImagePreviewSource(value, attachment);
    const stringValue = String(value || '');
    const hasValue = hasXlsFormRuntimeValue(value);
    const isQueued = attachment?.status === 'queued' || attachment?.storage?.startsWith('embedded');

    return (
      <div className="rounded-2xl border border-dashed border-blue-200/15 bg-slate-900/35 p-3">
        {field.type === 'image' || field.type === 'signature' ? (
          previewSource ? (
            <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50">
              <img src={previewSource} alt={field.label || field.name} className="max-h-56 w-full object-cover" />
            </div>
          ) : null
        ) : null}

        {field.type === 'audio' && stringValue ? (
          <audio controls src={stringValue} className="mb-3 w-full" />
        ) : null}

        {field.type === 'video' && stringValue ? (
          <video controls src={stringValue} className="mb-3 max-h-64 w-full rounded-2xl bg-slate-950/60" />
        ) : null}

        {field.type === 'file' && stringValue ? (
          <div className="mb-3 rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2 text-[11px] font-bold text-slate-200">
            {attachment?.fileName || stringValue}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          {field.type === 'signature' ? (
            <button
              type="button"
              onClick={() => setSignatureTarget({ field, repeatContext })}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-indigo-300/25 bg-indigo-400/12 px-4 text-center text-indigo-100 transition-all hover:bg-indigo-400/20 active:scale-[0.98]"
            >
              <PenTool size={18} />
              <span className="text-[10px] font-black uppercase tracking-[0.14em]">
                {hasValue ? 'Remplacer la signature' : 'Signer'}
              </span>
            </button>
          ) : (
            <label className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-blue-300/20 bg-blue-400/10 px-4 text-center text-blue-100 transition-all hover:bg-blue-400/18 active:scale-[0.98]">
              <input
                type="file"
                accept={getRuntimeFieldAccept(field)}
                capture={getRuntimeFieldCapture(field) as 'user' | 'environment' | undefined}
                className="hidden"
                onChange={(event) => handleRuntimeFile(field, event.target.files?.[0], repeatContext)}
              />
              {field.type === 'image' ? (hasValue ? <Camera size={18} /> : <ImagePlus size={18} />) : <FileUp size={18} />}
              <span className="text-[10px] font-black uppercase tracking-[0.14em]">
                {uploadingField === attachmentKey ? 'Traitement...' : hasValue ? 'Remplacer' : 'Ajouter'}
              </span>
            </label>
          )}

          {hasValue ? (
            <button
              type="button"
              onClick={() => clearRuntimeFile(field, repeatContext)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-rose-100 transition-all hover:bg-rose-400/18 active:scale-[0.98]"
            >
              <X size={16} />
              Retirer
            </button>
          ) : null}
        </div>

        {hasValue ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
              isQueued
                ? 'border-amber-300/25 bg-amber-400/10 text-amber-100'
                : 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
            }`}>
              {isQueued ? 'Media local' : 'Media serveur'}
            </span>
            <span className="max-w-full truncate text-[10px] font-semibold text-slate-500">
              {attachment?.fileName || stringValue}
            </span>
            {attachment?.sha256 ? (
              <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[9px] font-bold text-slate-400">
                sha256 {attachment.sha256.slice(0, 10)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderXlsRuntimeField = (field: XlsFormField, repeatContext?: RepeatContext) => {
    const value = getXlsFormRuntimeFieldValue(field, runtimeValues, repeatContext?.instance);
    const fieldIssues = getRuntimeFieldIssues(field, repeatContext);
    const missing = fieldIssues.some((issue) => issue.type === 'required');
    const invalid = fieldIssues.some((issue) => issue.type === 'constraint');
    const fieldId = repeatContext
      ? `internal-kobo-field-${field.name}-${repeatContext.repeatName}-${repeatContext.repeatIndex}`
      : `internal-kobo-field-${field.name}`;
    const label = field.label || field.name;
    const required = field.required || Boolean(field.requiredExpression);
    const readOnly = Boolean(field.readOnly || (field.calculation && field.type !== 'calculate'));
    const shellClass = `rounded-2xl border p-4 space-y-3 shadow-sm ${
      missing || invalid ? 'border-amber-300/45 bg-amber-400/[0.09]' : 'border-white/[0.09] bg-white/[0.06]'
    }`;

    if (field.type === 'note') {
      return (
        <div key={`${fieldId}-note`} className="rounded-2xl border border-blue-300/20 bg-blue-400/[0.1] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-100">{label}</p>
          {field.hint ? <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-300">{field.hint}</p> : null}
        </div>
      );
    }

    if (field.type === 'calculate') {
      return (
        <div key={`${fieldId}-calculate`} id={fieldId} className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.07] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-black uppercase tracking-[0.13em] text-cyan-100">{label}</p>
              <p className="mt-1 text-[10px] font-semibold text-slate-500">Calcul live: {field.name}</p>
            </div>
            <span className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-100">
              Auto
            </span>
          </div>
          <p className="mt-3 rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm font-black text-white">
            {hasXlsFormRuntimeValue(value) ? String(value) : 'En attente des valeurs sources'}
          </p>
        </div>
      );
    }

    if (!isXlsFormRuntimeFieldVisible(field, runtimeValues, repeatContext?.instance)) return null;

    if (field.type === 'acknowledge') {
      const checked = isTruthyGemValue(value);
      return (
        <button
          key={fieldId}
          id={fieldId}
          type="button"
          onClick={() => updateRuntimeField(field, !checked, repeatContext)}
          className={`${shellClass} flex w-full items-center justify-between gap-4 text-left transition-all active:scale-[0.99]`}
        >
          <div className="min-w-0">
            <p className="text-[14px] font-black leading-snug text-white">{label}</p>
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
      <div key={fieldId} id={fieldId} className={shellClass}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-black leading-snug text-white">{label}</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-500">Code Kobo: {field.name}</p>
            {field.hint ? <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">{field.hint}</p> : null}
          </div>
          {required ? (
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
                key={`${fieldId}-${issue.type}`}
                className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-[10px] font-bold leading-snug text-amber-50"
              >
                {issue.message}
              </p>
            ))}
          </div>
        ) : null}

        {readOnly ? (
          <div className="flex h-12 items-center gap-2 rounded-2xl border border-white/8 bg-slate-950/35 px-4 text-[12px] font-black text-slate-300">
            <Lock size={13} className="text-slate-600" />
            <span className="truncate">{hasXlsFormRuntimeValue(value) ? String(value) : 'Non renseigne'}</span>
            {field.calculation ? (
              <span className="ml-auto shrink-0 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-cyan-100">
                Auto
              </span>
            ) : null}
          </div>
        ) : null}

        {(field.type === 'text' || field.type === 'barcode') && !readOnly ? (
          <textarea
            value={String(value || '')}
            onChange={(event) => updateRuntimeField(field, event.target.value, repeatContext)}
            rows={field.appearance === 'multiline' ? 3 : 2}
            placeholder="Saisir la valeur..."
            className="w-full resize-none rounded-2xl border border-white/10 bg-slate-900/45 px-4 py-3 text-sm font-semibold leading-relaxed text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-blue-400/50"
          />
        ) : null}

        {['integer', 'decimal', 'range', 'date', 'time', 'datetime', 'geopoint', 'geotrace', 'geoshape'].includes(field.type) && !readOnly ? (
          <div className="space-y-2">
            {field.type === 'range' ? (
              <input
                type="range"
                min={field.parameters?.match(/start\s*=\s*(-?\d+)/i)?.[1] || '0'}
                max={field.parameters?.match(/end\s*=\s*(-?\d+)/i)?.[1] || '100'}
                step={field.parameters?.match(/step\s*=\s*([0-9.]+)/i)?.[1] || '1'}
                value={String(value || '')}
                onChange={(event) => updateRuntimeField(field, event.target.value, repeatContext)}
                aria-label={label}
                title={label}
                className="w-full accent-blue-400"
              />
            ) : null}
            <div className="flex gap-2">
              <input
                type={getRuntimeFieldInputType(field)}
                inputMode={field.type === 'integer' || field.type === 'decimal' || field.type === 'range' ? 'decimal' : undefined}
                value={String(value || '')}
                onChange={(event) => updateRuntimeField(field, event.target.value, repeatContext)}
                placeholder={['geopoint', 'geotrace', 'geoshape'].includes(field.type) ? 'lat lon; lat lon' : 'Saisir la valeur...'}
                className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-900/50 px-4 text-sm font-bold text-white outline-none transition-colors placeholder:text-slate-500 focus:border-blue-400/50"
              />
              {['geopoint', 'geotrace', 'geoshape'].includes(field.type) ? (
                <button
                  type="button"
                  onClick={() => captureLocation(field, repeatContext)}
                  disabled={locatingField === field.name}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-100 transition-all hover:bg-emerald-400/18 active:scale-95 disabled:opacity-60"
                  title="Capturer la position GPS actuelle"
                  aria-label="Capturer la position GPS actuelle"
                >
                  {locatingField === field.name ? <Loader2 size={17} className="animate-spin" /> : <MapPin size={17} />}
                </button>
              ) : null}
            </div>
              {['geopoint', 'geotrace', 'geoshape'].includes(field.type) && locationError ? (
              <p className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-[10px] font-bold text-rose-100">
                {locationError}
              </p>
            ) : null}
          </div>
        ) : null}

        {(field.type === 'select_one' || field.type === 'select_multiple' || field.type === 'rank') && field.listName && !readOnly ? (
          <div className={`grid grid-cols-1 gap-2 ${field.appearance === 'minimal' ? '' : 'sm:grid-cols-2'}`}>
            {getFilteredXlsFormRuntimeChoices(xlsFormDefinition!, field, runtimeValues, repeatContext?.instance).map((option) => {
              const active = field.type === 'select_multiple' || field.type === 'rank'
                ? asArray(value).includes(option.name)
                : value === option.name;

              return (
                <button
                  key={option.name}
                  type="button"
                  onClick={() => setRuntimeOption(field, option.name, repeatContext)}
                  className={`relative overflow-hidden min-h-12 flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 pl-4 text-left text-[12px] font-black uppercase tracking-[0.08em] transition-all active:scale-95 ${
                    active ? getToneForValue(option.name) : 'border-white/10 bg-slate-950/35 text-slate-300 hover:border-blue-300/30 hover:bg-blue-400/[0.08] hover:text-white'
                  }`}
                >
                  <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full transition-all ${
                    active ? 'bg-white shadow-[0_0_16px_rgba(255,255,255,0.8)]' : 'bg-white/10'
                  }`} />
                  <span className="min-w-0">{option.label || option.name}</span>
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

        {GEM_RUNTIME_MEDIA_TYPES.has(field.type) && !readOnly ? renderRuntimeMediaField(field, value, repeatContext) : null}

        {hasXlsFormRuntimeValue(value) && !GEM_RUNTIME_MEDIA_TYPES.has(field.type) ? (
          <p className="text-[10px] font-bold text-slate-500">
            Valeur Kobo: <span className="text-slate-300">{Array.isArray(value) ? value.join(' ') : String(value)}</span>
          </p>
        ) : null}
      </div>
    );
  };

  const renderRuntimeFieldsWithGroups = (
    page: XlsFormPage,
    fields: XlsFormField[],
    repeatContext?: RepeatContext
  ) => {
    let currentGroupPath = '';
    return fields.flatMap((field) => {
      const items: React.ReactNode[] = [];
      const groupPath = field.groupPath || '';
      const shouldShowGroupHeader = groupPath && groupPath !== page.path && groupPath !== currentGroupPath;
      if (shouldShowGroupHeader) {
        currentGroupPath = groupPath;
        items.push(
          <div key={`${page.id}-${groupPath}`} className="rounded-2xl border border-blue-300/20 bg-blue-500/[0.09] px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100">
              {getRuntimeGroupLabel(groupPath)}
            </p>
            <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">{groupPath}</p>
          </div>
        );
      }
      items.push(renderXlsRuntimeField(field, repeatContext));
      return items;
    });
  };

  const renderRuntimePage = (page: typeof runtimeNavigablePages[number]) => {
    const status = getRuntimePageStatus(page);

    if (page.type === 'repeat' && page.repeatName) {
      const instances = getRepeatInstances(page.repeatName);
      const activeIndex = Math.min(activeRepeatIndexByPage[page.id] || 0, Math.max(0, instances.length - 1));
      const activeInstance = instances[activeIndex];
      const repeatContext = activeInstance ? {
        repeatName: page.repeatName,
        repeatIndex: activeIndex,
        instance: activeInstance,
      } : undefined;
      const fields = repeatContext
        ? page.fields.filter((field) => isXlsFormRuntimeFieldVisible(field, runtimeValues, repeatContext.instance))
        : page.fields;

      return (
        <section className="space-y-4">
          <div className="rounded-2xl border border-blue-300/18 bg-blue-500/[0.08] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">{page.title}</h4>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Repeat: {page.repeatName} - {instances.length} ligne(s)
                </p>
              </div>
              <button
                type="button"
                onClick={() => addRepeatInstance(page)}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-blue-200/25 bg-blue-300/12 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-blue-50 hover:bg-blue-300/20"
              >
                <Plus size={15} />
                Ajouter
              </button>
            </div>

            {instances.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {instances.map((_, index) => (
                  <button
                    key={`${page.id}-instance-${index}`}
                    type="button"
                    onClick={() => setActiveRepeatIndexByPage((current) => ({ ...current, [page.id]: index }))}
                    className={`rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] ${
                      activeIndex === index
                        ? 'border-blue-200/45 bg-blue-300/18 text-blue-50'
                        : 'border-white/10 bg-white/[0.03] text-slate-500'
                    }`}
                  >
                    Ligne {index + 1}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {repeatContext ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-100">
                      Ligne {activeIndex + 1} / {instances.length}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">{status.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRepeatInstance(page, activeIndex)}
                    className="inline-flex h-9 items-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-3 text-[9px] font-black uppercase tracking-[0.12em] text-rose-100 hover:bg-rose-400/18"
                  >
                    <Minus size={14} />
                    Retirer
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {fields.length ? renderRuntimeFieldsWithGroups(page, fields, repeatContext) : (
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-6 text-center">
                    <p className="text-sm font-black text-white">Aucun champ visible dans cette ligne.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-[1.5rem] border border-amber-300/25 bg-amber-400/[0.08] p-6 text-center">
              <p className="text-sm font-black text-amber-50">Ajoutez une ligne pour remplir ce repeat.</p>
              <button
                type="button"
                onClick={() => addRepeatInstance(page)}
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-amber-300 px-4 text-[10px] font-black uppercase tracking-[0.12em] text-slate-950"
              >
                <Plus size={15} />
                Ajouter la premiere ligne
              </button>
            </div>
          )}
        </section>
      );
    }

    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-sm font-black uppercase tracking-[0.16em] text-white">{page.title}</h4>
              <p className="mt-1 text-[11px] font-semibold text-slate-400">{page.subtitle}</p>
            </div>
            <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${status.className}`}>
              {page.missingFields.length ? `${page.missingFields.length} a completer` : 'Etape complete'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {page.fields.length ? renderRuntimeFieldsWithGroups(page, page.fields) : (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-6 text-center">
              <p className="text-sm font-black text-white">Aucun champ visible pour cette etape.</p>
              <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
                Les branchements conditionnels XLSForm cachent cette page tant que les valeurs requises ne sont pas remplies.
              </p>
            </div>
          )}
        </div>
      </section>
    );
  };

  const saveRuntimeSignature = (signatureBase64: string) => {
    if (!signatureTarget) return;
    const attachmentKey = getRuntimeAttachmentKey(signatureTarget.field, signatureTarget.repeatContext);
    const capturedAt = new Date().toISOString();
    updateRuntimeField(signatureTarget.field, signatureBase64, signatureTarget.repeatContext);
    onChange(`_ged_os_attachment_${attachmentKey}`, {
      id: makeAttachmentId(),
      fieldName: attachmentKey,
      fieldCode: signatureTarget.field.name,
      valuePath: signatureTarget.repeatContext
        ? [signatureTarget.repeatContext.repeatName, signatureTarget.repeatContext.repeatIndex, signatureTarget.field.name]
        : [signatureTarget.field.name],
      fileName: `${attachmentKey}.png`,
      mimeType: 'image/png',
      capturedAt,
      source: signatureTarget.repeatContext ? 'gem-xlsform-repeat-signature' : 'gem-xlsform-signature',
      status: 'queued',
      storage: 'embedded-offline',
      dataUrl: signatureBase64,
    } satisfies InternalKoboAttachment);
    onChange(`_ged_os_photo_${attachmentKey}_original_name`, `${attachmentKey}.png`);
    onChange(`_ged_os_photo_${attachmentKey}_mime`, 'image/png');
    onChange(`_ged_os_photo_${attachmentKey}_captured_at`, capturedAt);
    setSignatureTarget(null);
  };

  const renderField = (field: InternalGemField) => {
    const value = getInternalGemFieldValue(field, values);
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
      const checked = isTruthyGemValue(value);
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
            {(INTERNAL_GED_OS_CHOICES[field.listName] || []).map((option) => {
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
          const current = String(values[field.name] || '');
          const hasVal = hasInternalGemValue(current);
          

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
                  {hasVal ? <Camera size={18} /> : <ImagePlus size={18} />}
                  <span className="text-[10px] font-black uppercase tracking-[0.14em]">
                    {uploadingField === field.name ? 'Traitement photo...' : hasVal ? 'Remplacer la photo' : 'Ajouter une photo'}
                  </span>
                </label>
                {hasVal ? (
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
              {hasVal ? (
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
                  {attachment?.sha256 ? (
                    <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[9px] font-bold text-slate-400">
                      sha256 {attachment.sha256.slice(0, 10)}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })() : null}

        {hasInternalGemValue(value) && field.type !== 'image' && !field.readOnly ? (
          <p className="text-[10px] font-bold text-slate-500">
            Valeur Kobo: <span className="text-slate-300">{formatInternalGemValue(value, field.listName)}</span>
          </p>
        ) : null}
      </div>
    );
  };


  return (
    <div className={inline ? "flex flex-col h-full w-full bg-transparent" : "fixed inset-0 z-[3000] flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-md sm:items-center sm:p-4"}>
      <div className={`relative grid w-full overflow-hidden shadow-2xl ${inline ? 'h-full flex-1 bg-transparent md:grid-cols-[310px_1fr]' : 'h-[100dvh] max-w-7xl rounded-t-[1.5rem] border border-blue-200/10 bg-[#0B1728] sm:h-[92vh] sm:rounded-[1.75rem] md:grid-cols-[310px_1fr]'}`}>
        <aside className="hidden border-r border-white/10 bg-slate-950/35 p-4 md:flex md:flex-col">
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
              <div
                className="h-full rounded-full bg-blue-400 transition-all workflow-progress-bar"
                style={{ '--workflow-progress': `${progress.percent}%` } as React.CSSProperties}
              />
            </div>
            <p className="mt-3 text-[11px] font-semibold text-slate-400">
              {validationIssues.length ? `${validationIssues.length} action(s) restante(s)` : 'Tous les champs visibles sont complets'}
            </p>
            <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-blue-100/80">
                  Calcul detaille
                </p>
                <p className="shrink-0 text-[10px] font-black text-white">
                  {progress.filled} sur {progress.total}
                </p>
              </div>
              <p className="mt-1 text-[10px] font-semibold leading-snug text-slate-400">
                Champs visibles pris en compte dans le pourcentage.
              </p>
              {progressMissingPreview.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-100/80">
                    Restants
                  </p>
                  {progressMissingPreview.map((item) => (
                    <div
                      key={item.name}
                      className="min-w-0 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-2.5 py-2"
                    >
                      <p className="truncate text-[10px] font-black leading-tight text-amber-50">
                        {item.label}
                      </p>
                      {item.pageTitle ? (
                        <p className="mt-0.5 truncate text-[9px] font-semibold text-amber-100/55">
                          {item.pageTitle}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {progressHiddenMissingCount > 0 ? (
                    <p className="text-[10px] font-bold text-slate-500">
                      + {progressHiddenMissingCount} autre(s) champ(s)
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] px-2.5 py-2 text-[10px] font-bold text-emerald-100">
                  Aucun champ visible restant.
                </p>
              )}
            </div>
          </div>

          <div className="mb-5">
            <HistoryPanel submissions={submissions || []} isHistoryLoading={isHistoryLoading} historyError={historyError} onRefreshHistory={onRefreshHistory} onDownloadHistory={downloadSubmissionHistoryJson} onViewReceipt={setReceiptSubmission} />
          </div>
          {queueItems && queueItems.length > 0 ? (
            <div className="mb-5">
              <LocalQueuePanel queueItems={queueItems || []} onFlushQueue={onFlushQueue} isQueueFlushing={isQueueFlushing} isOnline={isOnline} />
            </div>
          ) : null}

          <div className="space-y-2">
            {xlsFormDefinition ? (
              runtimeNavigablePages.map((page) => {
                const status = getRuntimePageStatus(page);
                const isActive = activeRuntimePage?.id === page.id;
                const inactiveStatusClass = page.locked
                  ? 'border-white/5 bg-white/[0.02] text-slate-600'
                  : 'border-white/8 bg-white/[0.025] text-slate-500';
                return (
                  <button
                    key={page.id}
                    type="button"
                    disabled={page.locked}
                    onClick={() => {
                      if (!page.locked) setActiveRuntimePageId(page.id);
                    }}

                    className={`relative w-full overflow-hidden rounded-2xl border p-3 text-left transition-all ${
                      isActive
                        ? 'border-blue-300/70 bg-blue-500/18 text-white shadow-lg shadow-blue-500/10 ring-1 ring-blue-300/25'
                        : page.locked
                          ? 'cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-600 opacity-45 grayscale'
                          : 'border-white/8 bg-white/[0.025] text-slate-500 opacity-50 grayscale hover:opacity-75 hover:grayscale-0'
                    }`}
                  >
                    {isActive ? <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-blue-300 shadow-[0_0_18px_rgba(96,165,250,0.9)]" /> : null}
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className={`block truncate text-[12px] font-black uppercase tracking-[0.1em] ${isActive ? 'text-white' : 'text-slate-500'}`}>
                          {page.title}
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
              })
            ) : (
              sectionsWithLocks.map((section) => {
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
              })
            )}
          </div>
        </aside>

        <main className="flex min-h-0 flex-col">
          <header className="shrink-0 border-b border-blue-300/15 bg-[#0A1830] p-4 shadow-[inset_0_-1px_0_rgba(96,165,250,0.08)] sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-300">GEM Collect</p>
                <h3 className="mt-1 truncate text-xl font-black uppercase tracking-tight text-white sm:text-2xl">
                  {xlsFormDefinition?.title || 'Formulaire du menage'}
                </h3>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <p className="min-w-0 truncate text-[12px] font-semibold text-slate-300">
                    {numeroOrdre ? `Numero ordre ${numeroOrdre}` : 'Renseignez le numero ordre'}{selectedRole ? ` - ${formatInternalGemValue(selectedRole, 'roles')}` : ''}
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
                aria-label="Fermer GEM Collect"
              >
                <X size={18} />
              </button>
            </div>

            {!hideFormSelector && availableRuntimeForms.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-blue-300/15 bg-slate-950/35 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-blue-200">
                      <ClipboardList size={13} />
                      Projet deploye pour cette enquete
                    </span>
                    <select
                      value={selectedRuntimeFormKey}
                      onChange={(event) => {
                        setSelectedRuntimeFormKey(event.target.value);
                        setPendingRuntimeDefinition(null);
                      }}
                      disabled={isRuntimeFormListLoading || availableRuntimeForms.length < 2}
                      className="mt-2 h-11 w-full rounded-xl border border-blue-300/20 bg-[#081323] px-3 text-[12px] font-black text-white outline-none transition focus:border-blue-300 disabled:cursor-not-allowed disabled:opacity-75"
                    >
                      {availableRuntimeForms.map((form) => (
                        <option key={form.formKey} value={form.formKey}>
                          {form.title || form.formKey}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-100">
                    {availableRuntimeForms.length} deploye(s)
                  </div>
                </div>
                <p className="mt-2 text-[10px] font-semibold leading-relaxed text-slate-400">
                  Seuls les projets deployes apparaissent ici; les brouillons restent dans le workspace et ne peuvent pas etre utilises pour collecter.
                </p>
              </div>
            ) : null}

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

            {pendingRuntimeDefinition ? (
              <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-500/12 px-4 py-3 text-[11px] font-bold text-amber-50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">
                      Nouvelle version XLSForm detectee
                    </p>
                    <p className="mt-1 leading-relaxed">
                      Locale v{xlsFormDefinition?.formVersion || String(values._ged_os_runtime_form_version || INTERNAL_GED_OS_FORM_SETTINGS.version)} - VPS v{pendingRuntimeDefinition.formVersion}. Les valeurs deja saisies seront preservees par nom de champ.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={migrateToPendingRuntimeDefinition}
                    className="shrink-0 rounded-full bg-amber-300 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-950 hover:bg-amber-200"
                  >
                    Migrer maintenant
                  </button>
                </div>
              </div>
            ) : serverFormStatus.status === 'mismatch' ? (
              <div className="mt-3 hidden rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-[11px] font-bold text-amber-100 sm:block">
                Version XLSForm a verifier: locale {xlsFormDefinition?.formVersion || INTERNAL_GED_OS_FORM_SETTINGS.version}, VPS {serverFormStatus.version || 'inconnue'}.
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
                  {localDraft.formVersion && localDraft.formVersion !== (xlsFormDefinition?.formVersion || values._ged_os_runtime_form_version)
                    ? ` - version brouillon ${localDraft.formVersion}`
                    : ''}
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
                value={xlsFormDefinition ? activeRuntimePage?.id || '' : activeSection?.id || ''}
                onChange={(event) => {
                  if (xlsFormDefinition) setActiveRuntimePageId(event.target.value);
                  else setActiveSectionId(event.target.value);
                }}
                title="Navigation entre les sections du formulaire"
                aria-label="Navigation entre les sections du formulaire"
                className="h-12 w-full rounded-2xl border border-blue-300/25 bg-[#0B1728] px-4 text-[12px] font-black uppercase tracking-[0.1em] text-white outline-none"
              >
                {(xlsFormDefinition ? mobileRuntimePageOptions : mobileSectionOptions).map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
                ))}
              </select>
              <div className="mt-3">
                <HistoryPanel compact submissions={submissions || []} isHistoryLoading={isHistoryLoading} historyError={historyError} onRefreshHistory={onRefreshHistory} onDownloadHistory={downloadSubmissionHistoryJson} onViewReceipt={setReceiptSubmission} />
              </div>
              {queueItems && queueItems.length > 0 ? (
                <div className="mt-3">
                  <LocalQueuePanel compact queueItems={queueItems || []} onFlushQueue={onFlushQueue} isQueueFlushing={isQueueFlushing} isOnline={isOnline} />
                </div>
              ) : null}
            </div>

            <ValidationAssistantPanel validationIssues={validationIssues} missingRequired={missingRequired} constraintIssues={constraintIssues} firstActionableIssue={firstActionableIssue} validationIssueDetails={validationIssueDetails} focusRequiredField={focusRequiredField} />

            {xlsFormDefinition && activeRuntimePage ? (
              renderRuntimePage(activeRuntimePage)
            ) : !xlsFormDefinition && activeSection ? (
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
                  <p className="mt-1 truncate text-sm font-black text-white">{formatInternalGemValue(selectedRole || 'role non defini', 'roles')}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Progression</p>
                  <p className="mt-1 text-sm font-black text-white">{progress.filled}/{progress.total} champs</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Version XLSForm</p>
                  <p className="mt-1 truncate text-sm font-black text-white">
                    v{xlsFormDefinition?.formVersion || INTERNAL_GED_OS_FORM_SETTINGS.version}
                  </p>
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
                  {(xlsFormDefinition ? runtimeNavigablePages : sectionsWithLocks)
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
        <SignatureModal
          isOpen={Boolean(signatureTarget)}
          onClose={() => setSignatureTarget(null)}
          onSave={saveRuntimeSignature}
          title={signatureTarget?.field.label || signatureTarget?.field.name || 'Signature terrain'}
        />
        {receiptSubmission ? <ReceiptModal receiptSubmission={receiptSubmission} copiedReceiptId={copiedReceiptId} copyReceiptId={copyReceiptId} downloadReceiptJson={downloadReceiptJson} onClose={() => setReceiptSubmission(null)} fieldLabelByName={fieldLabelByName} /> : null}
      </div>
    </div>
  );
};
