import {
    evaluateXlsFormExpression,
    parseNumber,
    hasValue,
    asValueList,
    isTruthyXls
} from './xlsFormShared.js';
import { applyXlsFormCalculations } from './calculateEngine.js';

const FIELD_TYPES_WITH_CHOICES = new Set(['select_one', 'select_multiple']);

function getInheritedRelevant(field) {
    return [...(field.parentRelevant || []), field.relevant].filter(Boolean);
}

export { getInheritedRelevant };

export function isXlsFormFieldVisible(field, values = {}, repeatValues = {}) {
    return getInheritedRelevant(field).every((expression) =>
        evaluateXlsFormExpression(expression, values, {
            field,
            repeatValues,
            currentValue: repeatValues[field.name] ?? values[field.name]
        })
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

export { parseGeopoint, isValidLatitude, isValidLongitude };

export function getFilteredXlsFormChoices(definition, fieldName, values = {}, repeatValues = {}) {
    const field = (definition.fields || []).find((item) => item.name === fieldName);
    if (!field?.listName) return [];

    const choices = definition.choices?.[field.listName] || [];
    if (!field.choiceFilter) return choices;

    return choices.filter((choice) =>
        evaluateXlsFormExpression(field.choiceFilter, values, {
            choice,
            field,
            repeatValues,
            currentValue: repeatValues[field.name] ?? values[field.name]
        })
    );
}

function isRequiredField(field, values, repeatValues = {}) {
    if (field.requiredExpression) {
        return evaluateXlsFormExpression(field.requiredExpression, values, {
            field,
            repeatValues,
            currentValue: repeatValues[field.name] ?? values[field.name]
        });
    }
    return field.required === true || isTruthyXls(field.required);
}

function validateTypeAndChoice(definition, field, values, repeatValues = {}) {
    const value = repeatValues[field.name] ?? values[field.name];
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
        const validNames = new Set(getFilteredXlsFormChoices(definition, field.name, values, repeatValues).map((choice) => String(choice.name)));
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

    const validateField = (field, repeatValues = {}, repeatContext = {}) => {
        if (!field.name || ['note', 'calculate'].includes(field.type)) return;
        const value = repeatValues[field.name] ?? calculatedValues[field.name];

        if (isRequiredField(field, calculatedValues, repeatValues) && !hasValue(value)) {
            issues.push({
                field: field.name,
                type: 'required',
                message: field.requiredMessage || 'Champ obligatoire pour cette branche XLSForm.',
                ...repeatContext
            });
            return;
        }

        const typeIssue = validateTypeAndChoice(definition, field, calculatedValues, repeatValues);
        if (typeIssue) {
            issues.push({ field: field.name, type: 'constraint', message: typeIssue, ...repeatContext });
        }

        if (field.constraint && hasValue(value)) {
            const passes = evaluateXlsFormExpression(field.constraint, calculatedValues, {
                field,
                repeatValues,
                currentValue: value
            });
            if (!passes) {
                issues.push({
                    field: field.name,
                    type: 'constraint',
                    message: field.constraintMessage || 'La valeur ne respecte pas la contrainte XLSForm.',
                    ...repeatContext
                });
            }
        }
    };

    for (const field of visibleFields) {
        if (field.repeatPath) continue;
        validateField(field);
    }

    for (const repeat of definition.repeats || []) {
        const repeatName = repeat.name;
        const instances = Array.isArray(calculatedValues[repeatName])
            ? calculatedValues[repeatName].filter((item) => item && typeof item === 'object' && !Array.isArray(item))
            : [];
        const repeatFields = (definition.fields || []).filter((field) => field.repeatPath === repeatName);
        const requiredRepeatFields = repeatFields.filter((field) =>
            !['note', 'calculate'].includes(field.type) &&
            isXlsFormFieldVisible(field, calculatedValues) &&
            isRequiredField(field, calculatedValues)
        );

        if (instances.length === 0 && requiredRepeatFields.length > 0) {
            issues.push({
                field: requiredRepeatFields[0].name,
                type: 'required',
                message: 'Ajoutez au moins une ligne dans ce repeat.',
                repeatName
            });
            continue;
        }

        instances.forEach((repeatValues, repeatIndex) => {
            repeatFields.forEach((field) => {
                if (!isXlsFormFieldVisible(field, calculatedValues, repeatValues)) return;
                validateField(field, repeatValues, { repeatName, repeatIndex });
            });
        });
    }

    return {
        values: calculatedValues,
        issues,
        requiredMissing: issues.filter((issue) => issue.type === 'required').map((issue) => issue.field),
        constraintIssues: issues.filter((issue) => issue.type === 'constraint'),
        unresolvedCalculations: calculationResult.unresolved
    };
}
