import { describe, expect, it } from 'vitest';
import {
    applyXlsFormCalculations,
    buildXlsFormDefinition,
    compareXlsFormDefinitions,
    getFilteredXlsFormChoices,
    getVisibleXlsFormFields,
    validateXlsFormValues
} from '../xlsFormEngine.js';

const buildSampleDefinition = () =>
    buildXlsFormDefinition({
        settings: {
            form_id: 'sample_audit',
            version: '2026-05-03',
            form_title: 'Audit universel'
        },
        survey: [
            { type: 'begin_group', name: 'menage', label: 'Menage' },
            { type: 'integer', name: 'numero', label: 'Numero', required: 'yes', constraint: '. > 0' },
            { type: 'select_one roles', name: 'role', label: 'Role', required: 'yes' },
            { type: 'select_one communes', name: 'commune', label: 'Commune', choice_filter: "region = ${region}" },
            { type: 'text', name: 'region', label: 'Region', required: 'yes' },
            { type: 'end_group' },
            { type: 'begin_repeat', name: 'photos', label: 'Photos' },
            { type: 'image', name: 'photo', label: 'Photo chantier', relevant: "${role} = 'controleur'" },
            { type: 'end_repeat' },
            { type: 'calculate', name: 'resume', calculation: "concat(${numero}, '-', ${role})" },
            { type: 'text', name: 'observation', label: 'Observation', relevant: "${role} = 'controleur'", required: 'yes' }
        ],
        choices: [
            { list_name: 'roles', name: 'macon', label: 'Macon' },
            { list_name: 'roles', name: 'controleur', label: 'Controleur' },
            { list_name: 'communes', name: 'dabo', label: 'Dabo', region: 'Kolda' },
            { list_name: 'communes', name: 'thies', label: 'Thies', region: 'Thies' }
        ]
    });

describe('universal XLSForm engine', () => {
    it('normalizes settings, groups, repeats, choices and diagnostics', () => {
        const definition = buildSampleDefinition();

        expect(definition.formKey).toBe('sample_audit');
        expect(definition.formVersion).toBe('2026-05-03');
        expect(definition.groups).toHaveLength(1);
        expect(definition.repeats).toHaveLength(1);
        expect(definition.choices.roles).toHaveLength(2);
        expect(definition.diagnostics).toMatchObject({
            fieldCount: 7,
            repeatCount: 1,
            choiceFilterCount: 1,
            constraintCount: 1
        });
    });

    it('evaluates relevant, required and constraints', () => {
        const definition = buildSampleDefinition();
        const visibleForMacon = getVisibleXlsFormFields(definition, {
            numero: 1,
            role: 'macon',
            region: 'Kolda'
        }).map((field) => field.name);

        expect(visibleForMacon).not.toContain('observation');
        expect(visibleForMacon).not.toContain('photo');

        const invalid = validateXlsFormValues(definition, {
            numero: 0,
            role: 'controleur',
            region: 'Kolda'
        });
        expect(invalid.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'numero', type: 'constraint' }),
            expect.objectContaining({ field: 'observation', type: 'required' })
        ]));
    });

    it('filters choices with choice_filter expressions', () => {
        const definition = buildSampleDefinition();

        expect(getFilteredXlsFormChoices(definition, 'commune', { region: 'Kolda' }).map((choice) => choice.name)).toEqual(['dabo']);
        expect(getFilteredXlsFormChoices(definition, 'commune', { region: 'Thies' }).map((choice) => choice.name)).toEqual(['thies']);
    });

    it('applies basic calculations', () => {
        const definition = buildSampleDefinition();

        expect(applyXlsFormCalculations(definition, { numero: 26, role: 'macon' }).values.resume).toBe('26-macon');
    });

    it('applies Kobo-style pulldata and calculation columns on visible questions', () => {
        const definition = buildXlsFormDefinition({
            settings: { form_id: 'pulldata_runtime', version: '2026-05-03' },
            survey: [
                { type: 'integer', name: 'Numero_ordre', label: 'Numero ordre', required: 'yes' },
                { type: 'calculate', name: 'C1', calculation: "pulldata('Thies','nom','code_key',${Numero_ordre})" },
                { type: 'text', name: 'nom_key', label: 'Prenom et nom', required: 'yes', calculation: '${C1}' }
            ]
        });

        const values = applyXlsFormCalculations(definition, {
            Numero_ordre: '4526',
            _gem_pulldata_Thies: {
                code_key: '4526',
                nom: 'Menage test'
            }
        }).values;

        expect(values.C1).toBe('Menage test');
        expect(values.nom_key).toBe('Menage test');
        expect(definition.fields.find((field) => field.name === 'nom_key')?.readOnly).toBe(true);
        expect(validateXlsFormValues(definition, values).requiredMissing).toEqual([]);
    });

    it('repairs the known earth-resistance observation branch from the active Kobo form', () => {
        const definition = buildXlsFormDefinition({
            settings: { form_id: 'terre_runtime', version: '2026-05-03' },
            survey: [
                { type: 'select_one etat', name: 'VALEUR_DE_LA_RESISTANCE_DE_TER', label: 'Terre', required: 'yes' },
                {
                    type: 'integer',
                    name: 'OBSERVATIONS__007',
                    label: 'Valeur de terre',
                    required: 'yes',
                    relevant: "${VALEUR_DE_LA_RESISTANCE_DE_TER} = 'conforme' and ${VALEUR_DE_LA_RESISTANCE_DE_TER} = 'non_conforme'"
                }
            ],
            choices: [
                { list_name: 'etat', name: 'conforme', label: 'Conforme' },
                { list_name: 'etat', name: 'non_conforme', label: 'Non conforme' }
            ]
        });

        const visible = getVisibleXlsFormFields(definition, {
            VALEUR_DE_LA_RESISTANCE_DE_TER: 'conforme'
        }).map((field) => field.name);

        expect(visible).toContain('OBSERVATIONS__007');
        expect(validateXlsFormValues(definition, {
            VALEUR_DE_LA_RESISTANCE_DE_TER: 'conforme'
        }).requiredMissing).toContain('OBSERVATIONS__007');
    });

    it('supports mobile media field types and arithmetic calculations', () => {
        const definition = buildXlsFormDefinition({
            settings: {
                form_id: 'media_runtime',
                version: '2026-05-03'
            },
            survey: [
                { type: 'integer', name: 'kits', label: 'Kits', required: 'yes' },
                { type: 'decimal', name: 'prix', label: 'Prix' },
                { type: 'calculate', name: 'total', calculation: '${kits} * ${prix}' },
                { type: 'signature', name: 'signature_menage', label: 'Signature' },
                { type: 'audio', name: 'audio_note', label: 'Audio' },
                { type: 'video', name: 'video_chantier', label: 'Video' },
                { type: 'file', name: 'piece_jointe', label: 'Piece jointe' }
            ]
        });

        expect(definition.diagnostics.unsupportedTypes).toEqual([]);
        expect(definition.diagnostics.mediaCount).toBe(4);
        expect(applyXlsFormCalculations(definition, { kits: 3, prix: 12.5 }).values.total).toBe(37.5);
    });

    it('validates repeat instances instead of forcing repeat fields at root level', () => {
        const definition = buildXlsFormDefinition({
            settings: { form_id: 'repeat_runtime', version: '2026-05-03' },
            survey: [
                { type: 'begin_repeat', name: 'visites', label: 'Visites' },
                { type: 'text', name: 'observation', label: 'Observation', required: 'yes' },
                { type: 'integer', name: 'quantite', label: 'Quantite', constraint: '. > 0' },
                { type: 'end_repeat' }
            ]
        });

        expect(validateXlsFormValues(definition, { visites: [{ observation: 'ok', quantite: 2 }] }).issues).toEqual([]);
        expect(validateXlsFormValues(definition, { visites: [{ quantite: 0 }] }).issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'observation', type: 'required', repeatName: 'visites', repeatIndex: 0 }),
            expect.objectContaining({ field: 'quantite', type: 'constraint', repeatName: 'visites', repeatIndex: 0 })
        ]));
    });

    it('compares form versions with field and choice deltas', () => {
        const previous = buildSampleDefinition();
        const current = buildXlsFormDefinition({
            settings: {
                form_id: 'sample_audit',
                version: '2026-05-04',
                form_title: 'Audit universel'
            },
            survey: [
                { type: 'integer', name: 'numero', label: 'Numero menage', required: 'yes', constraint: '. > 0' },
                { type: 'select_one roles', name: 'role', label: 'Role', required: 'yes' },
                { type: 'text', name: 'nouveau_champ', label: 'Nouveau champ' }
            ],
            choices: [
                { list_name: 'roles', name: 'macon', label: 'Macon terrain' },
                { list_name: 'roles', name: 'livreur', label: 'Livreur' }
            ]
        });

        const comparison = compareXlsFormDefinitions(previous, current);

        expect(comparison.summary).toMatchObject({
            fieldsAdded: 1,
            fieldsRemoved: 5,
            fieldsChanged: 2,
            choicesAdded: 1,
            choicesRemoved: 3,
            choicesChanged: 1
        });
        expect(comparison.fields.added[0]).toMatchObject({ name: 'nouveau_champ' });
        expect(comparison.choices.changed[0]).toMatchObject({ name: 'macon' });
    });
});
