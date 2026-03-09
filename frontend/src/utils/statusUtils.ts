import type { Household } from './types';

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
