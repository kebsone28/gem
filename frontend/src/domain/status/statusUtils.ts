import { STATUS_META, type StatusKey } from './statusRegistry';

// Normalize helper partagé depuis l'ancien fichier
const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const normalizeStatus = (status?: string): string => {
  if (!status) return 'Inconnu';

  const s = normalizeText(status);

  // 1. STATUTS NÉGATIFS (Prioritaires)
  if (s.includes('non eligible') || s.includes('inelegible') || s.includes('ineligi'))
    return 'Non éligible';
  if (s.includes('desist')) return 'Désistement';
  if (s.includes('refus')) return 'Refusé';

  // 2. STATUT "NON ENCORE" (Doit être vérifié AVANT "installé")
  if (
    s.includes('non encore install') || 
    s.includes('pas encore install') ||
    s.includes('non install') ||
    s.includes('non debut') || 
    s.includes('pas debut') || 
    s.includes('non demarr') || 
    s.includes('non commenc') ||
    s.includes('pending') ||
    s.includes('a faire') ||
    s.includes('nouveau') ||
    s.includes('start') ||
    s.includes('non fait')
  )
    return 'Non encore installée';

  // 3. STATUTS POSITIFS / CHANTIER
  if (s.includes('non conforme')) return 'Non conforme';
  if (s.includes('conforme')) return 'Contrôle conforme';
  if (s.includes('termine')) return 'Contrôle conforme';
  if (s.includes('install')) return 'Installé'; 
  if (s.includes('eligible')) return 'Eligible';

  if (s.includes('interieur')) return 'Intérieur terminé';
  if (s.includes('reseau')) return 'Réseau terminé';
  if (s.includes('mur')) return 'Murs terminés';
  if (s.includes('livraison')) return 'Livraison effectuée';

  if (s.includes('attente') || s.includes('plan')) return 'En attente';

  return 'Inconnu';
};

export const getStatusMeta = (status?: string) => {
  const normalized = normalizeStatus(status);
  
  if (!normalized || !(normalized in STATUS_META)) {
    return {
      label: 'Inconnu',
      color: 'text-slate-500',
      bg: 'bg-slate-500/10',
      order: -1,
    };
  }

  return STATUS_META[normalized as StatusKey];
};

/**
 * LOGIQUE MÉTIER: Retour en arrière interdit
 */
export const canTransition = (from?: string, to?: string): boolean => {
  const fromMeta = getStatusMeta(from);
  const toMeta = getStatusMeta(to);

  // Un statut final ne devrait théoriquement plus bouger sauf override admin fort
  if (fromMeta.isFinal && !toMeta.isFinal) return false;
  
  // Règle générale: on ne régresse pas dans l'order
  return toMeta.order >= Math.max(fromMeta.order, 0);
};

export const getNextStatuses = (current?: string) => {
  return Object.entries(STATUS_META)
    .filter(([key]) => canTransition(current, key))
    .map(([key, meta]) => ({
      value: key,
      label: meta.label,
    }));
};
