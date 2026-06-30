import {
    stripOuterParens,
    splitFunctionArgs,
    evaluateXlsFormExpression,
    parseOperand,
    parseNumber,
    hasValue,
    getExpressionValue
} from './xlsFormShared.js';

function normalizePulldataKey(value) {
    return String(value ?? '')
        .trim()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^\w.-]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function getPulldataRecord(values, sourceName) {
    const source = normalizePulldataKey(sourceName);
    const candidates = [
        values[`_ged_os_pulldata_${sourceName}`],
        values[`_ged_os_pulldata_${source}`],
        values._gemPulldata,
        values._gem_pulldata
    ];

    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
        if (candidate[sourceName] && typeof candidate[sourceName] === 'object' && !Array.isArray(candidate[sourceName])) {
            return candidate[sourceName];
        }
        if (candidate[source] && typeof candidate[source] === 'object' && !Array.isArray(candidate[source])) {
            return candidate[source];
        }
        if (candidate.nom || candidate.telephone || candidate.latitude || candidate.longitude || candidate.region) return candidate;
    }

    return null;
}

function getPulldataColumn(record, columnName) {
    if (!record || typeof record !== 'object') return undefined;
    if (Object.prototype.hasOwnProperty.call(record, columnName)) return record[columnName];
    const normalizedColumn = normalizePulldataKey(columnName);
    const match = Object.entries(record).find(([key]) => normalizePulldataKey(key) === normalizedColumn);
    return match?.[1];
}

function resolvePulldataOperand(argsExpression, values, context = {}) {
    const args = splitFunctionArgs(argsExpression);
    if (args.length < 2) return undefined;

    const sourceName = String(evaluateCalculationOperand(args[0], values, context) ?? '').trim();
    const targetColumn = String(evaluateCalculationOperand(args[1], values, context) ?? '').trim();
    const lookupColumn = args[2] ? String(evaluateCalculationOperand(args[2], values, context) ?? '').trim() : '';
    const lookupValue = args[3] ? evaluateCalculationOperand(args[3], values, context) : undefined;
    const record = getPulldataRecord(values, sourceName);

    if (!record || !targetColumn) return undefined;

    if (lookupColumn && hasValue(lookupValue)) {
        const recordLookup = getPulldataColumn(record, lookupColumn);
        const numeroOrdre = values.Numero_ordre;
        if (
            hasValue(recordLookup) &&
            String(recordLookup) !== String(lookupValue) &&
            String(numeroOrdre ?? '') !== String(lookupValue)
        ) {
            return undefined;
        }
    }

    return getPulldataColumn(record, targetColumn);
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

    const pulldataMatch = operand.match(/^pulldata\((.+)\)$/i);
    if (pulldataMatch) return resolvePulldataOperand(pulldataMatch[1], values, context);

    const numberMatch = operand.match(/^number\((.+)\)$/i);
    if (numberMatch) return parseNumber(evaluateCalculationOperand(numberMatch[1], values, context)) ?? '';

    const intMatch = operand.match(/^int\((.+)\)$/i);
    if (intMatch) {
        const value = parseNumber(evaluateCalculationOperand(intMatch[1], values, context));
        return value === null ? '' : Math.trunc(value);
    }

    const roundMatch = operand.match(/^round\((.+)\)$/i);
    if (roundMatch) {
        const args = splitFunctionArgs(roundMatch[1]);
        const value = parseNumber(evaluateCalculationOperand(args[0], values, context));
        const precision = parseNumber(evaluateCalculationOperand(args[1] || '0', values, context)) || 0;
        if (value === null) return '';
        const factor = 10 ** precision;
        return Math.round(value * factor) / factor;
    }

    const coalesceMatch = operand.match(/^coalesce\((.+)\)$/i);
    if (coalesceMatch) {
        for (const arg of splitFunctionArgs(coalesceMatch[1])) {
            const value = evaluateCalculationOperand(arg, values, context);
            if (hasValue(value)) return value;
        }
        return '';
    }

    if (/[+\-*/]/.test(operand)) {
        const expression = operand
            .replace(/\bdiv\b/gi, '/')
            .replace(/\$\{([^}]+)\}/g, (_, fieldName) => String(parseNumber(getExpressionValue(values, fieldName, context)) ?? 0));
        if (/^[\d\s+\-*/().]+$/.test(expression)) {
            try {
                const result = Function(`"use strict"; return (${expression});`)();
                return Number.isFinite(result) ? result : '';
            } catch {
                return '';
            }
        }
    }

    return parseOperand(operand, values, context);
}

export function applyXlsFormCalculations(definition, values = {}) {
    const nextValues = { ...values };
    const unresolved = [];

    for (const field of definition.fields || []) {
        if (!field.name || !field.calculation) continue;
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
