import { describe, it, expect } from 'vitest';
import { resolveStorageUrl } from '@/lib/supabase/storage-url';

describe('resolveStorageUrl', () => {
  const mockSupabase = {
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`,
          },
        }),
      }),
    },
  } as any;

  const bucket = 'product-images';

  it('returns null for null path', () => {
    expect(resolveStorageUrl(mockSupabase, null, bucket)).toBeNull();
  });

  it('returns null for undefined path', () => {
    expect(resolveStorageUrl(mockSupabase, undefined, bucket)).toBeNull();
  });

  it('returns null for empty string path', () => {
    expect(resolveStorageUrl(mockSupabase, '', bucket)).toBeNull();
  });

  it('returns null for non-string path (number)', () => {
    expect(resolveStorageUrl(mockSupabase, 123, bucket)).toBeNull();
  });

  it('returns null for non-string path (object)', () => {
    expect(resolveStorageUrl(mockSupabase, {}, bucket)).toBeNull();
  });

  it('resolves a valid storage path to a public URL', () => {
    const result = resolveStorageUrl(mockSupabase, 'abc/photo.jpg', bucket);
    expect(result).toBe('https://example.supabase.co/storage/v1/object/public/product-images/abc/photo.jpg');
  });

  it('returns path unchanged if it starts with http', () => {
    const fullUrl = 'http://example.com/image.jpg';
    expect(resolveStorageUrl(mockSupabase, fullUrl, bucket)).toBe(fullUrl);
  });

  it('returns path unchanged if it starts with https', () => {
    const fullUrl = 'https://example.com/image.jpg';
    expect(resolveStorageUrl(mockSupabase, fullUrl, bucket)).toBe(fullUrl);
  });

  it('handles paths with multiple segments', () => {
    const result = resolveStorageUrl(mockSupabase, 'folder/subfolder/image.png', bucket);
    expect(result).toBe('https://example.supabase.co/storage/v1/object/public/product-images/folder/subfolder/image.png');
  });

  it('handles paths with special characters', () => {
    const result = resolveStorageUrl(mockSupabase, 'folder/image-name_123.jpg', bucket);
    expect(result).toBe('https://example.supabase.co/storage/v1/object/public/product-images/folder/image-name_123.jpg');
  });
});
