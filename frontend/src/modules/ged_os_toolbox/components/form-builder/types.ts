/**
 * Types partagés pour le Form Builder Ged OS Toolbox
 * Extraits de ToolboxSubmissions.tsx pour modularité
 */

export type BuilderQuestionType =
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
  | 'nfc'
  | 'calculate'
  | 'hidden'
  | 'xml_external'
  | 'acknowledge';

export type BuilderDropPosition = 'before' | 'after';
export type BuilderSettingsTab = 'options' | 'languages' | 'branching' | 'validation';
export type BuilderLanguage = 'fr' | 'en' | 'wo';

export interface BuilderQuestion {
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
}

export interface ProjectDraft {
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
}

export interface BuilderAuditIssue {
  level: 'error' | 'warning';
  title: string;
  detail: string;
  questionId?: string;
}

export interface BuilderFieldPaletteItem {
  type: BuilderQuestionType;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  defaultListName?: string;
  defaultChoices?: Array<{ name: string; label: string }>;
  appearance?: string;
}

export interface QuestionLibraryBlock {
  key: string;
  title: string;
  description: string;
  questions: BuilderQuestion[];
}

export interface BuilderClipboardData {
  questions: BuilderQuestion[];
  timestamp: number;
}

export interface ProjectDraftState {
  projectDraft: ProjectDraft;
  builderQuestions: BuilderQuestion[];
  builderHistory: BuilderQuestion[][];
  builderFuture: BuilderQuestion[][];
  builderClipboard: BuilderClipboardData | null;
  selectedBuilderQuestionId: string | null;
  builderDropTarget: string | null;
  builderDraggingLabel: string;
  builderLanguage: BuilderLanguage;
  builderAuditIssues: BuilderAuditIssue[];
  builderAuditScore: number;
  builderAuditErrors: BuilderAuditIssue[];
  builderAuditWarnings: BuilderAuditIssue[];
  isSavingBuilder: boolean;
  builderAuditErrorsCount: number;
  builderAuditWarningsCount: number;
  questionLibraryQuery: string;
  questionLibraryOpen: boolean;
}
