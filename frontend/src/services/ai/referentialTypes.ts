/**
 * 📚 Types enrichis pour les référentiels techniques et normes
 * Types structurés pour améliorer la précision et la richesse des réponses IA
 */

// ─────────────────────────────────────────────
// RÉFÉRENTIELS ET NORMES
// ─────────────────────────────────────────────

export type NormeReference = 'NS 01-001' | 'NS 01-002' | 'NS 01-003' | 'Guide MFR' | 'UTE C 15-100' | 'Autre';

export type SourceFamily = 'MFR' | 'NS01' | 'SENELEC' | 'GEM' | 'INTERNATIONAL';

export type VerdictType = 'Conforme' | 'Conforme sous réserve' | 'Non conforme' | 'A verifier';

export type SeverityType = 'critique' | 'majeure' | 'mineure' | 'information';

export type DomaineTechnique =
  | 'projet_mfr'
  | 'installation_interieur'
  | 'branchement_senelec'
  | 'protection_electrique'
  | 'anomalies'
  | 'glossaire'
  | 'specifications'
  | 'normes'
  | 'kobo'
  | 'finance'
  | 'mission';

// ─────────────────────────────────────────────
// DÉFINITIONS TECHNIQUES ENRICHIES
// ─────────────────────────────────────────────

export interface NormeSpec {
  reference: string;
  title: string;
  chapter?: string;
  article?: string;
  version?: string;
  dateApplication?: string;
}

export interface CritereConformite {
  id: string;
  description: string;
  obligation: 'obligatoire' | 'recommandé' | 'interdit';
  methodeControle?: string;
  tolerance?: string;
}

export interface PratiqueInterdite {
  id: string;
  description: string;
  risque: string;
  consequence?: string;
  alternative?: string;
}

export interface ActionCorrective {
  id: string;
  description: string;
  priorite: 'immediate' | 'rapide' | 'planifiée';
  responsable?: string;
  delai?: string;
  verification?: string;
}

export interface ReferenceTechnique {
  norme: NormeReference;
  sourceFamily: SourceFamily;
  specs: string[];
  criticalChecks: string[];
  forbiddenPractices: PratiqueInterdite[];
  correctiveActions: ActionCorrective[];
  validationNote?: string;
}

export interface DefinitionTechniqueEnrichie {
  id: string;
  domaine: DomaineTechnique;
  title: string;
  description: string;
  reference: ReferenceTechnique;
  keywords: string[];
  images?: { url: string; caption: string }[];
  defaultVerdict?: VerdictType;
  defaultSeverity?: SeverityType;
  exemplesConformes?: string[];
  exemplesNonConformes?: string[];
  contexteApplication?: string;
}

// ─────────────────────────────────────────────
// FICHE DE CONTRÔLE TERRAIN ENRICHIE
// ─────────────────────────────────────────────

export interface FicheControleTerrain {
  id: string;
  date: string;
  inspecteur: string;
  lieu: string;
  typeControle: 'initial' | 'intermediaire' | 'final' | 'reception';
  
  observation: string;
  referenceRule: string;
  mainRisk: string;
  immediateAction: string;
  
  criteres: CritereConformite[];
  photos?: { url: string; caption: string; timestamp: string }[];
  documents?: { url: string; type: string; titre: string }[];
  
  verdict: VerdictType;
  severity: SeverityType;
  commentaireInspecteur?: string;
  signatureInspecteur?: boolean;
  signatureClient?: boolean;
  
  meta?: {
    temperature?: string;
    humidite?: string;
    conditionsMeteo?: string;
    equipementUtilise?: string[];
  };
}

// ─────────────────────────────────────────────
// RÉPONSE IA ENRICHIE
// ─────────────────────────────────────────────

export interface ReferenceCitee {
  norme: NormeReference;
  chapter?: string;
  article?: string;
  extrait?: string;
  url?: string;
}

export interface RisqueIdentifie {
  type: 'electrique' | 'mecanique' | 'incendie' | 'securite' | 'autre';
  description: string;
  niveau: SeverityType;
  mitigation?: string;
}

export interface EtapeProcedure {
  numero: number;
  description: string;
  responsable?: string;
  preconditions?: string[];
  delai?: string;
  documents?: string[];
}

export interface ReponseIAEnrichie {
  // Champs existants
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'user';
  actionLabel?: string;
  actionPath?: string;
  actionType?: 'nav' | 'download_report' | 'download_contract';
  images?: { url: string; caption: string }[];
  smartReplies?: string[];
  verdict?: VerdictType;
  severity?: SeverityType;
  recommendedAction?: string;
  controlSheet?: FicheControleTerrain;
  _engine?: 'RULES' | 'CLAUDE' | 'RULES_FALLBACK' | 'CLAUDE_FALLBACK' | 'VISION' | 'VISION_ERROR';

  // Nouveaux champs enrichis
  domaine?: DomaineTechnique;
  referencesCitees?: ReferenceCitee[];
  risquesIdentifies?: RisqueIdentifie[];
  etapesProcedure?: EtapeProcedure[];
  definitionTechnique?: DefinitionTechniqueEnrichie;
  contexte?: {
    roleUtilisateur?: string;
    moduleActif?: string;
    donneesContextuelles?: Record<string, unknown>;
  };
  meta?: {
    confiance?: number; // 0-1
    sources?: string[];
    version?: string;
    dateGeneration?: string;
  };
}

// ─────────────────────────────────────────────
// TYPES DE QUESTIONS
// ─────────────────────────────────────────────

export type CategorieQuestion =
  | 'mission'
  | 'finance'
  | 'kobo'
  | 'norme'
  | 'senelec'
  | 'compteur'
  | 'protection'
  | 'anomalies'
  | 'interieur'
  | 'glossaire'
  | 'termes'
  | 'specs'
  | 'decision'
  | 'report';

export interface QuestionStructuree {
  id: string;
  categorie: CategorieQuestion;
  texte: string;
  variations?: string[];
  motsCles: string[];
  reponseAttendue: string;
  references: ReferenceCitee[];
  domaine: DomaineTechnique;
  complexite: 'basique' | 'intermediaire' | 'avancee';
  frequence?: number; // pour le scoring de popularité
}

// ─────────────────────────────────────────────
// UTILITAIRES DE TYPE
// ─────────────────────────────────────────────

export function isVerdictValid(verdict: string): verdict is VerdictType {
  return ['Conforme', 'Conforme sous réserve', 'Non conforme', 'A verifier'].includes(verdict);
}

export function isSeverityValid(severity: string): severity is SeverityType {
  return ['critique', 'majeure', 'mineure', 'information'].includes(severity);
}

export function getSeverityColor(severity: SeverityType): string {
  switch (severity) {
    case 'critique':
      return 'rose';
    case 'majeure':
      return 'orange';
    case 'mineure':
      return 'sky';
    case 'information':
      return 'blue';
    default:
      return 'slate';
  }
}

export function getVerdictColor(verdict: VerdictType): string {
  switch (verdict) {
    case 'Conforme':
    case 'Conforme sous réserve':
      return 'emerald';
    case 'Non conforme':
      return 'rose';
    case 'A verifier':
      return 'amber';
    default:
      return 'slate';
  }
}
