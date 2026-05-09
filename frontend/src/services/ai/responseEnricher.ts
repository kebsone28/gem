/**
 * 🔄 ResponseEnricher - Enrichissement automatique des réponses IA
 * Ajoute des métadonnées structurées aux réponses IA basées sur les référentiels techniques
 */

import {
  type DomaineTechnique,
  type ReferenceCitee,
  type RisqueIdentifie,
  type EtapeProcedure,
  type DefinitionTechniqueEnrichie,
  type NormeReference,
  type SourceFamily,
  type VerdictType,
  type SeverityType,
} from './referentialTypes';
import type { AIResponse } from './MissionSageService';

// ─────────────────────────────────────────────
// MAPPING DES MOTS-CLÉS VERS LES DOMAINES
// ─────────────────────────────────────────────

const DOMAIN_KEYWORDS: Record<DomaineTechnique, string[]> = {
  mission: ['mission', 'ordre de mission', ' om ', 'certification', 'validation', 'chef de projet'],
  finance: ['budget', 'indemnité', 'coût', 'dépense', ' argent ', 'fcfa', 'compta'],
  kobo: ['kobo', 'terrain', 'collecte', 'formulaire', 'sync', 'synchronisation'],
  projet_mfr: [' mfr ', 'ménage', 'faible revenu', '37500', 'eligibilité', 'critère'],
  installation_interieur: [
    'intérieur',
    'interieur',
    'coffret',
    'lampe',
    'prise',
    'interrupteur',
    'couloir',
    'câble armé',
  ],
  branchement_senelec: [
    'branchement',
    'senelec',
    'coffret compteur',
    'potelet',
    'limite propriété',
    'surplomb',
    'hublot',
  ],
  protection_electrique: [
    'protection',
    ' ddr ',
    'parafoudre',
    'fusible',
    'surtension',
    ' choc ',
    ' prise de terre ',
    ' pe ',
  ],
  anomalies: [
    'anomalie',
    'défaut',
    'erreur',
    'interdit',
    'fils visibles',
    'câble extérieur',
    'barrette',
  ],
  glossaire: [
    'partie active',
    ' masse ',
    'liaison équipotentielle',
    'conducteur pe',
    'section',
    'définition',
  ],
  specifications: ['hauteur', 'profondeur', 'configuration', 'spécification', 'matériel'],
  normes: ['norme', 'ns 01-001', 'ns 01001', ' bt ', ' erp ', 'tension'],
};

// ─────────────────────────────────────────────
// RÉFÉRENTIELS TECHNIQUES
// ─────────────────────────────────────────────

const NORME_REFERENCES: Record<string, ReferenceCitee> = {
  'ns 01-001': {
    norme: 'NS 01-001',
    chapter: 'Chapitre 1-7',
    article: 'Articles 1-15',
  },
  'guide mfr': {
    norme: 'Guide MFR',
    chapter: 'Chapitre 1-5',
  },
};

// ─────────────────────────────────────────────
// FONCTIONS D'ENRICHISSEMENT
// ─────────────────────────────────────────────

function detectDomaine(message: string): DomaineTechnique | undefined {
  const normalized = message.toLowerCase();
  
  for (const [domaine, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return domaine as DomaineTechnique;
    }
  }
  
  return undefined;
}

function extractReferences(message: string): ReferenceCitee[] {
  const references: ReferenceCitee[] = [];
  const normalized = message.toLowerCase();
  
  // Extraction des références normatives
  if (normalized.includes('ns 01-001') || normalized.includes('ns 01001')) {
    references.push({
      norme: 'NS 01-001',
      chapter: 'Chapitre 1-7',
      article: 'Articles 1-15',
    });
  }
  
  if (normalized.includes('guide mfr') || normalized.includes('ménage')) {
    references.push({
      norme: 'Guide MFR',
      chapter: 'Chapitre 1-5',
    });
  }
  
  return references;
}

function extractRisks(message: string): RisqueIdentifie[] {
  const risks: RisqueIdentifie[] = [];
  const normalized = message.toLowerCase();
  
  // Détection des risques électriques
  if (normalized.includes('choc') || normalized.includes('électrique') || normalized.includes('electrique')) {
    risks.push({
      type: 'electrique',
      description: 'Risque de choc électrique',
      niveau: 'critique',
      mitigation: 'Utiliser des DDR et protections appropriées',
    });
  }
  
  if (normalized.includes('incendie') || normalized.includes('feu')) {
    risks.push({
      type: 'incendie',
      description: 'Risque d\'incendie',
      niveau: 'critique',
      mitigation: 'Respecter les sections de câble et protections',
    });
  }
  
  return risks;
}

function extractProcedureSteps(message: string): EtapeProcedure[] {
  const steps: EtapeProcedure[] = [];
  const lines = message.split('\n').filter((line) => line.trim());
  
  let stepNumber = 0;
  for (const line of lines) {
    const match = line.match(/^(\d+)[\.\)]\s*(.+)/);
    if (match) {
      stepNumber++;
      steps.push({
        numero: stepNumber,
        description: match[2].trim(),
      });
    }
  }
  
  return steps;
}

function detectVerdict(message: string): VerdictType | undefined {
  const normalized = message.toLowerCase();
  
  if (normalized.includes('conforme') && !normalized.includes('réserve')) {
    return 'Conforme';
  }
  if (normalized.includes('réserve') || normalized.includes('sous réserve')) {
    return 'Conforme sous réserve';
  }
  if (normalized.includes('non conforme') || normalized.includes('défectueux')) {
    return 'Non conforme';
  }
  if (normalized.includes('vérifier') || normalized.includes('contrôle')) {
    return 'A verifier';
  }
  
  return undefined;
}

function detectSeverity(message: string): SeverityType | undefined {
  const normalized = message.toLowerCase();
  
  if (normalized.includes('critique') || normalized.includes('dangereux') || normalized.includes('grave')) {
    return 'critique';
  }
  if (normalized.includes('majeur') || normalized.includes('important')) {
    return 'majeure';
  }
  if (normalized.includes('mineur') || normalized.includes('léger')) {
    return 'mineure';
  }
  if (normalized.includes('information') || normalized.includes('note')) {
    return 'information';
  }
  
  return undefined;
}

// ─────────────────────────────────────────────
// FONCTION PRINCIPALE D'ENRICHISSEMENT
// ─────────────────────────────────────────────

export function enrichResponse(
  response: AIResponse,
  context?: {
    roleUtilisateur?: string;
    moduleActif?: string;
    donneesContextuelles?: Record<string, unknown>;
  }
): AIResponse {
  // Si la réponse a déjà des métadonnées enrichies, la retourner telle quelle
  if (response.domaine || response.referencesCitees || response.risquesIdentifies) {
    return response;
  }
  
  const domaine = detectDomaine(response.message);
  const referencesCitees = extractReferences(response.message);
  const risquesIdentifies = extractRisks(response.message);
  const etapesProcedure = extractProcedureSteps(response.message);
  
  // Enrichir le verdict et la sévérité s'ils ne sont pas déjà définis
  const verdict = response.verdict || detectVerdict(response.message);
  const severity = response.severity || detectSeverity(response.message);
  
  return {
    ...response,
    domaine,
    referencesCitees,
    risquesIdentifies,
    etapesProcedure,
    verdict,
    severity,
    contexte: context || response.contexte,
    meta: {
      ...response.meta,
      confiance: 0.95, // Confiance par défaut pour les réponses enrichies
      sources: [...(response.meta?.sources || []), 'ELECTRICIAN_GUIDE', 'KOBO_STANDARDS'],
      version: '10.0',
      dateGeneration: new Date().toISOString(),
    },
  };
}

// ─────────────────────────────────────────────
// UTILITAIRES D'AFFICHAGE
// ─────────────────────────────────────────────

export function formatReferences(references: ReferenceCitee[]): string {
  return references
    .map((ref) => `${ref.norme}${ref.chapter ? ` - ${ref.chapter}` : ''}${ref.article ? ` (${ref.article})` : ''}`)
    .join(' | ');
}

export function formatRisks(risks: RisqueIdentifie[]): string {
  return risks.map((risk) => `${risk.type}: ${risk.description}`).join(' | ');
}

export function formatProcedureSteps(steps: EtapeProcedure[]): string {
  return steps.map((step) => `${step.numero}. ${step.description}`).join('\n');
}
