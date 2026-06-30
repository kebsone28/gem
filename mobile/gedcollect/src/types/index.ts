export interface GedFormQuestion {
  type: string;
  name: string;
  label: string;
  required?: string;
  hint?: string;
  relevant?: string;
  constraint?: string;
  constraint_message?: string;
  calculation?: string;
  default?: string;
  readonly?: string;
  appearance?: string;
  choice_filter?: string;
  parameters?: string;
}

export interface GedFormChoice {
  list_name: string;
  name: string;
  label: string;
}

export interface GedFormDefinition {
  formKey: string;
  version: string;
  title: string;
  description: string;
  survey: GedFormQuestion[];
  choices: GedFormChoice[];
  updatedAt: string;
}

export interface GedSubmission {
  id: string;
  formKey: string;
  formVersion: string;
  clientSubmissionId: string;
  values: Record<string, unknown>;
  photos?: Record<string, string>;
  metadata?: {
    deviceId: string;
    startTime: string;
    endTime: string;
    submittedAt?: string;
  };
  status: 'draft' | 'pending' | 'syncing' | 'synced' | 'error';
  createdAt?: string;
  updatedAt?: string;
  errorMessage?: string;
  retryCount?: number;
}

export interface GedSettings {
  serverUrl: string;
  autoSync: boolean;
  syncIntervalMinutes: number;
  wifiOnly: boolean;
  language: 'fr' | 'en';
  theme: 'light' | 'dark' | 'system';
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface FormListItem {
  formKey: string;
  title: string;
  version: string;
  description?: string;
  updatedAt: string;
  submissionCount: number;
  pendingCount: number;
}

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  organizationId: string;
  organization: string;
}

export interface DraftInfo {
  id: string;
  values?: Record<string, string>;
  photos?: Record<string, string>;
}

export type RootStackParamList = {
  Login: undefined;
  FormList: undefined;
  Form: { formKey: string; formTitle: string; survey: any[]; choices: any[]; draft?: DraftInfo; viewOnly?: boolean; serverVersion?: string };
  Drafts: undefined;
  Dashboard: undefined;
  QRScanner: { onScan?: (value: string) => void };
  Settings: undefined;
  Submissions: { formKey?: string };
};

export interface DraftSummary {
  id: string;
  formKey: string;
  formTitle: string;
  formVersion: string;
  totalFields: number;
  filledFields: number;
  photoCount: number;
  hasGps: boolean;
  savedAt: string;
  qualityScore: number;
}

export interface DashboardStats {
  todayCount: number;
  weekCount: number;
  totalCount: number;
  pendingCount: number;
  syncedCount: number;
  draftCount: number;
  averageQuality: number;
  lastSyncAt: string | null;
  formsThisWeek: { day: string; count: number }[];
  byForm: { formKey: string; formTitle: string; count: number }[];
}
