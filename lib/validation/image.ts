/**
 * Image validation utilities — magic byte verification and size limits.
 */

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Known image magic byte signatures (matched at byte offset 0) */
const MAGIC_BYTES: ReadonlyArray<{ mime: string; bytes: readonly number[] }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header (first 4 bytes)
  { mime: 'image/bmp', bytes: [0x42, 0x4d] },
  { mime: 'image/tiff', bytes: [0x49, 0x49, 0x2a, 0x00] }, // little-endian
  { mime: 'image/tiff', bytes: [0x4d, 0x4d, 0x00, 0x2a] }, // big-endian
];

/**
 * HEIC/HEIF/AVIF use ISO BMFF container format (ftyp box).
 * Bytes 4-7 must be "ftyp" and bytes 8-11 contain the brand code.
 */
const FTYP_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'avif', 'avis'] as const;

function isFtypImage(header: Uint8Array): boolean {
  if (header.length < 12) return false;
  // Bytes 4-7 must be ASCII "ftyp"
  const ftyp = String.fromCharCode(header[4], header[5], header[6], header[7]);
  if (ftyp !== 'ftyp') return false;
  // Bytes 8-11 are the major brand
  const brand = String.fromCharCode(header[8], header[9], header[10], header[11]);
  return (FTYP_BRANDS as readonly string[]).includes(brand);
}

interface ImageValidationResult {
  readonly valid: boolean;
  readonly error?: string;
}

/**
 * Validate image file size (before reading the full buffer).
 */
export function validateImageSize(sizeBytes: number): ImageValidationResult {
  if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Datei zu groß: ${sizeMB} MB (max ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB)`,
    };
  }
  return { valid: true };
}

/**
 * Validate that a buffer's magic bytes match a known image format.
 */
export function validateImageMagicBytes(buffer: ArrayBuffer): ImageValidationResult {
  const header = new Uint8Array(buffer, 0, Math.min(12, buffer.byteLength));

  const isKnown = MAGIC_BYTES.some(({ bytes }) =>
    bytes.every((b, i) => header[i] === b)
  ) || isFtypImage(header);

  if (!isKnown) {
    return {
      valid: false,
      error: 'Datei ist kein gültiges Bildformat (ungültige Magic Bytes)',
    };
  }

  return { valid: true };
}
