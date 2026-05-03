import { describe, expect, it } from 'vitest';
import { getServerRequiredMissing } from '../internalKobo.validation.js';

const BASE_VALUES = {
    Numero_ordre: '26',
    nom_key: 'Aladji Sow',
    telephone_key: '771234567',
    latitude_key: '13.4332708',
    longitude_key: '-13.6843772',
    region_key: 'Kolda',
    LOCALISATION_CLIENT: '13.4332708 -13.6843772'
};

describe('internal Kobo server validation', () => {
    it('requires household identity and role before any role section can close', () => {
        expect(getServerRequiredMissing({})).toEqual([
            'Numero_ordre',
            'nom_key',
            'telephone_key',
            'latitude_key',
            'longitude_key',
            'region_key',
            'LOCALISATION_CLIENT',
            'role'
        ]);
    });

    it('blocks macon completion until the selected branch and final acknowledgement are filled', () => {
        expect(getServerRequiredMissing({ ...BASE_VALUES, role: 'macon' })).toContain('kit_disponible_macon');

        expect(
            getServerRequiredMissing({
                ...BASE_VALUES,
                role: 'macon',
                kit_disponible_macon: 'oui'
            })
        ).toEqual(expect.arrayContaining(['type_mur_realise_macon', 'notes_generales']));

        expect(
            getServerRequiredMissing({
                ...BASE_VALUES,
                role: 'macon',
                kit_disponible_macon: 'oui',
                type_mur_realise_macon: 'mur_termine',
                notes_generales: 'RAS',
                validation_macon_final: false
            })
        ).toContain('validation_macon_final');

        expect(
            getServerRequiredMissing({
                ...BASE_VALUES,
                role: 'macon',
                kit_disponible_macon: 'oui',
                type_mur_realise_macon: 'mur_termine',
                notes_generales: 'RAS',
                validation_macon_final: true
            })
        ).toEqual([]);
    });

    it('keeps the final controller acknowledgement locked behind the earth value and observation', () => {
        const controlBase = {
            ...BASE_VALUES,
            role: 'controleur',
            ETAT_DE_L_INSTALLATION: 'terminee',
            Phase_de_controle: 'controle_final',
            ETAT_BRANCHEMENT: 'non_termine',
            OBSERVATION: ['branchement_absent'],
            DISJONCTEUR_GENERAL_EN_TETE_D_: 'conforme',
            TYPE_DE_DISJONCTEUR_GENERAL: 'differentiel',
            ENSEMBLE_DE_L_INSTALLATION_PRO: 'conforme',
            PROTECTION_L_ORIGINE_DE_CHAQ: 'conforme',
            S_PARATION_DES_CIRCUITS_Lumi_: 'conforme',
            PROTECTION_CONTRE_LES_CONTACTS: 'conforme',
            MISE_EN_OEUVRE_MAT_RIEL_ET_APP: 'conforme',
            CONTINUITE_DE_LA_PROTECTION_ME: 'conforme',
            MISE_EN_UVRE_DU_R_SEAU_DE_TER: 'conforme',
            notes_generales: 'RAS'
        };

        const withoutEarthValue = getServerRequiredMissing(controlBase);
        expect(withoutEarthValue).toContain('VALEUR_DE_LA_RESISTANCE_DE_TER');
        expect(withoutEarthValue).not.toContain('OBSERVATIONS__007');
        expect(withoutEarthValue).not.toContain('validation_controleur_final');

        const withoutEarthObservation = getServerRequiredMissing({
            ...controlBase,
            VALEUR_DE_LA_RESISTANCE_DE_TER: 'conforme'
        });
        expect(withoutEarthObservation).toContain('OBSERVATIONS__007');
        expect(withoutEarthObservation).not.toContain('validation_controleur_final');

        const withoutFinalAck = getServerRequiredMissing({
            ...controlBase,
            VALEUR_DE_LA_RESISTANCE_DE_TER: 'conforme',
            OBSERVATIONS__007: '8'
        });
        expect(withoutFinalAck).toContain('validation_controleur_final');

        expect(
            getServerRequiredMissing({
                ...controlBase,
                VALEUR_DE_LA_RESISTANCE_DE_TER: 'conforme',
                OBSERVATIONS__007: '8',
                validation_controleur_final: 'yes'
            })
        ).toEqual([]);
    });

    it('accepts exact Kobo aliases for legacy XLSForm field names', () => {
        const missing = getServerRequiredMissing({
            ...BASE_VALUES,
            role: 'livreur',
            Situation_du_M_nage: 'menage_eligible',
            'Longueur_câble_2_5mm_Int_rieure': 12,
            'Longueur_câble_1_5mm_Int_rieure': 8,
            'Longueur_Tranch_e_câble_arm_4mm': 3,
            Longueur_Tranch_e_C_ble_arm_1_5mm: 2,
            Je_confirme_la_remis_u_materiel_au_m_nage: true,
            Je_confirme_le_marqu_osition_des_coffrets: true,
            Je_confirme_le_marqu_s_coffret_lectrique: true,
            notes_generales: 'RAS'
        });

        expect(missing).toEqual([]);
    });
});
