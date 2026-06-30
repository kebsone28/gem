 
// src/utils/exportWord/utils/imageLoader.ts
import logger from '../../logger';

const imageCache = new Map<string, ArrayBuffer>();

export const fetchImageCached = async (url: string): Promise<ArrayBuffer | null> => {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url)!;

  try {
    // Handle relative paths by converting to absolute URL
    let fetchUrl = url;
    if (url.startsWith('/')) {
      fetchUrl = `${window.location.origin}${url}`;
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      logger.warn(`Image fetch failed: ${response.status} ${response.statusText}`);
      return null;
    }
    const buffer = await response.arrayBuffer();
    imageCache.set(url, buffer);
    return buffer;
  } catch (e) {
    logger.warn(`Could not load image: ${url}`, e);
    return null;
  }
};
