import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Database,
  Download,
  Eye,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '../components';
import {
  fetchInternalKoboFormDefinitions,
  fetchInternalKoboDiagnostics,
  fetchInternalKoboSubmissionsReport,
  downloadInternalKoboSubmissionsExport,
  importInternalKoboXlsForm,
  reviewInternalKoboSubmission,
  updateInternalKoboFormDefinitionStatus,
  type InternalKoboAttachment,
  type InternalKoboImportedFormSummary,
  type InternalKoboSubmissionDiagnostics,
  type InternalKoboSubmissionRecord,
  type InternalKoboSubmissionStatus,
} from '../services/internalKoboSubmissionService';
import {
  formatInternalKoboValue,
  INTERNAL_KOBO_CHOICES,
  INTERNAL_KOBO_FORM_SETTINGS,
} from '../components/terrain/internalKoboFormDefinition';

type Filters = {
  q: string;
  status: '' | InternalKoboSubmissionStatus;
  role: string;
  syncStatus: string;
  limit: number;
};

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Soumis',
  validated: 'Valide',
  rejected: 'Rejete',
};

const statusClass = (status: string) => {
  if (status === 'submitted' || status === 'validated') return 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100';
  if (status === 'rejected') return 'border-rose-300/25 bg-rose-400/10 text-rose-100';
  return 'border-amber-300/25 bg-amber-400/10 text-amber-100';
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Jamais';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatBytes = (value?: number) => {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

const saveBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

const countValue = (diagnostics: InternalKoboSubmissionDiagnostics | null, bucket: keyof InternalKoboSubmissionDiagnostics, key: string) => {
  const value = diagnostics?.[bucket];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  return Number((value as Record<string, number>)[key] || 0);
};

const getSubmissionAttachments = (submission: InternalKoboSubmissionRecord | null): InternalKoboAttachment[] => {
  const media = (submission?.metadata as any)?.media;
  const attachments = media?.attachments;
  return Array.isArray(attachments) ? attachments : [];
};

export default function InternalKoboSubmissions() {
  const [filters, setFilters] = useState<Filters>({
    q: '',
    status: '',
    role: '',
    syncStatus: '',
    limit: 100,
  });
  const [submissions, setSubmissions] = useState<InternalKoboSubmissionRecord[]>([]);
  const [listDiagnostics, setListDiagnostics] = useState<InternalKoboSubmissionDiagnostics | null>(null);
  const [globalDiagnostics, setGlobalDiagnostics] = useState<InternalKoboSubmissionDiagnostics | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [receiptQr, setReceiptQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [isExporting, setIsExporting] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importedForms, setImportedForms] = useState<InternalKoboImportedFormSummary[]>([]);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const [formManagerMessage, setFormManagerMessage] = useState('');
  const [formStatusUpdating, setFormStatusUpdating] = useState('');

  const selectedSubmission = useMemo(
    () => submissions.find((submission) => submission.id === selectedId) || submissions[0] || null,
    [selectedId, submissions]
  );

  const loadFormDefinitions = useCallback(async () => {
    setIsLoadingForms(true);
    try {
      const forms = await fetchInternalKoboFormDefinitions();
      setImportedForms(forms);
    } catch {
      setFormManagerMessage('Gestionnaire XLSForm indisponible pour le moment');
    } finally {
      setIsLoadingForms(false);
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const cleanFilters = {
        q: filters.q.trim() || undefined,
        status: filters.status || undefined,
        role: filters.role || undefined,
        syncStatus: filters.syncStatus || undefined,
        limit: filters.limit,
      };
      const [report, diagnostics] = await Promise.all([
        fetchInternalKoboSubmissionsReport(cleanFilters),
        fetchInternalKoboDiagnostics(),
      ]);
      setSubmissions(report.submissions);
      setListDiagnostics(report.diagnostics);
      setGlobalDiagnostics(diagnostics);
      setSelectedId((current) =>
        report.submissions.some((submission) => submission.id === current)
          ? current
          : report.submissions[0]?.id || ''
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les soumissions Kobo internes');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  useEffect(() => {
    loadFormDefinitions();
  }, [loadFormDefinitions]);

  useEffect(() => {
    setReviewNote('');
  }, [selectedSubmission?.id]);

  useEffect(() => {
    let cancelled = false;
    setReceiptQr('');
    if (!selectedSubmission) return undefined;

    QRCode.toDataURL(
      JSON.stringify({
        id: selectedSubmission.id,
        clientSubmissionId: selectedSubmission.clientSubmissionId,
        numeroOrdre: selectedSubmission.numeroOrdre,
        status: selectedSubmission.status,
        savedAt: selectedSubmission.savedAt,
      }),
      { margin: 1, width: 180 }
    )
      .then((dataUrl) => {
        if (!cancelled) setReceiptQr(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setReceiptQr('');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSubmission]);

  const exportFromServer = async (format: 'csv' | 'json' | 'xlsx') => {
    setIsExporting(format);
    setError('');
    try {
      const cleanFilters = {
        q: filters.q.trim() || undefined,
        status: filters.status || undefined,
        role: filters.role || undefined,
        syncStatus: filters.syncStatus || undefined,
        limit: Math.max(filters.limit, 500),
      };
      const { blob, filename } = await downloadInternalKoboSubmissionsExport(cleanFilters, format);
      saveBlob(blob, filename);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Export serveur impossible');
    } finally {
      setIsExporting('');
    }
  };

  const handleImportXlsForm = async (file?: File) => {
    if (!file) return;
    setIsImporting(true);
    setImportMessage('');
    setError('');
    try {
      const result = await importInternalKoboXlsForm(file);
      const diagnostics = result.form?.diagnostics as Record<string, unknown> | undefined;
      setImportMessage(
        `XLSForm universel importe: ${result.form?.title || result.form?.formKey || 'formulaire'} v${result.form?.formVersion || 'inconnue'} - ${diagnostics?.fieldCount || 0} champs, ${diagnostics?.choiceCount || 0} choix, ${diagnostics?.repeatCount || 0} repeat(s)`
      );
      await loadFormDefinitions();
      await loadSubmissions();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import XLSForm impossible');
    } finally {
      setIsImporting(false);
    }
  };

  const handleToggleFormStatus = async (form: InternalKoboImportedFormSummary) => {
    setFormStatusUpdating(form.formKey);
    setFormManagerMessage('');
    setError('');
    try {
      const updated = await updateInternalKoboFormDefinitionStatus(form.formKey, form.active === false);
      if (updated) {
        setImportedForms((current) =>
          current.map((entry) => (entry.formKey === updated.formKey ? updated : entry))
        );
        setFormManagerMessage(
          `${updated.title || updated.formKey} est maintenant ${updated.active === false ? 'inactif' : 'actif'}`
        );
      }
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Mise a jour du formulaire impossible');
    } finally {
      setFormStatusUpdating('');
    }
  };

  const handleReview = async (status: Exclude<InternalKoboSubmissionStatus, 'draft'>) => {
    if (!selectedSubmission) return;
    setIsReviewing(true);
    setError('');
    try {
      const updated = await reviewInternalKoboSubmission(selectedSubmission.id, status, reviewNote);
      if (updated) {
        setSubmissions((current) =>
          current.map((submission) => (submission.id === updated.id ? updated : submission))
        );
        setSelectedId(updated.id);
      }
      setReviewNote('');
      await loadSubmissions();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Validation admin impossible');
    } finally {
      setIsReviewing(false);
    }
  };

  const copyReceipt = async () => {
    if (!selectedSubmission || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(selectedSubmission.clientSubmissionId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  };

  const valueEntries = useMemo(() => {
    if (!selectedSubmission) return [];
    return Object.entries(selectedSubmission.values || {}).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && String(value).trim() !== '';
    });
  }, [selectedSubmission]);

  const metadataEntries = useMemo(() => {
    if (!selectedSubmission?.metadata) return [];
    return Object.entries(selectedSubmission.metadata).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');
  }, [selectedSubmission]);
  const selectedValidationIssues = useMemo(() => {
    const issues = (selectedSubmission?.metadata as any)?.serverValidationIssues;
    return Array.isArray(issues) ? issues : [];
  }, [selectedSubmission]);
  const selectedAttachments = useMemo(() => getSubmissionAttachments(selectedSubmission), [selectedSubmission]);
  const activeFormCount = importedForms.filter((form) => form.active !== false).length;
  const inactiveFormCount = Math.max(importedForms.length - activeFormCount, 0);

  const health = globalDiagnostics?.health || 'ok';
  const healthClass =
    health === 'ok'
      ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
      : 'border-amber-300/25 bg-amber-400/10 text-amber-100';

  return (
    <PageContainer className="min-h-screen bg-slate-950 py-8">
      <PageHeader
        title="Soumissions Kobo interne"
        subtitle="Console VPS pour verifier, exporter et auditer les fiches terrain natives GEM"
        icon={<ClipboardCheck size={24} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadSubmissions}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-2xl border border-blue-300/25 bg-blue-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-blue-100 hover:bg-blue-500/18 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Actualiser
            </button>
            <button
              type="button"
              onClick={() => exportFromServer('csv')}
              disabled={submissions.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-100 hover:bg-white/[0.08] disabled:opacity-40"
            >
              <Download size={14} className={isExporting === 'csv' ? 'animate-pulse' : ''} />
              CSV
            </button>
            <button
              type="button"
              onClick={() => exportFromServer('json')}
              disabled={submissions.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-100 hover:bg-white/[0.08] disabled:opacity-40"
            >
              <FileJson size={14} className={isExporting === 'json' ? 'animate-pulse' : ''} />
              JSON
            </button>
            <button
              type="button"
              onClick={() => exportFromServer('xlsx')}
              disabled={submissions.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-100 hover:bg-emerald-500/18 disabled:opacity-40"
            >
              <FileSpreadsheet size={14} className={isExporting === 'xlsx' ? 'animate-pulse' : ''} />
              XLSX
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-amber-100 hover:bg-amber-500/18">
              <Upload size={14} className={isImporting ? 'animate-pulse' : ''} />
              Import XLSForm
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={isImporting}
                onChange={(event) => {
                  handleImportXlsForm(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
        }
      />

      <ContentArea padding="none" className="border-slate-800 bg-slate-950/40 shadow-2xl shadow-blue-950/20">
        <div className="space-y-6 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto]">
            <label className="flex h-12 items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 px-4">
              <Search size={16} className="text-slate-500" />
              <input
                value={filters.q}
                onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                placeholder="Numero, menage, telephone, ID recu..."
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
              />
            </label>
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as Filters['status'] }))}
              className="h-12 rounded-2xl border border-white/10 bg-slate-900 px-4 text-xs font-black uppercase tracking-[0.1em] text-white outline-none"
            >
              <option value="">Tous statuts</option>
              <option value="draft">Brouillons</option>
              <option value="submitted">Soumis</option>
              <option value="validated">Valides</option>
              <option value="rejected">Rejetes</option>
            </select>
            <select
              value={filters.role}
              onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}
              className="h-12 rounded-2xl border border-white/10 bg-slate-900 px-4 text-xs font-black uppercase tracking-[0.1em] text-white outline-none"
            >
              <option value="">Tous roles</option>
              {INTERNAL_KOBO_CHOICES.roles.map((role) => (
                <option key={role.name} value={role.name}>
                  {role.label}
                </option>
              ))}
            </select>
            <select
              value={filters.syncStatus}
              onChange={(event) => setFilters((current) => ({ ...current, syncStatus: event.target.value }))}
              className="h-12 rounded-2xl border border-white/10 bg-slate-900 px-4 text-xs font-black uppercase tracking-[0.1em] text-white outline-none"
            >
              <option value="">Sync tous</option>
              <option value="synced">Synced</option>
              <option value="queued">Queued</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={filters.limit}
              onChange={(event) => setFilters((current) => ({ ...current, limit: Number(event.target.value) }))}
              className="h-12 rounded-2xl border border-white/10 bg-slate-900 px-4 text-xs font-black uppercase tracking-[0.1em] text-white outline-none"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </div>

          {error ? (
            <div className="flex items-center gap-3 rounded-2xl border border-rose-300/25 bg-rose-500/10 p-4 text-sm font-bold text-rose-100">
              <AlertTriangle size={18} />
              {error}
            </div>
          ) : null}
          {importMessage ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
              <FileSpreadsheet size={18} />
              {importMessage}
            </div>
          ) : null}
          {formManagerMessage ? (
            <div className="flex items-center gap-3 rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4 text-sm font-bold text-blue-100">
              <ShieldCheck size={18} />
              {formManagerMessage}
            </div>
          ) : null}

          <section className="rounded-3xl border border-blue-300/15 bg-slate-900/55 p-4 shadow-xl shadow-blue-950/15">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Gestionnaire XLSForm</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {importedForms.length} formulaire(s) importe(s), {activeFormCount} actif(s), {inactiveFormCount} bloque(s)
                </p>
              </div>
              <button
                type="button"
                onClick={loadFormDefinitions}
                disabled={isLoadingForms}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-100 hover:bg-white/[0.08] disabled:opacity-50"
              >
                <RefreshCw size={13} className={isLoadingForms ? 'animate-spin' : ''} />
                Recharger
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {importedForms.length === 0 && !isLoadingForms ? (
                <div className="rounded-2xl border border-dashed border-white/12 bg-slate-950/30 p-4 text-sm font-semibold text-slate-400">
                  Aucun XLSForm importe. Utilisez le bouton Import XLSForm pour charger une version depuis le fichier Kobo.
                </div>
              ) : null}
              {importedForms.map((form) => {
                const diagnostics = form.diagnostics || {};
                const active = form.active !== false;
                return (
                  <article
                    key={form.formKey}
                    className={`rounded-2xl border p-4 transition-colors ${
                      active
                        ? 'border-emerald-300/20 bg-emerald-500/[0.06]'
                        : 'border-white/10 bg-slate-950/45 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">{form.title || form.formKey}</p>
                        <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          {form.formKey} - v{form.formVersion || 'non versionne'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
                          active
                            ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
                            : 'border-slate-300/15 bg-slate-500/10 text-slate-300'
                        }`}
                      >
                        {active ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {([
                        ['Champs', diagnostics.fieldCount],
                        ['Requis', diagnostics.requiredCount],
                        ['Historique', form.historyCount || 0],
                      ] as Array<[string, unknown]>).map(([label, value]) => (
                        <div key={String(label)} className="rounded-xl border border-white/8 bg-slate-950/30 p-2">
                          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
                          <p className="mt-1 text-sm font-black text-white">{Number(value ?? 0)}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] font-semibold text-slate-500">
                      Dernier import: {formatDateTime(form.importedAt || form.updatedAt || null)}
                    </p>
                    {form.previousComparisonSummary ? (
                      <p className="mt-2 rounded-xl border border-amber-200/10 bg-amber-400/[0.06] px-3 py-2 text-[10px] font-bold text-amber-50">
                        Delta precedent: {Number((form.previousComparisonSummary as any).fieldsAdded || 0)} ajout(s),{' '}
                        {Number((form.previousComparisonSummary as any).fieldsChanged || 0)} changement(s),{' '}
                        {Number((form.previousComparisonSummary as any).fieldsRemoved || 0)} retrait(s).
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleToggleFormStatus(form)}
                      disabled={formStatusUpdating === form.formKey}
                      className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors disabled:opacity-50 ${
                        active
                          ? 'border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/18'
                          : 'border-emerald-300/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/18'
                      }`}
                    >
                      <ShieldCheck size={13} />
                      {formStatusUpdating === form.formKey
                        ? 'Mise a jour...'
                        : active
                          ? 'Desactiver les soumissions'
                          : 'Activer pour collecte'}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-8">
            {[
              { label: 'Total VPS', value: globalDiagnostics?.total ?? listDiagnostics?.count ?? submissions.length, icon: Database },
              { label: '24h', value: globalDiagnostics?.receivedLast24h ?? 0, icon: Activity },
              { label: 'Soumis', value: countValue(globalDiagnostics, 'byStatus', 'submitted') + countValue(globalDiagnostics, 'byStatus', 'validated'), icon: CheckCircle2 },
              { label: 'Brouillons', value: countValue(globalDiagnostics, 'byStatus', 'draft'), icon: FileJson },
              { label: 'Requis manquants', value: globalDiagnostics?.missingRequiredCount ?? listDiagnostics?.missingRequiredCount ?? 0, icon: AlertTriangle },
              { label: 'Corrections', value: globalDiagnostics?.validationIssueCount ?? listDiagnostics?.validationIssueCount ?? 0, icon: AlertTriangle },
              { label: 'File terrain', value: globalDiagnostics?.clientQueue?.pending ?? 0, icon: Upload },
              { label: 'Medias', value: globalDiagnostics?.mediaStats?.attachmentCount ?? 0, icon: FileSpreadsheet },
              { label: 'Etat moteur', value: String(health).toUpperCase(), icon: Server, tone: healthClass },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className={`rounded-2xl border p-4 ${stat.tone || 'border-white/10 bg-white/[0.045] text-slate-100'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{stat.label}</p>
                    <Icon size={16} className="text-blue-200" />
                  </div>
                  <p className="mt-3 text-2xl font-black text-white">{stat.value}</p>
                </div>
              );
            })}
          </div>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-3xl border border-blue-300/15 bg-blue-500/[0.055] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Versions terrain</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">Versions utilisees et formulaires actifs.</p>
                </div>
                <Server size={18} className="text-blue-200" />
              </div>
              <div className="mt-4 space-y-2">
                {Object.entries(globalDiagnostics?.byFormVersion || {}).slice(0, 5).map(([version, count]) => (
                  <div key={version} className="flex items-center justify-between rounded-2xl border border-white/8 bg-slate-950/25 px-3 py-2">
                    <span className="truncate text-[11px] font-black text-white">v{version}</span>
                    <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-slate-300">{count}</span>
                  </div>
                ))}
                {Object.keys(globalDiagnostics?.byFormVersion || {}).length === 0 ? (
                  <p className="rounded-2xl border border-white/8 bg-slate-950/25 px-3 py-3 text-[11px] font-semibold text-slate-500">
                    Aucune version encore observee.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-sky-300/15 bg-sky-500/[0.055] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-100">File offline terrain</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Dernier signalement: {formatDateTime(globalDiagnostics?.clientQueue?.latestReportedAt || null)}
                  </p>
                </div>
                <Upload size={18} className="text-sky-200" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ['Attente', globalDiagnostics?.clientQueue?.pending || 0],
                  ['Echecs', globalDiagnostics?.clientQueue?.failed || 0],
                  ['Bloques', globalDiagnostics?.clientQueue?.blocked || 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-slate-950/25 p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-black text-white">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 rounded-2xl border border-white/8 bg-slate-950/25 px-3 py-2 text-[11px] font-bold text-slate-300">
                Medias en attente: {formatBytes(globalDiagnostics?.clientQueue?.mediaBytes)}
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-300/15 bg-emerald-500/[0.055] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-100">Stockage medias</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">Photos, fichiers, signatures, audio et video.</p>
                </div>
                <FileSpreadsheet size={18} className="text-emerald-200" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  ['Stockes', globalDiagnostics?.mediaStats?.serverStoredCount || 0],
                  ['Non resolus', globalDiagnostics?.mediaStats?.unresolvedCount || 0],
                  ['Doublons hash', globalDiagnostics?.mediaStats?.duplicateHashCount || 0],
                  ['Volume', formatBytes(globalDiagnostics?.mediaStats?.totalStoredBytes)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-slate-950/25 p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
                    <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {globalDiagnostics?.warnings?.length ? (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-100">Points a surveiller</p>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                {globalDiagnostics.warnings.map((warning) => (
                  <div key={warning} className="rounded-xl border border-amber-200/15 bg-slate-950/25 p-3 text-[12px] font-bold leading-relaxed text-amber-50">
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/45">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Journal des fiches</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    Version serveur: {globalDiagnostics?.serverFormVersion || INTERNAL_KOBO_FORM_SETTINGS.version}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black text-slate-300">
                  {submissions.length} chargees
                </span>
              </div>
              <div className="max-h-[680px] overflow-auto custom-scrollbar">
                {submissions.length === 0 && !isLoading ? (
                  <div className="p-8 text-center text-sm font-semibold text-slate-400">
                    Aucune soumission ne correspond aux filtres.
                  </div>
                ) : null}
                {submissions.map((submission) => {
                  const isSelected = selectedSubmission?.id === submission.id;
                  const validationIssueCount = Array.isArray((submission.metadata as any)?.serverValidationIssues)
                    ? (submission.metadata as any).serverValidationIssues.length
                    : 0;
                  return (
                    <button
                      key={submission.id}
                      type="button"
                      onClick={() => setSelectedId(submission.id)}
                      className={`grid w-full grid-cols-1 gap-3 border-b border-white/8 p-4 text-left transition-all md:grid-cols-[1fr_auto] ${
                        isSelected ? 'bg-blue-500/12 ring-1 ring-inset ring-blue-300/20' : 'hover:bg-white/[0.035]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-white">
                            {submission.household?.name || `Menage ${submission.numeroOrdre || '-'}`}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${statusClass(submission.status)}`}>
                            {statusLabels[submission.status] || submission.status}
                          </span>
                          {(submission.requiredMissing || []).length > 0 ? (
                            <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-amber-100">
                              {submission.requiredMissing.length} requis
                            </span>
                          ) : null}
                          {validationIssueCount > 0 ? (
                            <span className="rounded-full border border-rose-300/25 bg-rose-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-rose-100">
                              {validationIssueCount} correction(s)
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-[11px] font-semibold text-slate-400">
                          Numero {submission.numeroOrdre || submission.household?.numeroordre || '-'} - {formatInternalKoboValue(submission.role || '', 'roles') || 'Role non renseigne'}
                        </p>
                        <p className="mt-1 truncate text-[10px] font-semibold text-slate-600">
                          {submission.clientSubmissionId}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 md:justify-end">
                        <span className="text-[11px] font-black text-slate-300">{formatDateTime(submission.savedAt)}</span>
                        <Eye size={16} className={isSelected ? 'text-blue-200' : 'text-slate-600'} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="min-h-[460px] rounded-3xl border border-white/10 bg-slate-900/45">
              {selectedSubmission ? (
                <div className="flex h-full flex-col">
                  <div className="border-b border-white/10 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-100">Recu Kobo interne</p>
                        <h3 className="mt-2 truncate text-lg font-black text-white">
                          {selectedSubmission.household?.name || `Menage ${selectedSubmission.numeroOrdre || '-'}`}
                        </h3>
                        <p className="mt-1 text-[11px] font-semibold text-slate-400">
                          {formatInternalKoboValue(selectedSubmission.role || '', 'roles')} - {formatDateTime(selectedSubmission.savedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedId('')}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-500 hover:text-white"
                        aria-label="Masquer le detail"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="mt-4 grid grid-cols-[auto_1fr] gap-4">
                      {receiptQr ? (
                        <img src={receiptQr} alt="QR code recu Kobo interne" className="h-28 w-28 rounded-2xl border border-white/10 bg-white p-2" />
                      ) : (
                        <div className="grid h-28 w-28 place-items-center rounded-2xl border border-white/10 bg-slate-950/40 text-[10px] font-black text-slate-500">
                          QR
                        </div>
                      )}
                      <div className="min-w-0 space-y-2">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">ID client</p>
                          <p className="mt-1 truncate text-[11px] font-bold text-slate-100">{selectedSubmission.clientSubmissionId}</p>
                        </div>
                        <button
                          type="button"
                          onClick={copyReceipt}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-300/25 bg-blue-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-blue-100 hover:bg-blue-500/18"
                        >
                          <Copy size={13} />
                          {copied ? 'Copie' : 'Copier recu'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ['Statut', statusLabels[selectedSubmission.status] || selectedSubmission.status],
                        ['Sync', selectedSubmission.syncStatus],
                        ['Version', selectedSubmission.formVersion],
                        ['Agent', selectedSubmission.submittedBy?.name || selectedSubmission.submittedBy?.email || '-'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/25 p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
                          <p className="mt-1 truncate text-[11px] font-bold text-slate-100">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-2xl border border-blue-300/15 bg-blue-500/[0.06] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-100">Validation admin</p>
                          <p className="mt-1 text-[10px] font-semibold text-slate-500">Decision stockee avec horodatage et agent.</p>
                        </div>
                        <ShieldCheck size={18} className="text-blue-200" />
                      </div>
                      <textarea
                        value={reviewNote}
                        onChange={(event) => setReviewNote(event.target.value)}
                        rows={2}
                        placeholder="Observation de validation..."
                        className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2 text-xs font-semibold text-white outline-none placeholder:text-slate-500 focus:border-blue-300/40"
                      />
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => handleReview('validated')}
                          disabled={isReviewing || (selectedSubmission.requiredMissing || []).length > 0 || selectedValidationIssues.length > 0}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-500/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          <CheckCircle2 size={13} />
                          Valider
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReview('rejected')}
                          disabled={isReviewing}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-500/12 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          <X size={13} />
                          Rejeter
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReview('submitted')}
                          disabled={isReviewing}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-100 hover:bg-white/[0.08] disabled:opacity-50"
                        >
                          <RefreshCw size={13} className={isReviewing ? 'animate-spin' : ''} />
                          A revoir
                        </button>
                      </div>
                    </div>

                    {(selectedSubmission.requiredMissing || []).length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">Champs requis restants</p>
                        <p className="mt-2 break-words text-[11px] font-bold leading-relaxed text-amber-50">
                          {selectedSubmission.requiredMissing.join(', ')}
                        </p>
                      </div>
                    ) : null}

                    {selectedValidationIssues.length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-100">Corrections serveur</p>
                        <div className="mt-2 space-y-2">
                          {selectedValidationIssues.map((issue: any, index: number) => (
                            <div key={`${issue.field || 'issue'}-${index}`} className="rounded-xl border border-rose-200/10 bg-slate-950/25 p-2">
                              <p className="text-[10px] font-black text-rose-50">{issue.field || 'Champ inconnu'}</p>
                              <p className="mt-1 text-[10px] font-semibold leading-relaxed text-rose-100/80">{issue.message || 'Valeur a corriger'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedAttachments.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">Pieces jointes</p>
                        <div className="mt-3 grid grid-cols-1 gap-2">
                          {selectedAttachments.map((attachment, index) => (
                            <a
                              key={attachment.id || `${attachment.fieldName}-${index}`}
                              href={attachment.url || attachment.dataUrl || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.06] p-3 text-left transition-colors hover:bg-emerald-400/[0.1]"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-black text-emerald-50">{attachment.fileName || attachment.fieldName}</p>
                                <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-100/60">
                                  {attachment.fieldName} - {attachment.storage || attachment.status || 'stockee'}
                                </p>
                              </div>
                              <Download size={15} className="shrink-0 text-emerald-100" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-100">Valeurs saisies</p>
                      <div className="mt-3 grid grid-cols-1 gap-2">
                        {valueEntries.slice(0, 80).map(([key, value]) => (
                          <div key={key} className="rounded-2xl border border-white/8 bg-slate-950/25 p-3">
                            <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{key}</p>
                            <p className="mt-1 break-words text-[11px] font-bold leading-relaxed text-slate-100">
                              {Array.isArray(value)
                                ? value.join(', ')
                                : typeof value === 'object'
                                  ? JSON.stringify(value)
                                  : String(value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">Observabilite</p>
                      <div className="mt-3 grid grid-cols-1 gap-2">
                        {metadataEntries.slice(0, 40).map(([key, value]) => (
                          <div key={key} className="rounded-2xl border border-cyan-200/10 bg-cyan-400/[0.055] p-3">
                            <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-cyan-100/70">{key}</p>
                            <p className="mt-1 break-words text-[11px] font-bold leading-relaxed text-slate-100">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid h-full min-h-[460px] place-items-center p-8 text-center">
                  <div>
                    <ClipboardCheck className="mx-auto text-slate-600" size={42} />
                    <p className="mt-4 text-sm font-black text-white">Selectionnez une fiche</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">Le detail, le recu QR et les metadonnees apparaitront ici.</p>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </ContentArea>
    </PageContainer>
  );
}
