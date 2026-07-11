/**
 * Extract width and height from PNG or JPEG image buffers.
 *
 * PNG: width at bytes 16–19, height at bytes 20–23 (big-endian 32-bit).
 * JPEG: find the SOF0 marker (0xFF 0xC0), then read height at offset +5
 * and width at offset +7 (big-endian 16-bit each).
 *
 * Returns `null` when dimensions cannot be determined (insufficient data,
 * invalid marker, or unsupported type).
 */

export type ImageMimeType = 'image/png' | 'image/jpeg';

export interface ImageDimensions {
  width: number;
  height: number;
}

export function extractImageDimensions(
  buffer: ArrayBuffer,
  mimeType: ImageMimeType,
): ImageDimensions | null {
  const view = new DataView(buffer);

  try {
    switch (mimeType) {
      case 'image/png':
        return extractPngDimensions(view);
      case 'image/jpeg':
        return extractJpegDimensions(view);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

/**
 * PNG IHDR dimensions are stored as big-endian 32-bit unsigned integers
 * starting at offset 16 (width) and offset 20 (height).
 *
 * Minimum valid PNG header is 33 bytes: 8-byte signature + IHDR chunk
 * (4 len + 4 type + 13 data + 4 CRC).
 */
function extractPngDimensions(view: DataView): ImageDimensions | null {
  if (view.byteLength < 33) {
    return null;
  }

  const width = view.getUint32(16);
  const height = view.getUint32(20);

  // Sanity-check: zero dimensions are invalid for a real image
  if (width === 0 || height === 0) {
    return null;
  }

  return { width, height };
}

// ---------------------------------------------------------------------------
// JPEG
// ---------------------------------------------------------------------------

/**
 * Scan the buffer for the SOF0 marker (0xFF 0xC0) and read the dimensions
 * from its parameters:
 *
 *   [0xFF 0xC0] [length 2] [precision 1] [height 2] [width 2] …
 *                                          ^offset+5   ^offset+7
 *
 * Returns null if the marker is never found or the image is truncated.
 */
function extractJpegDimensions(view: DataView): ImageDimensions | null {
  const length = view.byteLength;
  let offset = 2; // skip the initial SOI marker (0xFF 0xD8)

  while (offset + 1 < length) {
    // Scan for a 0xFF byte (marker prefix)
    if (view.getUint8(offset) !== 0xff) {
      offset++;
      continue;
    }

    const marker = view.getUint8(offset + 1);

    // SOF0 (Start of Frame – baseline DCT)
    if (marker === 0xc0) {
      if (offset + 9 >= length) {
        return null; // not enough data for SOF0 parameters
      }

      // offset+2..+3 = segment length (skip), offset+4 = precision
      const height = view.getUint16(offset + 5);
      const width = view.getUint16(offset + 7);

      if (width === 0 || height === 0) {
        return null;
      }

      return { width, height };
    }

    // SOS (Start Of Scan) – no more metadata markers after it
    if (marker === 0xda) {
      return null;
    }

    // Skip the payload of the current marker
    if (marker === 0x01 || marker === 0xd0 || marker === 0xd1 ||
        marker === 0xd2 || marker === 0xd3 || marker === 0xd4 ||
        marker === 0xd5 || marker === 0xd6 || marker === 0xd7 ||
        marker === 0xd8) {
      // Standalone markers (no payload)
      offset += 2;
    } else {
      // Markers with a 2-byte length field (includes itself)
      if (offset + 3 >= length) {
        return null;
      }
      const segLen = view.getUint16(offset + 2);
      if (segLen < 2) {
        return null; // malformed
      }
      offset += 2 + segLen;
    }
  }

  return null;
}
