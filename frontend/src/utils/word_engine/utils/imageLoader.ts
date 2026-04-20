/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
// src/utils/exportWord/utils/imageLoader.ts
import logger from '../../logger';

const imageCache = new Map<string, ArrayBuffer>();

export const fetchImageCached = async (url: string): Promise<ArrayBuffer | null> => {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url)!;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    imageCache.set(url, buffer);
    return buffer;
  } catch (e) {
    logger.warn(`Could not load image: ${url}`, e);
    return null;
  }
};
