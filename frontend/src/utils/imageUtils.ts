/**
 * imageUtils.ts
 * Client-side image compression for field photo uploads.
 * Reduces photos from ~4MB (phone camera) to ~300-500KB
 * before uploading, saving 80% mobile data on EDGE/3G networks.
 */

const MAX_WIDTH = 1280;
const MAX_HEIGHT = 1280;
const QUALITY = 0.72; // JPEG quality (0.7-0.8 = good balance)
const MAX_SIZE_BYTES = 500 * 1024; // 500KB target

/**
 * Compress an image File to a smaller JPEG blob.
 * Uses Canvas API — works offline, no server round-trip.
 *
 * @param file - The original File from <input type="file">
 * @param options - Optional overrides for max dimensions and quality
 * @returns A compressed File ready for upload
 */
export async function compressImage(
  file: File,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    maxSizeBytes?: number;
  }
): Promise<File> {
  const maxW = options?.maxWidth ?? MAX_WIDTH;
  const maxH = options?.maxHeight ?? MAX_HEIGHT;
  let quality = options?.quality ?? QUALITY;
  const maxSize = options?.maxSizeBytes ?? MAX_SIZE_BYTES;

  // Skip compression for small files or non-images
  if (file.size <= maxSize || !file.type.startsWith('image/')) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const { width: origW, height: origH } = bitmap;

  // Calculate scaled dimensions maintaining aspect ratio
  let targetW = origW;
  let targetH = origH;

  if (origW > maxW || origH > maxH) {
    const ratio = Math.min(maxW / origW, maxH / origH);
    targetW = Math.round(origW * ratio);
    targetH = Math.round(origH * ratio);
  }

  // Draw to canvas
  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  // Encode as JPEG with progressive quality reduction
  let blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });

  // If still too large, reduce quality iteratively (max 3 passes)
  let attempts = 0;
  while (blob.size > maxSize && quality > 0.4 && attempts < 3) {
    quality -= 0.1;
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    attempts++;
  }

  const compressedName = file.name.replace(/\.[^.]+$/, '.jpg');

  console.debug(
    `[ImageUtils] Compressed: ${(file.size / 1024).toFixed(0)}KB → ${(blob.size / 1024).toFixed(0)}KB ` +
    `(${Math.round((1 - blob.size / file.size) * 100)}% reduction, quality=${quality.toFixed(2)}, ${targetW}×${targetH})`
  );

  return new File([blob], compressedName, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

/**
 * Check if a file needs compression (useful for UI feedback)
 */
export function needsCompression(file: File): boolean {
  return file.type.startsWith('image/') && file.size > MAX_SIZE_BYTES;
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
