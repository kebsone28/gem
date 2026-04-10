import type { Household } from './types';

// ── Mapping des couleurs pour les 7 statuts ──
export const STATUS_TO_HEX_COLOR: Record<string, string> = {
  'Contrôle conforme': '#10b981', // Vert émeraude
  'Non conforme': '#f43f5e', // Rouge rose
  'Non éligible': '#64748b', // Slate 500
  Désistement: '#64748b', // Slate 500
  Eligible: '#3b82f6', // Bleu
  Installé: '#10b981', // Vert
  Refusé: '#f43f5e', // Rouge
  'Intérieur terminé': '#818cf8', // Indigo clair
  'Réseau terminé': '#3b82f6', // Bleu
  'Murs terminés': '#f59e0b', // Orange/Ambre
  'Livraison effectuée': '#06b6d4', // Cyan
  'Non encore commencé': '#94a3b8', // Slate/Gris
  'En attente': '#94a3b8', // Gris
  'Non débuté': '#94a3b8', // Gris
};

export const STATUS_TO_TAILWIND_COLORS: Record<string, { text: string; bg: string }> = {
  'Contrôle conforme': { text: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  'Non conforme': { text: 'text-rose-500', bg: 'bg-rose-500/10' },
  'Non éligible': { text: 'text-slate-500', bg: 'bg-slate-500/10' },
  Désistement: { text: 'text-slate-500', bg: 'bg-slate-500/10' },
  Eligible: { text: 'text-blue-500', bg: 'bg-blue-500/10' },
  Installé: { text: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  Refusé: { text: 'text-rose-500', bg: 'bg-rose-500/10' },
  'Intérieur terminé': { text: 'text-blue-400', bg: 'bg-blue-400/10' },
  'Réseau terminé': { text: 'text-blue-500', bg: 'bg-blue-500/10' },
  'Murs terminés': { text: 'text-amber-500', bg: 'bg-amber-500/10' },
  'Livraison effectuée': { text: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  'Non encore commencé': { text: 'text-slate-500', bg: 'bg-slate-500/10' },
  'En attente': { text: 'text-slate-500', bg: 'bg-slate-500/10' },
  'Non débuté': { text: 'text-slate-500', bg: 'bg-slate-500/10' },
};

/**
 * Normalisation robuste des statuts Kobo
 */
const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')

    .replace(/[\u0300-\u036f]/g, '');

export const normalizeStatus = (status?: string): string => {
  if (!status) return 'Inconnu';

  const s = normalizeText(status);

  // Priorité haute pour éviter les collisions de "non"
  if (s.includes('non eligible') || s.includes('inelegible') || s.includes('ineligi'))
    return 'Non éligible';
  if (s.includes('desist')) return 'Désistement';
  if (s.includes('refus')) return 'Refusé';

  if (s.includes('non conforme')) return 'Non conforme';
  if (s.includes('conforme')) return 'Contrôle conforme';
  if (s.includes('termine')) return 'Contrôle conforme';

  if (s.includes('install')) return 'Installé';
  if (s.includes('eligible')) return 'Eligible';

  if (s.includes('interieur')) return 'Intérieur terminé';
  if (s.includes('reseau')) return 'Réseau terminé';
  if (s.includes('mur')) return 'Murs terminés';
  if (s.includes('livraison')) return 'Livraison effectuée';

  if (s.includes('non debut') || s.includes('non demarr') || s.includes('pending'))
    return 'Non débuté';

  if (s.includes('attente') || s.includes('plan')) return 'En attente';

  return 'Inconnu';
};

/**
 * Obtenir la couleur hex d'un statut
 */
export const getStatusHexColor = (status?: string): string => {
  const normalized = normalizeStatus(status);
  return STATUS_TO_HEX_COLOR[normalized] ?? '#94a3b8';
};

/**
 * Obtenir les classes Tailwind CSS pour un statut (texte + fond)
 */
export const getStatusTailwindClasses = (status?: string) => {
  const normalized = normalizeStatus(status);
  return (
    STATUS_TO_TAILWIND_COLORS[normalized] ?? {
      text: 'text-slate-500',
      bg: 'bg-slate-500/10',
    }
  );
};

export const getHouseholdDerivedStatus = (h: Household) => {
  if (!h) return 'Non encore commencé';

  // 1. Statuts bloquants et normalisés
  const normalized = normalizeStatus(h.status);
  if (['Non éligible', 'Désistement', 'Refusé'].includes(normalized)) return normalized;

  // 2. Alertes critiques
  const alerts = Array.isArray(h.alerts) ? h.alerts : [];
  if (alerts.some((a) => a.severity === 'HIGH' || a.type === 'CRITICAL')) return 'Non conforme';

  // 3. Nouvelle architecture (constructionData)
  const cData = h.constructionData as any;
  if (cData) {
    if (
      cData.audit?.installation_conforme === 'conforme' ||
      cData.audit?.branchement_conforme === 'conforme' ||
      normalized === 'Contrôle conforme'
    ) {
      return 'Contrôle conforme';
    }

    if (
      cData.audit?.installation_conforme === 'non_conforme' ||
      cData.audit?.branchement_conforme === 'non-conforme' ||
      h.status === 'BLOQUE'
    ) {
      return 'Non conforme';
    }

    if (cData.interiorStatus === 'COMPLETE') return 'Intérieur terminé';
    if (cData.networkStatus === 'COMPLETE') return 'Réseau terminé';
    if (['STANDARD', 'CHIMNEY'].includes(String(cData.wallType))) return 'Murs terminés';
    if (cData.kit?.status === 'COMPLETE') return 'Livraison effectuée';
  }

  // 4. Ancien système Kobo
  if (h.koboSync?.controleOk === true) return 'Contrôle conforme';
  if (h.koboSync?.controleOk === false) return 'Non conforme';
  if (h.koboSync?.interieurOk) return 'Intérieur terminé';
  if (h.koboSync?.reseauOk) return 'Réseau terminé';
  if (h.koboSync?.maconOk) return 'Murs terminés';
  if (h.koboSync?.livreurDate) return 'Livraison effectuée';

  // 5. Statut brut fallback
  if (h.status) {
    const finalStatus = normalizeStatus(h.status);
    if (finalStatus !== 'Inconnu') return finalStatus;
  }

  return 'Non encore commencé';
};
