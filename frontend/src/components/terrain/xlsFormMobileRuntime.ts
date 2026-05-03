export type XlsFormChoice = {
  name: string;
  label?: string;
  [key: string]: unknown;
};

export type XlsFormField = {
  name: string;
  type: string;
  rawType?: string;
  label?: string;
  hint?: string;
  required?: boolean;
  requiredExpression?: string;
  relevant?: string;
  parentRelevant?: string[];
  constraint?: string;
  constraintMessage?: string;
  defaultValue?: unknown;
  calculation?: string;
  appearance?: string;
  parameters?: string;
  choiceFilter?: string;
  listName?: string;
  groupPath?: string;
  repeatPath?: string;
  readOnly?: boolean;
};

export type XlsFormGroup = XlsFormField & {
  path?: string;
  depth?: number;
};

export type XlsFormDefinition = {
  engine?: string;
  engineVersion?: string;
  formKey: string;
  formVersion: string;
  title?: string;
  fields?: XlsFormField[];
  groups?: XlsFormGroup[];
  repeats?: XlsFormGroup[];
  choices?: Record<string, XlsFormChoice[]>;
};

export type XlsFormPage = {
  id: string;
  title: string;
  subtitle: string;
  type: 'group' | 'repeat' | 'root';
  path: string;
  repeatName?: string;
  fields: XlsFormField[];
  allFields: XlsFormField[];
};

export type XlsFormRuntimeIssue = {
  field: XlsFormField;
  type: 'required' | 'constraint';
  message: string;
  pageId?: string;
  repeatName?: string;
  repeatIndex?: number;
};

const CONTROL_TYPES = new Set(['note', 'calculate', 'start', 'end', 'today', 'username', 'phonenumber']);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const hasXlsFormRuntimeValue = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
};

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const stripOuterParens = (expression: string): string => {
  let value = expression.trim();
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
};

const splitTopLevel = (expression: string, separator: string): string[] => {
  const parts: string[] = [];
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
};

const splitFunctionArgs = (expression: string): string[] => splitTopLevel(expression, ',');

const asValueList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) return value.trim().split(/\s+/);
  return [];
};

const getExpressionValue = (
  values: Record<string, unknown>,
  fieldName: string,
  context: Record<string, unknown> = {}
) => {
  if (fieldName === '.') return context.currentValue;
  if (Object.prototype.hasOwnProperty.call(values, fieldName)) return values[fieldName];
  if (isRecord(context.repeatValues) && Object.prototype.hasOwnProperty.call(context.repeatValues, fieldName)) {
    return context.repeatValues[fieldName];
  }
  if (isRecord(context.choice) && Object.prototype.hasOwnProperty.call(context.choice, fieldName)) {
    return context.choice[fieldName];
  }
  return undefined;
};

const parseOperand = (
  rawOperand: string,
  values: Record<string, unknown>,
  context: Record<string, unknown> = {}
): unknown => {
  const operand = stripOuterParens(String(rawOperand || '').trim());
  if (operand === '.') return context.currentValue;
  if (/^'.*'$/.test(operand) || /^".*"$/.test(operand)) return operand.slice(1, -1);
  if (/^-?\d+([.,]\d+)?$/.test(operand)) return parseNumber(operand);
  if (/^(true|false)$/i.test(operand)) return operand.toLowerCase() === 'true';

  const fieldRef = operand.match(/^\$\{([^}]+)\}$/);
  if (fieldRef) return getExpressionValue(values, fieldRef[1], context);

  const selected = operand.match(/^selected\((.+)\)$/i);
  if (selected) {
    const args = splitFunctionArgs(selected[1]);
    return asValueList(parseOperand(args[0], values, context)).includes(
      String(parseOperand(args[1], values, context) ?? '')
    );
  }

  const countSelected = operand.match(/^count-selected\((.+)\)$/i);
  if (countSelected) return asValueList(parseOperand(countSelected[1], values, context)).length;

  const stringLength = operand.match(/^string-length\((.+)\)$/i);
  if (stringLength) return String(parseOperand(stringLength[1], values, context) ?? '').length;

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

  return getExpressionValue(values, operand, context);
};

export const evaluateXlsFormRuntimeExpression = (
  expression: string,
  values: Record<string, unknown>,
  context: Record<string, unknown> = {}
): boolean => {
  const cleaned = stripOuterParens(String(expression || '').trim());
  if (!cleaned) return true;

  const orParts = splitTopLevel(cleaned, ' or ');
  if (orParts.length > 1) return orParts.some((part) => evaluateXlsFormRuntimeExpression(part, values, context));

  const andParts = splitTopLevel(cleaned, ' and ');
  if (andParts.length > 1) return andParts.every((part) => evaluateXlsFormRuntimeExpression(part, values, context));

  const notMatch = cleaned.match(/^not\((.+)\)$/i);
  if (notMatch) return !evaluateXlsFormRuntimeExpression(notMatch[1], values, context);

  const comparison = cleaned.match(/^(.+?)\s*(<=|>=|!=|=|<|>)\s*(.+)$/);
  if (comparison) {
    const [, leftRaw, operator, rightRaw] = comparison;
    const left = parseOperand(leftRaw, values, context);
    const right = parseOperand(rightRaw, values, context);
    const leftNumber = parseNumber(left);
    const rightNumber = parseNumber(right);

    if (operator === '=') {
      if (Array.isArray(left)) return left.map(String).includes(String(right ?? ''));
      return String(left ?? '') === String(right ?? '');
    }
    if (operator === '!=') return String(left ?? '') !== String(right ?? '');
    if (leftNumber === null || rightNumber === null) return false;
    if (operator === '<') return leftNumber < rightNumber;
    if (operator === '<=') return leftNumber <= rightNumber;
    if (operator === '>') return leftNumber > rightNumber;
    if (operator === '>=') return leftNumber >= rightNumber;
  }

  return hasXlsFormRuntimeValue(parseOperand(cleaned, values, context));
};

const evaluateCalculationOperand = (
  rawOperand: string,
  values: Record<string, unknown>,
  context: Record<string, unknown> = {}
): unknown => {
  const operand = stripOuterParens(String(rawOperand || '').trim());
  const ifMatch = operand.match(/^if\((.+)\)$/i);
  if (ifMatch) {
    const args = splitFunctionArgs(ifMatch[1]);
    return evaluateXlsFormRuntimeExpression(args[0], values, context)
      ? evaluateCalculationOperand(args[1], values, context)
      : evaluateCalculationOperand(args[2], values, context);
  }

  const concatMatch = operand.match(/^concat\((.+)\)$/i);
  if (concatMatch) return splitFunctionArgs(concatMatch[1]).map((arg) => evaluateCalculationOperand(arg, values, context) ?? '').join('');

  if (/^now\(\)$/i.test(operand)) return new Date().toISOString();
  if (/^today\(\)$/i.test(operand)) return new Date().toISOString().slice(0, 10);

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
    const args = splitFunctionArgs(coalesceMatch[1]);
    for (const arg of args) {
      const value = evaluateCalculationOperand(arg, values, context);
      if (hasXlsFormRuntimeValue(value)) return value;
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
};

export const applyXlsFormRuntimeCalculations = (
  definition: XlsFormDefinition,
  values: Record<string, unknown>
) => {
  const nextValues = { ...values };
  const calculated: Record<string, unknown> = {};

  (definition.fields || []).forEach((field) => {
    if (field.type !== 'calculate' || !field.name || !field.calculation) return;
    const value = evaluateCalculationOperand(field.calculation, nextValues, {
      field,
      currentValue: nextValues[field.name],
    });
    if (value !== undefined && String(nextValues[field.name] ?? '') !== String(value ?? '')) {
      nextValues[field.name] = value;
      calculated[field.name] = value;
    }
  });

  return { values: nextValues, calculated };
};

export const isXlsFormRuntimeFieldVisible = (
  field: XlsFormField,
  values: Record<string, unknown>,
  repeatValues: Record<string, unknown> = {}
) => [...(field.parentRelevant || []), field.relevant].filter(Boolean).every((expression) =>
  evaluateXlsFormRuntimeExpression(String(expression), values, {
    field,
    repeatValues,
    currentValue: repeatValues[field.name] ?? values[field.name],
  })
);

export const getXlsFormRuntimeFieldValue = (
  field: XlsFormField,
  values: Record<string, unknown>,
  repeatValues?: Record<string, unknown>
) => {
  const value = repeatValues ? repeatValues[field.name] : values[field.name];
  return hasXlsFormRuntimeValue(value) ? value : field.defaultValue;
};

export const getFilteredXlsFormRuntimeChoices = (
  definition: XlsFormDefinition,
  field: XlsFormField,
  values: Record<string, unknown>,
  repeatValues: Record<string, unknown> = {}
) => {
  const choices = field.listName ? definition.choices?.[field.listName] || [] : [];
  if (!field.choiceFilter) return choices;
  return choices.filter((choice) =>
    evaluateXlsFormRuntimeExpression(field.choiceFilter || '', values, {
      choice,
      field,
      repeatValues,
      currentValue: repeatValues[field.name] ?? values[field.name],
    })
  );
};

const isChildOfTopLevelPath = (path: string, topLevelPath: string) =>
  path === topLevelPath || path.startsWith(`${topLevelPath}/`);

export const buildXlsFormRuntimePages = (
  definition: XlsFormDefinition,
  values: Record<string, unknown>,
  query = ''
): XlsFormPage[] => {
  const normalizedQuery = query.trim().toLowerCase();
  const groups = definition.groups || [];
  const repeats = definition.repeats || [];
  const topGroups = groups.filter((group) => Number(group.depth || 0) === 0);
  const topRepeats = repeats.filter((repeat) => Number(repeat.depth || 0) === 0);
  const rootFields = (definition.fields || []).filter((field) => !field.groupPath && !field.repeatPath);
  const pages: XlsFormPage[] = [];

  if (rootFields.length > 0) {
    pages.push({
      id: 'root',
      title: definition.title || 'Formulaire',
      subtitle: 'Questions generales',
      type: 'root',
      path: '',
      fields: rootFields,
      allFields: rootFields,
    });
  }

  topGroups.forEach((group) => {
    const path = group.path || group.name;
    const allFields = (definition.fields || []).filter((field) =>
      !field.repeatPath && isChildOfTopLevelPath(field.groupPath || '', path)
    );
    pages.push({
      id: `group:${path}`,
      title: group.label || group.name,
      subtitle: path,
      type: 'group',
      path,
      fields: allFields,
      allFields,
    });
  });

  topRepeats.forEach((repeat) => {
    const path = repeat.path || repeat.name;
    const allFields = (definition.fields || []).filter((field) =>
      isChildOfTopLevelPath(field.repeatPath || '', repeat.name)
    );
    pages.push({
      id: `repeat:${repeat.name}`,
      title: repeat.label || repeat.name,
      subtitle: 'Repeat XLSForm',
      type: 'repeat',
      path,
      repeatName: repeat.name,
      fields: allFields,
      allFields,
    });
  });

  if (pages.length === 0) {
    pages.push({
      id: 'form',
      title: definition.title || 'Formulaire',
      subtitle: 'Toutes les questions',
      type: 'root',
      path: '',
      fields: definition.fields || [],
      allFields: definition.fields || [],
    });
  }

  return pages
    .map((page) => {
      const fields = page.allFields.filter((field) => {
        if (!isXlsFormRuntimeFieldVisible(field, values)) return false;
        if (!normalizedQuery) return true;
        return `${field.label || ''} ${field.name}`.toLowerCase().includes(normalizedQuery);
      });
      return { ...page, fields };
    })
    .filter((page) => {
      if (!normalizedQuery) return true;
      return page.fields.length > 0 || `${page.title} ${page.subtitle}`.toLowerCase().includes(normalizedQuery);
    });
};

const isRequiredField = (
  field: XlsFormField,
  values: Record<string, unknown>,
  repeatValues: Record<string, unknown> = {}
) => {
  if (field.requiredExpression) {
    return evaluateXlsFormRuntimeExpression(field.requiredExpression, values, {
      field,
      repeatValues,
      currentValue: repeatValues[field.name] ?? values[field.name],
    });
  }
  return field.required === true;
};

const getConstraintIssue = (
  definition: XlsFormDefinition,
  field: XlsFormField,
  values: Record<string, unknown>,
  repeatValues: Record<string, unknown> = {}
) => {
  const value = getXlsFormRuntimeFieldValue(field, values, repeatValues);
  if (!hasXlsFormRuntimeValue(value)) return '';

  if (field.type === 'integer') {
    const number = parseNumber(value);
    if (number === null || !Number.isInteger(number)) return 'La valeur doit etre un entier.';
  }

  if (field.type === 'decimal') {
    if (parseNumber(value) === null) return 'La valeur doit etre un nombre.';
  }

  if (field.type === 'geopoint') {
    const parts = String(value).trim().split(/[,\s]+/).filter(Boolean);
    const latitude = parseNumber(parts[0]);
    const longitude = parseNumber(parts[1]);
    if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return 'Le GPS doit contenir latitude et longitude valides.';
    }
  }

  if ((field.type === 'select_one' || field.type === 'select_multiple') && field.listName) {
    const validNames = new Set(getFilteredXlsFormRuntimeChoices(definition, field, values, repeatValues).map((choice) => String(choice.name)));
    const selectedValues = field.type === 'select_multiple' ? asValueList(value) : [String(value)];
    const invalidValues = selectedValues.filter((entry) => !validNames.has(entry));
    if (invalidValues.length > 0) return `Choix non autorise: ${invalidValues.join(', ')}.`;
  }

  if (field.constraint && !evaluateXlsFormRuntimeExpression(field.constraint, values, {
    field,
    repeatValues,
    currentValue: value,
  })) {
    return field.constraintMessage || 'La valeur ne respecte pas la contrainte XLSForm.';
  }

  return '';
};

export const validateXlsFormRuntime = (
  definition: XlsFormDefinition,
  values: Record<string, unknown>,
  pages: XlsFormPage[]
) => {
  const issues: XlsFormRuntimeIssue[] = [];

  pages.forEach((page) => {
    if (page.type === 'repeat' && page.repeatName) {
      const instances = Array.isArray(values[page.repeatName]) ? values[page.repeatName] as Record<string, unknown>[] : [];
      const requiredFields = page.allFields.filter((field) => !CONTROL_TYPES.has(field.type) && isRequiredField(field, values));
      if (instances.length === 0 && requiredFields.length > 0) {
        issues.push({
          field: requiredFields[0],
          type: 'required',
          message: 'Ajoutez au moins une ligne dans ce repeat.',
          pageId: page.id,
          repeatName: page.repeatName,
        });
      }
      instances.forEach((instanceValues, repeatIndex) => {
        page.allFields.forEach((field) => {
          if (CONTROL_TYPES.has(field.type) || !isXlsFormRuntimeFieldVisible(field, values, instanceValues)) return;
          const value = getXlsFormRuntimeFieldValue(field, values, instanceValues);
          if (isRequiredField(field, values, instanceValues) && !hasXlsFormRuntimeValue(value)) {
            issues.push({ field, type: 'required', message: 'Champ obligatoire pour cette ligne.', pageId: page.id, repeatName: page.repeatName, repeatIndex });
            return;
          }
          const constraintIssue = getConstraintIssue(definition, field, values, instanceValues);
          if (constraintIssue) issues.push({ field, type: 'constraint', message: constraintIssue, pageId: page.id, repeatName: page.repeatName, repeatIndex });
        });
      });
      return;
    }

    page.allFields.forEach((field) => {
      if (CONTROL_TYPES.has(field.type) || !isXlsFormRuntimeFieldVisible(field, values)) return;
      const value = getXlsFormRuntimeFieldValue(field, values);
      if (isRequiredField(field, values) && !hasXlsFormRuntimeValue(value)) {
        issues.push({ field, type: 'required', message: 'Champ obligatoire pour cette branche XLSForm.', pageId: page.id });
        return;
      }
      const constraintIssue = getConstraintIssue(definition, field, values);
      if (constraintIssue) issues.push({ field, type: 'constraint', message: constraintIssue, pageId: page.id });
    });
  });

  return {
    issues,
    requiredMissing: issues.filter((issue) => issue.type === 'required').map((issue) => issue.field.name),
    constraintIssues: issues.filter((issue) => issue.type === 'constraint'),
  };
};
