import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import QRCode from 'qrcode';
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
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
  Cloud,
  Copy,
  CornerUpLeft,
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
  Menu,
  Map,
  MapPin,
  MoreHorizontal,
  MousePointer2,
  Pencil,
  PenLine,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Server,
  Settings,
  Share2,
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
  fetchInternalKoboImportedFormDefinition,
  fetchInternalKoboDiagnostics,
  fetchInternalKoboSubmissionsReport,
  createInternalKoboFormDefinition,
  downloadInternalKoboSubmissionsExport,
  downloadInternalKoboMediaExport,
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
  formatInternalGemValue,
  INTERNAL_GEM_CHOICES,
  INTERNAL_GEM_FORM_SETTINGS,
  INTERNAL_GEM_SECTIONS,
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
  formKey: string;
  limit: number;
  offset: number;
};

type MainTab = 'summary' | 'form' | 'data' | 'settings';
type DataTab = 'table' | 'reports' | 'gallery' | 'downloads' | 'map';
type WorkspaceSection = 'new' | 'deployed' | 'drafts' | 'archives';
type NewProjectStep = 'source' | 'details' | null;
type BuilderMode = 'blank' | 'template' | 'import' | 'url' | 'internal_gem';
type BuilderQuestionType =
  | 'begin_group'
  | 'begin_repeat'
  | 'integer'
  | 'decimal'
  | 'text'
  | 'select_one'
  | 'select_multiple'
  | 'select_one_from_file'
  | 'select_multiple_from_file'
  | 'rank'
  | 'note'
  | 'geopoint'
  | 'geotrace'
  | 'geoshape'
  | 'image'
  | 'signature'
  | 'file'
  | 'audio'
  | 'video'
  | 'date'
  | 'time'
  | 'datetime'
  | 'range'
  | 'barcode'
  | 'calculate'
  | 'hidden'
  | 'xml_external'
  | 'acknowledge';
type BuilderDropPosition = 'before' | 'after';
type BuilderSettingsTab = 'options' | 'languages' | 'branching' | 'validation';
type BuilderLanguage = 'fr' | 'en' | 'wo';

type BuilderQuestion = {
  id: string;
  type: BuilderQuestionType;
  name: string;
  label: string;
  hint?: string;
  labels?: Partial<Record<BuilderLanguage, string>>;
  hints?: Partial<Record<BuilderLanguage, string>>;
  required?: boolean;
  listName?: string;
  choices?: Array<{ name: string; label: string }>;
  relevant?: string;
  calculation?: string;
  constraint?: string;
  constraintMessage?: string;
  defaultValue?: string;
  appearance?: string;
  parameters?: string;
  choiceFilter?: string;
  readOnly?: boolean;
};

type ProjectDraft = {
  title: string;
  description: string;
  sector: string;
  country: string;
  defaultLanguage: BuilderLanguage;
  languages: BuilderLanguage[];
  ownerTeam: string;
  allowedRoles: string[];
  allowOffline: boolean;
  requireLatestVersion: boolean;
  draftMigrationMode: 'preserve' | 'migrate' | 'block';
};

type BuilderAuditIssue = {
  level: 'error' | 'warning';
  title: string;
  detail: string;
  questionId?: string;
};

type SavedDataFilter = {
  id: string;
  name: string;
  filters: Filters;
  tableColumnFilters: Record<string, string>;
  hiddenTableColumns: string[];
  selectedProjectFormKey: string;
  createdAt: string;
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
const savedDataFiltersStorageKey = 'gem-internal-kobo-saved-data-filters:v1';

const builderLanguages: Array<{ id: BuilderLanguage; label: string; xlsLabel: string }> = [
  { id: 'fr', label: 'Francais', xlsLabel: 'Francais (fr)' },
  { id: 'en', label: 'English', xlsLabel: 'English (en)' },
  { id: 'wo', label: 'Wolof', xlsLabel: 'Wolof (wo)' },
];

const getBuilderLanguageMeta = (language: BuilderLanguage) =>
  builderLanguages.find((item) => item.id === language) || builderLanguages[0];

const getBuilderQuestionLabel = (question: BuilderQuestion, language: BuilderLanguage) =>
  question.labels?.[language] || question.label || question.name;

const getBuilderQuestionHint = (question: BuilderQuestion, language: BuilderLanguage) =>
  question.hints?.[language] || question.hint || '';

const builderFieldPalette: Array<{
  type: BuilderQuestionType;
  label: string;
  description: string;
  icon: typeof Type;
  defaultListName?: string;
  defaultChoices?: Array<{ name: string; label: string }>;
  appearance?: string;
}> = [
  { type: 'begin_group', label: 'Groupe', description: 'Section ou page', icon: Layers, appearance: 'field-list' },
  { type: 'begin_repeat', label: 'Repeat', description: 'Lignes repetables', icon: Layers, appearance: 'field-list' },
  { type: 'text', label: 'Texte', description: 'Saisie libre ou observation', icon: Type },
  { type: 'integer', label: 'Nombre entier', description: 'Compteur, quantite, ordre', icon: Hash },
  { type: 'decimal', label: 'Decimal', description: 'Mesure ou montant', icon: Calculator },
  { type: 'range', label: 'Curseur', description: 'Intervalle numerique', icon: Calculator, appearance: 'horizontal' },
  {
    type: 'select_one',
    label: 'Choix unique',
    description: 'Une reponse',
    icon: CheckCircle2,
    defaultListName: 'oui_non',
    defaultChoices: [
      { name: 'oui', label: 'Oui' },
      { name: 'non', label: 'Non' },
    ],
  },
  {
    type: 'select_one_from_file',
    label: 'Choix fichier',
    description: 'Liste externe CSV',
    icon: FileSpreadsheet,
    defaultListName: 'external_choices.csv',
  },
  {
    type: 'select_multiple',
    label: 'Choix multiple',
    description: 'Plusieurs reponses',
    icon: CheckSquare,
    defaultListName: 'options_multiples',
    defaultChoices: [
      { name: 'option_1', label: 'Option 1' },
      { name: 'option_2', label: 'Option 2' },
    ],
  },
  {
    type: 'select_multiple_from_file',
    label: 'Multi fichier',
    description: 'Choix multiples CSV',
    icon: FileSpreadsheet,
    defaultListName: 'external_choices.csv',
  },
  {
    type: 'rank',
    label: 'Classement',
    description: 'Ordonner des choix',
    icon: CheckSquare,
    defaultListName: 'rank_options',
    defaultChoices: [
      { name: 'priorite_1', label: 'Priorite 1' },
      { name: 'priorite_2', label: 'Priorite 2' },
    ],
  },
  { type: 'note', label: 'Note', description: 'Texte informatif non saisi', icon: FileText },
  { type: 'geopoint', label: 'GPS', description: 'Position terrain', icon: MapPin },
  { type: 'geotrace', label: 'Trace GPS', description: 'Ligne de parcours', icon: Map },
  { type: 'geoshape', label: 'Polygone GPS', description: 'Zone fermee', icon: Map },
  { type: 'image', label: 'Photo', description: 'Camera ou galerie', icon: Camera },
  { type: 'signature', label: 'Signature', description: 'Signature tactile', icon: PenLine },
  { type: 'file', label: 'Fichier', description: 'Piece jointe', icon: File },
  { type: 'audio', label: 'Audio', description: 'Enregistrement sonore', icon: FileAudio },
  { type: 'video', label: 'Video', description: 'Capture video', icon: Video },
  { type: 'date', label: 'Date', description: 'Jour de passage', icon: CalendarDays },
  { type: 'time', label: 'Heure', description: 'Heure terrain', icon: Clock3 },
  { type: 'datetime', label: 'Date + heure', description: 'Horodatage', icon: CalendarDays },
  { type: 'barcode', label: 'Code-barres', description: 'Reference scannee', icon: Hash },
  { type: 'calculate', label: 'Calcul', description: 'Valeur auto XLSForm', icon: Calculator },
  { type: 'hidden', label: 'Cache', description: 'Champ non affiche', icon: EyeOff },
  { type: 'xml_external', label: 'XML externe', description: 'Source XML jointe', icon: FileJson },
  { type: 'acknowledge', label: 'Confirmation', description: 'Case de validation', icon: CheckSquare },
];

const builderQuestionLibrary: Array<{
  key: string;
  title: string;
  description: string;
  questions: BuilderQuestion[];
}> = [
  {
    key: 'household_identity',
    title: 'Identification menage',
    description: 'Numero ordre, nom, telephone, region et GPS depuis la base VPS.',
    questions: [
      {
        id: '',
        type: 'integer',
        name: 'Numero_ordre',
        label: 'Numero ordre',
        hint: 'Identifiant menage relie a la base VPS',
        required: true,
      },
      {
        id: '',
        type: 'text',
        name: 'nom_key',
        label: 'Prenom et Nom',
        calculation: "pulldata('Thies','nom','code_key',${Numero_ordre})",
        readOnly: true,
      },
      {
        id: '',
        type: 'text',
        name: 'telephone_key',
        label: 'Telephone',
        calculation: "pulldata('Thies','telephone','code_key',${Numero_ordre})",
        readOnly: true,
      },
      {
        id: '',
        type: 'geopoint',
        name: 'LOCALISATION_CLIENT',
        label: 'Coordonnees GPS du menage',
        calculation: "concat(${latitude_key}, ' ', ${longitude_key})",
        readOnly: true,
      },
    ],
  },
  {
    key: 'role_gate',
    title: 'Passage role obligatoire',
    description: 'Choix role qui active les formulaires metier.',
    questions: [
      {
        id: '',
        type: 'select_one',
        name: 'role',
        label: 'Votre role',
        listName: 'roles',
        required: true,
      },
    ],
  },
  {
    key: 'proof_media',
    title: 'Preuves terrain',
    description: 'Photo, signature, fichier et GPS actuel.',
    questions: [
      { id: '', type: 'image', name: 'photo_preuve', label: 'Photo preuve', required: true },
      { id: '', type: 'signature', name: 'signature_agent', label: 'Signature agent' },
      { id: '', type: 'file', name: 'piece_jointe', label: 'Piece jointe' },
      { id: '', type: 'geopoint', name: 'gps_passage', label: 'GPS du passage' },
    ],
  },
  {
    key: 'validation_terre',
    title: 'Controle terre bloquant',
    description: 'Valeur de terre obligatoire avant cloture.',
    questions: [
      {
        id: '',
        type: 'decimal',
        name: 'terre',
        label: 'Valeur terre',
        required: true,
        constraint: '. > 0',
        constraintMessage: 'La valeur de terre est obligatoire et doit etre superieure a 0.',
      },
      {
        id: '',
        type: 'text',
        name: 'OBSERVATIONS__007',
        label: 'Observations terre',
        relevant: '${terre} != ""',
        required: true,
      },
    ],
  },
];

const makeQuestionId = () => `q_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const normalizeBuilderName = (value: string, fallback: string) => {
  if (!value) return fallback;
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+$/g, '');
  return (normalized || fallback).slice(0, 48);
};

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

const getInternalGemBuilderQuestions = (): BuilderQuestion[] => {
  const questions: BuilderQuestion[] = [];
  const usedNames = new Set<string>();

  INTERNAL_GEM_SECTIONS.forEach((section) => {
    section.fields.forEach((field) => {
      const typePart = field.type.split(' ')[0];
      const type = (typePart === 'select_one' || typePart === 'select_multiple' || typePart === 'rank' || typePart === 'text' || typePart === 'integer' || typePart === 'decimal' || typePart === 'note' || typePart === 'geopoint' || typePart === 'image' || typePart === 'signature' || typePart === 'file' || typePart === 'date' || typePart === 'datetime' || typePart === 'calculate' || typePart === 'hidden' ? typePart : 'text') as BuilderQuestionType;
      
      let name = field.name;
      if (usedNames.has(name) && !['Numero_ordre', 'nom_key', 'telephone_key', 'latitude_key', 'longitude_key', 'region_key', 'role'].includes(name)) {
        name = `${name}_${section.id}`;
      }
      usedNames.add(name);

      const listName = field.listName || (field.type.includes(' ') ? field.type.split(' ')[1] : undefined);
      
      const choices = listName && (INTERNAL_GEM_CHOICES as any)[listName]
        ? (INTERNAL_GEM_CHOICES as any)[listName].map((c: any) => ({ name: c.name, label: c.label }))
        : undefined;

      questions.push({
        id: makeQuestionId(),
        type,
        name,
        label: field.label,
        hint: field.hint,
        required: field.required,
        listName,
        choices,
        relevant: field.relevant,
        readOnly: field.readOnly,
      });
    });
  });
  return questions;
};

const builderQuestionTypeLabel: Record<BuilderQuestionType, string> = {
  begin_group: 'grp',
  begin_repeat: 'rep',
  integer: '123',
  decimal: '1.2',
  range: 'rng',
  text: 'abc',
  select_one: 'one',
  select_multiple: 'multi',
  select_one_from_file: 'csv',
  select_multiple_from_file: 'csv+',
  rank: 'rank',
  note: 'i',
  geopoint: 'gps',
  geotrace: 'line',
  geoshape: 'poly',
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
  hidden: 'hide',
  xml_external: 'xml',
  acknowledge: 'ok',
};

const getBuilderTypeForSurvey = (question: BuilderQuestion) => {
  if (question.type === 'select_one') return `select_one ${question.listName || 'oui_non'}`;
  if (question.type === 'select_multiple') return `select_multiple ${question.listName || 'oui_non'}`;
  if (question.type === 'select_one_from_file') return `select_one_from_file ${question.listName || 'external_choices.csv'}`;
  if (question.type === 'select_multiple_from_file') return `select_multiple_from_file ${question.listName || 'external_choices.csv'}`;
  if (question.type === 'rank') return 'text'; // Rank is often problematic, fallback to text
  if (question.type === 'acknowledge') return 'trigger'; // trigger is standard XLSForm for acknowledge
  if (question.type === 'xml_external') return 'xml-external';
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
    labels: { fr: paletteItem?.label || `Question ${index}` },
    hints: paletteItem?.description ? { fr: paletteItem.description } : undefined,
    listName: paletteItem?.defaultListName,
    choices: paletteItem?.defaultChoices,
    appearance: paletteItem?.appearance,
    required: false,
  };
};

const cloneBuilderQuestion = (
  question: BuilderQuestion,
  options: { preserveId?: boolean; name?: string; label?: string } = {}
): BuilderQuestion => ({
  ...question,
  id: options.preserveId ? question.id : makeQuestionId(),
  name: options.name ?? question.name,
  label: options.label ?? question.label,
  labels: question.labels ? { ...question.labels } : undefined,
  hints: question.hints ? { ...question.hints } : undefined,
  choices: question.choices?.map((choice) => ({ ...choice })),
});

const cloneBuilderQuestions = (questions: BuilderQuestion[]) =>
  questions.map((question) => cloneBuilderQuestion(question, { preserveId: true }));

const getUniqueBuilderQuestionName = (baseName: string, questions: BuilderQuestion[]) => {
  const normalizedBase = normalizeBuilderName(baseName, 'question');
  let candidate = normalizedBase;
  let index = 2;
  while (questions.some((question) => question.name === candidate)) {
    candidate = normalizeBuilderName(`${normalizedBase}_${index}`, `question_${index}`);
    index += 1;
  }
  return candidate;
};

const builderChoiceTypes = new Set<BuilderQuestionType>([
  'select_one',
  'select_multiple',
  'select_one_from_file',
  'select_multiple_from_file',
  'rank',
]);

const builderInlineChoiceTypes = new Set<BuilderQuestionType>(['select_one', 'select_multiple', 'rank']);

const auditBuilderProject = (projectDraft: ProjectDraft, questions: BuilderQuestion[]): BuilderAuditIssue[] => {
  const issues: BuilderAuditIssue[] = [];
  const names = questions.map((question) => question.name.trim()).filter(Boolean);
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
  const normalizedRoleNames = new Set(INTERNAL_GEM_CHOICES.roles.map((role) => role.name));

  if (!projectDraft.title.trim()) {
    issues.push({
      level: 'error',
      title: 'Nom du projet manquant',
      detail: 'Kobo exige un titre avant de sauvegarder ou deployer un formulaire.',
    });
  }

  if (!questions.length) {
    issues.push({
      level: 'error',
      title: 'Aucun champ dans le formulaire',
      detail: 'Ajoutez au moins une question avant de creer un brouillon VPS.',
    });
  }

  if (!projectDraft.allowedRoles.length) {
    issues.push({
      level: 'error',
      title: 'Aucun role autorise',
      detail: 'Definissez les roles ou equipes autorises avant la collecte terrain.',
    });
  }

  if (!projectDraft.languages.includes(projectDraft.defaultLanguage)) {
    issues.push({
      level: 'error',
      title: 'Langue par defaut inactive',
      detail: 'La langue par defaut doit faire partie des langues XLSForm activees.',
    });
  }

  Array.from(new Set(duplicateNames)).forEach((name) => {
    issues.push({
      level: 'error',
      title: `Champ duplique: ${name}`,
      detail: 'Chaque colonne XLSForm doit avoir un nom unique pour eviter les collisions de soumission.',
    });
  });

  questions.forEach((question, index) => {
    const label = question.label.trim();
    const name = question.name.trim();

    if (!name) {
      issues.push({
        level: 'error',
        title: `Champ ${index + 1}: nom vide`,
        detail: 'Le nom technique est obligatoire dans la feuille survey.',
        questionId: question.id,
      });
    }

    if (!label && question.type !== 'hidden' && question.type !== 'xml_external') {
      issues.push({
        level: 'error',
        title: `Champ ${name || index + 1}: libelle vide`,
        detail: 'Un libelle lisible est requis pour les agents terrain.',
        questionId: question.id,
      });
    }

    if (builderChoiceTypes.has(question.type) && !question.listName?.trim()) {
      issues.push({
        level: 'error',
        title: `Liste de choix manquante: ${name || label}`,
        detail: 'Les questions de choix doivent pointer vers une liste XLSForm.',
        questionId: question.id,
      });
    }

    if (builderInlineChoiceTypes.has(question.type)) {
      const choices = question.choices || [];
      if (!choices.length) {
        issues.push({
          level: 'error',
          title: `Choix vides: ${name || label}`,
          detail: 'Ajoutez les options possibles ou utilisez un choix depuis fichier CSV.',
          questionId: question.id,
        });
      }
      const choiceNames = choices.map((choice) => choice.name.trim()).filter(Boolean);
      const duplicateChoices = choiceNames.filter((choiceName, choiceIndex) => choiceNames.indexOf(choiceName) !== choiceIndex);
      if (duplicateChoices.length) {
        issues.push({
          level: 'error',
          title: `Valeur de choix dupliquee: ${name || label}`,
          detail: 'Deux choix ne peuvent pas avoir la meme valeur technique.',
          questionId: question.id,
        });
      }
      if (question.type === 'rank' && choices.length < 2) {
        issues.push({
          level: 'warning',
          title: `Classement trop court: ${name || label}`,
          detail: 'Un champ rank est utile avec au moins deux options a ordonner.',
          questionId: question.id,
        });
      }
    }

    if ((question.type === 'select_one_from_file' || question.type === 'select_multiple_from_file') && !String(question.listName || '').includes('.csv')) {
      issues.push({
        level: 'warning',
        title: `CSV externe a verifier: ${name || label}`,
        detail: 'Kobo attend generalement le nom du fichier externe, par exemple choix.csv.',
        questionId: question.id,
      });
    }

    if (question.type === 'calculate' && !question.calculation?.trim()) {
      issues.push({
        level: 'warning',
        title: `Calcul vide: ${name || label}`,
        detail: 'Un champ calculate doit contenir une expression XLSForm.',
        questionId: question.id,
      });
    }

    if (question.type === 'hidden' && !question.defaultValue?.trim() && !question.calculation?.trim()) {
      issues.push({
        level: 'warning',
        title: `Champ cache sans valeur: ${name || label}`,
        detail: 'Definissez une valeur par defaut ou un calcul pour que le champ cache soit utile.',
        questionId: question.id,
      });
    }

    if (question.type === 'range' && !question.parameters?.trim()) {
      issues.push({
        level: 'warning',
        title: `Curseur sans bornes: ${name || label}`,
        detail: 'Ajoutez des parametres start/end/step pour cadrer la saisie terrain.',
        questionId: question.id,
      });
    }

    projectDraft.languages.forEach((language) => {
      if (language === projectDraft.defaultLanguage) return;
      if (!question.labels?.[language]?.trim() && label) {
        issues.push({
          level: 'warning',
          title: `Traduction ${getBuilderLanguageMeta(language).label} manquante`,
          detail: `${label} utilisera le libelle principal si la langue est activee.`,
          questionId: question.id,
        });
      }
    });
  });

  const numeroQuestion = questions.find((question) => question.name === 'Numero_ordre');
  if (!numeroQuestion) {
    issues.push({
      level: 'error',
      title: 'Numero ordre absent',
      detail: 'Le rattachement menage VPS ne peut pas fonctionner sans ce champ.',
    });
  } else if (!numeroQuestion.required) {
    issues.push({
      level: 'warning',
      title: 'Numero ordre non obligatoire',
      detail: 'Il devrait rester requis pour garantir la liaison avec la base menage.',
      questionId: numeroQuestion.id,
    });
  }

  const roleQuestion = questions.find((question) => question.name === 'role');
  if (!roleQuestion) {
    issues.push({
      level: 'error',
      title: 'Passage role absent',
      detail: 'La logique metier GEM/Kobo depend du champ role pour ouvrir les etapes.',
    });
  } else {
    if (roleQuestion.type !== 'select_one' || roleQuestion.listName !== 'roles') {
      issues.push({
        level: 'warning',
        title: 'Role non aligne sur la liste officielle',
        detail: 'Utilisez select_one roles pour conserver les branchements existants.',
        questionId: roleQuestion.id,
      });
    }
    const roleChoices = (roleQuestion.choices || INTERNAL_GEM_CHOICES.roles).map((choice) => choice.name);
    if (!roleChoices.some((role) => normalizedRoleNames.has(role))) {
      issues.push({
        level: 'warning',
        title: 'Choix role non reconnus',
        detail: 'Les raccourcis metier attendent les roles Livreur, Macon, Reseau, Installateur, Controleur.',
        questionId: roleQuestion.id,
      });
    }
  }

  if (!questions.some((question) => ['image', 'signature', 'file', 'audio', 'video'].includes(question.type))) {
    issues.push({
      level: 'warning',
      title: 'Aucune preuve media',
      detail: 'Ajoutez photo, signature ou fichier pour rapprocher la collecte de KoboCollect.',
    });
  }

  if (projectDraft.requireLatestVersion && projectDraft.draftMigrationMode === 'preserve') {
    issues.push({
      level: 'warning',
      title: 'Politique version contradictoire',
      detail: 'Version recente requise et preservation ancienne version peuvent bloquer certains brouillons.',
    });
  }

  return issues.slice(0, 40);
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
  if (column.listName) return formatInternalGemValue(String(value || ''), column.listName) || String(value || '');
  if (Array.isArray(value)) return value.join(', ');
  return String(value ?? '');
};

const normalizeBucketLabel = (bucket: 'status' | 'role' | 'sync' | 'version', value: string) => {
  if (bucket === 'status') return statusLabels[value] || value || 'Non defini';
  if (bucket === 'role') return formatInternalGemValue(value, 'roles') || value || 'Role non defini';
  if (bucket === 'sync') return value || 'Non synchronise';
  return value ? `v${value}` : 'Version inconnue';
};

const getSubmissionBucketCounts = (
  submissions: InternalKoboSubmissionRecord[],
  bucket: 'status' | 'role' | 'sync' | 'version'
) => {
  const counts: Record<string, number> = {};
  submissions.forEach((submission) => {
    const rawValue =
      bucket === 'status'
        ? submission.status
        : bucket === 'role'
          ? submission.role || ''
          : bucket === 'sync'
            ? submission.syncStatus
            : submission.formVersion;
    const key = String(rawValue || '').trim() || 'non_defini';
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, label: normalizeBucketLabel(bucket, key), value }));
};

const parseCoordinatePair = (value: unknown): { lat: number; lon: number } | null => {
  if (Array.isArray(value) && value.length >= 2) {
    const lat = Number(value[0]);
    const lon = Number(value[1]);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  }

  const text = String(value || '').trim();
  if (!text) return null;
  const matches = text.match(/-?\d+(?:[.,]\d+)?/g);
  if (!matches || matches.length < 2) return null;
  const lat = Number(matches[0].replace(',', '.'));
  const lon = Number(matches[1].replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
};

const getSubmissionCoordinates = (submission: InternalKoboSubmissionRecord) => {
  const values = submission.values || {};
  const direct = parseCoordinatePair([
    (values as any).latitude_key || (values as any).latitude || (values as any).lat,
    (values as any).longitude_key || (values as any).longitude || (values as any).lon || (values as any).lng,
  ]);
  if (direct) return direct;

  return (
    parseCoordinatePair((values as any).LOCALISATION_CLIENT) ||
    parseCoordinatePair((values as any).gps) ||
    parseCoordinatePair((values as any).geopoint) ||
    parseCoordinatePair((values as any)._geolocation)
  );
};

const XLSFORM_CONTROL_TYPES = new Set([
  'start',
  'end',
  'deviceid',
  'subscriberid',
  'simserial',
  'phonenumber',
  'username',
  'email',
  'audit',
  'begin_group',
  'end_group',
  'begin_repeat',
  'end_repeat',
]);

const asPlainRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const asRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry)) as Record<string, unknown>[]
    : [];

const asString = (value: unknown, fallback = '') => {
  if (value === undefined || value === null) return fallback;
  return String(value);
};

const getRowTypeBase = (row: Record<string, unknown>) =>
  asString(row.type)
    .trim()
    .split(/\s+/)[0]
    .replace(/-/g, '_')
    .toLowerCase();

const getDefinitionRows = (definition: Record<string, unknown> | null) => {
  if (!definition) return [];
  const rows = asRecordArray(definition.rows);
  return rows.length ? rows : asRecordArray(definition.fields);
};

const getDefinitionFields = (definition: Record<string, unknown> | null) => {
  if (!definition) return [];
  const fields = asRecordArray(definition.fields);
  const source = fields.length ? fields : getDefinitionRows(definition);
  return source.filter((row) => {
    const type = getRowTypeBase(row);
    return Boolean(asString(row.name).trim()) && !XLSFORM_CONTROL_TYPES.has(type);
  });
};

const getDefinitionChoiceRows = (definition: Record<string, unknown> | null): Record<string, unknown>[] => {
  if (!definition) return [];
  const rawChoices = definition.choices;
  const directRows = asRecordArray(rawChoices);
  if (directRows.length) return directRows;
  const groupedChoices = asPlainRecord(rawChoices);
  return Object.entries(groupedChoices).flatMap(([listName, entries]) =>
    asRecordArray(entries).map((entry) => ({
      list_name: listName,
      ...entry,
    }))
  );
};

const getDefinitionChoicesForList = (definition: Record<string, unknown> | null, listName: string) =>
  getDefinitionChoiceRows(definition).filter((choice) =>
    asString(choice.list_name || choice.listName).trim() === listName
  );

const getDefinitionTitle = (form: InternalKoboImportedFormSummary | null, definition: Record<string, unknown> | null) =>
  asString(definition?.title || definition?.form_title || form?.title || form?.formKey || KOBO_SOURCE_SNAPSHOT.name);

const getDefinitionListName = (row: Record<string, unknown>) => {
  const explicit = asString(row.listName || row.list_name).trim();
  if (explicit) return explicit;
  const [, listName] = asString(row.type).trim().split(/\s+/);
  return listName || '';
};

const getDefinitionLabel = (row: Record<string, unknown>) => {
  const label = row.label;
  if (label && typeof label === 'object' && !Array.isArray(label)) {
    const record = label as Record<string, unknown>;
    return asString(record.default || Object.values(record)[0] || row.name, asString(row.name));
  }
  return asString(label || row.name, 'Question');
};

const getDefinitionTranslations = (row: Record<string, unknown>, baseKey: 'label' | 'hint') => {
  const source = baseKey === 'label' ? row.labels : row.hints;
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const translations = source as Record<string, unknown>;
    return builderLanguages.reduce<Partial<Record<BuilderLanguage, string>>>((acc, language) => {
      const value = asString(translations[language.xlsLabel] || translations[language.id]);
      if (value) acc[language.id] = value;
      return acc;
    }, {});
  }
  return builderLanguages.reduce<Partial<Record<BuilderLanguage, string>>>((acc, language) => {
    const value = asString(row[`${baseKey}::${language.xlsLabel}`] || row[`${baseKey}::${language.id}`]);
    if (value) acc[language.id] = value;
    return acc;
  }, {});
};

const getBuilderTypeFromDefinitionRow = (row: Record<string, unknown>): BuilderQuestionType => {
  const base = getRowTypeBase(row);
  if (base === 'xml_external') return 'xml_external';
  if (base === 'select_one_from_file' || (base === 'select_one' && row.external)) return 'select_one_from_file';
  if (base === 'select_multiple_from_file' || (base === 'select_multiple' && row.external)) return 'select_multiple_from_file';
  if (base === 'select_one' || base === 'select_multiple') return base;
  if (base in builderQuestionTypeLabel) return base as BuilderQuestionType;
  return 'text';
};

const convertDefinitionToBuilderQuestions = (definition: Record<string, unknown>): BuilderQuestion[] => {
  const fields = getDefinitionFields(definition);
  return fields.map((field, index) => {
    const type = getBuilderTypeFromDefinitionRow(field);
    const name = normalizeBuilderName(asString(field.name), `question_${index + 1}`);
    const listName = getDefinitionListName(field);
    const choices = listName
      ? getDefinitionChoicesForList(definition, listName).map((choice, choiceIndex) => ({
          name: normalizeBuilderName(asString(choice.name), `option_${choiceIndex + 1}`),
          label: getDefinitionLabel(choice),
        }))
      : undefined;

    return {
      id: makeQuestionId(),
      type,
      name,
      label: getDefinitionLabel(field),
      hint: asString(field.hint || field.guidance_hint),
      labels: getDefinitionTranslations(field, 'label'),
      hints: getDefinitionTranslations(field, 'hint'),
      required: field.required === true || asString(field.required).toLowerCase() === 'yes',
      listName: listName || undefined,
      choices,
      relevant: asString(field.relevant),
      calculation: asString(field.calculation),
      constraint: asString(field.constraint),
      constraintMessage: asString(field.constraintMessage || field.constraint_message),
      defaultValue: asString(field.defaultValue || field.default),
      appearance: asString(field.appearance),
      parameters: asString(field.parameters),
      choiceFilter: asString(field.choiceFilter || field.choice_filter),
      readOnly: field.readOnly === true || asString(field.readonly || field.readOnly).toLowerCase() === 'yes',
    };
  });
};

const escapeXml = (value: unknown) =>
  asString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const getCellValue = (value: unknown) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const buildSpreadsheetSheetXml = (sheetName: string, rows: Record<string, unknown>[]) => {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const safeHeaders = headers.length ? headers : ['type', 'name', 'label'];
  const rowXml = [
    safeHeaders,
    ...rows.map((row) => safeHeaders.map((header) => getCellValue(row[header]))),
  ].map((cells) => (
    `<Row>${cells.map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join('')}</Row>`
  ));

  return `<Worksheet ss:Name="${escapeXml(sheetName)}"><Table>${rowXml.join('')}</Table></Worksheet>`;
};

const buildXlsFormSpreadsheetXml = (form: InternalKoboImportedFormSummary, definition: Record<string, unknown>) => {
  const settings = {
    form_title: getDefinitionTitle(form, definition),
    form_id: asString(definition.formKey || form.formKey),
    version: asString(definition.formVersion || form.formVersion),
    ...asPlainRecord(definition.settings),
  };
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    buildSpreadsheetSheetXml('survey', getDefinitionRows(definition)),
    buildSpreadsheetSheetXml('choices', getDefinitionChoiceRows(definition)),
    buildSpreadsheetSheetXml('settings', [settings]),
    '</Workbook>',
  ].join('');
};

const buildXFormXml = (form: InternalKoboImportedFormSummary, definition: Record<string, unknown>) => {
  const fields = getDefinitionFields(definition);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<xform id="${escapeXml(definition.formKey || form.formKey)}" version="${escapeXml(definition.formVersion || form.formVersion)}">`,
    `  <title>${escapeXml(getDefinitionTitle(form, definition))}</title>`,
    '  <survey>',
    ...fields.map((field) => (
      `    <field name="${escapeXml(field.name)}" type="${escapeXml(field.type)}" required="${escapeXml(field.required)}">${escapeXml(getDefinitionLabel(field))}</field>`
    )),
    '  </survey>',
    '</xform>',
  ].join('\n');
};

type ProjectStatus = 'deployed' | 'draft' | 'archived';

const getProjectStatus = (form: InternalKoboImportedFormSummary): ProjectStatus => {
  if (form.status === 'draft') return 'draft';
  if (form.active === false || form.status === 'inactive') return 'archived';
  return 'deployed';
};

const projectStatusMeta: Record<ProjectStatus, { label: string; className: string }> = {
  deployed: {
    label: 'deploye',
    className: 'bg-blue-100 text-blue-800',
  },
  draft: {
    label: 'brouillon',
    className: 'bg-cyan-100 text-cyan-800',
  },
  archived: {
    label: 'archive',
    className: 'bg-slate-200 text-slate-600',
  },
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
    defaultLanguage: 'fr',
    languages: ['fr'],
    ownerTeam: 'terrain',
    allowedRoles: INTERNAL_GEM_CHOICES.roles.map((role) => role.name),
    allowOffline: true,
    requireLatestVersion: true,
    draftMigrationMode: 'migrate',
  });
  const [builderQuestions, setBuilderQuestions] = useState<BuilderQuestion[]>(getTemplateBuilderQuestions);
  const [builderHistory, setBuilderHistory] = useState<BuilderQuestion[][]>([]);
  const [builderFuture, setBuilderFuture] = useState<BuilderQuestion[][]>([]);
  const [builderClipboard, setBuilderClipboard] = useState<BuilderQuestion | null>(null);
  const [selectedBuilderQuestionId, setSelectedBuilderQuestionId] = useState('');
  const [builderSettingsTab, setBuilderSettingsTab] = useState<BuilderSettingsTab>('options');
  const [builderLanguage, setBuilderLanguage] = useState<BuilderLanguage>('fr');
  const [questionLibraryQuery, setQuestionLibraryQuery] = useState('');
  const [builderDropTarget, setBuilderDropTarget] = useState<{ id: string; position: BuilderDropPosition } | null>(null);
  const [builderDraggingLabel, setBuilderDraggingLabel] = useState('');
  const [selectedRubricTitle, setSelectedRubricTitle] = useState('Menage');
  const [showKoboRubricAudit, setShowKoboRubricAudit] = useState(false);
  const [selectedTableRows, setSelectedTableRows] = useState<string[]>([]);
  const [hiddenTableColumns, setHiddenTableColumns] = useState<string[]>([]);
  const [tableColumnFilters, setTableColumnFilters] = useState<Record<string, string>>({});
  const [savedDataFilters, setSavedDataFilters] = useState<SavedDataFilter[]>([]);
  const [savedDataFilterName, setSavedDataFilterName] = useState('');
  const [showTableFieldsPanel, setShowTableFieldsPanel] = useState(false);
  const [isSavingBuilder, setIsSavingBuilder] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [filters, setFilters] = useState<Filters>({
    q: '',
    status: '',
    role: '',
    syncStatus: '',
    formKey: '',
    limit: 100,
    offset: 0,
  });
  const [galleryFieldFilter, setGalleryFieldFilter] = useState('');
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<{ url: string; title: string; submission: any } | null>(null);
  const [submissions, setSubmissions] = useState<InternalKoboSubmissionRecord[]>([]);
  const [submissionTotalCount, setSubmissionTotalCount] = useState(0);
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
  const [formToolsMenuKey, setFormToolsMenuKey] = useState('');
  const [formToolBusyKey, setFormToolBusyKey] = useState('');
  const [previewForm, setPreviewForm] = useState<InternalKoboImportedFormSummary | null>(null);
  const [previewDefinition, setPreviewDefinition] = useState<Record<string, unknown> | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [selectedProjectFormKey, setSelectedProjectFormKey] = useState('');
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
        formKey: selectedProjectFormKey || filters.formKey || undefined,
        limit: filters.limit,
        offset: filters.offset,
      };
      const [report, diagnostics] = await Promise.all([
        fetchInternalKoboSubmissionsReport(cleanFilters).catch((err) => {
          console.error('Error fetching submissions report:', err);
          return { submissions: [], count: 0, diagnostics: null };
        }),
        fetchInternalKoboDiagnostics().catch((err) => {
          console.error('Error fetching diagnostics:', err);
          return null;
        }),
      ]);
      setSubmissions(report.submissions);
      setSubmissionTotalCount(report.count || report.submissions.length);
      setListDiagnostics(report.diagnostics);
      setGlobalDiagnostics(diagnostics);
      setSelectedId((current) =>
        report.submissions.some((submission) => submission.id === current)
          ? current
          : report.submissions[0]?.id || ''
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les soumissions GEM');
    } finally {
      setIsLoading(false);
    }
  }, [filters, selectedProjectFormKey]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  useEffect(() => {
    loadFormDefinitions();
  }, [loadFormDefinitions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(savedDataFiltersStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setSavedDataFilters(parsed);
    } catch {
      setSavedDataFilters([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(savedDataFiltersStorageKey, JSON.stringify(savedDataFilters.slice(0, 30)));
  }, [savedDataFilters]);

  useEffect(() => {
    setSelectedProjectFormKey((current) => {
      if (current && importedForms.some((form) => form.formKey === current && getProjectStatus(form) === 'deployed')) {
        return current;
      }
      return importedForms.find((form) => getProjectStatus(form) === 'deployed')?.formKey || '';
    });
  }, [importedForms]);

  useEffect(() => {
    setReviewNote('');
  }, [selectedSubmission?.id]);

  useEffect(() => {
    setSelectedTableRows((current) =>
      current.filter((id) => submissions.some((submission) => submission.id === id))
    );
  }, [submissions]);

  const saveCurrentDataFilter = () => {
    const name = savedDataFilterName.trim();
    if (!name) {
      setFormManagerMessage('Donnez un nom au filtre avant de le sauvegarder.');
      return;
    }
    const nextFilter: SavedDataFilter = {
      id: `filter_${Date.now()}`,
      name,
      filters,
      tableColumnFilters,
      hiddenTableColumns,
      selectedProjectFormKey,
      createdAt: new Date().toISOString(),
    };
    setSavedDataFilters((current) => [nextFilter, ...current.filter((item) => item.name.toLowerCase() !== name.toLowerCase())].slice(0, 30));
    setSavedDataFilterName('');
    setFormManagerMessage(`Filtre sauvegarde: ${name}`);
  };

  const applySavedDataFilter = (savedFilter: SavedDataFilter) => {
    setFilters({ ...savedFilter.filters, offset: savedFilter.filters.offset || 0 });
    setTableColumnFilters(savedFilter.tableColumnFilters || {});
    setHiddenTableColumns(savedFilter.hiddenTableColumns || []);
    setSelectedProjectFormKey(savedFilter.selectedProjectFormKey || '');
    setFormManagerMessage(`Filtre charge: ${savedFilter.name}`);
  };

  const deleteSavedDataFilter = (id: string) => {
    setSavedDataFilters((current) => current.filter((item) => item.id !== id));
  };

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
        formKey: selectedProjectFormKey || undefined,
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

  const exportMediaZip = async () => {
    setIsExporting('zip');
    setError('');
    try {
      const { blob, filename } = await downloadInternalKoboMediaExport({
        formKey: selectedProjectFormKey,
        status: filters.status || undefined,
      });
      saveBlob(blob, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'export media');
    } finally {
      setIsExporting('');
    }
  };

  const handleDeleteSubmission = async (id: string) => {
    try {
      // API call to delete submission would go here.
      // await deleteInternalKoboSubmission(id);
      setFormManagerMessage('Soumission supprimee avec succes.');
      await loadSubmissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression de la soumission');
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
      setFilters((current) => ({ ...current, status: '', syncStatus: '', role: '', offset: 0 }));
      return;
    }
    if (section === 'drafts') {
      setMainTab('form');
      setFilters((current) => ({ ...current, status: '', syncStatus: '', role: '', offset: 0 }));
      return;
    }
    setMainTab('form');
  };

  const snapshotBuilderQuestions = useCallback(() => {
    setBuilderHistory((current) => [...current.slice(-19), cloneBuilderQuestions(builderQuestions)]);
    setBuilderFuture([]);
  }, [builderQuestions]);

  const resetBuilderHistory = () => {
    setBuilderHistory([]);
    setBuilderFuture([]);
    setBuilderClipboard(null);
  };

  const undoBuilderChange = () => {
    const previous = builderHistory[builderHistory.length - 1];
    if (!previous) return;
    setBuilderFuture((current) => [cloneBuilderQuestions(builderQuestions), ...current].slice(0, 20));
    setBuilderHistory((current) => current.slice(0, -1));
    setBuilderQuestions(cloneBuilderQuestions(previous));
    setSelectedBuilderQuestionId((current) =>
      previous.some((question) => question.id === current) ? current : previous[0]?.id || ''
    );
  };

  const redoBuilderChange = () => {
    const next = builderFuture[0];
    if (!next) return;
    setBuilderHistory((current) => [...current.slice(-19), cloneBuilderQuestions(builderQuestions)]);
    setBuilderFuture((current) => current.slice(1));
    setBuilderQuestions(cloneBuilderQuestions(next));
    setSelectedBuilderQuestionId((current) =>
      next.some((question) => question.id === current) ? current : next[0]?.id || ''
    );
  };

  const copyBuilderQuestionToClipboard = (questionId = selectedBuilderQuestionId) => {
    const question = builderQuestions.find((entry) => entry.id === questionId);
    if (!question) return;
    setBuilderClipboard(cloneBuilderQuestion(question, { preserveId: true }));
    setFormManagerMessage(`Question copiee: ${question.label || question.name}`);
  };

  const pasteBuilderQuestionFromClipboard = (afterId = selectedBuilderQuestionId) => {
    if (!builderClipboard) return;
    snapshotBuilderQuestions();
    setBuilderQuestions((current) => {
      const insertIndex = afterId ? current.findIndex((entry) => entry.id === afterId) : -1;
      const name = getUniqueBuilderQuestionName(`${builderClipboard.name}_copie`, current);
      const clone = cloneBuilderQuestion(builderClipboard, {
        name,
        label: `${builderClipboard.label || builderClipboard.name} copie`,
      });
      if (insertIndex < 0) return [...current, clone];
      return [...current.slice(0, insertIndex + 1), clone, ...current.slice(insertIndex + 1)];
    });
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
    resetBuilderHistory();
    let questions: BuilderQuestion[] = [];
    if (mode === 'blank') {
      questions = getBlankBuilderQuestions();
    } else if (mode === 'internal_gem') {
      questions = getInternalGemBuilderQuestions();
    } else {
      questions = getTemplateBuilderQuestions();
    }
    setBuilderQuestions(questions);
    setSelectedBuilderQuestionId('');
    setProjectDraft((current) => ({
      ...current,
      title: current.title || (mode === 'internal_gem' ? 'GEM Collect Natif' : mode === 'template' ? 'Copie de Suivi Electrification menages V2' : ''),
      description: current.description || (mode === 'internal_gem' ? 'Structure native du moteur de saisie terrain GEM.' : mode === 'template' ? 'Formulaire cree a partir de la structure Kobo active.' : ''),
    }));
    setNewProjectStep('details');
  };

  const updateBuilderQuestion = (id: string, patch: Partial<BuilderQuestion>) => {
    snapshotBuilderQuestions();
    setBuilderQuestions((current) =>
      current.map((question) => {
        if (question.id !== id) return question;
        const next = { ...question, ...patch };
        if (patch.label !== undefined && (!question.name || question.name.startsWith('question_'))) {
          next.name = normalizeBuilderName(String(patch.label || ''), question.name || 'question');
        }
        if ((['select_one', 'select_multiple', 'select_one_from_file', 'select_multiple_from_file', 'rank'] as BuilderQuestionType[]).includes(patch.type as BuilderQuestionType) && !next.listName) {
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
    snapshotBuilderQuestions();
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
    snapshotBuilderQuestions();
    setBuilderQuestions((current) => {
      const index = current.findIndex((question) => question.id === id);
      if (index < 0) return current;
      const clone = cloneBuilderQuestion(current[index], {
        name: getUniqueBuilderQuestionName(`${current[index].name}_copie`, current),
        label: `${current[index].label} copie`,
      });
      return [...current.slice(0, index + 1), clone, ...current.slice(index + 1)];
    });
  };

  const deleteBuilderQuestion = (id: string) => {
    snapshotBuilderQuestions();
    setBuilderQuestions((current) => current.filter((question) => question.id !== id));
    setSelectedBuilderQuestionId((current) => (current === id ? '' : current));
  };

  const moveBuilderQuestion = (sourceId: string, targetId: string, position: BuilderDropPosition) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    snapshotBuilderQuestions();
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
    snapshotBuilderQuestions();
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
    snapshotBuilderQuestions();
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
    snapshotBuilderQuestions();
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
    snapshotBuilderQuestions();
    setBuilderQuestions((current) =>
      current.map((question) =>
        question.id === questionId
          ? { ...question, choices: (question.choices || []).filter((_, index) => index !== choiceIndex) }
          : question
      )
    );
  };

  const insertBuilderLibraryBlock = (blockKey: string) => {
    const block = builderQuestionLibrary.find((entry) => entry.key === blockKey);
    if (!block) return;
    snapshotBuilderQuestions();
    const questions = block.questions.map((question, index) => ({
      ...question,
      id: makeQuestionId(),
      name: normalizeBuilderName(question.name, `${block.key}_${index + 1}`),
      labels: question.labels || { fr: question.label },
      hints: question.hints || (question.hint ? { fr: question.hint } : undefined),
    }));
    setBuilderQuestions((current) => [...current, ...questions]);
    setSelectedBuilderQuestionId(questions[0]?.id || '');
    setBuilderSettingsTab('options');
  };

  const toggleProjectLanguage = (language: BuilderLanguage) => {
    setProjectDraft((current) => {
      const enabled = current.languages.includes(language);
      const languages = enabled
        ? current.languages.filter((item) => item !== language)
        : [...current.languages, language];
      const nextLanguages = languages.length ? languages : [current.defaultLanguage];
      return {
        ...current,
        languages: nextLanguages,
        defaultLanguage: nextLanguages.includes(current.defaultLanguage) ? current.defaultLanguage : nextLanguages[0],
      };
    });
  };

  const toggleProjectRole = (roleName: string) => {
    setProjectDraft((current) => {
      const enabled = current.allowedRoles.includes(roleName);
      return {
        ...current,
        allowedRoles: enabled
          ? current.allowedRoles.filter((role) => role !== roleName)
          : [...current.allowedRoles, roleName],
      };
    });
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
      snapshotBuilderQuestions();
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

  const buildSurveyRowFromQuestion = (question: BuilderQuestion) => {
    const row: Record<string, unknown> = {
      type: getBuilderTypeForSurvey(question),
      name: normalizeBuilderName(question.name || question.label, 'question'),
      label: getBuilderQuestionLabel(question, projectDraft.defaultLanguage),
      hint: getBuilderQuestionHint(question, projectDraft.defaultLanguage),
      required: question.required ? 'yes' : '',
      relevant: question.relevant || '',
      calculation: question.calculation || '',
      constraint: question.constraint || '',
      constraint_message: question.constraintMessage || '',
      default: question.defaultValue || '',
      appearance: question.appearance || '',
      readonly: question.readOnly ? 'yes' : '',
      parameters: question.parameters || '',
      choice_filter: question.choiceFilter || '',
    };

    projectDraft.languages.forEach((language) => {
      const languageMeta = getBuilderLanguageMeta(language);
      const label = question.labels?.[language] || (language === projectDraft.defaultLanguage ? question.label : '');
      const hint = question.hints?.[language] || (language === projectDraft.defaultLanguage ? question.hint : '');
      if (label) row[`label::${languageMeta.xlsLabel}`] = label;
      if (hint) row[`hint::${languageMeta.xlsLabel}`] = hint;
      if (question.constraintMessage) row[`constraint_message::${languageMeta.xlsLabel}`] = question.constraintMessage;
    });

    const cleanRow: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        cleanRow[key] = val;
      }
    });

    return cleanRow;
  };

  const buildBuilderSurvey = (questions: BuilderQuestion[] = builderQuestions) => {
    const rows: Array<Record<string, unknown>> = [
      { type: 'start', name: 'start' },
      { type: 'end', name: 'end' },
      { type: 'begin_group', name: 'TYPE_DE_VISITE', label: 'Menage' },
    ];
    let openSection = null as { type: 'begin_group' | 'begin_repeat'; name: string } | null;

    builderQuestions.forEach((question) => {
      if (question.type === 'begin_group' || question.type === 'begin_repeat') {
        if (openSection) {
          rows.push({
            type: openSection.type === 'begin_group' ? 'end_group' : 'end_repeat',
          });
        }
        rows.push(buildSurveyRowFromQuestion(question));
        openSection = {
          type: question.type,
          name: normalizeBuilderName(question.name || question.label, 'section'),
        };
        return;
      }
      rows.push(buildSurveyRowFromQuestion(question));
    });

    if (openSection) {
      rows.push({
        type: openSection.type === 'begin_group' ? 'end_group' : 'end_repeat',
      });
    }
    rows.push({ type: 'end_group' });
    return rows;
  };

  const buildBuilderChoices = (questions: BuilderQuestion[] = builderQuestions) => {
    const choices: Array<Record<string, string>> = [];
    const seen = new Set<string>();
    
    // IMPORTANT: The backend already injects these base lists via getBuilderBaseChoices().
    // Sending them again causes duplicate list_name/name entries → XLSForm parser crash → 500.
    const BACKEND_MANAGED_LISTS = new Set(['roles', 'oui_non']);

    questions.forEach((question) => {
      (question.choices || []).forEach((choice) => {
        const listName = question.listName || `${question.name}_choices`;
        
        // Skip any list the backend already manages
        if (BACKEND_MANAGED_LISTS.has(listName)) return;

        const name = normalizeBuilderName(choice.name || choice.label, 'choice');
        const key = `${listName}|${name}`;
        
        if (!seen.has(key)) {
          seen.add(key);
          const row: Record<string, string> = {
            list_name: listName,
            name: name,
            label: choice.label,
          };
          
          projectDraft.languages.forEach((language) => {
            const languageMeta = getBuilderLanguageMeta(language);
            row[`label::${languageMeta.xlsLabel}`] = choice.label;
          });
          
          choices.push(row);
        }
      });
    });
    
    return choices;
  };

  const handleSaveBuilderProject = async () => {
    if (!projectDraft.title.trim()) {
      setError('Le nom du projet est obligatoire');
      setNewProjectStep('details');
      return;
    }
    if (builderAuditErrors.length) {
      setError(`Audit Kobo bloquant: ${builderAuditErrors[0].title}. Corrigez les erreurs avant sauvegarde.`);
      setSelectedBuilderQuestionId(builderAuditErrors.find((issue) => issue.questionId)?.questionId || selectedBuilderQuestionId);
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
        defaultLanguage: getBuilderLanguageMeta(projectDraft.defaultLanguage).xlsLabel,
        settings: {
          default_language: getBuilderLanguageMeta(projectDraft.defaultLanguage).xlsLabel,
          style: 'pages',
          languages: projectDraft.languages.map((language) => getBuilderLanguageMeta(language).xlsLabel),
          gem_permissions: {
            ownerTeam: projectDraft.ownerTeam,
            allowedRoles: projectDraft.allowedRoles,
            allowOffline: projectDraft.allowOffline,
            requireLatestVersion: projectDraft.requireLatestVersion,
            draftMigrationMode: projectDraft.draftMigrationMode,
          },
          gem_sync_policy: {
            retry: 'exponential-backoff',
            duplicateControl: 'clientSubmissionId+mediaHash',
            preserveDraftsOnVersionChange: projectDraft.draftMigrationMode !== 'block',
          },
        },
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

  const loadFullFormDefinition = async (form: InternalKoboImportedFormSummary) => {
    const definition = await fetchInternalKoboImportedFormDefinition(form.formKey);
    if (!definition) throw new Error('Definition XLSForm introuvable sur le VPS');
    return definition;
  };

  const handleOpenFormPreview = async (form: InternalKoboImportedFormSummary) => {
    setPreviewForm(form);
    setPreviewDefinition(null);
    setIsPreviewLoading(true);
    setFormToolsMenuKey('');
    setError('');
    try {
      const definition = await loadFullFormDefinition(form);
      setPreviewDefinition(definition);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Apercu du formulaire impossible');
      setPreviewForm(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleEditFormInBuilder = async (form: InternalKoboImportedFormSummary) => {
    const busyKey = `${form.formKey}:edit`;
    setFormToolBusyKey(busyKey);
    setFormToolsMenuKey('');
    setError('');
    try {
      const definition = await loadFullFormDefinition(form);
      const questions = convertDefinitionToBuilderQuestions(definition);
      setProjectDraft({
        title: `${form.title || form.formKey} - copie editable`,
        description: 'Copie creee depuis la definition XLSForm active pour modification dans GEM.',
        sector: 'Energie',
        country: 'Senegal',
        defaultLanguage: 'fr',
        languages: ['fr', 'en'],
        ownerTeam: 'terrain',
        allowedRoles: INTERNAL_GEM_CHOICES.roles.map((role) => role.name),
        allowOffline: true,
        requireLatestVersion: true,
        draftMigrationMode: 'migrate',
      });
      setBuilderMode('template');
      resetBuilderHistory();
      setBuilderQuestions(questions.length ? questions : getBlankBuilderQuestions());
      setSelectedBuilderQuestionId(questions[0]?.id || '');
      setBuilderSettingsTab('options');
      setNewProjectStep(null);
      setWorkspaceSection('new');
      setMainTab('form');
      setFormManagerMessage('Definition chargee dans le builder. Sauvegardez pour creer un nouveau brouillon VPS.');
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'Edition du formulaire impossible');
    } finally {
      setFormToolBusyKey('');
    }
  };

  const handleDownloadFormDefinition = async (form: InternalKoboImportedFormSummary, format: 'xls' | 'xml') => {
    const busyKey = `${form.formKey}:${format}`;
    setFormToolBusyKey(busyKey);
    setFormToolsMenuKey('');
    setError('');
    try {
      const definition = await loadFullFormDefinition(form);
      const fileBase = normalizeBuilderName(form.title || form.formKey, form.formKey || 'formulaire');
      if (format === 'xls') {
        saveBlob(
          new Blob([buildXlsFormSpreadsheetXml(form, definition)], {
            type: 'application/vnd.ms-excel;charset=utf-8',
          }),
          `${fileBase}.xls`
        );
      } else {
        saveBlob(
          new Blob([buildXFormXml(form, definition)], {
            type: 'application/xml;charset=utf-8',
          }),
          `${fileBase}.xml`
        );
      }
      setFormManagerMessage(`${format.toUpperCase()} genere depuis la definition VPS.`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : `Telechargement ${format.toUpperCase()} impossible`);
    } finally {
      setFormToolBusyKey('');
    }
  };

  const handleShareForm = async (form: InternalKoboImportedFormSummary) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?koboForm=${encodeURIComponent(form.formKey)}`;
    setFormToolsMenuKey('');
    try {
      await navigator.clipboard?.writeText(shareUrl);
      setFormManagerMessage('Lien du projet copie dans le presse-papiers.');
    } catch {
      setFormManagerMessage(`Lien projet: ${shareUrl}`);
    }
  };

  const handleCloneForm = async (form: InternalKoboImportedFormSummary, mode: 'clone' | 'template') => {
    const busyKey = `${form.formKey}:${mode}`;
    setFormToolBusyKey(busyKey);
    setFormToolsMenuKey('');
    setError('');
    setFormManagerMessage('');
    try {
      const definition = await loadFullFormDefinition(form);
      const titlePrefix = mode === 'template' ? 'Modele' : 'Clone';
      const title = `${titlePrefix} de ${getDefinitionTitle(form, definition)}`;
      const formId = normalizeBuilderName(`${title}_${Date.now()}`, 'formulaire_clone');
      const result = await createInternalKoboFormDefinition({
        title,
        description: mode === 'template'
          ? 'Modèle créé depuis la définition GEM active.'
          : 'Clone créé depuis la définition GEM active.',
        sector: 'Energie',
        country: 'Senegal',
        sourceType: mode,
        activate: false,
        survey: getDefinitionRows(definition),
        choices: getDefinitionChoiceRows(definition),
        settings: {
          ...asPlainRecord(definition.settings),
          form_title: title,
          form_id: formId,
          version: new Date().toISOString(),
        },
      });
      setFormManagerMessage(`${mode === 'template' ? 'Modele' : 'Clone'} cree: ${result.form?.title || title}`);
      await loadFormDefinitions();
      setWorkspaceSection('drafts');
      setMainTab('form');
    } catch (cloneError) {
      setError(cloneError instanceof Error ? cloneError.message : 'Creation de la copie impossible');
    } finally {
      setFormToolBusyKey('');
    }
  };

  const handleDeployInternalGemForm = async () => {
    setIsSavingBuilder(true);
    setError('');
    setFormManagerMessage('');
    try {
      const questions = getInternalGemBuilderQuestions();
      const title = 'GEM Collect Natif Dynamique';
      const formId = normalizeBuilderName(`${title}_${Date.now()}`, 'gem_collect_natif');
      
      const result = await createInternalKoboFormDefinition({
        title,
        description: 'Structure native GEM migree en definition dynamique.',
        sector: 'Energie',
        country: 'Senegal',
        sourceType: 'internal_gem',
        activate: true,
        survey: buildBuilderSurvey(questions),
        choices: buildBuilderChoices(questions),
        defaultLanguage: projectDraft.defaultLanguage,
        settings: {
          default_language: getBuilderLanguageMeta(projectDraft.defaultLanguage).xlsLabel,
          style: 'pages',
          languages: projectDraft.languages.map(l => getBuilderLanguageMeta(l).xlsLabel),
          gem_permissions: {
            ownerTeam: 'admin',
            allowedRoles: INTERNAL_GEM_CHOICES.roles.map(r => r.name),
            allowOffline: true,
            requireLatestVersion: true,
            draftMigrationMode: 'block',
          },
        },
      });
      
      setFormManagerMessage(`Formulaire natif deploye: ${result.form?.title || title}`);
      await loadFormDefinitions();
      setWorkspaceSection('deployed');
    } catch (deployError) {
      setError(deployError instanceof Error ? deployError.message : 'Deploiement du formulaire natif impossible');
    } finally {
      setIsSavingBuilder(false);
    }
  };

  const handleRedeployForm = async (form: InternalKoboImportedFormSummary) => {
    setFormToolsMenuKey('');
    if (form.active !== false) {
      setFormManagerMessage(`${form.title || form.formKey} est deja deploye.`);
      return;
    }
    await handleToggleFormStatus(form);
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
  const previewFields = useMemo(() => getDefinitionFields(previewDefinition).slice(0, 12), [previewDefinition]);
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


  const galleryFieldNames = useMemo(() => {
    const names = new Set<string>();
    galleryAttachments.forEach(({ attachment }) => {
      if (attachment.fieldName) names.add(attachment.fieldName);
    });
    return Array.from(names).sort();
  }, [galleryAttachments]);

  const filteredGalleryAttachments = useMemo(() => {
    if (!galleryFieldFilter) return galleryAttachments;
    return galleryAttachments.filter(({ attachment }) => attachment.fieldName === galleryFieldFilter);
  }, [galleryAttachments, galleryFieldFilter]);

  const mappedSubmissions = useMemo(
    () =>
      submissions
        .map((submission) => ({ submission, coordinates: getSubmissionCoordinates(submission) }))
        .filter((entry): entry is { submission: InternalKoboSubmissionRecord; coordinates: { lat: number; lon: number } } =>
          Boolean(entry.coordinates)
        ),
    [submissions]
  );
  const mapBounds = useMemo(() => {
    if (!mappedSubmissions.length) return null;
    const lats = mappedSubmissions.map((entry) => entry.coordinates.lat);
    const lons = mappedSubmissions.map((entry) => entry.coordinates.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    return {
      minLat,
      maxLat,
      minLon,
      maxLon,
      latSpan: Math.max(maxLat - minLat, 0.0001),
      lonSpan: Math.max(maxLon - minLon, 0.0001),
    };
  }, [mappedSubmissions]);


  const autoReportBuckets = useMemo(() => {
    return [] as Array<{ title: string; bucket: string; rows: Array<{ key: string; label: string; value: number }> }>;
  }, [submissions, previewDefinition]);

  const deployedProjectForms = importedForms.filter((form) => getProjectStatus(form) === 'deployed');
  const selectedProjectForm = deployedProjectForms.find((form) => form.formKey === selectedProjectFormKey) || deployedProjectForms[0] || null;
  const activeFormCount = deployedProjectForms.length;
  const draftFormCount = importedForms.filter((form) => getProjectStatus(form) === 'draft').length;
  const inactiveFormCount = importedForms.filter((form) => getProjectStatus(form) === 'archived').length;
  const selectedBuilderQuestion = builderQuestions.find((question) => question.id === selectedBuilderQuestionId) || null;
  const builderAuditIssues = useMemo(
    () => auditBuilderProject(projectDraft, builderQuestions),
    [builderQuestions, projectDraft]
  );
  const builderAuditErrors = useMemo(
    () => builderAuditIssues.filter((issue) => issue.level === 'error'),
    [builderAuditIssues]
  );
  const builderAuditWarnings = useMemo(
    () => builderAuditIssues.filter((issue) => issue.level === 'warning'),
    [builderAuditIssues]
  );
  const selectedBuilderAuditIssues = useMemo(
    () => builderAuditIssues.filter((issue) => issue.questionId === selectedBuilderQuestionId),
    [builderAuditIssues, selectedBuilderQuestionId]
  );
  const builderAuditScore = Math.max(
    0,
    Math.min(100, Math.round(100 - builderAuditErrors.length * 18 - builderAuditWarnings.length * 5))
  );
  const filteredQuestionLibrary = useMemo(() => {
    const query = questionLibraryQuery.trim().toLowerCase();
    if (!query) return builderQuestionLibrary;
    return builderQuestionLibrary.filter((block) =>
      `${block.title} ${block.description}`.toLowerCase().includes(query)
    );
  }, [questionLibraryQuery]);
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
    const status = getProjectStatus(form);
    if (workspaceSection === 'deployed') return status === 'deployed';
    if (workspaceSection === 'drafts') return status === 'draft';
    if (workspaceSection === 'archives') return status === 'archived';
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
            ? formatInternalGemValue(String(rawValue || ''), column.listName) || rawValue
            : rawValue;
          return String(displayValue || '').toLowerCase().includes(filter);
        })
      ),
    [submissions, tableColumnFilters, visibleTableColumns]
  );
  const allVisibleRowsSelected = filteredTableSubmissions.length > 0 &&
    filteredTableSubmissions.every((submission) => selectedTableRows.includes(submission.id));
  const serverPageStart = submissionTotalCount && submissions.length ? filters.offset + 1 : 0;
  const serverPageEnd = Math.min(filters.offset + submissions.length, submissionTotalCount);
  const canLoadPreviousPage = filters.offset > 0;
  const canLoadNextPage = filters.offset + submissions.length < submissionTotalCount;

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
    <>
    <PageContainer className="min-h-screen bg-slate-950 py-8">
      <PageHeader
        title="GEM Toolbox"
        subtitle="Console d'administration pour vérifier, exporter et auditer les fiches terrain GEM"
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
          aria-label="Importer un fichier XLSForm"
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
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100">Workspace GEM Toolbox</p>
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
                        {serverPageStart} - {serverPageEnd} sur {submissionTotalCount} serveur
                        {filteredTableSubmissions.length !== submissions.length ? ` (${filteredTableSubmissions.length} apres filtres colonnes)` : ''}
                      </span>
                      {deployedProjectForms.length > 0 ? (
                        <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-slate-500">
                          Projet
                          <select
                            value={selectedProjectFormKey}
                            onChange={(event) => {
                              setSelectedProjectFormKey(event.target.value);
                              setFilters((current) => ({ ...current, formKey: event.target.value, offset: 0 }));
                            }}
                            className="h-10 min-w-[260px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-cyan-400"
                          >
                            {deployedProjectForms.map((form) => (
                              <option key={form.formKey} value={form.formKey}>
                                {form.title || form.formKey}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {selectedTableRows.length > 0 ? (
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">
                          {selectedTableRows.length} selectionnee(s)
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFilters((current) => ({
                            ...current,
                            offset: Math.max(0, current.offset - current.limit),
                          }))
                        }
                        disabled={!canLoadPreviousPage}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-50 disabled:opacity-35"
                      >
                        <ArrowLeft size={14} />
                        precedent
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFilters((current) => ({
                            ...current,
                            offset: current.offset + current.limit,
                          }))
                        }
                        disabled={!canLoadNextPage}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-50 disabled:opacity-35"
                      >
                        suivant
                        <ArrowRight size={14} />
                      </button>
                      <select
                        value={filters.limit}
                        onChange={(event) => setFilters((current) => ({ ...current, limit: Number(event.target.value), offset: 0 }))}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-black uppercase tracking-[0.08em] text-slate-700 outline-none"
                        aria-label="Taille de page"
                      >
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={250}>250</option>
                        <option value={500}>500</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setTableColumnFilters({});
                          setFilters((current) => ({ ...current, offset: 0 }));
                        }}
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
                      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Filtres sauvegardes</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">Memorise projet, colonnes visibles, recherches et filtres de table pour les exports massifs.</p>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              value={savedDataFilterName}
                              onChange={(event) => setSavedDataFilterName(event.target.value)}
                              placeholder="Nom du filtre..."
                              className="h-10 min-w-0 sm:min-w-[260px] w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-cyan-400"
                            />
                            <button
                              type="button"
                              onClick={saveCurrentDataFilter}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-white hover:bg-cyan-700"
                            >
                              <Save size={14} />
                              Sauvegarder
                            </button>
                          </div>
                        </div>
                        {savedDataFilters.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {savedDataFilters.map((savedFilter) => (
                              <span key={savedFilter.id} className="inline-flex items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                                <button
                                  type="button"
                                  onClick={() => applySavedDataFilter(savedFilter)}
                                  className="px-3 py-1.5 text-[10px] font-black text-slate-700 hover:bg-cyan-50 hover:text-cyan-800"
                                >
                                  {savedFilter.name}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSavedDataFilter(savedFilter.id)}
                                  className="border-l border-slate-200 px-2 py-1.5 text-rose-500 hover:bg-rose-50"
                                  aria-label={`Supprimer ${savedFilter.name}`}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
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
                              {serverPageStart} - {serverPageEnd}
                              <br />
                              <span className="font-black">{submissionTotalCount} resultats</span>
                            </div>
                          </th>
                          {visibleTableColumns.map((column) => (
                            <th key={column.id} className="min-w-0 sm:min-w-[160px] border-b border-r border-slate-200 bg-slate-100 px-3 py-2 align-top">
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
                                  title={`Filtrer par ${column.label}`}
                                  aria-label={`Filtrer par ${column.label}`}
                                  className="h-9 w-full rounded border border-slate-200 bg-white px-2 text-sm font-medium text-slate-900 outline-none"
                                >
                                  <option value="">Afficher tout</option>
                                  {(column.listName ? INTERNAL_GEM_CHOICES[column.listName] || [] : []).map((choice) => (
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
                                     aria-label="Selectionner cette soumission"
                                     title="Selectionner cette soumission"
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
                            {formatInternalGemValue(selectedSubmission.role || '', 'roles')} - {formatDateTime(selectedSubmission.savedAt)}
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
                onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value, offset: 0 }))}
                placeholder="Numero, menage, telephone, ID recu..."
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
              />
            </label>
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as Filters['status'], offset: 0 }))}
              title="Filtrer par statut"
              aria-label="Filtrer par statut"
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
              onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value, offset: 0 }))}
              title="Filtrer par rôle"
              aria-label="Filtrer par rôle"
              className="h-12 rounded-2xl border border-white/10 bg-slate-900 px-4 text-xs font-black uppercase tracking-[0.1em] text-white outline-none"
            >
              <option value="">Tous roles</option>
              {INTERNAL_GEM_CHOICES.roles.map((role) => (
                <option key={role.name} value={role.name}>
                  {role.label}
                </option>
              ))}
            </select>
            <select
              value={filters.syncStatus}
              onChange={(event) => setFilters((current) => ({ ...current, syncStatus: event.target.value, offset: 0 }))}
              title="Filtrer par statut de synchronisation"
              aria-label="Filtrer par statut de synchronisation"
              className="h-12 rounded-2xl border border-white/10 bg-slate-900 px-4 text-xs font-black uppercase tracking-[0.1em] text-white outline-none"
            >
              <option value="">Sync tous</option>
              <option value="synced">Synced</option>
              <option value="queued">Queued</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={filters.limit}
              onChange={(event) => setFilters((current) => ({ ...current, limit: Number(event.target.value), offset: 0 }))}
              title="Nombre de résultats par page"
              aria-label="Nombre de résultats par page"
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
                        { id: 'internal_gem' as BuilderMode, label: 'GEM Collect Natif', icon: Activity, help: 'Importer la structure native du moteur de saisie terrain.' },
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
          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-100">Structure Kobo reprise</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {KOBO_SOURCE_RUBRICS.length} rubriques de reference masquees pour liberer l'espace de travail.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowKoboRubricAudit((current) => !current)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100 hover:bg-cyan-400/15"
              >
                <BookOpen size={13} />
                {showKoboRubricAudit ? 'Masquer audit' : 'Voir audit'}
              </button>
              <button
                type="button"
                onClick={handleDeployInternalGemForm}
                disabled={isSavingBuilder}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-50"
              >
                <Cloud size={13} className={isSavingBuilder ? 'animate-spin' : ''} />
                Déployer ce formulaire
              </button>
            </div>

            {showKoboRubricAudit ? (
              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                      onClick={undoBuilderChange}
                      disabled={builderHistory.length === 0}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700 hover:bg-slate-50 disabled:opacity-35"
                      title="Annuler la derniere modification"
                    >
                      <CornerUpLeft size={14} />
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={redoBuilderChange}
                      disabled={builderFuture.length === 0}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700 hover:bg-slate-50 disabled:opacity-35"
                      title="Retablir la modification"
                    >
                      <ArrowRight size={14} />
                      Retablir
                    </button>
                    <button
                      type="button"
                      onClick={() => copyBuilderQuestionToClipboard()}
                      disabled={!selectedBuilderQuestion}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700 hover:bg-slate-50 disabled:opacity-35"
                      title="Copier la question active"
                    >
                      <Copy size={14} />
                      Copier
                    </button>
                    <button
                      type="button"
                      onClick={() => pasteBuilderQuestionFromClipboard()}
                      disabled={!builderClipboard}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700 hover:bg-slate-50 disabled:opacity-35"
                      title="Coller apres la question active"
                    >
                      <ClipboardCheck size={14} />
                      Coller
                    </button>
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

                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[260px_1fr]">
                  <div className={`rounded-2xl border p-4 ${
                    builderAuditErrors.length
                      ? 'border-rose-200 bg-rose-50'
                      : builderAuditWarnings.length
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-emerald-200 bg-emerald-50'
                  }`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Audit Kobo</p>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <span className="text-3xl font-black text-slate-950">{builderAuditScore}%</span>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
                        builderAuditErrors.length
                          ? 'bg-rose-100 text-rose-800'
                          : builderAuditWarnings.length
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {builderAuditErrors.length ? `${builderAuditErrors.length} erreur(s)` : builderAuditWarnings.length ? `${builderAuditWarnings.length} alerte(s)` : 'Pret'}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-600">
                      Controle structure XLSForm, roles, langues, choix, version et collecte offline avant sauvegarde VPS.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Points a traiter</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Les erreurs bloquent la sauvegarde. Les alertes indiquent les ecarts Kobo a surveiller.
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">
                        {builderAuditErrors.length} bloquant(s) / {builderAuditWarnings.length} alerte(s)
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {builderAuditIssues.length ? builderAuditIssues.slice(0, 6).map((issue) => (
                        <button
                          key={`${issue.level}-${issue.title}-${issue.questionId || 'project'}`}
                          type="button"
                          onClick={() => issue.questionId && setSelectedBuilderQuestionId(issue.questionId)}
                          className={`rounded-xl border px-3 py-2 text-left ${
                            issue.level === 'error'
                              ? 'border-rose-200 bg-white text-rose-900'
                              : 'border-amber-200 bg-white text-amber-900'
                          }`}
                        >
                          <span className="block text-[10px] font-black uppercase tracking-[0.12em]">
                            {issue.level === 'error' ? 'Erreur' : 'Alerte'}
                          </span>
                          <span className="mt-1 block text-xs font-black">{issue.title}</span>
                          <span className="mt-1 block text-[11px] font-semibold leading-snug text-slate-600">{issue.detail}</span>
                        </button>
                      )) : (
                        <div className="rounded-xl border border-emerald-200 bg-white px-3 py-3 text-sm font-bold text-emerald-800">
                          Aucun blocage detecte. Le brouillon peut etre cree sur le VPS.
                        </div>
                      )}
                    </div>
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
                        className="group flex min-h-[62px] items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-all hover:border-blue-300 hover:bg-blue-50"
                        title="Glisser dans le formulaire ou cliquer pour ajouter"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 group-hover:ring-blue-200">
                          <Icon size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[12px] font-black leading-tight text-slate-900">{item.label}</span>
                          <span className="mt-1 block text-[10px] font-semibold leading-snug text-slate-500">{item.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Bibliotheque de questions</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">Blocs reutilisables comme Kobo Library, inseres dans la pile drag/drop.</p>
                      </div>
                      <div className="relative">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={questionLibraryQuery}
                          onChange={(event) => setQuestionLibraryQuery(event.target.value)}
                          placeholder="Chercher un bloc..."
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-400 sm:w-56"
                        />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {filteredQuestionLibrary.map((block) => (
                        <button
                          key={block.key}
                          type="button"
                          onClick={() => insertBuilderLibraryBlock(block.key)}
                          className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
                        >
                          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.1em] text-blue-800">
                            <BookOpen size={14} />
                            {block.title}
                          </span>
                          <span className="mt-1 block text-[11px] font-semibold leading-snug text-slate-500">{block.description}</span>
                          <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">
                            +{block.questions.length} champ(s)
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Langues et permissions</p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Langue active</span>
                        <select
                          value={builderLanguage}
                          onChange={(event) => setBuilderLanguage(event.target.value as BuilderLanguage)}
                          className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-400"
                        >
                          {builderLanguages.map((language) => (
                            <option key={language.id} value={language.id}>{language.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Equipe proprietaire</span>
                        <input
                          value={projectDraft.ownerTeam}
                          onChange={(event) => setProjectDraft((current) => ({ ...current, ownerTeam: event.target.value }))}
                          className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-400"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {builderLanguages.map((language) => {
                        const enabled = projectDraft.languages.includes(language.id);
                        return (
                          <button
                            key={language.id}
                            type="button"
                            onClick={() => toggleProjectLanguage(language.id)}
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${
                              enabled ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-slate-200 bg-white text-slate-500'
                            }`}
                          >
                            {enabled ? '✓ ' : '+ '}{language.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {INTERNAL_GEM_CHOICES.roles.map((role) => {
                        const enabled = projectDraft.allowedRoles.includes(role.name);
                        return (
                          <button
                            key={role.name}
                            type="button"
                            onClick={() => toggleProjectRole(role.name)}
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${
                              enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500'
                            }`}
                          >
                            {role.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <span className="text-[10px] font-black text-slate-600">Offline autorise</span>
                        <input
                          type="checkbox"
                          checked={projectDraft.allowOffline}
                          onChange={(event) => setProjectDraft((current) => ({ ...current, allowOffline: event.target.checked }))}
                          className="h-4 w-4 accent-blue-600"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <span className="text-[10px] font-black text-slate-600">Version recente requise</span>
                        <input
                          type="checkbox"
                          checked={projectDraft.requireLatestVersion}
                          onChange={(event) => setProjectDraft((current) => ({ ...current, requireLatestVersion: event.target.checked }))}
                          className="h-4 w-4 accent-blue-600"
                        />
                      </label>
                    </div>
                    <label className="mt-3 block">
                      <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Migration brouillons</span>
                      <select
                        value={projectDraft.draftMigrationMode}
                        onChange={(event) => setProjectDraft((current) => ({ ...current, draftMigrationMode: event.target.value as ProjectDraft['draftMigrationMode'] }))}
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-400"
                      >
                        <option value="migrate">Migrer si compatible</option>
                        <option value="preserve">Preserver en ancienne version</option>
                        <option value="block">Bloquer anciennes versions</option>
                      </select>
                    </label>
                  </div>
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
                                    {question.required ? '* ' : ''}{getBuilderQuestionLabel(question, builderLanguage) || `Question ${index + 1}`}
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
                                  {question.name} {getBuilderQuestionHint(question, builderLanguage) ? `- ${getBuilderQuestionHint(question, builderLanguage)}` : ''}
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

                  {selectedBuilderQuestion ? (
                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-700">Question active</p>
                      <p className="mt-1 truncate text-sm font-black text-slate-950">{getBuilderQuestionLabel(selectedBuilderQuestion, builderLanguage) || selectedBuilderQuestion.name}</p>
                      <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">
                        {selectedBuilderQuestion.name} - {builderQuestionTypeLabel[selectedBuilderQuestion.type]}
                      </p>
                    </div>
                  ) : null}

                  {selectedBuilderAuditIssues.length ? (
                    <div className="mt-3 space-y-2">
                      {selectedBuilderAuditIssues.map((issue) => (
                        <div
                          key={`${issue.level}-${issue.title}`}
                          className={`rounded-xl border px-3 py-2 ${
                            issue.level === 'error'
                              ? 'border-rose-200 bg-rose-50 text-rose-900'
                              : 'border-amber-200 bg-amber-50 text-amber-900'
                          }`}
                        >
                          <p className="text-[10px] font-black uppercase tracking-[0.12em]">
                            {issue.level === 'error' ? 'Erreur Kobo' : 'Alerte Kobo'}
                          </p>
                          <p className="mt-1 text-xs font-black">{issue.title}</p>
                          <p className="mt-1 text-[11px] font-semibold leading-snug text-slate-600">{issue.detail}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-1 rounded-xl bg-slate-100 p-1">
                    {[
                      ['options', 'Options des questions', 'Nom, libelle, type, choix et valeur par defaut'],
                      ['languages', 'Traductions', 'Libelles et aides par langue XLSForm'],
                      ['branching', 'Branchement conditionnel', 'Afficher uniquement selon une expression XLSForm'],
                      ['validation', 'Criteres de validation', 'Contraintes, message d erreur et calculs'],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setBuilderSettingsTab(id as BuilderSettingsTab)}
                        className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          builderSettingsTab === id ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:bg-white/50 hover:text-slate-900'
                        }`}
                      >
                        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                          builderSettingsTab === id ? 'bg-blue-600' : 'bg-slate-300'
                        }`} />
                        <span className="min-w-0">
                          <span className="block text-[11px] font-black uppercase tracking-[0.08em]">{label}</span>
                          <span className="mt-0.5 block text-[10px] font-semibold leading-snug text-slate-500">{label === 'Options des questions' ? 'Nom, type, choix, defaut.' : id === 'languages' ? 'Multilingue Kobo.' : id === 'branching' ? 'Conditions de passage.' : 'Contraintes et calculs.'}</span>
                        </span>
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
                              onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, {
                                label: event.target.value,
                                labels: {
                                  ...(selectedBuilderQuestion.labels || {}),
                                  [builderLanguage]: event.target.value,
                                },
                              })}
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
                                const needsChoices = (['select_one', 'select_multiple', 'select_one_from_file', 'select_multiple_from_file', 'rank'] as BuilderQuestionType[]).includes(nextType);
                                updateBuilderQuestion(selectedBuilderQuestion.id, {
                                  type: nextType,
                                  listName: needsChoices
                                    ? selectedBuilderQuestion.listName || paletteItem?.defaultListName || `${selectedBuilderQuestion.name}_choices`
                                    : undefined,
                                  choices: needsChoices
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
                              onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, {
                                hint: event.target.value,
                                hints: {
                                  ...(selectedBuilderQuestion.hints || {}),
                                  [builderLanguage]: event.target.value,
                                },
                              })}
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

                          {(['select_one', 'select_multiple', 'select_one_from_file', 'select_multiple_from_file', 'rank'] as BuilderQuestionType[]).includes(selectedBuilderQuestion.type) ? (
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
                                {selectedBuilderQuestion.type === 'select_one_from_file' || selectedBuilderQuestion.type === 'select_multiple_from_file' ? (
                                  <p className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-[10px] font-bold leading-relaxed text-cyan-900">
                                    Liste externe: indiquez le nom du fichier CSV dans la liste de choix. Les options seront resolues par le moteur XLSForm au runtime.
                                  </p>
                                ) : null}
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

                      {builderSettingsTab === 'languages' ? (
                        <div className="space-y-3">
                          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-[11px] font-semibold leading-relaxed text-cyan-900">
                            Ces traductions sont exportees en colonnes XLSForm <strong>label::Langue</strong> et <strong>hint::Langue</strong>. La langue active de saisie est {getBuilderLanguageMeta(builderLanguage).label}.
                          </div>
                          {projectDraft.languages.map((language) => {
                            const languageMeta = getBuilderLanguageMeta(language);
                            return (
                              <div key={language} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{languageMeta.label}</p>
                                  <button
                                    type="button"
                                    onClick={() => setProjectDraft((current) => ({ ...current, defaultLanguage: language }))}
                                    className={`rounded-full px-2 py-1 text-[9px] font-black ${
                                      projectDraft.defaultLanguage === language ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'
                                    }`}
                                  >
                                    {projectDraft.defaultLanguage === language ? 'Defaut' : 'Definir par defaut'}
                                  </button>
                                </div>
                                <label className="mt-2 block">
                                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Libelle</span>
                                  <input
                                    value={selectedBuilderQuestion.labels?.[language] || (language === 'fr' ? selectedBuilderQuestion.label : '')}
                                    onChange={(event) =>
                                      updateBuilderQuestion(selectedBuilderQuestion.id, {
                                        labels: {
                                          ...(selectedBuilderQuestion.labels || {}),
                                          [language]: event.target.value,
                                        },
                                        ...(language === projectDraft.defaultLanguage ? { label: event.target.value } : {}),
                                      })
                                    }
                                    className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-950 outline-none focus:border-blue-500"
                                  />
                                </label>
                                <label className="mt-2 block">
                                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">Instruction</span>
                                  <textarea
                                    value={selectedBuilderQuestion.hints?.[language] || (language === 'fr' ? selectedBuilderQuestion.hint || '' : '')}
                                    onChange={(event) =>
                                      updateBuilderQuestion(selectedBuilderQuestion.id, {
                                        hints: {
                                          ...(selectedBuilderQuestion.hints || {}),
                                          [language]: event.target.value,
                                        },
                                        ...(language === projectDraft.defaultLanguage ? { hint: event.target.value } : {}),
                                      })
                                    }
                                    rows={2}
                                    className="mt-1 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-950 outline-none focus:border-blue-500"
                                  />
                                </label>
                              </div>
                            );
                          })}
                        </div>
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
                          <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Filtre de choix</span>
                            <input
                              value={selectedBuilderQuestion.choiceFilter || ''}
                              onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, { choiceFilter: event.target.value })}
                              placeholder="region=${region_key}"
                              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Parametres XLSForm</span>
                            <input
                              value={selectedBuilderQuestion.parameters || ''}
                              onChange={(event) => updateBuilderQuestion(selectedBuilderQuestion.id, { parameters: event.target.value })}
                              placeholder="start=0 end=100 step=5 max-pixels=1280"
                              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500"
                            />
                          </label>
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">Raccourcis role</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {INTERNAL_GEM_CHOICES.roles.map((role) => (
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

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-xl shadow-slate-200/70">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">Mes Projets</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {importedForms.length} projet(s), {activeFormCount} deploye(s), {draftFormCount} brouillon(s), {inactiveFormCount} archive(s).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={loadFormDefinitions}
                  disabled={isLoadingForms}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isLoadingForms ? 'animate-spin' : ''} />
                  Actualiser
                </button>
                <button
                  type="button"
                  onClick={() => openWorkspaceSection('new')}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-white hover:bg-blue-700"
                >
                  <Plus size={14} />
                  Nouveau
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="w-12 border-b border-slate-200 px-4 py-3">
                      <input type="checkbox" disabled aria-label="Sélectionner tout" title="Sélectionner tout" className="h-5 w-5 rounded border-slate-300" />
                    </th>
                    {['Nom du projet', 'Statut', 'Date de la modification', 'Date du deploiement', 'Soumissions', 'Actions'].map((header) => (
                      <th key={header} className="border-b border-slate-200 px-4 py-3 text-xs font-black text-slate-600">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleForms.length === 0 && !isLoadingForms ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                        Aucun projet dans cette rubrique. Utilisez Nouveau pour creer ou importer un formulaire.
                      </td>
                    </tr>
                  ) : null}
                  {visibleForms.map((form) => {
                    const status = getProjectStatus(form);
                    const statusMeta = projectStatusMeta[status];
                    const diagnostics = form.diagnostics || {};
                    const submissionCount = Number((globalDiagnostics?.byFormKey || {})[form.formKey] || 0);
                    const latestImport = (form.latestImport || {}) as Record<string, unknown>;
                    const deployedAt = String(
                      latestImport.importedAt ||
                      form.lastValidated ||
                      form.importedAt ||
                      form.updatedAt ||
                      ''
                    );
                    const isSelectedForCollection = status === 'deployed' && selectedProjectFormKey === form.formKey;
                    return (
                      <tr key={form.formKey} className={`${isSelectedForCollection ? 'bg-blue-50' : 'bg-white'} hover:bg-slate-50`}>
                        <td className="border-b border-slate-200 px-4 py-4 align-middle">
                          <input
                            type="checkbox"
                            checked={isSelectedForCollection}
                            disabled={status !== 'deployed'}
                            onChange={() => {
                              if (status !== 'deployed') return;
                              setSelectedProjectFormKey(form.formKey);
                              setFilters((current) => ({ ...current, formKey: form.formKey, status: '', offset: 0 }));
                            }}
                             aria-label="Selectionner ce projet"
                             title="Selectionner ce projet"
                            className="h-5 w-5 rounded border-slate-300 accent-blue-600 disabled:cursor-not-allowed disabled:opacity-35"
                          />
                        </td>
                        <td className="min-w-0 sm:min-w-[320px] border-b border-slate-200 px-4 py-4 align-middle">
                          <button
                            type="button"
                            onClick={() => handleOpenFormPreview(form)}
                            className="block text-left text-sm font-black text-blue-800 hover:underline"
                          >
                            {form.title || form.formKey}
                          </button>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">
                            {form.formKey} - v{form.formVersion || 'non versionne'} - {Number(diagnostics.fieldCount || 0)} champ(s)
                          </p>
                        </td>
                        <td className="border-b border-slate-200 px-4 py-4 align-middle">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="border-b border-slate-200 px-4 py-4 align-middle text-slate-600">
                          {formatDateTime(form.updatedAt || form.importedAt || null)}
                        </td>
                        <td className="border-b border-slate-200 px-4 py-4 align-middle text-slate-600">
                          {status === 'deployed' ? formatDateTime(deployedAt || null) : '-'}
                        </td>
                        <td className="border-b border-slate-200 px-4 py-4 align-middle">
                          <span className="inline-flex min-w-10 justify-center rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
                            {submissionCount}
                          </span>
                        </td>
                        <td className="border-b border-slate-200 px-4 py-4 align-middle">
                          <div className="relative flex items-center gap-1">
                            <button
                              type="button"
                              title="Modifier dans le builder"
                              onClick={() => handleEditFormInBuilder(form)}
                              disabled={Boolean(formToolBusyKey)}
                              className="grid h-9 w-9 place-items-center rounded-lg text-blue-800 hover:bg-blue-50 disabled:opacity-50"
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              type="button"
                              title="Apercu du formulaire"
                              onClick={() => handleOpenFormPreview(form)}
                              disabled={Boolean(formToolBusyKey)}
                              className="grid h-9 w-9 place-items-center rounded-lg text-blue-800 hover:bg-blue-50 disabled:opacity-50"
                            >
                              <Eye size={19} />
                            </button>
                            {status === 'deployed' ? (
                              <button
                                type="button"
                                title="Utiliser dans l'enquete"
                                onClick={() => {
                                  setSelectedProjectFormKey(form.formKey);
                                  setFilters((current) => ({ ...current, formKey: form.formKey, status: '', offset: 0 }));
                                  setMainTab('data');
                                  setDataTab('table');
                                }}
                                className="grid h-9 w-9 place-items-center rounded-lg text-cyan-700 hover:bg-cyan-50"
                              >
                                <Table2 size={18} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                title="Deployer ce projet"
                                onClick={() => handleRedeployForm(form)}
                                disabled={formStatusUpdating === form.formKey}
                                className="grid h-9 w-9 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                              >
                                <FileUp size={18} />
                              </button>
                            )}
                            <button
                              type="button"
                              title="Plus d'outils"
                              onClick={() => setFormToolsMenuKey((current) => (current === form.formKey ? '' : form.formKey))}
                              className="grid h-9 w-9 place-items-center rounded-lg text-blue-800 hover:bg-blue-50"
                            >
                              <MoreHorizontal size={20} />
                            </button>
                            {formToolsMenuKey === form.formKey ? (
                              <div className="absolute right-0 top-10 z-30 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl shadow-slate-300/70">
                                {([
                                  ['Telecharger XLS', FileSpreadsheet, () => handleDownloadFormDefinition(form, 'xls')],
                                  ['Telecharger XML', FileJson, () => handleDownloadFormDefinition(form, 'xml')],
                                  ['Partager ce projet', Link, () => handleShareForm(form)],
                                  ['Cloner ce projet', Copy, () => handleCloneForm(form, 'clone')],
                                  ['Creer un modele', Type, () => handleCloneForm(form, 'template')],
                                  [status === 'deployed' ? 'Archiver ce projet' : 'Deployer ce projet', ShieldCheck, () => handleToggleFormStatus(form)],
                                ] as Array<[string, typeof FileSpreadsheet, () => void]>).map(([label, Icon, action]) => (
                                  <button
                                    key={label}
                                    type="button"
                                    onClick={action}
                                    disabled={Boolean(formToolBusyKey) || formStatusUpdating === form.formKey}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-blue-900 hover:bg-blue-50 disabled:opacity-50"
                                  >
                                    <Icon size={19} className="text-blue-700" />
                                    {label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          </>
          ) : null}

          {mainTab === 'summary' ? (
            selectedProjectFormKey && selectedProjectForm ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-6 lg:col-span-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Informations sur le projet</p>
                    <div className="mt-5">
                      <p className="text-xs font-semibold text-slate-400">Description</p>
                      <p className="mt-1 text-sm font-semibold text-white">{selectedProjectForm.title || selectedProjectForm.formKey}</p>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Statut</p>
                        <span className="mt-1 inline-block rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-black text-blue-300">Deploye</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Questions</p>
                        <p className="mt-1 text-sm font-bold text-white">{Number(selectedProjectForm.diagnostics?.fieldCount || 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Proprietaire</p>
                        <p className="mt-1 text-sm font-bold text-white">Equipe GEM</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Last edited</p>
                        <p className="mt-1 text-sm font-bold text-white">{formatDateTime(selectedProjectForm.updatedAt || null)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-6">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Liens rapides</p>
                    <div className="mt-4 flex flex-col gap-2">
                      <button onClick={() => { setMainTab('data'); setDataTab('table'); }} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 text-left transition hover:bg-white/10">
                        <span className="text-xs font-bold text-white">Collection de donnees</span>
                        <Table2 size={14} className="text-slate-400" />
                      </button>
                      <button onClick={() => setMainTab('settings')} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 text-left transition hover:bg-white/10">
                        <span className="text-xs font-bold text-white">Partager le projet</span>
                        <Share2 size={14} className="text-slate-400" />
                      </button>
                      <button onClick={() => handleEditFormInBuilder(selectedProjectForm)} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 text-left transition hover:bg-white/10">
                        <span className="text-xs font-bold text-white">Editer le formulaire</span>
                        <Pencil size={14} className="text-slate-400" />
                      </button>
                      <button onClick={() => handleOpenFormPreview(selectedProjectForm)} className="flex items-center justify-between rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-left transition hover:bg-blue-500/20">
                        <span className="text-xs font-bold text-blue-100">Apercu du formulaire</span>
                        <Eye size={14} className="text-blue-300" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-6">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Soumissions</p>
                  <div className="mt-6 flex items-center gap-4 border-b border-white/10 pb-4">
                    <span className="text-xs font-bold text-white">7 derniers jours</span>
                    <span className="text-xs font-semibold text-slate-500">31 derniers jours</span>
                    <span className="text-xs font-semibold text-slate-500">Trois derniers mois</span>
                    <span className="text-xs font-semibold text-slate-500">Douze derniers mois</span>
                  </div>
                  <div className="mt-8 flex h-40 items-end gap-2">
                    {[2, 5, 1, 8, 3, 12, 4].map((val, i) => (
                      <div key={i} className="group relative flex flex-1 flex-col justify-end">
                        <div className="w-full rounded-t-sm bg-blue-500/80 transition group-hover:bg-blue-400" style={{ height: `${(val / 12) * 100}%` }} />
                        <span className="mt-2 text-center text-[9px] font-semibold text-slate-500">J-{6-i}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
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

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-white">Migration Formulaire Natif</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-400">
                    Transformer la structure GEM Collect codée en dur en une définition dynamique éditable.
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/20 text-blue-300">
                  <Pencil size={24} />
                </div>
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => startProjectFromSource('internal_gem')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02]"
                >
                  <Pencil size={14} />
                  Editer le formulaire natif
                </button>
                <p className="mt-4 text-[11px] font-medium leading-relaxed text-slate-500">
                  Cette action chargera toutes les rubriques (Ménage, Maçon, Réseau, etc.) et les choix natifs dans le builder. Une fois sauvegardé, vous pourrez déployer des mises à jour dynamiques sans modifier le code source.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-white">Import Rapide Kobo</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-400">
                    Charger un fichier XLSForm existant pour le porter sur l'infrastructure GEM.
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-300">
                  <FileUp size={24} />
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => startProjectFromSource('import')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-emerald-700 shadow-lg shadow-emerald-900/20 transition-all hover:scale-[1.02]"
                >
                  <Upload size={14} />
                  Choisir un fichier
                </button>
                <button
                  type="button"
                  onClick={() => startProjectFromSource('url')}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-200 hover:bg-white/[0.08]"
                >
                  <Link size={14} />
                  Depuis URL
                </button>
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
            )
          ) : null}

          {mainTab === 'data' && dataTab !== 'table' ? (
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
                  <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                        {dataTabs.find((tab) => tab.id === dataTab)?.label}
                      </p>
                      <h3 className="mt-1 text-xl font-black text-slate-950">
                        {selectedProjectForm?.title || KOBO_SOURCE_SNAPSHOT.name}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {submissions.length} soumission(s) chargee(s), filtrees par le projet deploye selectionne.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTableFieldsPanel(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-50"
                      >
                        <Table2 size={14} />
                        Colonnes
                      </button>
                      <button
                        type="button"
                        onClick={loadSubmissions}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-50"
                      >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        Actualiser
                      </button>
                      <button
                        type="button"
                        onClick={() => exportFromServer('xlsx')}
                        disabled={submissions.length === 0}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-white hover:bg-blue-700 disabled:opacity-40"
                      >
                        <Download size={14} />
                        Export
                      </button>
                    </div>
                  </div>

                  {dataTab === 'reports' ? (
                    <div className="space-y-5 p-5">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        {([
                          ['Soumissions', submissions.length, ClipboardCheck],
                          ['Completes', submissions.filter((item) => item.status === 'submitted' || item.status === 'validated').length, CheckCircle2],
                          ['Brouillons', submissions.filter((item) => item.status === 'draft').length, FileJson],
                          ['Medias', galleryAttachments.length, Image],
                        ] as const).map(([label, value, Icon]) => (
                          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
                              <Icon size={17} className="text-blue-700" />
                            </div>
                            <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {autoReportBuckets.map((group: any) => (
                          <div key={group.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{group.title}</p>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">
                                {group.rows.length}
                              </span>
                            </div>
                            <div className="mt-4 space-y-3">
                              {group.rows.slice(0, 8).map((row: any) => {
                                const percent = submissions.length ? Math.round((row.value / submissions.length) * 100) : 0;
                                return (
                                  <div key={row.key}>
                                    <div className="flex items-center justify-between gap-3 text-sm">
                                      <span className="truncate font-black text-slate-900">{row.label}</span>
                                      <span className="font-black text-slate-500">{row.value}</span>
                                    </div>
                                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                      <div
                                        className="h-full rounded-full bg-cyan-500"
                                        style={{ '--progress': `${percent}%` } as React.CSSProperties}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                              {group.rows.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                                  Aucun indicateur disponible pour cette rubrique.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {dataTab === 'gallery' ? (
                    <div className="space-y-5 p-5">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        {[
                          ['Photos', galleryAttachments.length],
                          ['Pieces jointes', galleryAttachments.length],
                          ['Volume VPS', formatBytes(globalDiagnostics?.mediaStats?.totalStoredBytes)],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
                            <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setGalleryFieldFilter('')}
                            className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] transition ${
                              !galleryFieldFilter ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Toutes
                          </button>
                          {galleryFieldNames.map(name => (
                            <button
                              key={name}
                              onClick={() => setGalleryFieldFilter(name)}
                              className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] transition ${
                                galleryFieldFilter === name ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {formatKoboSourceColumnLabel(name)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {filteredGalleryAttachments.map(({ attachment, submission, key }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedGalleryImage({
                              url: attachment.url || attachment.dataUrl || '',
                              title: attachment.fileName || attachment.fieldName,
                              submission
                            })}
                            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
                          >
                            {String(attachment.mimeType || '').startsWith('image/') && (attachment.url || attachment.dataUrl) ? (
                              <img src={attachment.url || attachment.dataUrl} alt={attachment.fileName || attachment.fieldName} className="h-44 w-full object-cover transition duration-500 group-hover:scale-110" />
                            ) : (
                              <div className="grid h-44 place-items-center bg-slate-100 text-slate-400">
                                <FileSpreadsheet size={34} />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                            <div className="p-3">
                              <p className="truncate text-sm font-black text-slate-950">{attachment.fileName || attachment.fieldName}</p>
                              <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                                {submission.household?.name || `Menage ${submission.numeroOrdre || '-'}`}
                              </p>
                              <div className="mt-2 flex items-center justify-between">
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-500">
                                  {formatBytes(attachment.storedBytes || attachment.originalBytes)}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.05em] ${
                                  submission.status === 'validated' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {submission.status}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                        {filteredGalleryAttachments.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm font-semibold text-slate-500">
                            Aucun media dans la selection actuelle.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {dataTab === 'downloads' ? (
                    <div className="space-y-5 p-5">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {([
                          ['CSV', 'Tableur leger pour controle rapide', 'csv', FileSpreadsheet],
                          ['JSON', 'Archive complete avec valeurs et metadonnees', 'json', FileJson],
                          ['XLSX', 'Export audit conforme reporting', 'xlsx', FileSpreadsheet],
                          ['ZIP Medias', 'Toutes les photos et pieces jointes packagees', 'zip', Image],
                        ] as const).map(([label, description, format, Icon]) => (
                          <button
                            key={format}
                            type="button"
                            onClick={() => format === 'zip' ? exportMediaZip() : exportFromServer(format as any)}
                            disabled={submissions.length === 0 || isExporting !== ''}
                            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <Icon size={24} className={isExporting === format ? 'animate-pulse text-blue-700' : 'text-blue-700'} />
                              <Download size={16} className="text-slate-400" />
                            </div>
                            <p className="mt-4 text-xl font-black text-slate-950">{label}</p>
                            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">{description}</p>
                            <p className="mt-4 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">
                              {submissions.length} ligne(s)
                            </p>
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Parametres avances d'exportation (Optionnel)</p>
                          <div className="mt-3 grid grid-cols-1 gap-2">
                            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                              <input type="checkbox" id="export-groups" defaultChecked className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
                              <label htmlFor="export-groups" className="text-xs font-semibold text-slate-700">Inclure les groupes dans les en-tetes</label>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                              <input type="checkbox" id="export-media-urls" defaultChecked className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
                              <label htmlFor="export-media-urls" className="text-xs font-semibold text-slate-700">Inclure les URL des medias (photos, audios)</label>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                              <select className="flex-1 bg-transparent text-xs font-semibold text-slate-700 outline-none">
                                <option>Format de valeur et d'en-tete : Valeurs et étiquettes XML</option>
                                <option>Format de valeur et d'en-tete : Étiquettes uniquement</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Paquet export actuel</p>
                          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {[
                              ['Projet', selectedProjectForm?.title || 'Tous projets deployes'],
                              ['Derniere fiche', formatDateTime(globalDiagnostics?.latestSavedAt || selectedSubmission?.savedAt || null)],
                              ['Medias', String(galleryAttachments.length)],
                              ['Version', selectedProjectForm?.formVersion || globalDiagnostics?.serverFormVersion || '-'],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
                                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
                                <p className="mt-1 truncate text-sm font-black text-slate-900">{value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {dataTab === 'map' ? (
                    <div className="space-y-5 p-5">
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
                        <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                          <div className="absolute inset-0 opacity-80 [background-image:linear-gradient(#cbd5e1_1px,transparent_1px),linear-gradient(90deg,#cbd5e1_1px,transparent_1px)] [background-size:42px_42px]" />
                          <div className="absolute left-5 top-5 rounded-2xl border border-white bg-white/90 px-4 py-3 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Carte des soumissions</p>
                            <p className="mt-1 text-sm font-black text-slate-950">{mappedSubmissions.length} point(s) GPS</p>
                          </div>
                          {mappedSubmissions.map(({ submission, coordinates }) => {
                            const left = mapBounds ? ((coordinates.lon - mapBounds.minLon) / mapBounds.lonSpan) * 82 + 9 : 50;
                            const top = mapBounds ? (1 - (coordinates.lat - mapBounds.minLat) / mapBounds.latSpan) * 76 + 12 : 50;
                            return (
                              <button
                                key={submission.id}
                                type="button"
                                onClick={() => setSelectedId(submission.id)}
                                title={submission.household?.name || `Menage ${submission.numeroOrdre || '-'}`}
                                className={`absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 shadow-lg transition ${
                                  selectedSubmission?.id === submission.id
                                    ? 'border-blue-700 bg-blue-600 text-white'
                                    : 'border-white bg-cyan-500 text-white hover:bg-blue-600'
                                }`}
                                style={{ '--left': `${left}%`, '--top': `${top}%` } as React.CSSProperties}
                              >
                                <MapPin size={16} />
                              </button>
                            );
                          })}
                          {mappedSubmissions.length === 0 ? (
                            <div className="absolute inset-0 grid place-items-center">
                              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                                <MapPin size={28} className="mx-auto text-slate-400" />
                                <p className="mt-3 text-sm font-black text-slate-700">Aucune coordonnee GPS exploitable</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">Les champs latitude/longitude ou geopoint seront affiches ici.</p>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-3">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Couverture</p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {[
                                ['Avec GPS', mappedSubmissions.length],
                                ['Sans GPS', Math.max(0, submissions.length - mappedSubmissions.length)],
                              ].map(([label, value]) => (
                                <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">{label}</p>
                                  <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                            {mappedSubmissions.slice(0, 30).map(({ submission, coordinates }) => (
                              <button
                                key={submission.id}
                                type="button"
                                onClick={() => setSelectedId(submission.id)}
                                className={`w-full rounded-2xl border p-3 text-left transition ${
                                  selectedSubmission?.id === submission.id
                                    ? 'border-blue-300 bg-blue-50'
                                    : 'border-slate-200 bg-white hover:border-blue-200'
                                }`}
                              >
                                <p className="truncate text-sm font-black text-slate-950">{submission.household?.name || `Menage ${submission.numeroOrdre || '-'}`}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  {coordinates.lat.toFixed(6)}, {coordinates.lon.toFixed(6)}
                                </p>
                                <a
                                  href={`https://www.google.com/maps?q=${coordinates.lat},${coordinates.lon}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-blue-800 hover:bg-blue-100"
                                >
                                  Ouvrir carte
                                </a>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
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
                    ['Version serveur', globalDiagnostics?.serverFormVersion || INTERNAL_GEM_FORM_SETTINGS.version],
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
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Fichiers de support (Media / Pulldata)</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Gerez les fichiers CSV, XML ou medias utilises par les fonctions pulldata() ou select_one_from_file().
                    </p>
                  </div>
                  <button type="button" className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-blue-100 transition hover:bg-blue-500/20">
                    <Upload size={14} />
                    Ajouter un fichier
                  </button>
                </div>
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-semibold text-slate-500">
                  <FileSpreadsheet size={32} className="mx-auto mb-3 text-slate-600" />
                  Aucun fichier de support externe n'est actuellement charge sur le serveur pour ce formulaire.
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4 lg:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Partage du projet (Permissions)</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Gerez les acces specifiques a ce projet (Ajouter des soumissions, Editer, Valider).
                    </p>
                  </div>
                  <button type="button" className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-blue-100 transition hover:bg-blue-500/20">
                    <Share2 size={14} />
                    Ajouter un utilisateur
                  </button>
                </div>
                <div className="mt-5 rounded-2xl border border-white/10 p-4">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="text-sm font-bold text-white">Equipe GEM (Proprietaire)</p>
                       <p className="text-[10px] font-semibold text-slate-500">Tous les droits</p>
                     </div>
                   </div>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4 lg:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-100">Services REST (Webhooks)</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Envoyez automatiquement les donnees vers des serveurs externes lors de chaque soumission.
                    </p>
                  </div>
                  <button type="button" className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-blue-100 transition hover:bg-blue-500/20">
                    <Link size={14} />
                    Ajouter un service
                  </button>
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
                    Version serveur: {globalDiagnostics?.serverFormVersion || INTERNAL_GEM_FORM_SETTINGS.version}
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
                          Numero {submission.numeroOrdre || submission.household?.numeroordre || '-'} - {formatInternalGemValue(submission.role || '', 'roles') || 'Role non renseigne'}
                        </p>
                        <p className="mt-1 truncate text-[10px] font-semibold text-slate-600">
                          {submission.clientSubmissionId}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 md:justify-end">
                        <span className="text-[11px] font-black text-slate-300">{formatDateTime(submission.savedAt)}</span>
                        <button
                          type="button"
                          title="Supprimer cette soumission"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Voulez-vous vraiment supprimer cette soumission ? (Simulation, action bloquee pour integrite DB)")) {
                              handleDeleteSubmission(submission.id);
                            }
                          }}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 transition hover:bg-rose-500/20"
                        >
                          <Trash2 size={13} />
                        </button>
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
                          {formatInternalGemValue(selectedSubmission.role || '', 'roles')} - {formatDateTime(selectedSubmission.savedAt)}
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

      {previewForm ? (
        <div className="fixed inset-0 z-50 bg-slate-950/65 p-2 backdrop-blur-sm sm:p-5">
          <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-2xl shadow-slate-950/40">
            <div className="flex items-center justify-between bg-[#2494e8] px-5 py-4 text-white">
              <h2 className="text-lg font-semibold">Apercu du formulaire</h2>
              <button
                type="button"
                onClick={() => {
                  setPreviewForm(null);
                  setPreviewDefinition(null);
                }}
                className="grid h-10 w-10 place-items-center rounded-full text-white hover:bg-white/15"
                aria-label="Fermer l'apercu"
              >
                <X size={28} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
              <div className="mx-auto max-w-4xl">
                <div className="mb-8 flex items-center justify-between gap-4 px-1">
                  <div className="inline-flex items-center gap-2 text-xl font-semibold text-slate-500">
                    <span className="grid h-5 w-5 place-items-center rounded-md border-2 border-[#2494e8] text-[10px] font-black text-[#2494e8]">K</span>
                    <span>Kobo<span className="text-[#2494e8]">Toolbox</span></span>
                  </div>
                  <div className="flex items-center gap-6 text-slate-950">
                    <button type="button" onClick={() => window.print()} title="Imprimer" className="hover:text-blue-700">
                      <Printer size={32} />
                    </button>
                    <button type="button" title="Menu de l'apercu" className="hover:text-blue-700">
                      <Menu size={36} />
                    </button>
                  </div>
                </div>

                <div className="min-h-[430px] bg-white px-6 py-10 shadow-sm sm:px-12">
                  {isPreviewLoading ? (
                    <div className="grid min-h-[300px] place-items-center text-center">
                      <div>
                        <RefreshCw className="mx-auto animate-spin text-blue-600" size={34} />
                        <p className="mt-4 text-sm font-bold text-slate-600">Chargement de la definition XLSForm...</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-center text-3xl font-black text-[#3f78ad]">
                        {getDefinitionTitle(previewForm, previewDefinition)}
                      </h1>
                      <div className="mt-8 space-y-6">
                        {previewFields.length ? previewFields.map((field, index) => {
                          const type = getRowTypeBase(field);
                          const listName = getDefinitionListName(field);
                          const choices = listName ? getDefinitionChoicesForList(previewDefinition, listName).slice(0, 8) : [];
                          const required = field.required === true || asString(field.required).toLowerCase() === 'yes';
                          const label = getDefinitionLabel(field);
                          return (
                            <div key={`${asString(field.name)}-${index}`} className="max-w-xl">
                              <label className="block text-lg font-black text-slate-900">
                                {required ? <span className="mr-1 text-[#2f6fa7]">*</span> : null}
                                {label}
                              </label>
                              {asString(field.hint) ? (
                                <p className="mt-1 text-sm italic text-slate-500">{asString(field.hint)}</p>
                              ) : null}

                              {type === 'select_one' || type === 'select_multiple' ? (
                                <div className="mt-3 space-y-2">
                                  {choices.length ? choices.map((choice) => (
                                    <label key={`${asString(field.name)}-${asString(choice.name)}`} className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                                      <span className={`h-4 w-4 border border-slate-400 ${type === 'select_one' ? 'rounded-full' : 'rounded-sm'}`} />
                                      {getDefinitionLabel(choice)}
                                    </label>
                                  )) : (
                                    <select title="Selectionner une valeur" aria-label="Selectionner une valeur" className="mt-3 h-11 w-full rounded border border-slate-300 px-3 text-slate-600">
                                      <option>Selectionner...</option>
                                    </select>
                                  )}
                                </div>
                              ) : ['image', 'signature', 'file', 'audio', 'video'].includes(type) ? (
                                <button type="button" className="mt-3 inline-flex items-center gap-2 rounded border border-dashed border-slate-300 px-4 py-3 text-sm font-bold text-slate-600">
                                  <Upload size={16} />
                                  Ajouter un media
                                </button>
                              ) : type === 'note' ? (
                                <p className="mt-3 rounded bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">{label}</p>
                              ) : (
                                <input aria-label="Saisir une valeur" title="Saisir une valeur" className="mt-3 h-11 w-full rounded border border-slate-300 px-3 text-slate-900 outline-none focus:border-[#2494e8]" />
                              )}
                            </div>
                          );
                        }) : (
                          <div className="rounded border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500">
                            Aucun champ visible dans cette definition.
                          </div>
                        )}
                      </div>
                      <div className="mt-10 flex justify-center">
                        <button type="button" className="inline-flex items-center gap-2 rounded bg-[#3f7fb4] px-14 py-4 text-lg font-semibold text-white shadow-sm hover:bg-[#336fa1]">
                          <ArrowRight size={22} />
                          Suivant
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-3 bg-blue-100 text-[#5d8db7]">
                  <button type="button" className="inline-flex items-center gap-3 px-4 py-4 text-left text-base font-semibold hover:bg-blue-200/70">
                    <CornerUpLeft size={24} className="text-slate-700" />
                    Retourner au debut
                  </button>
                  <div />
                  <button type="button" className="inline-flex items-center justify-end gap-3 px-4 py-4 text-right text-base font-semibold hover:bg-blue-200/70">
                    Aller a la fin
                    <ArrowRight size={26} className="text-slate-700" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>

      {selectedGalleryImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-md">
          <button
            onClick={() => setSelectedGalleryImage(null)}
            className="absolute right-6 top-6 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
          >
            <X size={28} />
          </button>
          <div className="max-w-5xl w-full">
            <img 
              src={selectedGalleryImage.url} 
              alt={selectedGalleryImage.title} 
              className="max-h-[80vh] w-full object-contain rounded-2xl shadow-2xl" 
            />
            <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4 text-white">
              <div>
                <h2 className="text-2xl font-black">{selectedGalleryImage.title}</h2>
                <p className="mt-1 text-slate-400 font-bold">
                  {selectedGalleryImage.submission?.household?.name || `Menage ${selectedGalleryImage.submission?.numeroOrdre || '-'}`}
                </p>
              </div>
              <div className="flex gap-3">
                <a
                  href={selectedGalleryImage.url}
                  download={selectedGalleryImage.title}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-blue-700"
                >
                  <Download size={18} />
                  Telecharger
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTableFieldsPanel && (
        <div className="fixed inset-y-0 right-0 z-50 w-80 border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Colonnes du tableau</h3>
              <button onClick={() => setShowTableFieldsPanel(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 mb-4">Visibilite des champs</p>
              {koboTableColumns.map(column => {
                const isHidden = hiddenTableColumns.includes(column.id);
                return (
                  <label key={column.id} className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition">
                    <span className="text-xs font-bold text-slate-700">{column.label}</span>
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => {
                        if (isHidden) {
                          setHiddenTableColumns(prev => prev.filter(id => id !== column.id));
                        } else {
                          setHiddenTableColumns(prev => [...prev, column.id]);
                        }
                      }}
                      className="h-5 w-5 accent-blue-600 rounded"
                    />
                  </label>
                );
              })}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button 
                onClick={() => setHiddenTableColumns([])}
                className="w-full rounded-xl bg-white border border-slate-200 py-3 text-[11px] font-black uppercase tracking-widest text-slate-900 hover:bg-slate-100"
              >
                Reinitialiser tout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

