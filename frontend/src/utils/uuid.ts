 
/**
 * Robust UUID generator that works in non-secure contexts (HTTP)
 * where crypto.randomUUID might be unavailable.
 */
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for non-secure contexts (HTTP)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
