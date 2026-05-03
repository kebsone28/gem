import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Database,
  ImagePlus,
  Lock,
  LockKeyhole,
  Search,
  X,
} from 'lucide-react';
import apiClient from '../../api/client';
import { compressImage } from '../../utils/imageUtils';
import {
  formatInternalKoboValue,
  getInternalKoboFieldValue,
  getVisibleInternalKoboFields,
  hasInternalKoboValue,
  INTERNAL_KOBO_CHOICES,
  INTERNAL_KOBO_SECTIONS,
  isInternalKoboFieldVisible,
  isTruthyKoboValue,
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
};

const asArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) return value.split(/\s+/);
  return [];
};

const progressFor = (values: Record<string, unknown>) => {
  const visibleFields = getVisibleInternalKoboFields(values).filter((field) => !field.readOnly && field.type !== 'note');
  const filled = visibleFields.filter((field) => hasInternalKoboValue(getInternalKoboFieldValue(field, values))).length;
  return {
    filled,
    total: visibleFields.length,
    percent: visibleFields.length ? Math.round((filled / visibleFields.length) * 100) : 0,
  };
};

const getToneForValue = (value: unknown) => {
  const str = String(value ?? '').toLowerCase();
  if (['non', 'non_conforme', 'nc', 'probleme', 'menage_non_eligible', 'probleme_a_signaler'].includes(str)) {
    return 'border-rose-400/45 bg-rose-500/15 text-rose-50';
  }
  if (['oui', 'conforme', 'c', 'termine', 'terminee', 'realise', 'menage_eligible'].includes(str)) {
    return 'border-emerald-400/45 bg-emerald-500/15 text-emerald-50';
  }
  return 'border-blue-400/35 bg-blue-500/12 text-blue-50';
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

export const InternalKoboForm: React.FC<InternalKoboFormProps> = ({
  values,
  onChange,
  onSave,
  onClose,
  isSaving = false,
  onPhotoUpload,
  onResolvedHousehold,
  resolveHouseholdByNumero,
}) => {
  const [activeSectionId, setActiveSectionId] = useState(INTERNAL_KOBO_SECTIONS[0]?.id || '');
  const [query, setQuery] = useState('');
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [householdLookup, setHouseholdLookup] = useState<{
    status: 'idle' | 'loading' | 'found' | 'missing' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const lastResolvedNumeroRef = useRef('');
  const onChangeRef = useRef(onChange);
  const onResolvedHouseholdRef = useRef(onResolvedHousehold);
  const resolveHouseholdByNumeroRef = useRef(resolveHouseholdByNumero);
  const missingRequired = useMemo(() => validateInternalKoboRequiredFields(values), [values]);
  const progress = useMemo(() => progressFor(values), [values]);
  const normalizedQuery = query.trim().toLowerCase();
  const numeroOrdre = String(values.Numero_ordre || '').trim();
  const selectedRole = String(values.role || '').trim();
  const selectedRoleSectionId = ROLE_SECTION_BY_VALUE[selectedRole] || '';
  const lastAutoActivatedRoleRef = useRef('');

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
        const longitude = household.longitude ?? coordinates?.[0] ?? '';
        const latitude = household.latitude ?? coordinates?.[1] ?? '';
        const displayName = household.name || household.owner || household.koboData?.nom_key || '';
        const phone = household.phone || household.ownerPhone || household.koboData?.telephone_key || '';
        const region = household.region || household.koboData?.region_key || '';

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
    const locked = Boolean(previousBlockingSectionId && section.activeFields.length > 0);
    const blockedBySectionId = locked ? previousBlockingSectionId : '';

    if (!locked && missingFields.length > 0) {
      previousBlockingSectionId = section.id;
    }

    return {
      ...section,
      locked,
      blockedBySectionId,
      missingFields,
    };
  });

  const activeSection =
    navigableSections.find((section) => section.id === activeSectionId && !section.locked) ||
    navigableSections.find((section) => section.id === selectedRoleSectionId && !section.locked) ||
    navigableSections.find((section) => !section.locked) ||
    navigableSections[0];

  const blockedByTitle = (sectionId: string) =>
    navigableSections.find((section) => section.id === sectionId)?.title || 'l etape precedente';

  const getSectionStatus = (section: typeof navigableSections[number]) => {
    const fillableCount = section.activeFields.filter((field) => field.type !== 'note' && !field.readOnly).length;
    if (section.locked) {
      return {
        label: 'Verrouille',
        detail: `Terminer ${blockedByTitle(section.blockedBySectionId)}`,
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
      const uploaded = onPhotoUpload ? await onPhotoUpload(uploadFile) : uploadFile.name;
      onChange(field.name, uploaded);
    } finally {
      setUploadingField(null);
    }
  };

  const renderField = (field: InternalKoboField) => {
    const value = getInternalKoboFieldValue(field, values);
    const missing = missingRequired.some((item) => item.name === field.name);
    const shellClass = `rounded-2xl border p-4 space-y-3 shadow-sm ${
      missing ? 'border-amber-300/35 bg-amber-400/[0.08]' : 'border-white/[0.08] bg-white/[0.04]'
    }`;

    if (field.type === 'note') {
      return (
        <div key={field.name} className="rounded-2xl border border-blue-300/20 bg-blue-400/[0.08] p-4">
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
      <div key={field.name} className={shellClass}>
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
              className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm font-semibold leading-relaxed text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-blue-400/50"
            />
          ) : (
            <input
              type={field.type === 'integer' ? 'number' : 'text'}
              inputMode={field.type === 'integer' ? 'numeric' : 'text'}
              value={String(value || '')}
              onChange={(event) => onChange(field.name, event.target.value)}
              placeholder={field.type === 'geopoint' ? 'lat lon' : 'Saisir la valeur...'}
              className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 text-sm font-bold text-white outline-none transition-colors focus:border-blue-400/50"
            />
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
                  className={`${field.appearance === 'quick' ? 'min-h-10' : 'min-h-12'} flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left text-[12px] font-black uppercase tracking-[0.08em] transition-all active:scale-95 ${
                    active ? getToneForValue(option.name) : 'border-white/10 bg-slate-950/30 text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  <span>{option.label}</span>
                  {active ? <CheckCircle2 size={15} className="shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {field.type === 'image' ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-slate-950/35 p-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => handleFile(field, event.target.files?.[0])}
              />
              {hasInternalKoboValue(value) ? <Camera size={20} className="text-emerald-300" /> : <ImagePlus size={20} className="text-blue-300" />}
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
                {uploadingField === field.name ? 'Envoi photo...' : hasInternalKoboValue(value) ? 'Photo ajoutee' : 'Ajouter une photo'}
              </span>
              {hasInternalKoboValue(value) ? (
                <span className="max-w-full truncate text-[10px] font-semibold text-slate-500">{String(value)}</span>
              ) : null}
            </label>
          </div>
        ) : null}

        {hasInternalKoboValue(value) && field.type !== 'image' && !field.readOnly ? (
          <p className="text-[10px] font-bold text-slate-500">
            Valeur Kobo: <span className="text-slate-300">{formatInternalKoboValue(value, field.listName)}</span>
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <div className="grid h-[100dvh] w-full max-w-7xl overflow-hidden rounded-t-[1.5rem] border border-white/10 bg-[#07111F] shadow-2xl sm:h-[92vh] sm:rounded-[1.75rem] md:grid-cols-[310px_1fr]">
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
              {missingRequired.length ? `${missingRequired.length} champ(s) obligatoire(s) restant(s)` : 'Tous les champs visibles sont complets'}
            </p>
          </div>

          <div className="space-y-2">
            {navigableSections.map((section) => {
              const status = getSectionStatus(section);
              return (
                <button
                  key={section.id}
                  type="button"
                  disabled={section.locked}
                  onClick={() => {
                    if (!section.locked) setActiveSectionId(section.id);
                  }}
                  className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                    activeSection?.id === section.id
                      ? 'border-blue-300/45 bg-blue-500/14 text-white'
                      : section.locked
                        ? 'cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-600 opacity-70'
                        : 'border-white/8 bg-white/[0.035] text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-black uppercase tracking-[0.1em]">{section.title}</span>
                      <span className="mt-1 block truncate text-[10px] font-semibold text-slate-500">{status.detail}</span>
                    </span>
                    <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${status.className}`}>
                      {status.icon}
                      {status.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="flex min-h-0 flex-col">
          <header className="shrink-0 border-b border-white/10 bg-[#07111F] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-300">Saisie terrain VPS</p>
                <h3 className="mt-1 truncate text-xl font-black uppercase tracking-tight text-white sm:text-2xl">
                  Formulaire du menage
                </h3>
                <p className="mt-1 text-[12px] font-semibold text-slate-400">
                  {numeroOrdre ? `Numero ordre ${numeroOrdre}` : 'Renseignez le numero ordre'}{selectedRole ? ` - ${formatInternalKoboValue(selectedRole, 'roles')}` : ''}
                </p>
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

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <div className="flex h-12 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/45 px-3">
                <Search size={15} className="text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher une question..."
                  className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-white outline-none placeholder:text-slate-600"
                />
              </div>
              <div className={`rounded-2xl border px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.13em] sm:flex sm:items-center ${
                missingRequired.length ? 'border-amber-400/25 bg-amber-500/10 text-amber-100' : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
              }`}>
                {missingRequired.length ? `${missingRequired.length} obligatoire(s)` : 'Pret a soumettre'}
              </div>
            </div>

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

          <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar sm:p-5">
            <div className="mb-4 md:hidden">
              <select
                value={activeSection?.id || ''}
                onChange={(event) => setActiveSectionId(event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-[12px] font-black uppercase tracking-[0.1em] text-white outline-none"
              >
                {navigableSections.map((section) => (
                  <option key={section.id} value={section.id} disabled={section.locked}>
                    {section.locked ? `${section.title} - bloque` : section.title}
                  </option>
                ))}
              </select>
            </div>

            {activeSection ? (
              <section className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
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
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-6 text-center">
                      <p className="text-sm font-black text-white">Aucun champ actif pour ce role.</p>
                      <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-400">
                        Changez le role dans Menage pour remplir cette etape, ou utilisez-la comme consultation.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-8 text-center text-sm font-semibold text-slate-400">
                Aucun champ visible pour cette recherche.
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-white/10 bg-[#07111F] p-4">
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
                onClick={onSave}
                disabled={isSaving}
                className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-blue-600 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-xl shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-95 disabled:opacity-50"
              >
                <Database size={16} />
                {isSaving ? 'Enregistrement...' : missingRequired.length ? 'Enregistrer brouillon' : 'Soumettre au serveur'}
              </button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};
