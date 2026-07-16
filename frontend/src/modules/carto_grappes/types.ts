export interface Village {
  region: string;
  village: string;
  n: number;
  lat: number;
  lon: number;
  defaultGrappe: number;
  x: number;
  y: number;
  r: number;
}

export interface Menage {
  ordre: number;
  nom: string;
  tel: string;
  village: string;
  commune: string;
  region: string;
  grappe?: number;
}

export interface GpsData {
  ordre: number;
  lat: number;
  lon: number;
  accuracy: number;
}

export interface GpsEntry {
  [ordre: string]: [number, number, number];
}

export interface Prestataire {
  id?: string | number;
  lot?: string;
  nom?: string;
  entreprise?: string;
  societe?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  region?: string;
  representantLegal?: string;
  fonctionRepresentant?: string;
  nrc?: string; // Numéro Registre de Commerce
  ifu?: string; // Identifiant Fiscal Unique
  compteBancaire?: string;
  formeJuridique?: string;
  nombreEquipes?: number;
  cadencePersonnalisee?: number;
  dateDebut?: string;
  dateFin?: string;
  referenceLettreMission?: string;
  contactLocal?: string;
}

export type LotKey = 'A' | 'B' | 'C';

export type LotMode = 'individuel' | 'global' | 'groupe';

export type StatusValue =
  | 'non_fait'
  | 'en_cours'
  | 'fait'
  | 'non_conforme'
  | 'bloque_acces'
  | 'bloque_absent'
  | 'bloque_refus'
  | 'bloque_support'
  | 'bloque_materiel'
  | 'bloque_securite'
  | 'reporte'
  | 'autre';

export interface StatusOption {
  value: StatusValue;
  label: string;
  cssClass: string;
  requiresJustif: boolean;
}

export interface LotEntry {
  status: StatusValue;
  justif: string;
  updatedAt: string | null;
}

export interface MenageEntry {
  A: LotEntry;
  B: LotEntry;
  C: LotEntry;
  conforme: boolean;
  obs: string;
}

export interface EntrepreneurData {
  entreprise: string;
  societe: string;
  telephone: string;
  email: string;
  adresse: string;
}

export interface EntrepreneurGroup extends EntrepreneurData {
  id: string;
  grappes: string[];
}

export interface LotConfig {
  __global?: EntrepreneurData;
  __groupes?: EntrepreneurGroup[];
  [key: string]: EntrepreneurData | EntrepreneurGroup[] | undefined;
}

export type EntrepreneurConfig = Record<LotKey, LotConfig>;

export interface GrappeSummary {
  region: string;
  grappe: number;
  key: string;
  total: number;
  fait: number;
  enCours: number;
  bloque: number;
  nonFait: number;
  conforme: number;
  pct: number;
}

export interface RegionSummary {
  region: string;
  total: number;
  fait: number;
  enCours: number;
  bloque: number;
  nonFait: number;
  pct: number;
  grappes: GrappeSummary[];
}

export type TabKey =
  | 'map' | 'bordereau' | 'dashboard' | 'fiches'
  | 'admin' | 'dossiers' | 'planning' | 'history'
  | 'sync' | 'gps' | 'alerts' | 'workflow'
  | 'settings' | 'help' | 'alerts-computed' | 'contrat' | 'stats'
  | 'prestataires';


export type PlanningSubTab =
  | 'synthese' | 'parametres' | 'formation'
  | 'planification' | 'gantt' | 'ressources' | 'optimisation';

export interface FicheFieldDef {
  key: string;
  label: string;
  type: 'region' | 'grappe' | 'select' | 'textarea' | 'number' | 'text' | 'date';
  options?: string[];
  readonly?: boolean;
  full?: boolean;
  inputType?: string;
  min?: number;
  max?: number;
  required?: boolean;
  editable?: boolean;
}

export interface ClusteringConfig {
  enabled: boolean;
  maxDistance: number; // en kilomètres
  minMenagesPerGrappe: number;
  maxMenagesPerGrappe: number;
  preferredGrappeCount: number;
  algorithm: 'kmeans' | 'hierarchical' | 'density';
}

export interface GrappeCluster {
  id: string;
  region: string;
  grappeNumber: number;
  center: { lat: number; lon: number };
  menages: number[];
  villageCount: number;
  menageCount: number;
  averageDistance: number;
}

export interface ClusterConfiguration {
  config: ClusteringConfig;
  clusters: GrappeCluster[];
  score: number;
  metrics: {
    avgMenages: number;
    stdDevMenages: number;
    avgIntraDistance: number;
    avgInterDistance: number;
    avgVillageRatio: number;
  };
}

export interface PlanningConfiguration {
  params: PlanningParams;
  result: PlanningResult;
  score: number;
  metrics: {
    durationDays: number;
    durationMonths: number;
    deadlineDelay: number;
    totalCost: number;
    resourceUtilization: number;
    riskScore: number;
  };
}

export interface OptimizationOptions {
  targetDurationMonths?: number;
  maxCostMultiplier?: number;
  deadline?: Date;
  optimizeFor?: 'duration' | 'cost' | 'balanced';
  resourceConstraints?: {
    maxElectricians?: number;
    maxMasons?: number;
    maxControllers?: number;
  };
}

export interface EventCalendrierConfig {
  // Jours complètement non ouvrés
  magalNonOuvre?: boolean;
  gamouNonOuvre?: boolean;
  koriteNonOuvre?: boolean;
  tabaskiNonOuvre?: boolean;
  
  // Jours partiellement ouvrés (périodes avant/après)
  magalAvantPartiel?: boolean;
  magalApresPartiel?: boolean;
  gamouAvantPartiel?: boolean;
  gamouApresPartiel?: boolean;
  koriteAvantPartiel?: boolean;
  koriteApresPartiel?: boolean;
  tabaskiAvantPartiel?: boolean;
  tabaskiApresPartiel?: boolean;
  
  // Réduction en jours équivalents pour jours partiels
  magalAvantReduction?: number;      // 0.5 = compte comme 0.5 jour ouvré
  magalApresReduction?: number;      // 1 = compte comme 0 jour ouvré
  gamouAvantReduction?: number;
  gamouApresReduction?: number;
  koriteAvantReduction?: number;
  koriteApresReduction?: number;
  tabaskiAvantReduction?: number;
  tabaskiApresReduction?: number;
  
  // Nombre de jours avant/après pour chaque événement
  magalAvantJours?: number;
  magalApresJours?: number;
  gamouAvantJours?: number;
  gamouApresJours?: number;
  koriteAvantJours?: number;
  koriteApresJours?: number;
  tabaskiAvantJours?: number;
  tabaskiApresJours?: number;
}

export interface FicheDef {
  id: string;
  level: number;
  title: string;
  lot: string;
  fillBy: string;
  fillByTag: 'presta' | 'ctrl' | 'both';
  purpose: string;
  period: string;
  fields: FicheFieldDef[];
}

export interface FicheEntry {
  id: string;
  ficheKey: string;
  data: Record<string, unknown>;
  author?: string;
  createdAt?: string;
}

export interface HistoryEntry {
  id: string;
  householdOrdre: number;
  lot: string;
  fromStatus: string;
  toStatus: string;
  userName: string;
  createdAt: string;
}

export interface PlanningParams {
  dateDebut?: string;
  dureeObjectifMois?: number;
  dateLimiteProjet?: string;
  joursOuvresParMois?: number;
  precablageActif?: boolean;
  precablageCadenceJour?: number;
  precablageEffectifEquipe?: number;
  precablageEquipesKaffrine?: number;
  precablageEquipesTamba?: number;
  reseauCadenceJour?: number;
  reseauEffectifEquipe?: number;
  reseauEquipesKaffrine?: number;
  reseauEquipesTamba?: number;
  reseauPipelineDebut?: number;
  installCadenceJour?: number;
  installEffectifEquipe?: number;
  installEquipesKaffrine?: number;
  installEquipesTamba?: number;
  maconCadenceJour?: number;
  maconEffectifEquipe?: number;
  maconAvanceJours?: number;
  maconEquipesKaffrine?: number;
  maconEquipesTamba?: number;
  transportCadenceJour?: number;
  transportEffectifEquipe?: number;
  transportEquipesKaffrine?: number;
  transportEquipesTamba?: number;
  controleCadenceJour?: number;
  controleDebutPct?: number;
  controleursEquipesKaffrine?: number;
  controleursEquipesTamba?: number;
  receptionDelaiJours?: number;
  prepCadenceJour?: number;
  formationDureeJours?: number;
  formationMaxPersonnes?: number;
  nbFormateurs?: number;
  formationMode?: 'sequentiel' | 'parallele';
  regionsOrdre?: string[];
  modeRegions?: 'parallele' | 'sequentiel';
  samediTravaille?: boolean;
  dimancheTravaille?: boolean;
  pauseEntreSessions?: number;
  compterJoursFeries?: boolean;
  compterJoursReligieux?: boolean;
  compterSaisonPluie?: boolean;
  impactPluie?: number;
  saisonPluieDebut?: string;
  saisonPluieFin?: string;
  magalAvantJours?: number;
  magalApresJours?: number;
  magalImpact?: number; // Déprécié - remplacé par configuration binaire
  magalDateOverride?: string;
  gamouAvantJours?: number;
  gamouApresJours?: number;
  gamouImpact?: number; // Déprécié - remplacé par configuration binaire
  gamouDateOverride?: string;
  tabaskiAvantJours?: number;
  tabaskiApresJours?: number;
  tabaskiImpact?: number; // Déprécié - remplacé par configuration binaire
  tabaskiDateOverride?: string;
  koriteAvantJours?: number;
  koriteApresJours?: number;
  koriteImpact?: number; // Déprécié - remplacé par configuration binaire
  koriteDateOverride?: string;
  
  // Nouvelle configuration binaire simplifiée
  eventCalendrier?: EventCalendrierConfig;
  phaseStartMode?: Record<string, 'auto' | 'manual'>;
  manualDates?: Record<string, Record<string, string>>;
  manualDatesEnd?: Record<string, Record<string, string>>;
  totalElectriciens?: number;
  maconsKaffrine?: number;
  maconsTamba?: number;
  controleursKaffrine?: number;
  controleursTamba?: number;
  preparateursKaffrine?: number;
  preparateursTamba?: number;
  elecKaffrine?: number;
  elecTamba?: number;
  [key: string]: unknown;
}

export interface GanttItem {
  phase: string;
  region: string;
  debut: Date;
  fin: Date;
  color: string;
  detail?: string;
}

export interface PlanningAlert {
  region: string;
  msg: string;
  sev: 'high' | 'medium' | 'low';
  phase?: string;
}

export interface PlanningResult {
  regions: Record<string, RegionPlanning>;
  formation: FormationSession[];
  prepByRegion: Record<string, { debut: Date; fin: Date; jours: number }>;
  gantt: GanttItem[];
  alertes: PlanningAlert[];
  synthese: PlanningSynthese;
}

export interface RegionPlanning {
  menages: number;
  elec: number;
  install: PhaseDetail;
  reseau: PhaseDetail;
  controle: PhaseDetail;
  reception: PhaseDetail;
  macon: PhaseDetail;
  transport: PhaseDetail;
  finRegion: Date;
  grappes: {
    macon: GrappePhaseDetail[];
    transport: GrappeTransportDetail[];
    install: GrappePhaseDetail[];
    reseau: GrappePhaseDetail[];
    controle: GrappePhaseDetail[];
  };
}

export interface PhaseDetail {
  equipes: number;
  equipesMin?: number;
  equipesDispo?: number;
  jours: number;
  debut: Date;
  fin: Date;
  cadence?: number;
}

export interface GrappePhaseDetail {
  grappeKey: string;
  equipes: number;
  equipesMin: number;
  jours: number;
  debut: Date;
  fin: Date;
  cadence: number;
  menages: number;
}

export interface GrappeTransportDetail extends GrappePhaseDetail {
  cadenceConsommation: number;
  cadenceLivraison: number;
  satisfait: boolean;
}

export interface FormationSession {
  region: string;
  session: number;
  debut: Date;
  fin: Date;
  participants: number;
  formateur: number;
  label: string;
}

export interface PlanningSynthese {
  finGlobal: Date;
  debutTravaux: Date;
  dureeJours: number;
  dureeMois: number;
  dureeProjetJours: number;
  dureeProjetMois: number;
  totalElecInstall: number;
  totalElecReseau: number;
  totalElec: number;
  elecDisponibles: number;
  surplus: number;
  bottleneck: { phase: string; date: Date } | null;
  totalEquipes: Record<string, number>;
}

export interface Prestataire {
  id: string;
  entreprise: string;
  societe?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
}
