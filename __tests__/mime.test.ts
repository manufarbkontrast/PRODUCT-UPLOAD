import { describe, it, expect } from 'vitest';
import { mimeToExtension, extensionFromMimeOrUrl } from '@/lib/mime';

describe('mimeToExtension', () => {
  it('converts known image/jpeg to jpg', () => {
    expect(mimeToExtension('image/jpeg')).toBe('jpg');
  });

  it('converts known image/png to png', () => {
    expect(mimeToExtension('image/png')).toBe('png');
  });

  it('converts known image/webp to webp', () => {
    expect(mimeToExtension('image/webp')).toBe('webp');
  });

  it('converts known image/gif to gif', () => {
    expect(mimeToExtension('image/gif')).toBe('gif');
  });

  it('returns png default for unknown mime type', () => {
    expect(mimeToExtension('image/svg+xml')).toBe('png');
  });

  it('returns custom fallback for unknown mime type', () => {
    expect(mimeToExtension('image/svg+xml', 'svg')).toBe('svg');
  });

  it('returns custom fallback when mime type is empty', () => {
    expect(mimeToExtension('', 'jpg')).toBe('jpg');
  });
});

describe('extensionFromMimeOrUrl', () => {
  it('uses mime type when known', () => {
    expect(extensionFromMimeOrUrl('image/jpeg', 'https://example.com/photo.png')).toBe('jpg');
  });

  it('falls back to URL extension when mime is unknown', () => {
    expect(extensionFromMimeOrUrl('application/octet-stream', 'https://example.com/photo.png')).toBe('png');
  });

  it('falls back to URL extension with query parameters', () => {
    expect(extensionFromMimeOrUrl('application/octet-stream', 'https://example.com/photo.webp?v=123')).toBe('webp');
  });

  it('normalizes jpeg to jpg from URL', () => {
    expect(extensionFromMimeOrUrl('application/octet-stream', 'https://example.com/photo.jpeg')).toBe('jpg');
  });

  it('returns jpg as default when both mime and URL are invalid', () => {
    expect(extensionFromMimeOrUrl('application/octet-stream', 'https://example.com/file')).toBe('jpg');
  });

  it('returns jpg when URL has unsupported extension', () => {
    expect(extensionFromMimeOrUrl('application/octet-stream', 'https://example.com/file.svg')).toBe('jpg');
  });

  it('handles URL with uppercase extension', () => {
    expect(extensionFromMimeOrUrl('application/octet-stream', 'https://example.com/photo.PNG')).toBe('png');
  });

  it('extracts gif from URL when mime is unknown', () => {
    expect(extensionFromMimeOrUrl('application/octet-stream', 'https://example.com/animation.gif')).toBe('gif');
  });
});
