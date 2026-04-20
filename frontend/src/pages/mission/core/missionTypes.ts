/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
export interface MissionMember {
  name: string;
  role: string;
  unit: string;
  dailyIndemnity: number;
  days: number;
}

export interface MissionPhoto {
  id: string;
  data: string; // Base64
  comment: string;
  timestamp: string;
}

export interface MissionReportDay {
  day: number;
  title: string;
  detail?: string; // Détail de l'étape du planning
  observation: string;
  notes: string;
  isCompleted: boolean;
  photos: MissionPhoto[]; // Plusieurs photos par étape
  location?: { lat: number; lng: number };
}

export interface BrandingConfig {
  logo?: string; // Base64
  primaryColor?: [number, number, number];
  secondaryColor?: [number, number, number];
  organizationName?: string;
  footerText?: string;
}

export interface MissionOrderData {
  orderNumber: string;
  date: string;
  region: string;
  startDate: string;
  endDate: string;
  itineraryAller: string;
  itineraryRetour: string;
  purpose: string;
  transport: string;
  members: MissionMember[];
  planning: string[]; // 6-day itinerary
  reportDays?: MissionReportDay[];
  reportObservations?: string;
  isCertified?: boolean;
  isSubmitted?: boolean;
  signatureImage?: string; // Base64 string
  features?: {
    map: boolean;
    expenses: boolean;
    inventory: boolean;
    ai: boolean;
  };
  expenses?: Record<string, unknown>[];
  fuelStats?: {
    kmStart: number;
    kmEnd: number;
    rate: number;
  };
  inventory?: Record<string, unknown>[];
  branding?: BrandingConfig;
  createdBy?: string;
  creatorId?: string;
  integrityHash?: string;
  version?: number; // ✅ AJOUT
  data?: Record<string, unknown>; // ✅ AJOUT pour compatibilité sync
  id?: string; // ✅ AJOUT pour compatibilité word generator
}

export type MissionStatus = 'idle' | 'saving' | 'error' | 'success';

export interface AuditEntry {
  id: string;
  action: string;
  author: string;
  timestamp: string;
  details?: string;
  diff?: Record<string, unknown>;
}

export interface MissionState {
  // Data
  formData: Partial<MissionOrderData>;
  members: MissionMember[];
  currentMissionId: string | null;

  // Metadata & Sync (Industrialized Phase 2)
  version: number;
  updatedAt: string | null;
  lastSyncedAt: string | null;
  status: MissionStatus;
  isSyncing: boolean;
  isSyncingServer: boolean;
  syncStatus: 'synced' | 'pending' | 'failed';
  offlineQueue: Record<string, unknown>[];

  // Granular Dirty Tracking
  dirty: {
    form: boolean;
    members: boolean;
    planning: boolean;
  };

  // Audit & Workflow
  auditTrail: AuditEntry[];
  activeTab: 'prep' | 'report' | 'approval';
  isSimplifiedMode: boolean;
  isCertified: boolean;
  isSubmitted: boolean;
  lastSavedAt: string | null;
}

export type MissionAction =
  | { type: 'SET_FORM_DATA'; payload: Partial<MissionOrderData> }
  | { type: 'UPDATE_FORM_FIELD'; payload: { field: keyof MissionOrderData; value: unknown } }
  | { type: 'ADD_MEMBER'; payload: MissionMember }
  | { type: 'UPDATE_MEMBER'; index: number; payload: Partial<MissionMember> }
  | { type: 'REMOVE_MEMBER'; index: number }
  | { type: 'SET_STATUS'; payload: MissionStatus }
  | { type: 'FORCE_PUSH'; payload: Record<string, unknown> } // ✅ FIX: added payload
  | { type: 'RETRY_SYNC'; payload: Record<string, unknown> } // ✅ FIX: added payload
  | { type: 'OFFLINE_SAVE'; payload: Record<string, unknown> } // ✅ FIX: added payload
  | {
      type: 'LOAD_MISSION';
      payload: {
        id: string | null;
        data: Partial<MissionOrderData>;
        members: MissionMember[];
        version?: number;
        updatedAt?: string;
        auditTrail?: AuditEntry[];
      };
    }
  | {
      type: 'RESET_MISSION';
      payload: {
        orderNumber: string;
        date: string;
        planning: string[];
        createdBy?: string;
        creatorId?: string;
      };
    }
  | { type: 'SET_ACTIVE_TAB'; payload: 'prep' | 'report' | 'approval' }
  | { type: 'SET_SIMPLIFIED_MODE'; payload: boolean }
  | { type: 'SET_CERTIFIED'; payload: boolean }
  | { type: 'SET_SUBMITTED'; payload: boolean }
  | { type: 'CLEAR_DIRTY'; payload?: keyof MissionState['dirty'] }
  | { type: 'SET_SYNC_STATUS'; payload: MissionState['syncStatus'] }
  | {
      type: 'ADD_AUDIT_ENTRY';
      payload: { action: string; author: string; details?: string; diff?: Record<string, unknown> };
    };
