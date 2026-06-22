/**
 * Shared utility functions used across multiple modules
 * Eliminates code duplication and ensures consistency
 */

/**
 * JSON replacer that safely serializes BigInt values
 * Usage: JSON.stringify(obj, jsonBigIntReplacer)
 */
export const jsonBigIntReplacer = (_key, value) => {
  if (typeof value === 'bigint') return value.toString();
  return value;
};

/**
 * Sanitize BigInt values for JSON serialization
 * Converts BigInt to string to prevent JSON.stringify errors
 */
export const sanitizeBigIntForJson = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeBigIntForJson(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'bigint') {
      sanitized[key] = value.toString();
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBigIntForJson(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

/**
 * Merge or update nested JSON field
 * Used for partial updates of JSON columns
 */
export const mergeJsonField = (existing, updates) => {
  if (!existing) return updates;
  if (!updates) return existing;

  return {
    ...existing,
    ...updates,
  };
};

/**
 * Set value in nested object using dot notation
 * Example: setNestedValue(obj, 'user.profile.age', 25)
 */
export const setNestedValue = (obj, path, value) => {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key]) {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
  return obj;
};

/**
 * Get value from nested object using dot notation
 * Example: getNestedValue(obj, 'user.profile.age')
 */
export const getNestedValue = (obj, path, defaultValue = null) => {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current && typeof current === 'object') {
      current = current[key];
    } else {
      return defaultValue;
    }
  }

  return current ?? defaultValue;
};

/**
 * Deep clone an object
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item));
  }

  const cloned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
};

/**
 * Type conversion utilities
 */
export const parseInteger = (value, defaultValue = 0) => {
  const parsed = parseInt(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

export const parseFloat = (value, defaultValue = 0) => {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

export const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return !!value;
};

/**
 * Array utilities
 */
export const arrayToMap = (array, keyFn) => {
  const map = new Map();
  for (const item of array) {
    map.set(keyFn(item), item);
  }
  return map;
};

export const groupBy = (array, keyFn) => {
  const grouped = {};
  for (const item of array) {
    const key = keyFn(item);
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  }
  return grouped;
};

/**
 * String utilities
 */
export const slugify = (str) => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const truncate = (str, maxLength, suffix = '...') => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
};
