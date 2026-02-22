import { describe, it, expect } from 'vitest';
import { validateImageSize, validateImageMagicBytes } from '@/lib/validation/image';

describe('validateImageSize', () => {
  it('accepts files under limit', () => {
    const result = validateImageSize(5 * 1024 * 1024); // 5 MB
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts files at exact limit', () => {
    const result = validateImageSize(10 * 1024 * 1024); // 10 MB
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects files over limit', () => {
    const result = validateImageSize(15 * 1024 * 1024); // 15 MB
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('15.0 MB');
  });

  it('rejects significantly oversized files', () => {
    const result = validateImageSize(50 * 1024 * 1024); // 50 MB
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('accepts very small files', () => {
    const result = validateImageSize(1024); // 1 KB
    expect(result.valid).toBe(true);
  });

  it('accepts zero-byte files', () => {
    const result = validateImageSize(0);
    expect(result.valid).toBe(true);
  });
});

describe('validateImageMagicBytes', () => {
  it('accepts valid JPEG magic bytes', () => {
    const buffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).buffer;
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts valid PNG magic bytes', () => {
    const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts valid GIF magic bytes (GIF87a)', () => {
    const buffer = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]).buffer;
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts valid GIF magic bytes (GIF89a)', () => {
    const buffer = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]).buffer;
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts valid WebP magic bytes (RIFF)', () => {
    const buffer = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]).buffer;
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts valid BMP magic bytes', () => {
    const buffer = new Uint8Array([0x42, 0x4d, 0x00, 0x00]).buffer;
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts valid TIFF magic bytes (little-endian)', () => {
    const buffer = new Uint8Array([0x49, 0x49, 0x2a, 0x00]).buffer;
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts valid TIFF magic bytes (big-endian)', () => {
    const buffer = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]).buffer;
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts valid HEIC magic bytes (ftyp box)', () => {
    // HEIC: 4 bytes box size + "ftyp" + "heic"
    const buffer = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, // box size
      0x66, 0x74, 0x79, 0x70, // "ftyp"
      0x68, 0x65, 0x69, 0x63, // "heic" brand
    ]).buffer;
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(true);
  });

  it('accepts valid AVIF magic bytes (ftyp box)', () => {
    const buffer = new Uint8Array([
      0x00, 0x00, 0x00, 0x20, // box size
      0x66, 0x74, 0x79, 0x70, // "ftyp"
      0x61, 0x76, 0x69, 0x66, // "avif" brand
    ]).buffer;
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(true);
  });

  it('accepts HEIF with mif1 brand', () => {
    const buffer = new Uint8Array([
      0x00, 0x00, 0x00, 0x1c,
      0x66, 0x74, 0x79, 0x70, // "ftyp"
      0x6d, 0x69, 0x66, 0x31, // "mif1"
    ]).buffer;
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(true);
  });

  it('rejects ftyp box with unknown brand', () => {
    const buffer = new Uint8Array([
      0x00, 0x00, 0x00, 0x18,
      0x66, 0x74, 0x79, 0x70, // "ftyp"
      0x6d, 0x70, 0x34, 0x32, // "mp42" (video, not image)
    ]).buffer;
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(false);
  });

  it('rejects non-image files', () => {
    const buffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer; // ZIP file
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects empty buffers', () => {
    const buffer = new Uint8Array([]).buffer;
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects text files', () => {
    const buffer = new TextEncoder().encode('This is a text file').buffer;
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects PDF files', () => {
    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer; // %PDF
    const result = validateImageMagicBytes(buffer);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});
