import type { StatusOption, LotKey, FicheDef } from './types';
import { KitTrackingFicheModel } from './fiche_models/kitTracking.fiche.model';
import { QualityControlFicheModel } from './fiche_models/qualityControl.fiche.model';
import { PaymentSlipFicheModel } from './fiche_models/paymentSlip.fiche.model';
import { DetailedPlanningFicheModel } from './fiche_models/detailedPlanning.fiche.model';

export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'non_fait', label: 'Non fait', cssClass: 'bg-gray-400', requiresJustif: false },
  { value: 'en_cours', label: 'En cours', cssClass: 'bg-sky-500', requiresJustif: false },
  { value: 'fait', label: 'Fait', cssClass: 'bg-emerald-600', requiresJustif: false },
  { value: 'non_conforme', label: 'Non conforme – à reprendre', cssClass: 'bg-amber-500', requiresJustif: true },
  { value: 'bloque_acces', label: 'Bloqué – Accès / site', cssClass: 'bg-red-600', requiresJustif: true },
  { value: 'bloque_absent', label: 'Bloqué – Ménage absent', cssClass: 'bg-red-600', requiresJustif: true },
  { value: 'bloque_refus', label: 'Bloqué – Refus du ménage', cssClass: 'bg-red-600', requiresJustif: true },
  { value: 'bloque_support', label: 'Bloqué – Support défectueux', cssClass: 'bg-red-600', requiresJustif: true },
  { value: 'bloque_materiel', label: 'Bloqué – Matériel manquant', cssClass: 'bg-red-600', requiresJustif: true },
  { value: 'bloque_securite', label: 'Bloqué – Danger réseau / sécurité', cssClass: 'bg-red-600', requiresJustif: true },
  { value: 'reporte', label: 'Reporté', cssClass: 'bg-purple-500', requiresJustif: true },
  { value: 'autre', label: 'Autre', cssClass: 'bg-slate-500', requiresJustif: true },
];

export const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s]));

export const GRAPPE_COLORS: Record<string, string> = {
  Kaffrine_1: '#1E3A5F',
  Kaffrine_2: '#2E86AB',
  Kaffrine_3: '#E07A5F',
  Kaffrine_4: '#81B29A',
  Kaffrine_5: '#F2CC8F',
  Kaffrine_6: '#2A9D8F', // Nouvelle 6ème grappe Kaffrine
  Tambacounda_1: '#5B2333',
  Tambacounda_2: '#9C6644',
  Tambacounda_3: '#3D5A80',
};

// Fonction pour convertir les clés de grappe (KAF_G001) en clés de couleur (Kaffrine_1)
export function getGrappeColorKey(grappeKey: string): string {
  const match = grappeKey.match(/^([A-Z]+)_G(\d+)$/);
  if (!match) return grappeKey;
  
  const region = match[1];
  const number = parseInt(match[2], 10);
  
  // Convertir KAF -> Kaffrine, TAM -> Tambacounda
  const regionName = region === 'KAF' ? 'Kaffrine' : 
                     region === 'TAM' ? 'Tambacounda' : region;
  
  return `${regionName}_${number}`;
}

export const VIEW_W = 560;
export const VIEW_H = 620;

export const LOT_TITLES: Record<LotKey, string> = {
  A: 'Lot A — Pré-câblage',
  B: 'Lot B — Installation intérieure',
  C: 'Lot C — Raccordement',
};

export const REGIONS = ['Kaffrine', 'Tambacounda'];

export const GRAPPE_COUNT: Record<string, number> = {
  Kaffrine: 6, // Mis à jour pour correspondre à la nouvelle configuration
  Tambacounda: 3,
};

export const LOT_KEYS: LotKey[] = ['A', 'B', 'C'];

/* ── Fiches de suivi ── */

export const FICHE_DEFS: FicheDef[] = [
  { id: 'F01', level: 1, title: 'Production Pré-câblage', lot: 'A',
    fillBy: 'Prestataire (Lot A)', fillByTag: 'presta',
    purpose: 'Suivi quotidien de la production en atelier : coffrets pré-câblés, rejets, reprises et stock.',
    period: '1 fiche / jour / équipe',
    fields: [
      { key: 'region', label: 'Région', type: 'region' }, { key: 'grappe', label: 'Grappe', type: 'grappe' },
      { key: 'date', label: 'Date', type: 'date' }, { key: 'equipe', label: 'Équipe', type: 'text' },
      { key: 'coffretsJour', label: 'Coffrets pré-câblés du jour', type: 'number' },
      { key: 'rejets', label: 'Rejets', type: 'number' }, { key: 'reprises', label: 'Reprises', type: 'number' },
      { key: 'stockFin', label: 'Stock fin de journée', type: 'number' },
      { key: 'cumul', label: 'Cumul coffrets', type: 'number', readonly: true },
      { key: 'stockRestant', label: 'Stock restant', type: 'number', readonly: true },
      { key: 'observations', label: 'Observations', type: 'textarea', full: true },
    ] },
  { id: 'F02', level: 1, title: 'Production Coffrets', lot: 'A',
    fillBy: 'Prestataire (Lot A)', fillByTag: 'presta',
    purpose: 'Suivi de la production des coffrets de comptage avec contrôle qualité.',
    period: '1 fiche / jour / équipe',
    fields: [
      { key: 'region', label: 'Région', type: 'region' }, { key: 'grappe', label: 'Grappe', type: 'grappe' },
      { key: 'date', label: 'Date', type: 'date' }, { key: 'equipe', label: 'Équipe', type: 'text' },
      { key: 'coffretsProduits', label: 'Coffrets produits', type: 'number' },
      { key: 'coffretsOK', label: 'Coffrets conformes', type: 'number' },
      { key: 'coffretsNC', label: 'Non conformes', type: 'number' },
      { key: 'observations', label: 'Observations', type: 'textarea', full: true },
    ] },
  { id: 'F03', level: 2, title: 'Mur Support', lot: 'B',
    fillBy: 'Prestataire (Lot B)', fillByTag: 'presta',
    purpose: 'Suivi de la réalisation des murs supports selon NS 01-001.',
    period: '1 fiche / jour / équipe',
    fields: [
      { key: 'region', label: 'Région', type: 'region' }, { key: 'grappe', label: 'Grappe', type: 'grappe' },
      { key: 'date', label: 'Date', type: 'date' }, { key: 'equipe', label: 'Équipe', type: 'text' },
      { key: 'murPrevus', label: 'Murs prévus', type: 'number', readonly: true },
      { key: 'murRealises', label: 'Murs réalisés', type: 'number' },
      { key: 'murConstruits', label: 'Murs construits par prestataire', type: 'number' },
      { key: 'murExistants', label: 'Murs existants réutilisés', type: 'number' },
      { key: 'cumul', label: 'Cumul murs', type: 'number', readonly: true },
      { key: 'observations', label: 'Observations', type: 'textarea', full: true },
    ] },
  { id: 'F04', level: 2, title: 'Installation Intérieure', lot: 'B',
    fillBy: 'Prestataire (Lot B)', fillByTag: 'presta',
    purpose: "Suivi de l'installation intérieure complète selon dispositions Sénélec.",
    period: '1 fiche / ménage',
    fields: [
      { key: 'region', label: 'Région', type: 'region' }, { key: 'grappe', label: 'Grappe', type: 'grappe' },
      { key: 'ordre', label: 'N° ménage', type: 'number' }, { key: 'date', label: 'Date', type: 'date' },
      { key: 'phase1', label: 'Phase 1 - Traçage et fixation', type: 'select', options: ['OK', 'Non conforme'] },
      { key: 'phase2', label: 'Phase 2 - Raccordement coffret', type: 'select', options: ['OK', 'Non conforme'] },
      { key: 'phase3', label: 'Phase 3 - Équipement terminal', type: 'select', options: ['OK', 'Non conforme'] },
      { key: 'phase4', label: 'Phase 4 - Kit secondaire', type: 'select', options: ['OK', 'Non conforme', 'Non applicable'] },
      { key: 'terre', label: 'Mise à la terre', type: 'select', options: ['OK', 'Non conforme'] },
      { key: 'observations', label: 'Observations', type: 'textarea', full: true },
    ] },
  { id: 'F05', level: 2, title: 'Installation Kit Secondaire', lot: 'B',
    fillBy: 'Prestataire (Lot B)', fillByTag: 'presta',
    purpose: "Suivi de l'installation des kits secondaires (prises, éclairage).",
    period: '1 fiche / ménage',
    fields: [
      { key: 'region', label: 'Région', type: 'region' }, { key: 'grappe', label: 'Grappe', type: 'grappe' },
      { key: 'ordre', label: 'N° ménage', type: 'number' }, { key: 'date', label: 'Date', type: 'date' },
      { key: 'prises', label: 'Prises installées', type: 'number' },
      { key: 'pointsLumineux', label: 'Points lumineux', type: 'number' },
      { key: 'observations', label: 'Observations', type: 'textarea', full: true },
    ] },
  { id: 'F06', level: 2, title: 'Branchement', lot: 'C',
    fillBy: 'Prestataire (Lot C)', fillByTag: 'presta',
    purpose: 'Suivi du tirage et raccordement du câble préassemblé.',
    period: '1 fiche / ménage',
    fields: [
      { key: 'region', label: 'Région', type: 'region' }, { key: 'grappe', label: 'Grappe', type: 'grappe' },
      { key: 'ordre', label: 'N° ménage', type: 'number' }, { key: 'date', label: 'Date', type: 'date' },
      { key: 'tirage', label: 'Tirage câble', type: 'select', options: ['OK', 'Non conforme'] },
      { key: 'protections', label: 'Protections mécaniques', type: 'select', options: ['OK', 'Non conforme'] },
      { key: 'raccordement', label: 'Raccordement coffret', type: 'select', options: ['OK', 'Non conforme'] },
      { key: 'raccordementExt', label: 'Raccordement extérieur', type: 'select', options: ['OK', 'Non conforme'] },
      { key: 'controlesSecurite', label: 'Contrôles sécurité', type: 'select', options: ['OK', 'Non conforme'] },
      { key: 'observations', label: 'Observations', type: 'textarea', full: true },
    ] },
  { id: 'F07', level: 3, title: 'Contrôle Qualité Lot A', lot: 'A',
    fillBy: 'Contrôleur PROQUELEC', fillByTag: 'ctrl',
    purpose: 'Contrôle qualité des coffrets pré-câblés selon livrables contractuels.',
    period: '1 fiche / lot de contrôle',
    fields: [
      { key: 'region', label: 'Région', type: 'region' }, { key: 'grappe', label: 'Grappe', type: 'grappe' },
      { key: 'date', label: 'Date', type: 'date' }, { key: 'controleur', label: 'Contrôleur', type: 'text' },
      { key: 'coffretControles', label: 'Coffrets contrôlés', type: 'number' },
      { key: 'nc', label: 'Non conformes', type: 'number' },
      { key: 'tauxNc', label: 'Taux NC (%)', type: 'number', readonly: true },
      { key: 'typeNC', label: 'Types de non-conformités', type: 'textarea' },
      { key: 'actionCorrective', label: 'Action corrective', type: 'textarea', full: true },
    ] },
  { id: 'F08', level: 3, title: 'Contrôle Qualité Lot B', lot: 'B',
    fillBy: 'Contrôleur PROQUELEC', fillByTag: 'ctrl',
    purpose: 'Contrôle qualité des installations selon NS 01-001.',
    period: '1 fiche / lot de contrôle',
    fields: [
      { key: 'region', label: 'Région', type: 'region' }, { key: 'grappe', label: 'Grappe', type: 'grappe' },
      { key: 'date', label: 'Date', type: 'date' }, { key: 'controleur', label: 'Contrôleur', type: 'text' },
      { key: 'mursControles', label: 'Murs contrôlés', type: 'number' },
      { key: 'mursConformes', label: 'Murs conformes NS 01-001', type: 'number' },
      { key: 'installationsControlees', label: 'Installations contrôlées', type: 'number' },
      { key: 'installationsConformes', label: 'Installations conformes', type: 'number' },
      { key: 'observations', label: 'Observations', type: 'textarea', full: true },
    ] },
  { id: 'F09', level: 3, title: 'Contrôle Qualité Lot C', lot: 'C',
    fillBy: 'Contrôleur PROQUELEC', fillByTag: 'ctrl',
    purpose: 'Contrôle qualité des branchements selon dispositions Sénélec.',
    period: '1 fiche / lot de contrôle',
    fields: [
      { key: 'region', label: 'Région', type: 'region' }, { key: 'grappe', label: 'Grappe', type: 'grappe' },
      { key: 'date', label: 'Date', type: 'date' }, { key: 'controleur', label: 'Contrôleur', type: 'text' },
      { key: 'branchementsControles', label: 'Branchements contrôlés', type: 'number' },
      { key: 'branchementsConformes', label: 'Branchements conformes', type: 'number' },
      { key: 'typeNC', label: 'Types de non-conformités', type: 'textarea' },
      { key: 'actionCorrective', label: 'Action corrective', type: 'textarea', full: true },
    ] },
  { id: 'F10', level: 3, title: 'PV de Réception', lot: '',
    fillBy: 'Chef de projet + Contrôleur', fillByTag: 'both',
    purpose: 'Procès-verbal de réception finale de grappe selon livrables contractuels.',
    period: '1 fiche / grappe terminée',
    fields: [
      { key: 'region', label: 'Région', type: 'region' }, { key: 'grappe', label: 'Grappe', type: 'grappe' },
      { key: 'date', label: 'Date', type: 'date' }, { key: 'prestataire', label: 'Prestataire', type: 'text', readonly: true },
      { key: 'menagesPrevus', label: 'Ménages prévus', type: 'number', readonly: true },
      { key: 'menagesConformes', label: 'Ménages conformes', type: 'number' },
      { key: 'conformeA', label: 'Lot A conforme', type: 'select', options: ['Oui', 'Non'] },
      { key: 'conformeB', label: 'Lot B conforme', type: 'select', options: ['Oui', 'Non'] },
      { key: 'conformeC', label: 'Lot C conforme', type: 'select', options: ['Oui', 'Non'] },
      { key: 'reserves', label: 'Réserves', type: 'textarea' },
      { key: 'observation', label: 'Observation', type: 'textarea', full: true },
      { key: 'signChefProjet', label: 'Signature Chef de Projet', type: 'text' },
      { key: 'signControleur', label: 'Signature Contrôleur', type: 'text' },
    ] },
  { id: 'F11', level: 3, title: 'Suivi Planning', lot: '',
    fillBy: 'Chef de projet', fillByTag: 'ctrl',
    purpose: "Suivi de l'avancement par rapport au planning contractuel.",
    period: '1 fiche / mois',
    fields: [
      { key: 'region', label: 'Région', type: 'region' }, { key: 'grappe', label: 'Grappe', type: 'grappe' },
      { key: 'mois', label: 'Mois', type: 'select', options: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'] },
      { key: 'annee', label: 'Année', type: 'number' },
      { key: 'prevu', label: 'Dates prévues (réception)', type: 'text', readonly: true },
      { key: 'avancementA', label: 'Avancement Lot A (%)', type: 'number' },
      { key: 'avancementB', label: 'Avancement Lot B (%)', type: 'number' },
      { key: 'avancementC', label: 'Avancement Lot C (%)', type: 'number' },
      { key: 'retards', label: 'Retards identifiés', type: 'textarea' },
      { key: 'actions', label: 'Actions correctives', type: 'textarea', full: true },
    ] },
  { id: 'F12', level: 3, title: 'Situation mensuelle facturation', lot: '',
    fillBy: 'Prestataire + Chef de projet', fillByTag: 'both',
    purpose: 'Synthèse mensuelle des quantités validées pour établir la facturation. Montant calculé automatiquement selon le barème PROQUELEC.',
    period: '1 fiche / mois',
    fields: [
      { key: 'mois', label: 'Mois', type: 'select', options: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'] },
      { key: 'annee', label: 'Année', type: 'number' },
      { key: 'region', label: 'Région', type: 'region' },
      { key: 'grappe', label: 'Grappe', type: 'grappe' },
      { key: 'prestataire', label: 'Prestataire', type: 'text', readonly: true },
      { key: 'lot', label: 'LOT', type: 'select', options: ['A', 'B', 'C'] },
      { key: 'activite', label: 'Activité / Type de prix', type: 'select', options: ['Kit (Lot A)', 'Installation mur construit (Lot B)', 'Installation mur existant (Lot B)', 'Branchement (Lot C)'] },
      { key: 'quantiteValidee', label: 'Quantité validée', type: 'number' },
      { key: 'prixUnitaire', label: 'Prix unitaire (FCFA)', type: 'number', readonly: true },
      { key: 'montantCalc', label: 'Montant calculé (FCFA)', type: 'number', readonly: true },
      { key: 'observations', label: 'Observations', type: 'textarea', full: true },
    ] },
  { id: KitTrackingFicheModel.id, level: KitTrackingFicheModel.level, title: KitTrackingFicheModel.title, lot: 'B',
    fillBy: 'Prestataire (Lot B)', fillByTag: 'presta', purpose: KitTrackingFicheModel.description, period: 'Par ménage',
    fields: KitTrackingFicheModel.fields as unknown as FicheFieldDef[] },
  { id: QualityControlFicheModel.id, level: QualityControlFicheModel.level, title: QualityControlFicheModel.title, lot: 'C',
    fillBy: 'Contrôleur', fillByTag: 'ctrl', purpose: QualityControlFicheModel.description, period: 'Par lot',
    fields: QualityControlFicheModel.fields as unknown as FicheFieldDef[] },
  { id: PaymentSlipFicheModel.id, level: PaymentSlipFicheModel.level, title: PaymentSlipFicheModel.title, lot: 'A',
    fillBy: 'PROQUELEC', fillByTag: 'both', purpose: PaymentSlipFicheModel.description, period: 'Mensuel',
    fields: PaymentSlipFicheModel.fields as unknown as FicheFieldDef[] },
  { id: DetailedPlanningFicheModel.id, level: DetailedPlanningFicheModel.level, title: DetailedPlanningFicheModel.title, lot: 'A',
    fillBy: 'PROQUELEC', fillByTag: 'both', purpose: DetailedPlanningFicheModel.description, period: 'Détaillé',
    fields: DetailedPlanningFicheModel.fields as unknown as FicheFieldDef[] },
];

export const FICHE_LEVEL_LABELS: Record<number, string> = {
  1: 'Niveau 1 — Production par grappe',
  2: 'Niveau 2 — Fiches quantitatives par activité',
  3: 'Niveau 3 — Qualité, réception & facturation',
};

export const FICHE_LEVEL_COLORS: Record<number, string> = {
  1: 'bg-blue-600',
  2: 'bg-emerald-600',
  3: 'bg-purple-600',
};

/* ── Planning Defaults ── */

export const PHASE_KEYS = ['formation', 'preparation', 'maconnerie', 'transport', 'installation', 'reseau', 'controle', 'reception'] as const;
export type PhaseKey = (typeof PHASE_KEYS)[number];

export const PHASE_LABELS: Record<PhaseKey, string> = {
  formation: 'Formation',
  preparation: 'Préparation kits',
  maconnerie: 'Maçonnerie',
  transport: 'Transport',
  installation: 'Installation intérieure',
  reseau: 'Réseau BT',
  controle: 'Contrôle qualité',
  reception: 'Réception',
};

export const PLANNING_DEFAULTS = {
  dateDebut: '2026-07-20',
  dureeObjectifMois: 2,
  dateLimiteProjet: '',
  precablageActif: true,
  precablageCadenceJour: 5,
  precablageEffectifEquipe: 2,
  precablageEquipesKaffrine: 0,
  precablageEquipesTamba: 0,
  reseauCadenceJour: 20,
  reseauEffectifEquipe: 2,
  reseauEquipesKaffrine: 3,
  reseauEquipesTamba: 2,
  reseauPipelineDebut: 15,
  installCadenceJour: 2,
  installEffectifEquipe: 2,
  installEquipesKaffrine: 0,
  installEquipesTamba: 0,
  maconCadenceJour: 2,
  maconEffectifEquipe: 2,
  maconAvanceJours: 5,
  maconEquipesKaffrine: 0,
  maconEquipesTamba: 0,
  transportCadenceJour: 100,
  transportEffectifEquipe: 2,
  transportEquipesKaffrine: 1,
  transportEquipesTamba: 1,
  controleCadenceJour: 15,
  controleDebutPct: 10,
  controleursEquipesKaffrine: 0,
  controleursEquipesTamba: 0,
  receptionDelaiJours: 3,
  prepCadenceJour: 20,
  formationDureeJours: 3,
  formationMaxPersonnes: 25,
  nbFormateurs: 1,
  formationMode: 'sequentiel' as const,
  regionsOrdre: ['Tambacounda', 'Kaffrine'],
  modeRegions: 'parallele' as const,
  samediTravaille: true,
  dimancheTravaille: false,
  pauseEntreSessions: 0,
  compterJoursFeries: true,
  compterJoursReligieux: true,
  compterSaisonPluie: true,
  impactPluie: 50,
  saisonPluieDebut: '07-01',
  saisonPluieFin: '10-15',
  magalAvantJours: 5,
  magalApresJours: 3,
  magalImpact: 0,
  magalDateOverride: '',
  gamouAvantJours: 2,
  gamouApresJours: 2,
  gamouImpact: 0,
  gamouDateOverride: '',
  tabaskiAvantJours: 3,
  tabaskiApresJours: 3,
  tabaskiImpact: 0,
  tabaskiDateOverride: '',
  koriteAvantJours: 2,
  koriteApresJours: 2,
  koriteImpact: 0,
  koriteDateOverride: '',
  phaseStartMode: Object.fromEntries(PHASE_KEYS.map(k => [k, 'auto'])) as Record<string, 'auto' | 'manual'>,
  manualDates: {} as Record<string, Record<string, string>>,
  manualDatesEnd: {} as Record<string, Record<string, string>>,
  totalElectriciens: 0,
  maconsKaffrine: 0,
  maconsTamba: 0,
  controleursKaffrine: 0,
  controleursTamba: 0,
  preparateursKaffrine: 0,
  preparateursTamba: 0,
  elecKaffrine: 0,
  elecTamba: 0,
  joursOuvresParMois: 22,
};
