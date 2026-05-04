import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import QRCode from 'qrcode';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  BookOpen,
  Calculator,
  CalendarDays,
  Camera,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Clock3,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  File,
  FileAudio,
  FileText,
  FileJson,
  FileSpreadsheet,
  FileUp,
  GripVertical,
  Hash,
  Image,
  Layers,
  Link,
  Map,
  MapPin,
  MoreHorizontal,
  MousePointer2,
  Pencil,
  PenLine,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Table2,
  Trash2,
  Type,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '../components';
import {
  fetchInternalKoboFormDefinitions,
  fetchInternalKoboDiagnostics,
  fetchInternalKoboSubmissionsReport,
  createInternalKoboFormDefinition,
  downloadInternalKoboSubmissionsExport,
  importInternalKoboXlsForm,
  importInternalKoboXlsFormFromUrl,
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
import {
  formatKoboSourceColumnLabel,
  KOBO_SOURCE_RUBRICS,
  KOBO_SOURCE_SNAPSHOT,
} from '../components/terrain/koboSourceSnapshot';

type Filters = {
  q: string;
  status: '' | InternalKoboSubmissionStatus;
  role: string;
  syncStatus: string;
  limit: number;
};

type MainTab = 'summary' | 'form' | 'data' | 'settings';
type DataTab = 'table' | 'reports' | 'gallery' | 'downloads' | 'map';
type WorkspaceSection = 'new' | 'deployed' | 'drafts' | 'archives';
type NewProjectStep = 'source' | 'details' | null;
type BuilderMode = 'blank' | 'template' | 'import' | 'url';
type BuilderQuestionType =
  | 'integer'
  | 'decimal'
  | 'text'
  | 'select_one'
  | 'select_multiple'
  | 'note'
  | 'geopoint'
  | 'image'
  | 'signature'
  | 'file'
  | 'audio'
  | 'video'
  | 'date'
  | 'time'
  | 'datetime'
  | 'barcode'
  | 'calculate'
  | 'acknowledge';
type BuilderDropPosition = 'before' | 'after';
type BuilderSettingsTab = 'options' | 'branching' | 'validation';

type BuilderQuestion = {
  id: string;
  type: BuilderQuestionType;
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  listName?: string;
  choices?: Array<{ name: string; label: string }>;
  relevant?: string;
  calculation?: string;
  constraint?: string;
  constraintMessage?: string;
  defaultValue?: string;
  appearance?: string;
  readOnly?: boolean;
};

type ProjectDraft = {
  title: string;
  description: string;
  sector: string;
  country: string;
};

type KoboTableColumn = {
  id: string;
  label: string;
  kind: 'date' | 'number' | 'text' | 'select' | 'image' | 'boolean';
  listName?: string;
};

const mainTabs: Array<{ id: MainTab; label: string; icon: typeof ClipboardCheck }> = [
  { id: 'summary', label: 'Sommaire', icon: ClipboardCheck },
  { id: 'form', label: 'Formulaire', icon: FileText },
  { id: 'data', label: 'Donnees', icon: Table2 },
  { id: 'settings', label: 'Parametres', icon: Settings },
];

const dataTabs: Array<{ id: DataTab; label: string; icon: typeof Table2 }> = [
  { id: 'table', label: 'Tableau', icon: Table2 },
  { id: 'reports', label: 'Rapports', icon: BarChart3 },
  { id: 'gallery', label: 'Galerie photo', icon: Image },
  { id: 'downloads', label: 'Telechargements', icon: Download },
  { id: 'map', label: 'Carte', icon: Map },
];

const koboTableColumns: KoboTableColumn[] = [
  { id: 'start', label: 'start', kind: 'date' },
  { id: 'Numero_ordre', label: 'Numero ordre', kind: 'number' },
  { id: 'nom_key', label: 'Prenom et Nom', kind: 'text' },
  { id: 'region_key', label: 'Region', kind: 'text' },
  { id: 'role', label: 'Votre Role', kind: 'select', listName: 'roles' },
  { id: 'Situation_du_M_nage', label: 'Situation du Menage', kind: 'select' },
  { id: 'Photo', label: 'Photo', kind: 'image' },
  { id: 'terre', label: 'Valeur terre', kind: 'text' },
  { id: 'notes_generales', label: 'Notes generales', kind: 'text' },
];

const projectSectors = ['Energie', 'Eau et assainissement', 'Sante', 'Education', 'Infrastructure', 'Autre'];
const projectCountries = ['Senegal', 'Gambie', 'Mali', 'Guinee', 'Autre'];

const builderFieldPalette: Array<{
  type: BuilderQuestionType;
  label: string;
  description: string;
  icon: typeof Type;
  defaultListName?: string;
  defaultChoices?: Array<{ name: string; label: string }>;
  appearance?: string;
}> = [
  { type: 'text', label: 'Texte', description: 'Saisie libre ou observation', icon: Type },
  { type: 'integer', label: 'Nombre entier', description: 'Compteur, quantite, ordre', icon: Hash },
  { type: 'decimal', label: 'Decimal', description: 'Valeur terre, mesure, montant', icon: Calculator },
  {
    type: 'select_one',
    label: 'Choix unique',
    description: 'Une seule reponse possible',
    icon: CheckCircle2,
    defaultListName: 'oui_non',
    defaultChoices: [
      { name: 'oui', label: 'Oui' },
      { name: 'non', label: 'Non' },
    ],
  },
  {
    type: 'select_multiple',
    label: 'Choix multiple',
    description: 'Plusieurs reponses possibles',
    icon: CheckSquare,
    defaultListName: 'options_multiples',
    defaultChoices: [
      { name: 'option_1', label: 'Option 1' },
      { name: 'option_2', label: 'Option 2' },
    ],
  },
  { type: 'note', label: 'Note', description: 'Texte informatif non saisi', icon: FileText },
  { type: 'geopoint', label: 'GPS', description: 'Position terrain', icon: MapPin },
  { type: 'image', label: 'Photo', description: 'Camera ou galerie', icon: Camera },
  { type: 'signature', label: 'Signature', description: 'Signature tactile', icon: PenLine },
  { type: 'file', label: 'Fichier', description: 'Piece jointe', icon: File },
  { type: 'audio', label: 'Audio', description: 'Enregistrement sonore', icon: FileAudio },
  { type: 'video', label: 'Video', description: 'Capture video', icon: Video },
  { type: 'date', label: 'Date', description: 'Jour de passage', icon: CalendarDays },
  { type: 'time', label: 'Heure', description: 'Heure terrain', icon: Clock3 },
  { type: 'datetime', label: 'Date + heure', description: 'Horodatage complet', icon: CalendarDays },
  { type: 'barcode', label: 'Code-barres', description: 'Reference scannee', icon: Hash },
  { type: 'calculate', label: 'Calcul', description: 'Valeur auto XLSForm', icon: Calculator },
  { type: 'acknowledge', label: 'Confirmation', description: 'Case de validation', icon: CheckSquare },
];

const makeQuestionId = () => `q_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const normalizeBuilderName = (value: string, fallback: string) =>
  (value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || fallback;

const getBlankBuilderQuestions = (): BuilderQuestion[] => [
  {
    id: makeQuestionId(),
    type: 'integer',
    name: 'Numero_ordre',
    label: 'Numero ordre',
    hint: 'Identifiant menage relie a la base VPS',
    required: true,
  },
  {
    id: makeQuestionId(),
    type: 'text',
    name: 'nom_key',
    label: 'Prenom et Nom',
    calculation: "pulldata('Thies','nom','code_key',${Numero_ordre})",
    required: true,
  },
  {
    id: makeQuestionId(),
    type: 'select_one',
    name: 'role',
    label: 'Votre role',
    listName: 'roles',
    required: true,
  },
];

const getTemplateBuilderQuestions = (): BuilderQuestion[] => [
  ...getBlankBuilderQuestions(),
  {
    id: makeQuestionId(),
    type: 'select_one',
    name: 'kit_disponible_macon',
    label: 'Le kit est-il disponible et complet ?',
    listName: 'oui_non',
    required: true,
    relevant: "${role} = 'macon'",
  },
  {
    id: makeQuestionId(),
    type: 'text',
    name: 'notes_generales',
    label: 'Notes generales',
    required: true,
  },
];

const builderQuestionTypeLabel: Record<BuilderQuestionType, string> = {
  integer: '123',
  decimal: '1.2',
  text: 'abc',
  select_one: 'one',
  select_multiple: 'multi',
  note: 'i',
  geopoint: 'gps',
  image: 'img',
  signature: 'sign',
  file: 'file',
  audio: 'audio',
  video: 'video',
  date: 'date',
  time: 'time',
  datetime: 'date+',
  barcode: 'code',
  calculate: 'calc',
  acknowledge: 'ok',
};

const getBuilderTypeForSurvey = (question: BuilderQuestion) => {
  if (question.type === 'select_one') return `select_one ${question.listName || 'oui_non'}`;
  if (question.type === 'select_multiple') return `select_multiple ${question.listName || 'oui_non'}`;
  return question.type;
};

const createBuilderQuestion = (type: BuilderQuestionType, index: number): BuilderQuestion => {
  const paletteItem = builderFieldPalette.find((item) => item.type === type);
  const baseName = normalizeBuilderName(`${type}_${index}`, `question_${index}`);
  return {
    id: makeQuestionId(),
    type,
    name: baseName,
    label: paletteItem?.label || `Question ${index}`,
    hint: paletteItem?.description || '',
    listName: paletteItem?.defaultListName,
    choices: paletteItem?.defaultChoices,
    appearance: paletteItem?.appearance,
    required: false,
  };
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

const getSubmissionValueByAliases = (submission: InternalKoboSubmissionRecord, aliases: string[]) => {
  const values = submission.values || {};
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(values, alias)) return values[alias];
  }
  return undefined;
};

const getKoboTableValue = (submission: InternalKoboSubmissionRecord, column: KoboTableColumn) => {
  if (column.id === 'start') return (submission.values as any).start || submission.savedAt || submission.createdAt;
  if (column.id === 'Numero_ordre') return submission.numeroOrdre || submission.household?.numeroordre || getSubmissionValueByAliases(submission, ['Numero_ordre', 'numero_ordre']);
  if (column.id === 'nom_key') return submission.household?.name || getSubmissionValueByAliases(submission, ['nom_key', 'PRENOM', 'NOM']);
  if (column.id === 'region_key') return submission.household?.region || getSubmissionValueByAliases(submission, ['region_key', 'Region']);
  if (column.id === 'role') return submission.role || getSubmissionValueByAliases(submission, ['role']);
  if (column.id === 'Situation_du_M_nage') return getSubmissionValueByAliases(submission, ['Situation_du_M_nage', 'Situation_du_Menage', 'group_wu8kv54/Situation_du_M_nage']);
  if (column.id === 'Photo') return getSubmissionAttachments(submission).find((attachment) => String(attachment.mimeType || '').startsWith('image/'))?.url || getSubmissionValueByAliases(submission, ['Photo']);
  if (column.id === 'terre') return getSubmissionValueByAliases(submission, ['VALEUR_DE_LA_RESISTANCE_DE_TER', 'VALEUR_DE_LA_RESISTANCE_DE_TERRE']);
  return getSubmissionValueByAliases(submission, [column.id]);
};

const formatKoboTableCellValue = (submission: InternalKoboSubmissionRecord, column: KoboTableColumn) => {
  const value = getKoboTableValue(submission, column);
  if (column.kind === 'date') return formatDateTime(String(value || ''));
  if (column.listName) return formatInternalKoboValue(String(value || ''), column.listName) || String(value || '');
  if (Array.isArray(value)) return value.join(', ');
  return String(value ?? '');
};

export default function InternalKoboSubmissions() {
  const [mainTab, setMainTab] = useState<MainTab>('data');
  const [dataTab, setDataTab] = useState<DataTab>('table');
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>('deployed');
  const [newProjectStep, setNewProjectStep] = useState<NewProjectStep>(null);
  const [builderMode, setBuilderMode] = useState<BuilderMode>('template');
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>({
    title: '',
    description: '',
    sector: 'Energie',
    country: 'Senegal',
  });
  const [builderQuestions, setBuilderQuestions] = useState<BuilderQuestion[]>(getTemplateBuilderQuestions);
  const [selectedBuilderQuestionId, setSelectedBuilderQuestionId] = useState('');
  const [builderSettingsTab, setBuilderSettingsTab] = useState<BuilderSettingsTab>('options');
  const [builderDropTarget, setBuilderDropTarget] = useState<{ id: string; position: BuilderDropPosition } | null>(null);
  const [builderDraggingLabel, setBuilderDraggingLabel] = useState('');
  const [selectedRubricTitle, setSelectedRubricTitle] = useState('Menage');
  const [selectedTableRows, setSelectedTableRows] = useState<string[]>([]);
  const [hiddenTableColumns, setHiddenTableColumns] = useState<string[]>([]);
  const [tableColumnFilters, setTableColumnFilters] = useState<Record<string, string>>({});
  const [showTableFieldsPanel, setShowTableFieldsPanel] = useState(false);
  const [isSavingBuilder, setIsSavingBuilder] = useState(false);
  const [importUrl, setImportUrl] = useState('');
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
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const showLegacyKoboTable = typeof window !== 'undefined' && window.location.search.includes('legacyKoboTable=1');

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

  const handleImportXlsFormUrl = async () => {
    const url = importUrl.trim();
    if (!url) {
      setError('Veuillez saisir une URL XLSForm valide');
      return;
    }
    setIsImporting(true);
    setImportMessage('');
    setError('');
    try {
      const result = await importInternalKoboXlsFormFromUrl(url);
      setImportMessage(`XLSForm importe depuis URL: ${result.form?.title || result.form?.formKey || 'formulaire'}`);
      setImportUrl('');
      setNewProjectStep(null);
      await loadFormDefinitions();
      await loadSubmissions();
      setMainTab('form');
      setWorkspaceSection('deployed');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import URL XLSForm impossible');
    } finally {
      setIsImporting(false);
    }
  };

  const openWorkspaceSection = (section: WorkspaceSection) => {
    setWorkspaceSection(section);
    if (section === 'new') {
      setNewProjectStep('source');
      setMainTab('form');
      return;
    }
    if (section === 'deployed') {
      setMainTab('form');
      setFilters((current) => ({ ...current, status: '', syncStatus: '', role: '' }));
      return;
    }
    if (section === 'drafts') {
      setMainTab('data');
      setDataTab('table');
      setFilters((current) => ({ ...current, status: 'draft' }));
      return;
    }
    setMainTab('form');
  };

  const startProjectFromSource = (mode: BuilderMode) => {
    setBuilderMode(mode);
    if (mode === 'import') {
      importFileInputRef.current?.click();
      return;
    }
    if (mode === 'url') {
      setNewProjectStep('details');
      return;
    }
    setBuilderQuestions(mode === 'blank' ? getBlankBuilderQuestions() : getTemplateBuilderQuestions());
    setSelectedBuilderQuestionId('');
    setProjectDraft((current) => ({
      ...current,
      title: current.title || (mode === 'template' ? 'Copie de Suivi Electrification menages V2' : ''),
      description: current.description || (mode === 'template' ? 'Formulaire cree a partir de la structure Kobo active.' : ''),
    }));
    setNewProjectStep('details');
  };

  const updateBuilderQuestion = (id: string, patch: Partial<BuilderQuestion>) => {
    setBuilderQuestions((current) =>
      current.map((question) => {
        if (question.id !== id) return question;
        const next = { ...question, ...patch };
        if (patch.label !== undefined && (!question.name || question.name.startsWith('question_'))) {
          next.name = normalizeBuilderName(String(patch.label || ''), question.name || 'question');
        }
        if ((patch.type === 'select_one' || patch.type === 'select_multiple') && !next.listName) {
          next.listName = `${next.name || 'question'}_choices`;
          next.choices = next.choices?.length ? next.choices : [
            { name: 'option_1', label: 'Option 1' },
            { name: 'option_2', label: 'Option 2' },
          ];
        }
        return next;
      })
    );
  };

  const addBuilderQuestion = (afterId?: string, type: BuilderQuestionType = 'text') => {
    const question = createBuilderQuestion(type, builderQuestions.length + 1);
    setBuilderQuestions((current) => {
      const index = afterId ? current.findIndex((entry) => entry.id === afterId) : -1;
      if (index < 0) return [...current, question];
      return [...current.slice(0, index + 1), question, ...current.slice(index + 1)];
    });
    setSelectedBuilderQuestionId(question.id);
    setBuilderSettingsTab('options');
  };

  const duplicateBuilderQuestion = (id: string) => {
    setBuilderQuestions((current) => {
      const index = current.findIndex((question) => question.id === id);
      if (index < 0) return current;
      const clone = {
        ...current[index],
        id: makeQuestionId(),
        name: `${current[index].name}_copie`.slice(0, 48),
        label: `${current[index].label} copie`,
      };
      return [...current.slice(0, index + 1), clone, ...current.slice(index + 1)];
    });
  };

  const deleteBuilderQuestion = (id: string) => {
    setBuilderQuestions((current) => current.filter((question) => question.id !== id));
    setSelectedBuilderQuestionId((current) => (current === id ? '' : current));
  };

  const moveBuilderQuestion = (sourceId: string, targetId: string, position: BuilderDropPosition) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setBuilderQuestions((current) => {
      const source = current.find((question) => question.id === sourceId);
      if (!source) return current;
      const withoutSource = current.filter((question) => question.id !== sourceId);
      const targetIndex = withoutSource.findIndex((question) => question.id === targetId);
      if (targetIndex < 0) return current;
      const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
      return [
        ...withoutSource.slice(0, insertIndex),
        source,
        ...withoutSource.slice(insertIndex),
      ];
    });
  };

  const moveBuilderQuestionByOffset = (id: string, offset: number) => {
    setBuilderQuestions((current) => {
      const index = current.findIndex((question) => question.id === id);
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [question] = next.splice(index, 1);
      next.splice(nextIndex, 0, question);
      return next;
    });
  };

  const addBuilderChoice = (questionId: string) => {
    setBuilderQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId) return question;
        const nextIndex = (question.choices?.length || 0) + 1;
        return {
          ...question,
          choices: [
            ...(question.choices || []),
            { name: `option_${nextIndex}`, label: `Option ${nextIndex}` },
          ],
        };
      })
    );
  };

  const updateBuilderChoice = (
    questionId: string,
    choiceIndex: number,
    patch: Partial<{ name: string; label: string }>
  ) => {
    setBuilderQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId) return question;
        return {
          ...question,
          choices: (question.choices || []).map((choice, index) =>
            index === choiceIndex
              ? {
                  ...choice,
                  ...patch,
                  name: patch.name !== undefined ? normalizeBuilderName(patch.name, choice.name || `option_${index + 1}`) : choice.name,
                }
              : choice
          ),
        };
      })
    );
  };

  const deleteBuilderChoice = (questionId: string, choiceIndex: number) => {
    setBuilderQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? { ...question, choices: (question.choices || []).filter((_, index) => index !== choiceIndex) }
          : question
      )
    );
  };

  const handleBuilderPaletteDragStart = (event: DragEvent<HTMLElement>, type: BuilderQuestionType, label: string) => {
    event.dataTransfer.setData('application/x-gem-builder-type', type);
    event.dataTransfer.effectAllowed = 'copy';
    setBuilderDraggingLabel(label);
  };

  const handleBuilderQuestionDragStart = (event: DragEvent<HTMLElement>, question: BuilderQuestion) => {
    event.dataTransfer.setData('application/x-gem-builder-question', question.id);
    event.dataTransfer.effectAllowed = 'move';
    setBuilderDraggingLabel(question.label || question.name);
  };

  const handleBuilderQuestionDragOver = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const position: BuilderDropPosition = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    setBuilderDropTarget({ id: targetId, position });
    event.dataTransfer.dropEffect = event.dataTransfer.types.includes('application/x-gem-builder-type') ? 'copy' : 'move';
  };

  const handleBuilderDrop = (event: DragEvent<HTMLElement>, targetId: string, fallbackPosition: BuilderDropPosition = 'after') => {
    event.preventDefault();
    const position = builderDropTarget?.id === targetId ? builderDropTarget.position : fallbackPosition;
    const sourceQuestionId = event.dataTransfer.getData('application/x-gem-builder-question');
    const sourceType = event.dataTransfer.getData('application/x-gem-builder-type') as BuilderQuestionType;
    if (sourceQuestionId) {
      moveBuilderQuestion(sourceQuestionId, targetId, position);
    } else if (sourceType) {
      const question = createBuilderQuestion(sourceType, builderQuestions.length + 1);
      setBuilderQuestions((current) => {
        const targetIndex = current.findIndex((entry) => entry.id === targetId);
        if (targetIndex < 0) return [...current, question];
        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        return [...current.slice(0, insertIndex), question, ...current.slice(insertIndex)];
      });
      setSelectedBuilderQuestionId(question.id);
      setBuilderSettingsTab('options');
    }
    setBuilderDropTarget(null);
    setBuilderDraggingLabel('');
  };

  const handleBuilderCanvasDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const sourceType = event.dataTransfer.getData('application/x-gem-builder-type') as BuilderQuestionType;
    if (sourceType && !builderDropTarget) addBuilderQuestion(undefined, sourceType);
    setBuilderDropTarget(null);
    setBuilderDraggingLabel('');
  };

  const buildBuilderSurvey = () => [
    { type: 'start', name: 'start' },
    { type: 'end', name: 'end' },
    { type: 'begin_group', name: 'TYPE_DE_VISITE', label: 'Menage' },
    ...builderQuestions.map((question) => ({
      type: getBuilderTypeForSurvey(question),
      name: normalizeBuilderName(question.name || question.label, 'question'),
      label: question.label,
      hint: question.hint || '',
      required: question.required ? 'yes' : '',
      relevant: question.relevant || '',
      calculation: question.calculation || '',
      constraint: question.constraint || '',
      constraint_message: question.constraintMessage || '',
      default: question.defaultValue || '',
      appearance: question.appearance || '',
      readonly: question.readOnly ? 'yes' : '',
    })),
    { type: 'end_group', name: 'TYPE_DE_VISITE_end' },
  ];

  const buildBuilderChoices = () =>
    builderQuestions.flatMap((question) =>
      (question.choices || []).map((choice) => ({
        list_name: question.listName || `${question.name}_choices`,
        name: normalizeBuilderName(choice.name || choice.label, 'choice'),
        label: choice.label,
      }))
    );

  const handleSaveBuilderProject = async () => {
    if (!projectDraft.title.trim()) {
      setError('Le nom du projet est obligatoire');
      setNewProjectStep('details');
      return;
    }
    setIsSavingBuilder(true);
    setError('');
    setFormManagerMessage('');
    try {
      const result = await createInternalKoboFormDefinition({
        title: projectDraft.title.trim(),
        description: projectDraft.description.trim(),
        sector: projectDraft.sector,
        country: projectDraft.country,
        sourceType: builderMode,
        activate: false,
        survey: buildBuilderSurvey(),
        choices: buildBuilderChoices(),
      });
      setFormManagerMessage(`Projet cree en brouillon: ${result.form?.title || result.form?.formKey || projectDraft.title}`);
      setNewProjectStep(null);
      setWorkspaceSection('deployed');
      await loadFormDefinitions();
      setMainTab('form');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Creation du formulaire impossible');
    } finally {
      setIsSavingBuilder(false);
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
  const galleryAttachments = useMemo(
    () =>
      submissions.flatMap((submission) =>
        getSubmissionAttachments(submission).map((attachment, index) => ({
          attachment,
          submission,
          key: attachment.id || `${submission.id}-${attachment.fieldName}-${index}`,
        }))
      ),
    [submissions]
  );
  const activeFormCount = importedForms.filter((form) => form.active !== false).length;
  const draftFormCount = importedForms.filter((form) => form.status === 'draft').length;
  const inactiveFormCount = importedForms.filter((form) => form.active === false && form.status !== 'draft').length;
  const selectedBuilderQuestion = builderQuestions.find((question) => question.id === selectedBuilderQuestionId) || null;
  const selectedRubric = KOBO_SOURCE_RUBRICS.find((rubric) => rubric.title === selectedRubricTitle) || KOBO_SOURCE_RUBRICS[0];
  const selectedRubricColumns = useMemo(() => {
    const title = selectedRubric?.title.toLowerCase() || '';
    const role = selectedRubric?.role || '';
    const candidates = KOBO_SOURCE_SNAPSHOT.selectedColumns.filter((column) => {
      const normalized = column.toLowerCase();
      if (title.includes('menage')) return normalized.includes('type_de_visite') || normalized.includes('numero_ordre');
      if (title.includes('livreur')) return normalized.includes('group_wu8kv54') || normalized.includes('photo');
      if (title.includes('macon')) return normalized.includes('etape_macon');
      if (title.includes('reseau')) return normalized.includes('etape_reseau');
      if (title.includes('interieure')) return normalized.includes('etape_interieur') || normalized.includes('group_hx7ae46');
      if (title.includes('controle')) return normalized.includes('group_hx7ae46') || normalized.includes('pose_du_branchement');
      if (title.includes('notes')) return normalized.includes('notes_generales');
      return role ? normalized.includes(role) : false;
    });
    return candidates.slice(0, Math.max(4, Math.min(selectedRubric?.fields || 8, 16)));
  }, [selectedRubric]);
  const visibleForms = importedForms.filter((form) => {
    if (workspaceSection === 'deployed') return form.active !== false;
    if (workspaceSection === 'drafts') return form.status === 'draft';
    if (workspaceSection === 'archives') return form.active === false && form.status !== 'draft';
    return true;
  });
  const visibleTableColumns = useMemo(
    () => koboTableColumns.filter((column) => !hiddenTableColumns.includes(column.id)),
    [hiddenTableColumns]
  );
  const filteredTableSubmissions = useMemo(
    () =>
      submissions.filter((submission) =>
        visibleTableColumns.every((column) => {
          const filter = String(tableColumnFilters[column.id] || '').trim().toLowerCase();
          if (!filter) return true;
          const rawValue = getKoboTableValue(submission, column);
          const displayValue = column.listName
            ? formatInternalKoboValue(String(rawValue || ''), column.listName) || rawValue
            : rawValue;
          return String(displayValue || '').toLowerCase().includes(filter);
        })
      ),
    [submissions, tableColumnFilters, visibleTableColumns]
  );
  const allVisibleRowsSelected = filteredTableSubmissions.length > 0 &&
    filteredTableSubmissions.every((submission) => selectedTableRows.includes(submission.id));

  const health = globalDiagnostics?.health || 'ok';
  const healthClass =
    health === 'ok'
      ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
      : 'border-amber-300/25 bg-amber-400/10 text-amber-100';
  const koboSideStats: Array<{ id: WorkspaceSection; label: string; value: number; icon: typeof ClipboardCheck; tone: string }> = [
    { id: 'new', label: 'Nouveau', value: 1, icon: ClipboardCheck, tone: 'border-blue-300/20 bg-blue-500/10 text-blue-100' },
    { id: 'deployed', label: 'Deployes', value: activeFormCount, icon: Upload, tone: 'border-emerald-300/20 bg-emerald-500/10 text-emerald-100' },
    { id: 'drafts', label: 'Brouillons', value: draftFormCount, icon: FileJson, tone: 'border-amber-300/20 bg-amber-500/10 text-amber-100' },
    { id: 'archives', label: 'Archives', value: inactiveFormCount, icon: Archive, tone: 'border-slate-300/15 bg-slate-500/10 text-slate-300' },
  ];

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
        <input
          ref={importFileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          disabled={isImporting}
          onChange={(event) => {
            handleImportXlsForm(event.target.files?.[0]);
            event.target.value = '';
            setNewProjectStep(null);
            setWorkspaceSection('deployed');
            setMainTab('form');
          }}
        />
        <div className="space-y-6 p-4 sm:p-6">
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/55">
            <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr]">
              <aside className="border-b border-white/10 bg-slate-950/35 p-4 xl:border-b-0 xl:border-r">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100">Kobo workspace</p>
                <h2 className="mt-2 text-lg font-black text-white">{KOBO_SOURCE_SNAPSHOT.name}</h2>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  Miroir interne GEM, soumission directe au VPS.
                </p>
                <div className="mt-4 space-y-2">
                  {koboSideStats.map((item) => {
                    const Icon = item.icon;
                    const active = workspaceSection === item.id;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => openWorkspaceSection(item.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition-all ${item.tone} ${
                          active ? 'ring-2 ring-cyan-200/35' : 'hover:scale-[1.01] hover:border-white/25'
                        }`}
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <Icon size={15} className="shrink-0" />
                          <span className="truncate text-[11px] font-black uppercase tracking-[0.1em]">{item.label}</span>
                        </span>
                        <span className="rounded-full bg-white/[0.08] px-2 py-1 text-[10px] font-black">{item.value}</span>
                      </button>
                    );
                  })}
                </div>
              </aside>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {mainTabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = mainTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setMainTab(tab.id)}
                        className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-[11px] font-black uppercase tracking-[0.13em] transition-colors ${
                          active
                            ? 'border-cyan-300/35 bg-cyan-400/15 text-cyan-50 shadow-lg shadow-cyan-950/20'
                            : 'border-white/10 bg-white/[0.035] text-slate-400 hover:text-white'
                        }`}
                      >
                        <Icon size={14} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                  {[
                    ['Actif Kobo', KOBO_SOURCE_SNAPSHOT.deploymentActive ? 'Oui' : 'Non'],
                    ['Soumissions VPS', globalDiagnostics?.total ?? submissions.length],
                    ['Version Kobo', KOBO_SOURCE_SNAPSHOT.currentVersionId],
                    ['Sante moteur', String(health).toUpperCase()],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl border border-white/8 bg-slate-950/30 p-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
                      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {mainTab === 'data' && dataTab === 'table' ? (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl shadow-slate-200/70">
              <div className="grid min-h-[640px] grid-cols-1 lg:grid-cols-[230px_1fr]">
                <aside className="border-b border-slate-200 bg-slate-50 lg:border-b-0 lg:border-r">
                  <div className="space-y-1 p-3">
                    {dataTabs.map((tab) => {
                      const Icon = tab.icon;
                      const active = dataTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setDataTab(tab.id)}
                          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition-colors ${
                            active
                              ? 'border-l-4 border-cyan-400 bg-white text-slate-950 shadow-sm'
                              : 'text-slate-600 hover:bg-white hover:text-slate-950'
                          }`}
                        >
                          <Icon size={21} className={active ? 'text-slate-950' : 'text-slate-500'} />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </aside>

                <div className="min-w-0">
                  <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowTableFieldsPanel((current) => !current)}
                        className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-black text-blue-800 hover:bg-blue-50"
                      >
                        {showTableFieldsPanel ? <EyeOff size={18} /> : <Eye size={18} />}
                        masquer les champs
                      </button>
                      <span className="text-sm font-semibold text-slate-500">
                        {filteredTableSubmissions.length} resultat(s) sur {submissions.length}
                      </span>
                      {selectedTableRows.length > 0 ? (
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">
                          {selectedTableRows.length} selectionnee(s)
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTableColumnFilters({})}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-50"
                      >
                        <RefreshCw size={14} />
                        reset
                      </button>
                      <button
                        type="button"
                        onClick={loadSubmissions}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-50"
                      >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        actualiser
                      </button>
                      <button
                        type="button"
                        onClick={() => exportFromServer('xlsx')}
                        disabled={submissions.length === 0}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-white hover:bg-blue-700 disabled:opacity-40"
                      >
                        <Download size={14} />
                        export
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTableFieldsPanel((current) => !current)}
                        className="grid h-10 w-10 place-items-center rounded-lg text-slate-700 hover:bg-slate-100"
                        aria-label="Parametres tableau"
                      >
                        <Settings size={22} />
                      </button>
                    </div>
                  </div>

                  {showTableFieldsPanel ? (
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Champs visibles</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {koboTableColumns.map((column) => {
                          const hidden = hiddenTableColumns.includes(column.id);
                          return (
                            <button
                              key={column.id}
                              type="button"
                              onClick={() =>
                                setHiddenTableColumns((current) =>
                                  hidden ? current.filter((id) => id !== column.id) : [...current, column.id]
                                )
                              }
                              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                                hidden
                                  ? 'border-slate-200 bg-white text-slate-400'
                                  : 'border-cyan-200 bg-cyan-50 text-cyan-800'
                              }`}
                            >
                              {hidden ? 'Masque - ' : ''}{column.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="overflow-auto">
                    <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-slate-800">
                          <th className="sticky left-0 z-10 w-[116px] border-b border-r border-slate-200 bg-slate-100 px-3 py-2 align-top">
                            <div className="text-sm font-semibold leading-tight">
                              1 - {filteredTableSubmissions.length}
                              <br />
                              <span className="font-black">{filteredTableSubmissions.length} resultats</span>
                            </div>
                          </th>
                          {visibleTableColumns.map((column) => (
                            <th key={column.id} className="min-w-[160px] border-b border-r border-slate-200 bg-slate-100 px-3 py-2 align-top">
                              <div className="flex items-start justify-between gap-3 font-black text-slate-900">
                                <span>
                                  <span className="mr-1 text-[11px] font-black text-slate-500">
                                    {column.kind === 'number' ? '123' : column.kind === 'select' ? '●' : column.kind === 'image' ? '▧' : 'abc'}
                                  </span>
                                  {column.label}
                                </span>
                                <span className="text-slate-600">▾</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                        <tr className="bg-slate-100">
                          <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-3 py-2">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={allVisibleRowsSelected}
                                onChange={(event) => {
                                  if (event.target.checked) {
                                    setSelectedTableRows(Array.from(new Set([...selectedTableRows, ...filteredTableSubmissions.map((entry) => entry.id)])));
                                  } else {
                                    setSelectedTableRows((current) =>
                                      current.filter((id) => !filteredTableSubmissions.some((entry) => entry.id === id))
                                    );
                                  }
                                }}
                                className="h-5 w-5 rounded border-slate-300 accent-blue-600"
                              />
                              <span className="text-slate-600">▾</span>
                            </label>
                          </th>
                          {visibleTableColumns.map((column) => (
                            <th key={`${column.id}-filter`} className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2">
                              {column.kind === 'select' ? (
                                <select
                                  value={tableColumnFilters[column.id] || ''}
                                  onChange={(event) => setTableColumnFilters((current) => ({ ...current, [column.id]: event.target.value }))}
                                  className="h-9 w-full rounded border border-slate-200 bg-white px-2 text-sm font-medium text-slate-900 outline-none"
                                >
                                  <option value="">Afficher tout</option>
                                  {(column.listName ? INTERNAL_KOBO_CHOICES[column.listName] || [] : []).map((choice) => (
                                    <option key={choice.name} value={choice.label}>{choice.label}</option>
                                  ))}
                                </select>
                              ) : column.kind === 'image' ? (
                                <span className="block h-9 rounded border border-transparent px-2 py-2 text-xs font-bold text-slate-400">Media</span>
                              ) : (
                                <input
                                  value={tableColumnFilters[column.id] || ''}
                                  onChange={(event) => setTableColumnFilters((current) => ({ ...current, [column.id]: event.target.value }))}
                                  placeholder="Recherche"
                                  className="h-9 w-full rounded border border-slate-200 bg-white px-2 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                                />
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTableSubmissions.length === 0 && !isLoading ? (
                          <tr>
                            <td colSpan={visibleTableColumns.length + 1} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                              Aucune soumission ne correspond aux filtres.
                            </td>
                          </tr>
                        ) : null}
                        {filteredTableSubmissions.map((submission) => {
                          const selected = selectedSubmission?.id === submission.id;
                          return (
                            <tr
                              key={submission.id}
                              onClick={() => setSelectedId(submission.id)}
                              className={`cursor-pointer transition-colors ${selected ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'}`}
                            >
                              <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-3 py-3">
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedTableRows.includes(submission.id)}
                                    onChange={(event) => {
                                      event.stopPropagation();
                                      setSelectedTableRows((current) =>
                                        event.target.checked
                                          ? Array.from(new Set([...current, submission.id]))
                                          : current.filter((id) => id !== submission.id)
                                      );
                                    }}
                                    className="h-5 w-5 rounded border-slate-300 accent-blue-600"
                                  />
                                  <Eye size={18} className="text-blue-800" />
                                  <Pencil size={18} className="text-blue-800" />
                                </div>
                              </td>
                              {visibleTableColumns.map((column) => {
                                const value = getKoboTableValue(submission, column);
                                return (
                                  <td key={`${submission.id}-${column.id}`} className="max-w-[240px] border-b border-r border-slate-200 px-3 py-3 align-top font-medium text-slate-900">
                                    {column.kind === 'image' ? (
                                      value ? (
                                        <a
                                          href={String(value)}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(event) => event.stopPropagation()}
                                          className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-800"
                                        >
                                          <Image size={14} />
                                          Photo
                                        </a>
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )
                                    ) : column.id === 'role' ? (
                                      <span className="inline-flex items-center gap-1">
                                        <Search size={14} className="text-cyan-500" />
                                        {formatKoboTableCellValue(submission, column) || '-'}
                                      </span>
                                    ) : (
                                      <span className="line-clamp-2">{formatKoboTableCellValue(submission, column) || '-'}</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {selectedSubmission ? (
                    <div className="border-t border-slate-200 bg-slate-50 p-4">
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Detail de la soumission</p>
                          <h3 className="mt-2 text-lg font-black text-slate-950">
                            {selectedSubmission.household?.name || `Menage ${selectedSubmission.numeroOrdre || '-'}`}
                          </h3>
                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            {formatInternalKoboValue(selectedSubmission.role || '', 'roles')} - {formatDateTime(selectedSubmission.savedAt)}
                          </p>
                          <button
                            type="button"
                            onClick={copyReceipt}
                            className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-blue-800 hover:bg-blue-50"
                          >
                            {copied ? 'Copie' : 'Copier recu'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                          {[
                            ['Statut', statusLabels[selectedSubmission.status] || selectedSubmission.status],
                            ['Sync', selectedSubmission.syncStatus],
                            ['Version', selectedSubmission.formVersion],
                            ['Agent', selectedSubmission.submittedBy?.name || selectedSubmission.submittedBy?.email || '-'],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
                              <p className="mt-1 truncate text-sm font-black text-slate-900">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {showLegacyKoboTable && mainTab === 'data' && dataTab === 'table' ? (
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
          ) : null}

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

          {newProjectStep ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
              <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/12 bg-slate-950 shadow-2xl shadow-black/50">
                <div className="flex items-center justify-between border-b border-white/10 bg-blue-500 px-5 py-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-50">Creer le projet</p>
                    <h3 className="mt-1 text-lg font-black text-white">
                      {newProjectStep === 'source' ? 'Choisir une source' : 'Details du projet'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewProjectStep(null)}
                    className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
                    aria-label="Fermer"
                  >
                    <X size={20} />
                  </button>
                </div>

                {newProjectStep === 'source' ? (
                  <div className="p-6">
                    <p className="max-w-2xl text-sm font-semibold leading-relaxed text-slate-300">
                      Comme KoboToolbox, GEM peut demarrer depuis un formulaire vierge, un modele terrain, un fichier XLSForm ou une URL XLSForm.
                    </p>
                    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                      {[
                        { id: 'blank' as BuilderMode, label: 'Construction du formulaire', icon: Pencil, help: 'Creer les questions une par une dans le builder GEM.' },
                        { id: 'template' as BuilderMode, label: 'Utiliser un modele', icon: BookOpen, help: 'Reprendre la logique terrain et les champs menage VPS.' },
                        { id: 'import' as BuilderMode, label: 'Importer un XLSForm', icon: FileUp, help: 'Charger un fichier .xlsx ou .xls comme dans Kobo.' },
                        { id: 'url' as BuilderMode, label: "Importer depuis une URL", icon: Link, help: 'Importer une source XLSForm distante.' },
                      ].map((source) => {
                        const Icon = source.icon;
                        return (
                          <button
                            key={source.id}
                            type="button"
                            onClick={() => startProjectFromSource(source.id)}
                            className="group rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-blue-300/35 hover:bg-blue-400/10"
                          >
                            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-blue-300/20 bg-blue-500/10 text-blue-100">
                              <Icon size={22} />
                            </span>
                            <span className="mt-4 block text-sm font-black text-white">{source.label}</span>
                            <span className="mt-2 block text-xs font-semibold leading-relaxed text-slate-400">{source.help}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-6">
                    {builderMode === 'url' ? (
                      <div className="space-y-4">
                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">URL XLSForm</span>
                          <input
                            value={importUrl}
                            onChange={(event) => setImportUrl(event.target.value)}
                            placeholder="https://.../formulaire.xlsx"
                            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                          />
                        </label>
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setNewProjectStep('source')}
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-100"
                          >
                            <ArrowLeft size={14} />
                            Retour
                          </button>
                          <button
                            type="button"
                            onClick={handleImportXlsFormUrl}
                            disabled={isImporting}
                            className="inline-flex items-center gap-2 rounded-2xl border border-blue-300/25 bg-blue-500 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50"
                          >
                            <Upload size={14} className={isImporting ? 'animate-pulse' : ''} />
                            Importer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Nom du projet requis</span>
                          <input
                            value={projectDraft.title}
                            onChange={(event) => setProjectDraft((current) => ({ ...current, title: event.target.value }))}
                            placeholder="Veuillez saisir un titre pour votre projet"
                            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Description</span>
                          <input
                            value={projectDraft.description}
                            onChange={(event) => setProjectDraft((current) => ({ ...current, description: event.target.value }))}
                            placeholder="Courte description du formulaire"
                            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                          />
                        </label>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Secteur requis</span>
                            <select
                              value={projectDraft.sector}
                              onChange={(event) => setProjectDraft((current) => ({ ...current, sector: event.target.value }))}
                              className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-semibold text-white outline-none"
                            >
                              {projectSectors.map((sector) => <option key={sector}>{sector}</option>)}
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Pays requis</span>
                            <select
                              value={projectDraft.country}
                              onChange={(event) => setProjectDraft((current) => ({ ...current, country: event.target.value }))}
                              className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-semibold text-white outline-none"
                            >
                              {projectCountries.map((country) => <option key={country}>{country}</option>)}
                            </select>
                          </label>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setNewProjectStep('source')}
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-100"
                          >
                            <ArrowLeft size={14} />
                            Retour
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewProjectStep(null);
                              setMainTab('form');
                              setWorkspaceSection('new');
                            }}
                            className="inline-flex items-center gap-2 rounded-2xl border border-blue-300/25 bg-blue-500 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white"
                          >
                            <Pencil size={14} />
                            Ouvrir le builder
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {mainTab === 'form' ? (
          <>
          <section className="rounded-3xl border border-white/10 bg-slate-900/55 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Rubriques Kobo reprises</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  Disposition extraite du formulaire Kobo actif, reorganisee pour la saisie terrain GEM.
                </p>
              </div>
              <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100">
                {KOBO_SOURCE_RUBRICS.length} rubriques
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {KOBO_SOURCE_RUBRICS.map((rubric, index) => {
                const active = selectedRubricTitle === rubric.title;
                return (
                <button
                  key={rubric.title}
                  type="button"
                  onClick={() => setSelectedRubricTitle(rubric.title)}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    active
                      ? 'border-cyan-300/40 bg-cyan-400/10 shadow-lg shadow-cyan-950/15'
                      : 'border-white/10 bg-slate-950/30 hover:border-blue-300/25 hover:bg-blue-400/[0.06]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-100">Etape {index + 1}</p>
                      <h3 className="mt-2 truncate text-sm font-black text-white">{rubric.title}</h3>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-black text-slate-300">
                      {rubric.fields}
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-400">{rubric.subtitle}</p>
                </button>
              );
              })}
            </div>
            {selectedRubric ? (
              <div className="mt-4 rounded-3xl border border-cyan-300/20 bg-cyan-500/[0.055] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">Rubrique ouverte</p>
                    <h3 className="mt-1 text-lg font-black text-white">{selectedRubric.title}</h3>
                    <p className="mt-1 max-w-3xl text-xs font-semibold leading-relaxed text-slate-400">{selectedRubric.subtitle}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-200">
                    {selectedRubric.fields} champs Kobo
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {selectedRubricColumns.map((column, index) => (
                    <div key={`${selectedRubric.title}-${column}`} className="rounded-2xl border border-white/8 bg-slate-950/30 p-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Champ {index + 1}</p>
                      <p className="mt-1 truncate text-[12px] font-black text-white" title={column}>
                        {formatKoboSourceColumnLabel(column)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {workspaceSection === 'new' ? (
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 text-slate-900 shadow-2xl shadow-slate-950/20">
              <div className="border-b border-slate-200 bg-white px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Constructeur Kobo drag/drop</p>
                    <input
                      value={projectDraft.title}
                      onChange={(event) => setProjectDraft((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Nom du projet"
                      className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg font-black text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      Glissez les champs depuis la bibliotheque, reordonnez la pile, reglez les options puis sauvegardez le brouillon VPS.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => addBuilderQuestion(undefined, 'text')}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-blue-800 hover:bg-blue-100"
                    >
                      <Plus size={14} />
                      Question
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveBuilderProject}
                      disabled={isSavingBuilder || builderQuestions.length === 0}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save size={14} className={isSavingBuilder ? 'animate-pulse' : ''} />
                      Sauvegarder brouillon
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
                  {builderFieldPalette.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        draggable
                        onDragStart={(event) => handleBuilderPaletteDragStart(event, item.type, item.label)}
                        onDragEnd={() => {
                          setBuilderDropTarget(null);
                          setBuilderDraggingLabel('');
                        }}
                        onClick={() => addBuilderQuestion(undefined, item.type)}
                        className="group flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-all hover:border-blue-300 hover:bg-blue-50"
                        title="Glisser dans le formulaire ou cliquer pour ajouter"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 group-hover:ring-blue-200">
                          <Icon size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-black text-slate-900">{item.label}</span>
                          <span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-500">{item.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[1fr_380px]">
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleBuilderCanvasDrop}
                  className="rounded-2xl border border-slate-200 bg-white p-3"
                >
                  <div className="mb-3 flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Formulaire</p>
                      <p className="text-xs font-semibold text-slate-500">
                        {builderQuestions.length} champ(s) - {builderDraggingLabel ? `Depot en cours: ${builderDraggingLabel}` : 'glisser/deposer active'}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-800">
                      <MousePointer2 size={13} />
                      Drag/drop
                    </span>
                  </div>

                  {builderQuestions.length === 0 ? (
                    <div className="grid min-h-72 place-items-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 p-8 text-center">
                      <div>
                        <Layers size={34} className="mx-auto text-blue-500" />
                        <p className="mt-3 text-sm font-black text-slate-900">Deposez un champ ici</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">Le formulaire se construit comme dans Kobo: bibliotheque, pile, parametres.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {builderQuestions.map((question, index) => {
                        const active = selectedBuilderQuestionId === question.id;
                        const paletteItem = builderFieldPalette.find((item) => item.type === question.type);
                        const Icon = paletteItem?.icon || Type;
                        const dropBefore = builderDropTarget?.id === question.id && builderDropTarget.position === 'before';
                        const dropAfter = builderDropTarget?.id === question.id && builderDropTarget.position === 'after';
                        return (
                          <article
                            key={question.id}
                            onDragOver={(event) => handleBuilderQuestionDragOver(event, question.id)}
                            onDrop={(event) => handleBuilderDrop(event, question.id)}
                            onDragLeave={() => setBuilderDropTarget((current) => (current?.id === question.id ? null : current))}
                            className="relative"
                          >
                            {dropBefore ? <div className="mb-2 h-1 rounded-full bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.7)]" /> : null}
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedBuilderQuestionId(question.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') setSelectedBuilderQuestionId(question.id);
                              }}
                              className={`grid w-full grid-cols-[44px_54px_1fr_auto] items-stretch overflow-hidden rounded-xl border text-left transition-all ${
                                active
                                  ? 'border-blue-400 bg-blue-50 shadow-sm ring-4 ring-blue-100'
                                  : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                              }`}
                            >
                              <button
                                type="button"
                                draggable
                                onDragStart={(event) => handleBuilderQuestionDragStart(event, question)}
                                onDragEnd={() => {
                                  setBuilderDropTarget(null);
                                  setBuilderDraggingLabel('');
                                }}
                                onClick={(event) => event.stopPropagation()}
                                className="grid cursor-grab place-items-center border-r border-slate-200 bg-slate-50 text-slate-400 active:cursor-grabbing"
                                aria-label="Glisser pour deplacer"
                                title="Glisser pour deplacer"
                              >
                                <GripVertical size={18} />
                              </button>
                              <span className="grid place-items-center border-r border-slate-200 bg-slate-50">
                                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-blue-700 shadow-sm ring-1 ring-slate-200">
                                  <Icon size={16} />
                                </span>
                              </span>
                              <span className="min-w-0 p-4">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">#{index + 1}</span>
                                  <span className="text-sm font-black text-slate-950">
                                    {question.required ? '* ' : ''}{question.label || `Question ${index + 1}`}
                                  </span>
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500">
                                    {builderQuestionTypeLabel[question.type]}
                                  </span>
                                  {question.relevant ? (
                                    <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-violet-700">
                                      Condition
                                    </span>
                                  ) : null}
                                  {question.calculation ? (
                                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-cyan-700">
                                      Calcul
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-1 block truncate text-[11px] font-semibold text-slate-500">
                                  {question.name} {question.hint ? `- ${question.hint}` : ''}
                                </span>
                              </span>
                              <span className="flex items-center gap-1 pr-3">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    moveBuilderQuestionByOffset(question.id, -1);
                                  }}
                                  disabled={index === 0}
                                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-700 disabled:opacity-30"
                                  aria-label="Monter"
                                >
                                  <ArrowUp size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    moveBuilderQuestionByOffset(question.id, 1);
                                  }}
                                  disabled={index === builderQuestions.length - 1}
                                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-700 disabled:opacity-30"
                                  aria-label="Descendre"
                                >
                                  <ArrowDown size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    duplicateBuilderQuestion(question.id);
                                  }}
                                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-700"
                                  aria-label="Dupliquer"
                                >
                                  <Copy size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    addBuilderQuestion(question.id, 'text');
                                  }}
                                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-700"
                                  aria-label="Ajouter apres"
                                >
                                  <Plus size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    deleteBuilderQuestion(question.id);
                                  }}
                                  className="grid h-9 w-9 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                                  aria-label="Supprimer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </span>
                            </div>
                            {dropAfter ? <div className="mt-2 h-1 rounded-full bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.7)]" /> : null}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>

                <aside className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Parametres de question</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Options, branchements conditionnels, validation.</p>
                    </div>
                    <MoreHorizontal size={16} className="text-slate-400" />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
                    {[
                      ['options', 'Options'],
                      ['branching', 'Branchement'],
                      ['validation', 'Validation'],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setBuilderSettingsTab(id as BuilderSettingsTab)}
                        className={`rounded-lg px-2 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition-colors ${
                          builderSettingsTab === id ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {selectedBuilderQuestion ? (
                    <div className="mt-4 space-y-3">
                      {builderSettingsTab === 'options' ? (
                        <>
                          <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Libelle</span>
                            <input
                              value={selectedBuilderQuestion.label}
                              onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, { label: event.target.value })}
                              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Nom du champ</span>
                            <input
                              value={selectedBuilderQuestion.name}
                              onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, { name: normalizeBuilderName(event.target.value, selectedBuilderQuestion.name) })}
                              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Type</span>
                            <select
                              value={selectedBuilderQuestion.type}
                              onChange={(event) => {
                                const nextType = event.target.value as BuilderQuestionType;
                                const paletteItem = builderFieldPalette.find((item) => item.type === nextType);
                                updateBuilderQuestion(selectedBuilderQuestion.id, {
                                  type: nextType,
                                  listName: nextType === 'select_one' || nextType === 'select_multiple'
                                    ? selectedBuilderQuestion.listName || paletteItem?.defaultListName || `${selectedBuilderQuestion.name}_choices`
                                    : undefined,
                                  choices: nextType === 'select_one' || nextType === 'select_multiple'
                                    ? selectedBuilderQuestion.choices?.length
                                      ? selectedBuilderQuestion.choices
                                      : paletteItem?.defaultChoices
                                    : undefined,
                                });
                              }}
                              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500"
                            >
                              {builderFieldPalette.map((item) => (
                                <option key={item.type} value={item.type}>{item.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Instruction supplementaire</span>
                            <textarea
                              value={selectedBuilderQuestion.hint || ''}
                              onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, { hint: event.target.value })}
                              rows={3}
                              className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block">
                              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Defaut</span>
                              <input
                                value={selectedBuilderQuestion.defaultValue || ''}
                                onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, { defaultValue: event.target.value })}
                                className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-950 outline-none focus:border-blue-500"
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Apparence</span>
                              <input
                                value={selectedBuilderQuestion.appearance || ''}
                                onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, { appearance: event.target.value })}
                                placeholder="minimal, multiline..."
                                className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-950 outline-none focus:border-blue-500"
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">Obligatoire</span>
                              <input
                                type="checkbox"
                                checked={Boolean(selectedBuilderQuestion.required)}
                                onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, { required: event.target.checked })}
                                className="h-4 w-4 accent-blue-600"
                              />
                            </label>
                            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">Lecture seule</span>
                              <input
                                type="checkbox"
                                checked={Boolean(selectedBuilderQuestion.readOnly)}
                                onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, { readOnly: event.target.checked })}
                                className="h-4 w-4 accent-blue-600"
                              />
                            </label>
                          </div>

                          {(selectedBuilderQuestion.type === 'select_one' || selectedBuilderQuestion.type === 'select_multiple') ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <label className="min-w-0 flex-1">
                                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Liste de choix</span>
                                  <input
                                    value={selectedBuilderQuestion.listName || ''}
                                    onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, { listName: normalizeBuilderName(event.target.value, `${selectedBuilderQuestion.name}_choices`) })}
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-950 outline-none focus:border-blue-500"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => addBuilderChoice(selectedBuilderQuestion.id)}
                                  className="mt-5 grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-white"
                                  aria-label="Ajouter un choix"
                                >
                                  <Plus size={15} />
                                </button>
                              </div>
                              <div className="mt-3 space-y-2">
                                {(selectedBuilderQuestion.choices || []).map((choice, choiceIndex) => (
                                  <div key={`${selectedBuilderQuestion.id}-${choiceIndex}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                    <input
                                      value={choice.name}
                                      onChange={(event) => updateBuilderChoice(selectedBuilderQuestion.id, choiceIndex, { name: event.target.value })}
                                      placeholder="valeur"
                                      className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                                    />
                                    <input
                                      value={choice.label}
                                      onChange={(event) => updateBuilderChoice(selectedBuilderQuestion.id, choiceIndex, { label: event.target.value })}
                                      placeholder="libelle"
                                      className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => deleteBuilderChoice(selectedBuilderQuestion.id, choiceIndex)}
                                      className="grid h-9 w-9 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600"
                                      aria-label="Supprimer ce choix"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : null}

                      {builderSettingsTab === 'branching' ? (
                        <>
                          <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Branchement conditionnel</span>
                            <textarea
                              value={selectedBuilderQuestion.relevant || ''}
                              onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, { relevant: event.target.value })}
                              placeholder="${role} = 'macon'"
                              rows={4}
                              className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-950 outline-none focus:border-blue-500"
                            />
                          </label>
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">Raccourcis role</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {INTERNAL_KOBO_CHOICES.roles.map((role) => (
                                <button
                                  key={role.name}
                                  type="button"
                                  onClick={() => updateBuilderQuestion(selectedBuilderQuestion.id, { relevant: "${role} = '" + role.name + "'" })}
                                  className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-[10px] font-black text-amber-900 hover:bg-amber-100"
                                >
                                  {role.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : null}

                      {builderSettingsTab === 'validation' ? (
                        <>
                          <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Critere de validation</span>
                            <input
                              value={selectedBuilderQuestion.constraint || ''}
                              onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, { constraint: event.target.value })}
                              placeholder=". >= 0"
                              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Message d'erreur</span>
                            <input
                              value={selectedBuilderQuestion.constraintMessage || ''}
                              onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, { constraintMessage: event.target.value })}
                              placeholder="Valeur incorrecte"
                              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Calcul XLSForm</span>
                            <textarea
                              value={selectedBuilderQuestion.calculation || ''}
                              onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, { calculation: event.target.value })}
                              placeholder="pulldata('Thies','nom','code_key',${Numero_ordre})"
                              rows={4}
                              className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-950 outline-none focus:border-blue-500"
                            />
                          </label>
                          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-[11px] font-semibold leading-relaxed text-cyan-900">
                            Les calculs et contraintes sont sauvegardes dans la definition XLSForm et controles par le moteur GEM au moment de la saisie.
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedBuilderQuestionId(builderQuestions[0]?.id || '')}
                      className="mt-4 w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-bold text-slate-500 hover:border-blue-300 hover:text-blue-700"
                    >
                      Selectionnez une question pour regler ses parametres.
                    </button>
                  )}
                </aside>
              </div>
            </section>
          ) : null}

          <section className="rounded-3xl border border-blue-300/15 bg-slate-900/55 p-4 shadow-xl shadow-blue-950/15">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Gestionnaire XLSForm</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {importedForms.length} formulaire(s), {activeFormCount} deploye(s), {draftFormCount} brouillon(s), {inactiveFormCount} archive(s)
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
              {visibleForms.length === 0 && !isLoadingForms ? (
                <div className="rounded-2xl border border-dashed border-white/12 bg-slate-950/30 p-4 text-sm font-semibold text-slate-400">
                  Aucun formulaire dans cette rubrique. Utilisez Nouveau pour creer ou importer un formulaire.
                </div>
              ) : null}
              {visibleForms.map((form) => {
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
          </>
          ) : null}

          {mainTab === 'summary' ? (
          <>
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
          </>
          ) : null}

          {mainTab === 'data' && dataTab !== 'table' ? (
            <section className="rounded-3xl border border-white/10 bg-slate-900/45 p-3">
              <div className="flex flex-wrap gap-2">
                {dataTabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = dataTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDataTab(tab.id)}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
                        active
                          ? 'border-blue-300/40 bg-blue-400/15 text-blue-50'
                          : 'border-white/10 bg-slate-950/25 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon size={13} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {mainTab === 'data' && dataTab === 'reports' ? (
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {[
                ['Par statut', globalDiagnostics?.byStatus || {}],
                ['Par role', globalDiagnostics?.byRole || {}],
                ['Par version', globalDiagnostics?.byFormVersion || {}],
              ].map(([title, bucket]) => (
                <div key={String(title)} className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">{String(title)}</p>
                  <div className="mt-4 space-y-2">
                    {Object.entries(bucket as Record<string, number>).slice(0, 8).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/30 px-3 py-2">
                        <span className="truncate text-[11px] font-black text-white">
                          {String(title) === 'Par role' ? formatInternalKoboValue(key, 'roles') || key : key}
                        </span>
                        <span className="rounded-full bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-slate-300">{value}</span>
                      </div>
                    ))}
                    {Object.keys(bucket as Record<string, number>).length === 0 ? (
                      <p className="rounded-2xl border border-white/8 bg-slate-950/30 p-3 text-xs font-semibold text-slate-500">
                        Aucun indicateur disponible.
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          {mainTab === 'data' && dataTab === 'gallery' ? (
            <section className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Galerie photo</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{galleryAttachments.length} piece(s) jointe(s) dans la selection chargee.</p>
                </div>
                <Image size={18} className="text-blue-200" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {galleryAttachments.map(({ attachment, submission, key }) => (
                  <a
                    key={key}
                    href={attachment.url || attachment.dataUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/35 transition-colors hover:border-blue-300/30"
                  >
                    {String(attachment.mimeType || '').startsWith('image/') && (attachment.url || attachment.dataUrl) ? (
                      <img src={attachment.url || attachment.dataUrl} alt={attachment.fileName || attachment.fieldName} className="h-40 w-full object-cover" />
                    ) : (
                      <div className="grid h-40 place-items-center bg-slate-950/45 text-slate-500">
                        <FileSpreadsheet size={30} />
                      </div>
                    )}
                    <div className="p-3">
                      <p className="truncate text-[11px] font-black text-white">{attachment.fileName || attachment.fieldName}</p>
                      <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">
                        Menage {submission.numeroOrdre || submission.household?.numeroordre || '-'} - {attachment.fieldName}
                      </p>
                    </div>
                  </a>
                ))}
                {galleryAttachments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/12 bg-slate-950/30 p-6 text-sm font-semibold text-slate-500">
                    Aucun media dans la selection actuelle.
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {mainTab === 'data' && dataTab === 'downloads' ? (
            <section className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Telechargements</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Exports filtres depuis le VPS, prets pour audit ou reporting.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {([
                  ['CSV', 'csv', FileSpreadsheet],
                  ['JSON', 'json', FileJson],
                  ['XLSX', 'xlsx', FileSpreadsheet],
                ] as const).map(([label, format, Icon]) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => exportFromServer(format)}
                    disabled={submissions.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4 text-[11px] font-black uppercase tracking-[0.14em] text-slate-100 hover:bg-white/[0.06] disabled:opacity-40"
                  >
                    <Icon size={16} className={isExporting === format ? 'animate-pulse' : ''} />
                    Export {label}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {mainTab === 'data' && dataTab === 'map' ? (
            <section className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Carte</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Apercu geographique des soumissions chargees.</p>
                </div>
                <Map size={18} className="text-blue-200" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {submissions.slice(0, 30).map((submission) => (
                  <div key={submission.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                    <p className="truncate text-sm font-black text-white">{submission.household?.name || `Menage ${submission.numeroOrdre || '-'}`}</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      {submission.household?.region || (submission.values as any)?.region_key || 'Region non renseignee'}
                    </p>
                    <p className="mt-3 rounded-xl border border-blue-200/10 bg-blue-400/[0.06] px-3 py-2 text-[10px] font-bold text-blue-100">
                      GPS: {String((submission.values as any)?.LOCALISATION_CLIENT || (submission.values as any)?.gps || 'Non renseigne')}
                    </p>
                  </div>
                ))}
                {submissions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/12 bg-slate-950/30 p-6 text-sm font-semibold text-slate-500">
                    Aucune fiche chargee pour la carte.
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {mainTab === 'settings' ? (
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Parametres de collecte</p>
                <div className="mt-4 grid grid-cols-1 gap-2">
                  {[
                    ['Formulaire source', KOBO_SOURCE_SNAPSHOT.name],
                    ['Asset UID Kobo', KOBO_SOURCE_SNAPSHOT.assetUid],
                    ['Version Kobo active', KOBO_SOURCE_SNAPSHOT.currentVersionId],
                    ['Moteur', 'GEM XLSForm interne'],
                    ['Validation serveur', 'Active'],
                    ['Soumission', 'VPS GEM'],
                    ['Colonnes table Kobo', KOBO_SOURCE_SNAPSHOT.selectedColumns.length],
                    ['Champs export Kobo', KOBO_SOURCE_SNAPSHOT.exportFieldCount],
                    ['Version serveur', globalDiagnostics?.serverFormVersion || INTERNAL_KOBO_FORM_SETTINGS.version],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-slate-950/30 px-3 py-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
                      <span className="truncate text-[11px] font-bold text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Formulaires actifs</p>
                <div className="mt-4 space-y-2">
                  {importedForms.slice(0, 6).map((form) => (
                    <div key={form.formKey} className="rounded-2xl border border-white/8 bg-slate-950/30 p-3">
                      <p className="truncate text-[12px] font-black text-white">{form.title || form.formKey}</p>
                      <p className="mt-1 text-[10px] font-semibold text-slate-500">
                        v{form.formVersion} - {form.active === false ? 'inactif' : 'actif'}
                      </p>
                    </div>
                  ))}
                  {importedForms.length === 0 ? (
                    <p className="rounded-2xl border border-white/8 bg-slate-950/30 p-3 text-xs font-semibold text-slate-500">
                      Aucun formulaire importe.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4 lg:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Colonnes Kobo aspirees</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Ordre exact des colonnes visibles dans le tableau Kobo. GEM les garde comme reference d'audit et d'export.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black text-slate-300">
                    {KOBO_SOURCE_SNAPSHOT.selectedColumns.length} colonnes
                  </span>
                </div>
                <div className="mt-4 flex max-h-52 flex-wrap gap-2 overflow-y-auto pr-1 custom-scrollbar">
                  {KOBO_SOURCE_SNAPSHOT.selectedColumns.map((column, index) => (
                    <span
                      key={`${column}-${index}`}
                      title={column}
                      className="rounded-full border border-white/10 bg-slate-950/35 px-3 py-1 text-[10px] font-bold text-slate-300"
                    >
                      {index + 1}. {formatKoboSourceColumnLabel(column)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4 lg:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Historique versions Kobo</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {KOBO_SOURCE_SNAPSHOT.deployedVersions.length} versions deployees aspirees sur {KOBO_SOURCE_SNAPSHOT.versionCount} revisions Kobo.
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black text-emerald-100">
                    Active {KOBO_SOURCE_SNAPSHOT.currentVersionId}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {KOBO_SOURCE_SNAPSHOT.deployedVersions.map((version) => (
                    <div key={version.uid} className="rounded-2xl border border-white/8 bg-slate-950/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-[11px] font-black text-white">{version.uid}</p>
                        {version.uid === KOBO_SOURCE_SNAPSHOT.currentVersionId ? (
                          <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-black text-emerald-100">Actif</span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-[9px] font-semibold text-slate-500">{version.contentHash}</p>
                      <p className="mt-2 text-[10px] font-bold text-slate-400">{formatDateTime(version.deployedAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {showLegacyKoboTable && mainTab === 'data' && dataTab === 'table' ? (
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
          ) : null}
        </div>
      </ContentArea>
    </PageContainer>
  );
}
