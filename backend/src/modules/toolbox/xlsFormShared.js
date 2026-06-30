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

function normalizeKnownKoboExpression(expression) {
    const value = String(expression || '').trim();
    if (
        value.includes("${VALEUR_DE_LA_RESISTANCE_DE_TER} = 'conforme'") &&
        value.includes("${VALEUR_DE_LA_RESISTANCE_DE_TER} = 'non_conforme'")
    ) {
        return "${VALEUR_DE_LA_RESISTANCE_DE_TER} != ''";
    }
    return value;
}

function getExpressionValue(values, fieldName, context = {}) {
    if (fieldName === '.') return context.currentValue;
    if (Object.prototype.hasOwnProperty.call(values, fieldName)) return values[fieldName];
    if (context.repeatValues && Object.prototype.hasOwnProperty.call(context.repeatValues, fieldName)) {
        return context.repeatValues[fieldName];
    }
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
    const cleaned = stripOuterParens(normalizeKnownKoboExpression(expression));
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

function isTruthyXls(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    return ['yes', 'true', '1', 'oui', 'required'].includes(normalized);
}

export {
    parseNumber,
    hasValue,
    asValueList,
    splitTopLevel,
    stripOuterParens,
    splitFunctionArgs,
    normalizeKnownKoboExpression,
    getExpressionValue,
    parseOperand,
    isTruthyXls
};
