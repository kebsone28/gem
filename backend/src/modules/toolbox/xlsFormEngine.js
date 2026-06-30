import crypto from 'node:crypto';
import ExcelJS from 'exceljs';

import { isTruthyXls } from './xlsFormShared.js';

export { evaluateXlsFormExpression } from './xlsFormShared.js';
export { applyXlsFormCalculations } from './calculateEngine.js';
export {
    validateXlsFormValues,
    isXlsFormFieldVisible,
    getVisibleXlsFormFields,
    getFilteredXlsFormChoices,
    parseGeopoint,
    isValidLatitude,
    isValidLongitude,
    getInheritedRelevant
} from './constraintEngine.js';

export const XLSFORM_ENGINE_VERSION = '1.0.0';

const FIELD_TYPES_WITH_CHOICES = new Set(['select_one', 'select_multiple']);
const CONTROL_TYPES = new Set([
    'begin_group',
    'end_group',
    'begin_repeat',
    'end_repeat',
    'calculate',
    'note'
]);

function normalizeKey(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^\w.-]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function cellValueToString(rawValue) {
    if (rawValue === undefined || rawValue === null) return '';
    if (typeof rawValue === 'object') {
        if (rawValue.text !== undefined) return String(rawValue.text);
        if (rawValue.result !== undefined) return String(rawValue.result);
        if (Array.isArray(rawValue.richText)) {
            return rawValue.richText.map((part) => part.text || '').join('');
        }
        if (rawValue.hyperlink && rawValue.text) return String(rawValue.text);
    }
    return String(rawValue);
}

function getWorksheetJson(workbook, sheetName) {
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) return [];

    const headers = [];
    worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, index) => {
        headers[index] = cellValueToString(cell.value).trim();
    });

    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const item = {};
        headers.forEach((header, index) => {
            if (!header) return;
            item[header] = cellValueToString(row.getCell(index).value).trim();
        });
        if (Object.values(item).some((value) => String(value ?? '').trim() !== '')) {
            rows.push(item);
        }
    });

    return rows;
}

function extractLanguages(rows) {
    const languages = new Set();
    rows.forEach((row) => {
        Object.keys(row).forEach((key) => {
            const match = key.match(/^(label|hint|constraint_message|media::image)::(.+)$/i);
            if (match?.[2]) languages.add(match[1].trim());
        });
    });
    return Array.from(languages);
}

function multilingualValue(row, baseKey) {
    const translations = {};
    Object.entries(row).forEach(([key, value]) => {
        const match = key.match(new RegExp(`^${baseKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}::(.+)$`, 'i'));
        if (match?.[1] && String(value || '').trim()) {
            translations[match[1].trim()] = String(value).trim();
        }
    });

    const defaultValue = String(row[baseKey] || '').trim() || Object.values(translations)[0] || '';
    return {
        default: defaultValue,
        translations
    };
}

function parseQuestionType(typeValue) {
    const rawType = String(typeValue || '').trim();
    const normalizedRawType = rawType.toLowerCase().replace(/\s+/g, '_');
    const [baseType, ...rest] = rawType.split(/\s+/);
    const normalizedBase = baseType.toLowerCase();
    const listName = rest.join(' ').trim();

    if (normalizedRawType === 'begin_group') return { rawType, type: 'begin_group', listName: '', external: false };
    if (normalizedRawType === 'end_group') return { rawType, type: 'end_group', listName: '', external: false };
    if (normalizedRawType === 'begin_repeat') return { rawType, type: 'begin_repeat', listName: '', external: false };
    if (normalizedRawType === 'end_repeat') return { rawType, type: 'end_repeat', listName: '', external: false };

    if (normalizedBase === 'select_one_from_file') {
        return { rawType, type: 'select_one', listName, external: true };
    }

    if (normalizedBase === 'select_multiple_from_file') {
        return { rawType, type: 'select_multiple', listName, external: true };
    }

    if (normalizedBase === 'select_one' || normalizedBase === 'select_multiple') {
        return { rawType, type: normalizedBase, listName, external: false };
    }

    return { rawType, type: normalizedBase || 'text', listName: '', external: false };
}

function normalizeChoice(row, index) {
    const label = multilingualValue(row, 'label');
    const mediaImage = multilingualValue(row, 'media::image');
    const reservedKeys = new Set(['list_name', 'name', 'label', 'media::image']);
    const attributes = {};

    Object.entries(row).forEach(([key, value]) => {
        if (reservedKeys.has(key) || key.includes('::')) return;
        if (String(value || '').trim()) attributes[key] = value;
    });

    return {
        index,
        name: String(row.name || '').trim(),
        label: label.default,
        labels: label.translations,
        mediaImage: mediaImage.default,
        mediaImages: mediaImage.translations,
        ...attributes
    };
}

export function buildXlsFormDefinition({ survey = [], choices = [], settings = {}, source = {} }) {
    const languages = extractLanguages([...survey, ...choices]);
    const sourceFormName = source.fileName
        ? String(source.fileName).replace(/\.(xlsx|xls)$/i, '')
        : '';
    const rawFormKey =
        settings.form_id ||
        settings.id_string ||
        settings.form_title ||
        settings.title ||
        sourceFormName ||
        `xlsform_${crypto.randomUUID()}`;
    const formKey = normalizeKey(rawFormKey) || `xlsform_${crypto.randomUUID()}`;
    const formVersion = String(settings.version || settings.form_version || settings.form_id || '').trim() || 'unversioned';

    const groupedChoices = {};
    choices.forEach((choiceRow, index) => {
        const listName = String(choiceRow.list_name || choiceRow.listName || choiceRow['list name'] || '').trim();
        const name = String(choiceRow.name || '').trim();
        if (!listName || !name) return;
        if (!groupedChoices[listName]) groupedChoices[listName] = [];
        groupedChoices[listName].push(normalizeChoice(choiceRow, groupedChoices[listName].length || index));
    });

    const groups = [];
    const repeats = [];
    const fields = [];
    const rows = [];
    const stack = [];
    const unsupportedTypes = new Set();

    survey.forEach((row, index) => {
        const parsedType = parseQuestionType(row.type);
        const name = String(row.name || '').trim() || `row_${index + 1}`;
        const label = multilingualValue(row, 'label');
        const hint = multilingualValue(row, 'hint');
        const constraintMessage = multilingualValue(row, 'constraint_message');
        const currentPath = stack.map((item) => item.name).join('/');
        const parentRelevant = stack.map((item) => item.relevant).filter(Boolean);
        const item = {
            index,
            rowNumber: index + 2,
            name,
            type: parsedType.type,
            rawType: parsedType.rawType,
            label: label.default || name,
            labels: label.translations,
            hint: hint.default,
            hints: hint.translations,
            relevant: String(row.relevant || '').trim(),
            parentRelevant,
            constraint: String(row.constraint || '').trim(),
            constraintMessage: constraintMessage.default,
            constraintMessages: constraintMessage.translations,
            required: isTruthyXls(row.required),
            requiredExpression: !isTruthyXls(row.required) && String(row.required || '').trim()
                ? String(row.required).trim()
                : '',
            defaultValue: row.default || row['default'] || '',
            calculation: row.calculation || row.calculate || '',
            appearance: row.appearance || '',
            parameters: row.parameters || '',
            choiceFilter: row.choice_filter || row.choiceFilter || '',
            listName: parsedType.listName,
            external: parsedType.external,
            readOnly: isTruthyXls(row.readonly || row.read_only) || Boolean(row.calculation && parsedType.type !== 'calculate'),
            groupPath: currentPath,
            repeatPath: stack.filter((entry) => entry.type === 'begin_repeat').map((entry) => entry.name).join('/'),
            bind: {
                required: row.required || '',
                readonly: row.readonly || row.read_only || '',
                relevant: row.relevant || '',
                constraint: row.constraint || ''
            }
        };

        rows.push(item);

        if (parsedType.type === 'begin_group' || parsedType.type === 'begin_repeat') {
            const group = {
                ...item,
                path: currentPath ? `${currentPath}/${name}` : name,
                depth: stack.length
            };
            if (parsedType.type === 'begin_repeat') repeats.push(group);
            else groups.push(group);
            stack.push(group);
            return;
        }

        if (parsedType.type === 'end_group' || parsedType.type === 'end_repeat') {
            stack.pop();
            return;
        }

        if (!CONTROL_TYPES.has(parsedType.type) && ![
            'text',
            'integer',
            'decimal',
            'range',
            'geopoint',
            'geotrace',
            'geoshape',
            'image',
            'signature',
            'file',
            'audio',
            'video',
            'date',
            'time',
            'datetime',
            'select_one',
            'select_multiple',
            'acknowledge',
            'rank',
            'barcode',
            'hidden',
            'xml-external',
            'xml_external',
            'start',
            'end',
            'today',
            'username',
            'phonenumber',
            'deviceid',
            'subscriberid',
            'simserial',
            'audit'
        ].includes(parsedType.type)) {
            unsupportedTypes.add(parsedType.rawType || parsedType.type);
        }

        fields.push(item);
    });

    const diagnostics = {
        fieldCount: fields.length,
        rowCount: rows.length,
        questionCount: fields.filter((field) => !['note', 'calculate'].includes(field.type)).length,
        choiceCount: Object.values(groupedChoices).reduce((sum, list) => sum + list.length, 0),
        choiceListCount: Object.keys(groupedChoices).length,
        requiredCount: fields.filter((field) => field.required || field.requiredExpression).length,
        relevantCount: fields.filter((field) => field.relevant || field.parentRelevant.length > 0).length,
        constraintCount: fields.filter((field) => field.constraint).length,
        calculateCount: fields.filter((field) => field.type === 'calculate' || field.calculation).length,
        choiceFilterCount: fields.filter((field) => field.choiceFilter).length,
        groupCount: groups.length,
        repeatCount: repeats.length,
        imageCount: fields.filter((field) => field.type === 'image').length,
        mediaCount: fields.filter((field) => ['image', 'signature', 'file', 'audio', 'video'].includes(field.type)).length,
        externalChoiceCount: fields.filter((field) => field.external).length,
        languages,
        unsupportedTypes: Array.from(unsupportedTypes)
    };

    return {
        engine: 'ged-os-xlsform-universal',
        engineVersion: XLSFORM_ENGINE_VERSION,
        formKey,
        formVersion,
        title: String(settings.form_title || settings.title || formKey).trim(),
        defaultLanguage: settings.default_language || settings.defaultLanguage || '',
        importedAt: new Date().toISOString(),
        settings,
        fields,
        rows,
        groups,
        repeats,
        choices: groupedChoices,
        fieldNames: fields.map((field) => field.name),
        capabilities: [
            'survey',
            'choices',
            'settings',
            'relevant',
            'required',
            'constraint',
            'calculate-basic',
            'choice_filter',
            'groups',
            'repeats',
            'media',
            'multilingual',
            'rare-types'
        ],
        diagnostics,
        source
    };
}

export async function parseXlsFormBuffer(buffer, source = {}) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const survey = getWorksheetJson(workbook, 'survey');
    const choices = getWorksheetJson(workbook, 'choices');
    const settingsRows = getWorksheetJson(workbook, 'settings');

    return buildXlsFormDefinition({
        survey,
        choices,
        settings: settingsRows[0] || {},
        source
    });
}

function buildFieldSignature(field = {}) {
    return [
        field.type || '',
        field.rawType || '',
        field.label || '',
        field.listName || '',
        field.relevant || '',
        field.requiredExpression || '',
        field.required === true ? 'required' : '',
        field.constraint || '',
        field.choiceFilter || '',
        field.calculation || '',
        field.groupPath || '',
        field.repeatPath || ''
    ].join('|');
}

function buildChoiceSignature(choice = {}) {
    return JSON.stringify({
        label: choice.label || '',
        mediaImage: choice.mediaImage || '',
        attributes: Object.fromEntries(
            Object.entries(choice)
                .filter(([key]) => !['index', 'name', 'label', 'labels', 'mediaImage', 'mediaImages'].includes(key))
                .sort(([left], [right]) => left.localeCompare(right))
        )
    });
}

function indexFields(definition = {}) {
    return new Map((definition.fields || []).map((field) => [field.name, field]));
}

function indexChoices(definition = {}) {
    const indexed = new Map();
    Object.entries(definition.choices || {}).forEach(([listName, choices]) => {
        (choices || []).forEach((choice) => {
            indexed.set(`${listName}:${choice.name}`, { ...choice, listName });
        });
    });
    return indexed;
}

function summarizeDiagnosticsDelta(previous = {}, current = {}) {
    const keys = Array.from(new Set([...Object.keys(previous), ...Object.keys(current)]));
    return Object.fromEntries(
        keys
            .filter((key) => typeof previous[key] === 'number' || typeof current[key] === 'number')
            .map((key) => [
                key,
                {
                    previous: Number(previous[key] || 0),
                    current: Number(current[key] || 0),
                    delta: Number(current[key] || 0) - Number(previous[key] || 0)
                }
            ])
    );
}

export function compareXlsFormDefinitions(previousDefinition = {}, currentDefinition = {}) {
    const previousFields = indexFields(previousDefinition);
    const currentFields = indexFields(currentDefinition);
    const previousChoices = indexChoices(previousDefinition);
    const currentChoices = indexChoices(currentDefinition);

    const addedFields = [];
    const removedFields = [];
    const changedFields = [];
    currentFields.forEach((field, name) => {
        if (!previousFields.has(name)) {
            addedFields.push({ name, type: field.type, label: field.label || name });
            return;
        }
        const previous = previousFields.get(name);
        if (buildFieldSignature(previous) !== buildFieldSignature(field)) {
            changedFields.push({
                name,
                label: field.label || name,
                previous: {
                    type: previous.type,
                    label: previous.label,
                    relevant: previous.relevant,
                    required: previous.required,
                    requiredExpression: previous.requiredExpression,
                    constraint: previous.constraint,
                    listName: previous.listName,
                    choiceFilter: previous.choiceFilter,
                    calculation: previous.calculation
                },
                current: {
                    type: field.type,
                    label: field.label,
                    relevant: field.relevant,
                    required: field.required,
                    requiredExpression: field.requiredExpression,
                    constraint: field.constraint,
                    listName: field.listName,
                    choiceFilter: field.choiceFilter,
                    calculation: field.calculation
                }
            });
        }
    });
    previousFields.forEach((field, name) => {
        if (!currentFields.has(name)) removedFields.push({ name, type: field.type, label: field.label || name });
    });

    const addedChoices = [];
    const removedChoices = [];
    const changedChoices = [];
    currentChoices.forEach((choice, key) => {
        if (!previousChoices.has(key)) {
            addedChoices.push({ listName: choice.listName, name: choice.name, label: choice.label || choice.name });
            return;
        }
        const previous = previousChoices.get(key);
        if (buildChoiceSignature(previous) !== buildChoiceSignature(choice)) {
            changedChoices.push({
                listName: choice.listName,
                name: choice.name,
                previousLabel: previous.label || previous.name,
                currentLabel: choice.label || choice.name
            });
        }
    });
    previousChoices.forEach((choice, key) => {
        if (!currentChoices.has(key)) {
            removedChoices.push({ listName: choice.listName, name: choice.name, label: choice.label || choice.name });
        }
    });

    return {
        previous: {
            formKey: previousDefinition.formKey,
            formVersion: previousDefinition.formVersion,
            title: previousDefinition.title,
            diagnostics: previousDefinition.diagnostics || {}
        },
        current: {
            formKey: currentDefinition.formKey,
            formVersion: currentDefinition.formVersion,
            title: currentDefinition.title,
            diagnostics: currentDefinition.diagnostics || {}
        },
        summary: {
            fieldsAdded: addedFields.length,
            fieldsRemoved: removedFields.length,
            fieldsChanged: changedFields.length,
            choicesAdded: addedChoices.length,
            choicesRemoved: removedChoices.length,
            choicesChanged: changedChoices.length
        },
        fields: {
            added: addedFields,
            removed: removedFields,
            changed: changedFields
        },
        choices: {
            added: addedChoices,
            removed: removedChoices,
            changed: changedChoices
        },
        diagnosticsDelta: summarizeDiagnosticsDelta(previousDefinition.diagnostics || {}, currentDefinition.diagnostics || {})
    };
}
