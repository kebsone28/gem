/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
export type UserRole =
  | 'ADMIN'
  | 'ADMIN_PROQUELEC'
  | 'DG_PROQUELEC'
  | 'CLIENT_LSE'
  | 'CHEF_EQUIPE'
  | 'CHEF_PROJET'
  | 'COMPTABLE'
  | 'DIRECTEUR';

export interface User {
  id: string;
  email: string; // Acts as username/login
  notificationEmail?: string; // For system alerts (separate from login)
  name: string;
  role: UserRole;
  password?: string;
  organization?: string;
  organizationConfig?: Record<string, unknown>;
  teamId?: string; // If CHEF_EQUIPE
  active?: boolean;
  createdAt?: string;
  requires2FA?: boolean;
  permissions?: string[];
  deniedPermissions?: string[];
  securityQuestion?: string;
  securityAnswerHash?: string;
  // 🎭 Impersonation (God Mode Simulation)
  impersonatedBy?: string; // ID of the admin who is simulating
  originalRole?: UserRole; // Original role to return to
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  details: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface Household {
  id: string; // Local Dexie ID
  backendId?: string; // Real backend ID
  syncStatus?: 'pending' | 'synced' | 'error';
  projectId: string;
  zoneId: string;
  organizationId: string;
  updatedAt?: string;
  grappeId?: string;
  grappeName?: string;
  deliveryStatus?: string;
  delivery?: {
    agent?: string;
    date?: string;
  };
  assignedTeams?: string[];
  workTime?: {
    durationMinutes?: number;
  };

  name?: string;
  phone?: string;
  region?: string;
  departement?: string;
  village?: string;

  latitude?: number;
  longitude?: number;

  status: string;
  owner?: string;
  photo?: string;
  ownerPhone?: string; // Garder pour compatibilité

  location: {
    type: 'Point';
    coordinates: [number, number];
  };

  koboData?: Record<string, unknown>;
  numeroordre?: string;
  constructionData?: Record<string, unknown>;
  alerts?: Record<string, unknown>[];
  koboSync?: {
    preparateurKits?: number;
    livreurDate?: string;
    câbleInt25?: number;
    câbleInt15?: number;
    tranchee4?: number;
    tranchee15?: number;
    maconOk?: boolean;
    reseauOk?: boolean;
    interieurOk?: boolean;
    controleOk?: boolean;
    village?: string;
    departement?: string;
    region?: string;
    tel?: string;
  };
  koboSubmissionId?: string;
  version: number;
  lastModified?: number; // Timestamp local de la dernière modif
  createdAt?: string; // ✅ AJOUT
  manualOverrides?: string[]; // ✅ AJOUT: Liste des champs forcés manuellement
  source?: 'local' | 'kobo' | 'import';
  deletedAt?: Date | null;
}

export type TeamRole = 'PREPARATION' | 'INSTALLATION' | 'SUPERVISION' | 'LOGISTICS';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'CONFLICT';

export interface Team {
  id: string;
  name: string;
  projectId: string;
  organizationId: string;

  // Hierarchy
  parentTeamId?: string;
  children?: Team[];
  path?: string;
  level: number;

  // Business
  role: TeamRole;
  tradeKey?: string;
  capacity: number;

  // Logistics
  regionId?: string;
  region?: { id: string; name: string };
  grappeId?: string;
  grappe?: { id: string; name: string };
  zoneId?: string;
  warehouseId?: string;

  // Personnel
  leaderId?: string;
  leader?: { id: string; name: string };

  // State & Sync
  status: 'active' | 'inactive';
  offlineId?: string;
  syncStatus?: SyncStatus;

  updatedAt?: string;
  deletedAt?: string;
}

// Legacy SubTeam is now just a Team with a parentTeamId
export type SubTeam = Team;

export interface Grappe {
  id: string;
  name: string;
  regionId: string;
  region?: { name: string };
}

export interface SubGrappe {
  id: string;
  grappe_id: string;
  region: string;
  grappe_numero: number;
  sous_grappe_numero: number;
  nom: string;
  code: string;
  nb_menages: number;
  centroide_lat: number;
  centroide_lon: number;
}

export interface LogisticsEquipment {
  [itemName: string]: {
    quantityPerHousehold: number;
    unit: string;
  };
}

export interface CatalogItem {
  id: string;
  name: string;
  category: 'Securité' | 'Portatif' | 'Logistique' | 'Autre';
  purchasePrice: number;
  rentalPrice: number; // per month
}

export interface SubTeamEquipment {
  id: string;
  itemId: string;
  quantity: number;
  acquisitionType: 'achat' | 'location';
}

export interface PreparatorLoading {
  date: string; // ISO date YYYY-MM-DD
  kitsLoaded: number;
}

export interface PreparatorTeam {
  teamId: string;
  teamName: string;
  loadings: PreparatorLoading[];
}

export interface CahierTaskPricing {
  dailyRate: number;
  personnelCount: number;
  durationDays: number;
  penalties: string;
  currency: string;
}

export interface CahierTask {
  color: string;
  icon: any;
  image: string;
  defaultCadence: string;
  introduction: string;
  missions: string[];
  materials: string[];
  hse: string[];
  subcontracting?: string[];
  finances?: string[];
  legal?: string[];
  pricing?: CahierTaskPricing;
  technicalImages?: { url: string; label: string }[];
}

export interface TaskLibrary {
  [key: string]: CahierTask;
}

export interface CahierVersion {
  id: string;
  date: string;
  author: string;
  library: TaskLibrary;
}

export interface Warehouse {
  id: string;
  name: string;
  region: string;
  regionId?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  preparatorTeams: PreparatorTeam[];
  stockOverrides: Record<string, number>;
  deletedAt?: string;
}

export interface ProjectConfig {
  teams?: Team[];
  grappesConfig?: Record<string, unknown>;
  kitComposition?: { item: string; quantity: number }[];
  warehouses?: Warehouse[]; // NEW: per-region warehouses
  logisticsEquipment?: Partial<Record<TradeKey, LogisticsEquipment>>;
  stock_overrides?: Record<string, number>;
  assignments?: Record<string, Record<string, string[]>>; // sgId -> tradeKey -> teamIds
  clientProvidesMaterials?: boolean; // Legacy/Labor toggle
  includeSupply?: boolean; // NEW: Toggle to include material procurement costs
  logistique?: {
    history: { date: string; action: string }[];
    geofencingRadius?: number;
    variantPricing?: Record<string, number>;
  };

  // Legacy / transitional
  logistics_workshop?: {
    kitsLoaded?: number;
  };
  staffConfig?: Record<string, { amount: number; mode: 'daily' | 'monthly' | 'task' }>;

  costs?: {
    vehicleRental?: Record<string, number>;
    staffRates?: Record<string, { amount: number; mode: 'daily' | 'monthly' | 'task' }>;
  };
  productionRates?: Record<TradeKey, number>;
  materialUnitCosts?: Record<string, number>;
  financials?: {
    realCosts?: Record<string, Record<string, number>>;
    plannedCosts?: Record<string, Record<string, number>>;
  };

  materialCatalog?: CatalogItem[];
  subTeamAllocations?: Record<string, SubTeamEquipment[]>; // mapping subTeamId -> equipments
  cahierHistory?: CahierVersion[];
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  status: string;
  version: number;
  duration?: number;
  totalHouses?: number;
  config: ProjectConfig;
}

export type TradeKey = string;
