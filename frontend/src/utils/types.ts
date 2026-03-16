export type UserRole = 'ADMIN_PROQUELEC' | 'DG_PROQUELEC' | 'CLIENT_LSE' | 'CHEF_EQUIPE';

export interface User {
    id: string;
    email: string; // Acts as username/login
    name: string;
    role: UserRole;
    password?: string;
    organization?: string;
    teamId?: string; // If CHEF_EQUIPE
    active?: boolean;
    createdAt?: string;
    requires2FA?: boolean;
    securityQuestion?: string;
    securityAnswerHash?: string;
}

export interface Household {
    id: string;
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
    
    source?: string;
    koboData?: any;
    koboSync?: {
        preparateurKits?: number;
        livreurDate?: string;
        cableInt25?: number;
        cableInt15?: number;
        tranchee4?: number;
        tranchee15?: number;
        maconOk?: boolean;
        reseauOk?: boolean;
        interieurOk?: boolean;
        controleOk?: boolean;
        village?: string;
        departement?: string;
        tel?: string;
    }
}

export interface SubTeam {
    id: string;
    name: string;
    leader: string;
    phone?: string;
}

export interface Team {
    id: string;
    name: string;
    type: TradeKey;
    capacity: number;
    leader?: string;
    phone?: string;
    subTeams?: SubTeam[];
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

export interface ProjectConfig {
    teams?: Team[];
    grappesConfig?: any;
    kitComposition?: any[];
    logisticsEquipment?: Partial<Record<TradeKey, LogisticsEquipment>>;
    stock_overrides?: Record<string, number>;
    assignments?: Record<string, Record<string, string[]>>; // sgId -> tradeKey -> teamIds
    clientProvidesMaterials?: boolean; // Legacy/Labor toggle
    includeSupply?: boolean; // NEW: Toggle to include material procurement costs

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
}

export interface Project {
    id: string;
    organizationId: string;
    name: string;
    status: string;
    version: number;
    duration?: number;
    config: ProjectConfig;
}

export type TradeKey = string;
