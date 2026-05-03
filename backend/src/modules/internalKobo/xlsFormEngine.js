import crypto from 'node:crypto';
import ExcelJS from 'exceljs';

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

function isTruthyXls(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    return ['yes', 'true', '1', 'oui', 'required'].includes(normalized);
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
            if (match?.[2]) languages.add(match[2].trim());
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

function parseNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const normalized = String(value ?? '').trim().replace(',', '.');
    if (!normalized) return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
}

function hasValue(value) {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && String(value).trim() !== '';
}

function asValueList(value) {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string' && value.trim()) return value.trim().split(/\s+/);
    return [];
}

function splitTopLevel(expression, separator) {
    const parts = [];
    let depth = 0;
    let quote = '';
    let current = '';
    const lowerSeparator = separator.toLowerCase();

    for (let index = 0; index < expression.length; index += 1) {
        const char = expression[index];
        if ((char === '"' || char === "'") && expression[index - 1] !== '\\') {
            quote = quote === char ? '' : quote || char;
        }
        if (!quote) {
            if (char === '(') depth += 1;
            if (char === ')') depth = Math.max(0, depth - 1);
            const next = expression.slice(index, index + separator.length).toLowerCase();
            if (depth === 0 && next === lowerSeparator) {
                parts.push(current.trim());
                current = '';
                index += separator.length - 1;
                continue;
            }
        }
        current += char;
    }

    if (current.trim()) parts.push(current.trim());
    return parts;
}

function stripOuterParens(expression) {
    let value = String(expression || '').trim();
    while (value.startsWith('(') && value.endsWith(')')) {
        let depth = 0;
        let balanced = true;
        for (let index = 0; index < value.length; index += 1) {
            if (value[index] === '(') depth += 1;
            if (value[index] === ')') depth -= 1;
            if (depth === 0 && index < value.length - 1) {
                balanced = false;
                break;
            }
        }
        if (!balanced) break;
        value = value.slice(1, -1).trim();
    }
    return value;
}

function splitFunctionArgs(argsExpression) {
    return splitTopLevel(String(argsExpression || ''), ',');
}

function getExpressionValue(values, fieldName, context = {}) {
    if (fieldName === '.') return context.currentValue;
    if (Object.prototype.hasOwnProperty.call(values, fieldName)) return values[fieldName];
    if (context.choice && Object.prototype.hasOwnProperty.call(context.choice, fieldName)) return context.choice[fieldName];
    return undefined;
}

function parseOperand(rawOperand, values, context = {}) {
    const operand = stripOuterParens(String(rawOperand || '').trim());
    if (operand === '.') return context.currentValue;
    if (/^'.*'$/.test(operand) || /^".*"$/.test(operand)) return operand.slice(1, -1);
    if (/^-?\d+([.,]\d+)?$/.test(operand)) return parseNumber(operand);
    if (/^(true|false)$/i.test(operand)) return operand.toLowerCase() === 'true';

    const fieldRef = operand.match(/^\$\{([^}]+)\}$/);
    if (fieldRef) return getExpressionValue(values, fieldRef[1], context);

    const stringLength = operand.match(/^string-length\((.+)\)$/i);
    if (stringLength) return String(parseOperand(stringLength[1], values, context) ?? '').length;

    const countSelected = operand.match(/^count-selected\((.+)\)$/i);
    if (countSelected) return asValueList(parseOperand(countSelected[1], values, context)).length;

    const selected = operand.match(/^selected\((.+)\)$/i);
    if (selected) {
        const args = splitFunctionArgs(selected[1]);
        const source = asValueList(parseOperand(args[0], values, context));
        const expected = String(parseOperand(args[1], values, context) ?? '');
        return source.includes(expected);
    }

    const contains = operand.match(/^contains\((.+)\)$/i);
    if (contains) {
        const args = splitFunctionArgs(contains[1]);
        return String(parseOperand(args[0], values, context) ?? '').includes(
            String(parseOperand(args[1], values, context) ?? '')
        );
    }

    const regex = operand.match(/^regex\((.+)\)$/i);
    if (regex) {
        const args = splitFunctionArgs(regex[1]);
        try {
            return new RegExp(String(parseOperand(args[1], values, context) ?? '')).test(
                String(parseOperand(args[0], values, context) ?? '')
            );
        } catch {
            return false;
        }
    }

    if (context.choice && Object.prototype.hasOwnProperty.call(context.choice, operand)) {
        return context.choice[operand];
    }

    return getExpressionValue(values, operand, context);
}

export function evaluateXlsFormExpression(expression, values = {}, context = {}) {
    const cleaned = stripOuterParens(String(expression || '').trim());
    if (!cleaned) return true;

    const orParts = splitTopLevel(cleaned, ' or ');
    if (orParts.length > 1) return orParts.some((part) => evaluateXlsFormExpression(part, values, context));

    const andParts = splitTopLevel(cleaned, ' and ');
    if (andParts.length > 1) return andParts.every((part) => evaluateXlsFormExpression(part, values, context));

    const notMatch = cleaned.match(/^not\((.+)\)$/i);
    if (notMatch) return !evaluateXlsFormExpression(notMatch[1], values, context);

    const comparison = cleaned.match(/^(.+?)\s*(<=|>=|!=|=|<|>)\s*(.+)$/);
    if (comparison) {
        const [, leftRaw, operator, rightRaw] = comparison;
        const left = parseOperand(leftRaw, values, context);
        const right = parseOperand(rightRaw, values, context);
        const leftNumber = parseNumber(left);
        const rightNumber = parseNumber(right);
        const canCompareNumbers = leftNumber !== null && rightNumber !== null;

        if (operator === '=') {
            if (Array.isArray(left)) return left.map(String).includes(String(right ?? ''));
            return String(left ?? '') === String(right ?? '');
        }
        if (operator === '!=') return String(left ?? '') !== String(right ?? '');
        if (!canCompareNumbers) return false;
        if (operator === '<') return leftNumber < rightNumber;
        if (operator === '<=') return leftNumber <= rightNumber;
        if (operator === '>') return leftNumber > rightNumber;
        if (operator === '>=') return leftNumber >= rightNumber;
    }

    const operandValue = parseOperand(cleaned, values, context);
    return operandValue === true || hasValue(operandValue);
}

function evaluateCalculationOperand(rawOperand, values, context = {}) {
    const operand = stripOuterParens(String(rawOperand || '').trim());
    const ifMatch = operand.match(/^if\((.+)\)$/i);
    if (ifMatch) {
        const args = splitFunctionArgs(ifMatch[1]);
        return evaluateXlsFormExpression(args[0], values, context)
            ? evaluateCalculationOperand(args[1], values, context)
            : evaluateCalculationOperand(args[2], values, context);
    }

    const concatMatch = operand.match(/^concat\((.+)\)$/i);
    if (concatMatch) {
        return splitFunctionArgs(concatMatch[1])
            .map((arg) => evaluateCalculationOperand(arg, values, context) ?? '')
            .join('');
    }

    if (/^now\(\)$/i.test(operand)) return new Date().toISOString();
    if (/^today\(\)$/i.test(operand)) return new Date().toISOString().slice(0, 10);
    if (/^pulldata\(/i.test(operand)) return undefined;

    return parseOperand(operand, values, context);
}

export function applyXlsFormCalculations(definition, values = {}) {
    const nextValues = { ...values };
    const unresolved = [];

    for (const field of definition.fields || []) {
        if (field.type !== 'calculate' || !field.name || !field.calculation) continue;
        const calculated = evaluateCalculationOperand(field.calculation, nextValues, {
            field,
            currentValue: nextValues[field.name]
        });
        if (calculated === undefined) {
            unresolved.push({ field: field.name, calculation: field.calculation });
        } else {
            nextValues[field.name] = calculated;
        }
    }

    return { values: nextValues, unresolved };
}

function getInheritedRelevant(field) {
    return [...(field.parentRelevant || []), field.relevant].filter(Boolean);
}

export function isXlsFormFieldVisible(field, values = {}) {
    return getInheritedRelevant(field).every((expression) =>
        evaluateXlsFormExpression(expression, values, { field, currentValue: values[field.name] })
    );
}

export function getVisibleXlsFormFields(definition, values = {}) {
    const { values: calculatedValues } = applyXlsFormCalculations(definition, values);
    return (definition.fields || []).filter((field) => isXlsFormFieldVisible(field, calculatedValues));
}

function parseGeopoint(value) {
    const parts = String(value ?? '')
        .trim()
        .split(/[,\s]+/)
        .filter(Boolean);
    if (parts.length < 2) return null;
    return {
        latitude: parseNumber(parts[0]),
        longitude: parseNumber(parts[1]),
        altitude: parts[2] !== undefined ? parseNumber(parts[2]) : null,
        accuracy: parts[3] !== undefined ? parseNumber(parts[3]) : null
    };
}

function isValidLatitude(value) {
    const number = parseNumber(value);
    return number !== null && number >= -90 && number <= 90;
}

function isValidLongitude(value) {
    const number = parseNumber(value);
    return number !== null && number >= -180 && number <= 180;
}

export function getFilteredXlsFormChoices(definition, fieldName, values = {}) {
    const field = (definition.fields || []).find((item) => item.name === fieldName);
    if (!field?.listName) return [];

    const choices = definition.choices?.[field.listName] || [];
    if (!field.choiceFilter) return choices;

    return choices.filter((choice) =>
        evaluateXlsFormExpression(field.choiceFilter, values, {
            choice,
            field,
            currentValue: values[field.name]
        })
    );
}

function isRequiredField(field, values) {
    if (field.requiredExpression) {
        return evaluateXlsFormExpression(field.requiredExpression, values, {
            field,
            currentValue: values[field.name]
        });
    }
    return field.required === true;
}

function validateTypeAndChoice(definition, field, values) {
    const value = values[field.name];
    if (!hasValue(value)) return null;

    if (field.type === 'integer') {
        const number = parseNumber(value);
        if (number === null || !Number.isInteger(number)) {
            return 'La valeur doit etre un entier.';
        }
    }

    if (field.type === 'decimal') {
        const number = parseNumber(value);
        if (number === null) return 'La valeur doit etre un nombre.';
    }

    if (field.type === 'geopoint') {
        const point = parseGeopoint(value);
        if (!point || !isValidLatitude(point.latitude) || !isValidLongitude(point.longitude)) {
            return 'Le GPS doit contenir latitude et longitude valides.';
        }
    }

    if (FIELD_TYPES_WITH_CHOICES.has(field.type) && field.listName) {
        const validNames = new Set(getFilteredXlsFormChoices(definition, field.name, values).map((choice) => String(choice.name)));
        const selectedValues = field.type === 'select_multiple' ? asValueList(value) : [String(value)];
        const invalidValues = selectedValues.filter((entry) => !validNames.has(entry));
        if (invalidValues.length > 0) {
            return `Choix non autorise: ${invalidValues.join(', ')}.`;
        }
    }

    return null;
}

export function validateXlsFormValues(definition, values = {}) {
    const calculationResult = applyXlsFormCalculations(definition, values);
    const calculatedValues = calculationResult.values;
    const visibleFields = getVisibleXlsFormFields(definition, calculatedValues);
    const issues = [];

    for (const field of visibleFields) {
        if (!field.name || ['note', 'calculate'].includes(field.type)) continue;
        const value = calculatedValues[field.name];

        if (isRequiredField(field, calculatedValues) && !hasValue(value)) {
            issues.push({
                field: field.name,
                type: 'required',
                message: field.requiredMessage || 'Champ obligatoire pour cette branche XLSForm.'
            });
            continue;
        }

        const typeIssue = validateTypeAndChoice(definition, field, calculatedValues);
        if (typeIssue) {
            issues.push({ field: field.name, type: 'constraint', message: typeIssue });
        }

        if (field.constraint && hasValue(value)) {
            const passes = evaluateXlsFormExpression(field.constraint, calculatedValues, {
                field,
                currentValue: value
            });
            if (!passes) {
                issues.push({
                    field: field.name,
                    type: 'constraint',
                    message: field.constraintMessage || 'La valeur ne respecte pas la contrainte XLSForm.'
                });
            }
        }
    }

    return {
        values: calculatedValues,
        issues,
        requiredMissing: issues.filter((issue) => issue.type === 'required').map((issue) => issue.field),
        constraintIssues: issues.filter((issue) => issue.type === 'constraint'),
        unresolvedCalculations: calculationResult.unresolved
    };
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
            'geopoint',
            'image',
            'date',
            'time',
            'datetime',
            'select_one',
            'select_multiple',
            'acknowledge',
            'barcode',
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
        externalChoiceCount: fields.filter((field) => field.external).length,
        languages,
        unsupportedTypes: Array.from(unsupportedTypes)
    };

    return {
        engine: 'gem-xlsform-universal',
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
            'media'
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
