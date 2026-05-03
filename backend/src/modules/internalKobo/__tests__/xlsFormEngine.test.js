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
