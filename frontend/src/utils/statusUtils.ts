import type { Household } from './types';

// ── Mapping des couleurs pour les 7 statuts ──
export const STATUS_TO_HEX_COLOR: Record<string, string> = {
    'Contrôle conforme': '#10b981',      // Vert émeraude
    'Non conforme': '#f43f5e',           // Rouge rose
    'Intérieur terminé': '#818cf8',      // Indigo clair
    'Réseau terminé': '#3b82f6',         // Bleu
    'Murs terminés': '#f59e0b',          // Orange/Ambre
    'Livraison effectuée': '#06b6d4',    // Cyan
    'Non encore commencé': '#94a3b8',    // Slate/Gris
    'En attente': '#94a3b8',             // Gris (identique à Non encore commencé)
    'Non débuté': '#94a3b8'              // Gris
};

export const STATUS_TO_TAILWIND_COLORS: Record<string, { text: string; bg: string }> = {
    'Contrôle conforme': { text: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    'Non conforme': { text: 'text-rose-500', bg: 'bg-rose-500/10' },
    'Intérieur terminé': { text: 'text-blue-400', bg: 'bg-blue-400/10' },
    'Réseau terminé': { text: 'text-blue-500', bg: 'bg-blue-500/10' },
    'Murs terminés': { text: 'text-amber-500', bg: 'bg-amber-500/10' },
    'Livraison effectuée': { text: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    'Non encore commencé': { text: 'text-slate-500', bg: 'bg-slate-500/10' },
    'En attente': { text: 'text-slate-500', bg: 'bg-slate-500/10' },
    'Non débuté': { text: 'text-slate-500', bg: 'bg-slate-500/10' }
};

/**
 * Obtenir la couleur hex d'un statut
 */
export const getStatusHexColor = (status?: string): string => {
    if (!status) return '#94a3b8';
    const match = Object.entries(STATUS_TO_HEX_COLOR).find(
        ([k]) => status.includes(k) || k.includes(status)
    );
    return match ? match[1] : '#94a3b8';
};

/**
 * Obtenir les classes Tailwind CSS pour un statut (texte + fond)
 */
export const getStatusTailwindClasses = (status?: string) => {
    if (!status) return { text: 'text-slate-500', bg: 'bg-slate-500/10' };
    
    // Chercher une correspondance directe
    for (const [statusKey, colors] of Object.entries(STATUS_TO_TAILWIND_COLORS)) {
        if (status.includes(statusKey) || statusKey.includes(status)) {
            return colors;
        }
    }
    
    return { text: 'text-slate-500', bg: 'bg-slate-500/10' };
};

export const getHouseholdDerivedStatus = (h: Household) => {
    // 1. Contrôle final
    if (h.koboSync?.controleOk === true) return 'Contrôle conforme';
    if (h.koboSync?.controleOk === false) return 'Non conforme';

    // 2. Progression des travaux (ordre chronologique inverse)
    if (h.koboSync?.interieurOk) return 'Intérieur terminé';
    if (h.koboSync?.reseauOk) return 'Réseau terminé';
    if (h.koboSync?.maconOk) return 'Murs terminés';

    // 3. Logistique
    if (h.koboSync?.livreurDate) return 'Livraison effectuée';

    // 4. Par défaut / Status API brut si défini et pertinent, sinon "Non encore commencé"
    if (h.status && h.status !== 'Non débuté' && h.status !== 'Pending') {
        return h.status;
    }

    return 'Non encore commencé';
};
