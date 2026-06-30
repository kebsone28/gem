/**
 * Constantes du Form Builder Ged OS Toolbox
 * Extraites de ToolboxSubmissions.tsx pour modularité
 */
import {
  Activity,
  Archive,
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
  Database,
  Download,
  EyeOff,
  File,
  FileAudio,
  FileJson,
  FileSpreadsheet,
  FileText,
  Hash,
  Image,
  Layers,
  Map,
  MapPin,
  PenLine,
  Settings,
  Table2,
  Type,
  Video,
} from 'lucide-react';
import type {
  BuilderLanguage,
  BuilderQuestion,
  BuilderQuestionType,
  BuilderFieldPaletteItem,
  QuestionLibraryBlock,
} from './types';
import type { LucideIcon } from 'lucide-react';

export const mainTabs: Array<{
  id: 'summary' | 'form' | 'data' | 'settings';
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'summary', label: 'Sommaire', icon: ClipboardCheck },
  { id: 'form', label: 'Formulaire', icon: FileText },
  { id: 'data', label: 'Donnees', icon: Table2 },
  { id: 'settings', label: 'Parametres', icon: Settings },
];

export const dataTabs: Array<{
  id: 'table' | 'reports' | 'gallery' | 'downloads' | 'map';
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'table', label: 'Tableau', icon: Table2 },
  { id: 'reports', label: 'Rapports', icon: BarChart3 },
  { id: 'gallery', label: 'Galerie photo', icon: Image },
  { id: 'downloads', label: 'Telechargements', icon: Download },
  { id: 'map', label: 'Carte', icon: Map },
];

export interface KoboTableColumn {
  id: string;
  label: string;
  kind: 'date' | 'number' | 'text' | 'select' | 'image' | 'boolean';
  listName?: string;
}

export const koboTableColumns: KoboTableColumn[] = [
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

export const projectSectors = [
  'Energie',
  'Eau et assainissement',
  'Sante',
  'Education',
  'Infrastructure',
  'Autre',
];

export const projectCountries = ['Senegal', 'Gambie', 'Mali', 'Guinee', 'Autre'];

export const savedDataFiltersStorageKey = 'gem-toolbox-saved-data-filters:v1';
export const STORAGE_KEY_FILTERS = 'gem-toolbox-filters-v2';

export const builderLanguages: Array<{ id: BuilderLanguage; label: string; xlsLabel: string }> = [
  { id: 'fr', label: 'Francais', xlsLabel: 'Francais (fr)' },
  { id: 'en', label: 'English', xlsLabel: 'English (en)' },
  { id: 'wo', label: 'Wolof', xlsLabel: 'Wolof (wo)' },
];

export const builderFieldPalette: BuilderFieldPaletteItem[] = [
  {
    type: 'begin_group',
    label: 'Groupe',
    description: 'Section ou page',
    icon: Layers,
    appearance: 'field-list',
  },
  {
    type: 'begin_repeat',
    label: 'Repeat',
    description: 'Lignes repetables',
    icon: Layers,
    appearance: 'field-list',
  },
  { type: 'text', label: 'Texte', description: 'Saisie libre ou observation', icon: Type },
  { type: 'integer', label: 'Nombre entier', description: 'Compteur, quantite, ordre', icon: Hash },
  { type: 'decimal', label: 'Decimal', description: 'Mesure ou montant', icon: Calculator },
  {
    type: 'range',
    label: 'Curseur',
    description: 'Intervalle numerique',
    icon: Calculator,
    appearance: 'horizontal',
  },
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
  { type: 'nfc', label: 'NFC', description: 'Lecture badge ou etiquette', icon: Hash },
  { type: 'calculate', label: 'Calcul', description: 'Valeur auto XLSForm', icon: Calculator },
  { type: 'hidden', label: 'Cache', description: 'Champ non affiche', icon: EyeOff },
  { type: 'xml_external', label: 'XML externe', description: 'Source XML jointe', icon: FileJson },
  {
    type: 'acknowledge',
    label: 'Confirmation',
    description: 'Case de validation',
    icon: CheckSquare,
  },
];

export const builderQuestionLibrary: QuestionLibraryBlock[] = [
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

export const builderQuestionTypeLabel: Record<BuilderQuestionType, string> = {
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
  nfc: 'nfc',
  calculate: 'calc',
  hidden: 'hide',
  xml_external: 'xml',
  acknowledge: 'ok',
};

export const builderChoiceTypes = new Set<BuilderQuestionType>([
  'select_one',
  'select_multiple',
  'select_one_from_file',
  'select_multiple_from_file',
  'rank',
]);

export const builderInlineChoiceTypes = new Set<BuilderQuestionType>([
  'select_one',
  'select_multiple',
  'rank',
]);

export type WorkspaceSection = 'new' | 'deployed' | 'drafts' | 'archives';
export type BuilderMode = 'blank' | 'template' | 'import' | 'url' | 'internal_gem';
export type NewProjectStep = 'source' | 'details' | null;
