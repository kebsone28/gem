/**
 * Planning Helper Functions & Constants
 * Extracted from Planning.tsx to reduce component size
 */
import { format } from 'date-fns';

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

export const GANTT_WINDOW_DAYS = 21;

export const REGIONAL_CAPACITY_METRICS = [
  { actualKey: 'livraison', theoreticalKey: 'livraison', label: 'Livraison' },
  { actualKey: 'macons', theoreticalKey: 'macons', label: 'Maçons' },
  { actualKey: 'reseau', theoreticalKey: 'reseau', label: 'Réseau' },
  { actualKey: 'interieur_type1', theoreticalKey: 'interieur', label: 'Installation' },
  { actualKey: 'controle', theoreticalKey: 'controle', label: 'Contrôle' },
] as const;

export const TRADE_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Tous les métiers' },
  { value: 'logistique', label: 'Livraison' },
  { value: 'macons', label: 'Maçonnerie' },
  { value: 'reseau', label: 'Réseau' },
  { value: 'interieur_type1', label: 'Installation' },
  { value: 'controle', label: 'Contrôle' },
] as const;

export const GANTT_PHASE_METADATA = [
  {
    stageKey: 'FORMATION' as const,
    phase: undefined,
    label: 'Formation électricien',
    dependencies: [] as Array<
      'FORMATION' | 'LIVRAISON' | 'MACONNERIE' | 'RESEAU' | 'INSTALLATION' | 'CONTROLE'
    >,
    chipClass: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
    fillColor: '#f59e0b',
  },
  {
    stageKey: 'LIVRAISON' as const,
    phase: 'LIVRAISON' as const,
    label: 'Livraison matériel',
    dependencies: ['FORMATION'] as Array<
      'FORMATION' | 'LIVRAISON' | 'MACONNERIE' | 'RESEAU' | 'INSTALLATION' | 'CONTROLE'
    >,
    chipClass: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-200',
    fillColor: '#06b6d4',
  },
  {
    stageKey: 'MACONNERIE' as const,
    phase: 'MACONNERIE' as const,
    label: 'Travaux maçonnerie',
    dependencies: ['LIVRAISON'] as Array<
      'FORMATION' | 'LIVRAISON' | 'MACONNERIE' | 'RESEAU' | 'INSTALLATION' | 'CONTROLE'
    >,
    chipClass: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
    fillColor: '#f59e0b',
  },
  {
    stageKey: 'RESEAU' as const,
    phase: 'RESEAU' as const,
    label: 'Travaux réseau',
    dependencies: ['LIVRAISON'] as Array<
      'FORMATION' | 'LIVRAISON' | 'MACONNERIE' | 'RESEAU' | 'INSTALLATION' | 'CONTROLE'
    >,
    chipClass: 'border-blue-400/20 bg-blue-500/10 text-blue-200',
    fillColor: '#3b82f6',
  },
  {
    stageKey: 'INSTALLATION' as const,
    phase: 'INTERIEUR' as const,
    label: 'Travaux intérieur',
    dependencies: ['FORMATION', 'MACONNERIE', 'RESEAU'] as Array<
      'FORMATION' | 'LIVRAISON' | 'MACONNERIE' | 'RESEAU' | 'INSTALLATION' | 'CONTROLE'
    >,
    chipClass: 'border-violet-400/20 bg-violet-500/10 text-violet-200',
    fillColor: '#8b5cf6',
  },
  {
    stageKey: 'CONTROLE' as const,
    phase: 'CONTROLE' as const,
    label: 'Suivi contrôle et reporting',
    dependencies: ['INSTALLATION'] as Array<
      'FORMATION' | 'LIVRAISON' | 'MACONNERIE' | 'RESEAU' | 'INSTALLATION' | 'CONTROLE'
    >,
    chipClass: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    fillColor: '#10b981',
  },
] as const;

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface PlanningAiSection {
  title: string;
  items: string[];
}

export interface PlanningAiRecommendation {
  lead: string;
  sections: PlanningAiSection[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ──────────────────────────────────────────────────────────────────────────────

export const toDateInputValue = (date: Date): string => format(date, 'yyyy-MM-dd');

export const fromDateInputValue = (value: string): Date | null => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getPlanningRowStatusLabel = (row: {
  status: string;
  atRisk: boolean;
  isBlocked: boolean;
}): string => {
  if (row.isBlocked) return 'Bloqué';
  if (row.atRisk) return 'Sous tension';
  if (row.status === 'virtual') return 'Prévisionnel';
  if (row.status === 'inactive') return 'Inactive';
  return 'Planifié';
};

export const getPlanningRowStatusClass = (row: {
  status: string;
  atRisk: boolean;
  isBlocked: boolean;
}): string => {
  if (row.isBlocked) return 'text-rose-400';
  if (row.atRisk) return 'text-amber-400';
  if (row.status === 'virtual') return 'text-cyan-300';
  if (row.status === 'inactive') return 'text-slate-500';
  return 'text-emerald-400';
};

// ──────────────────────────────────────────────────────────────────────────────
// Text Processing Helpers for AI Recommendations
// ──────────────────────────────────────────────────────────────────────────────

function cleanMissionSageText(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/^"+|"+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitMissionSageItems(value: string): string[] {
  return value
    .split(/\s+(?=(?:\d+\.|-)\s+)/)
    .map((item) =>
      cleanMissionSageText(item)
        .replace(/^[-\d.\s]+/, '')
        .trim()
    )
    .filter(Boolean)
    .slice(0, 3);
}

export function formatPlanningAiRecommendation(message: string): PlanningAiRecommendation {
  const normalized = message.replace(/\r?\n/g, ' ').trim();
  const headingPattern = /\*\*([^*]+)\*\*/g;
  const matches = Array.from(normalized.matchAll(headingPattern));

  if (matches.length === 0) {
    const lead = cleanMissionSageText(normalized);
    return {
      lead: lead.length > 320 ? `${lead.slice(0, 320).trim()}...` : lead,
      sections: [],
    };
  }

  const firstHeadingIndex = matches[0].index ?? 0;
  const lead = cleanMissionSageText(normalized.slice(0, firstHeadingIndex));
  const sections = matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end =
        index + 1 < matches.length
          ? (matches[index + 1].index ?? normalized.length)
          : normalized.length;
      return {
        title: cleanMissionSageText(match[1]),
        items: splitMissionSageItems(normalized.slice(start, end)),
      };
    })
    .filter((section) => section.title && section.items.length > 0)
    .slice(0, 3);

  return {
    lead: lead || 'Synthèse MissionSage pour le planning opérationnel.',
    sections,
  };
}
