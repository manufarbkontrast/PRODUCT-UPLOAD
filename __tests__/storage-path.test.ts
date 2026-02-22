import { describe, it, expect } from 'vitest';
import { extractStoragePath } from '@/lib/supabase/storage-path';

describe('extractStoragePath', () => {
  const bucket = 'product-images';

  it('extracts path after bucket name in full URL', () => {
    const fullUrl = 'https://xxx.supabase.co/storage/v1/object/public/product-images/abc/photo.jpg';
    expect(extractStoragePath(fullUrl, bucket)).toBe('abc/photo.jpg');
  });

  it('extracts path with multiple segments', () => {
    const fullUrl = 'https://xxx.supabase.co/storage/v1/object/public/product-images/folder/subfolder/image.png';
    expect(extractStoragePath(fullUrl, bucket)).toBe('folder/subfolder/image.png');
  });

  it('returns original path if bucket name not found', () => {
    const path = 'some/other/path.jpg';
    expect(extractStoragePath(path, bucket)).toBe(path);
  });

  it('handles paths that are already relative', () => {
    const relativePath = 'abc/photo.jpg';
    expect(extractStoragePath(relativePath, bucket)).toBe(relativePath);
  });

  it('handles different bucket names', () => {
    const fullUrl = 'https://xxx.supabase.co/storage/v1/object/public/avatars/user/profile.jpg';
    expect(extractStoragePath(fullUrl, 'avatars')).toBe('user/profile.jpg');
  });

  it('handles URLs with query parameters', () => {
    const fullUrl = 'https://xxx.supabase.co/storage/v1/object/public/product-images/abc/photo.jpg?v=123';
    expect(extractStoragePath(fullUrl, bucket)).toBe('abc/photo.jpg?v=123');
  });

  it('handles simple filename without folders', () => {
    const fullUrl = 'https://xxx.supabase.co/storage/v1/object/public/product-images/photo.jpg';
    expect(extractStoragePath(fullUrl, bucket)).toBe('photo.jpg');
  });

  it('returns empty string for bucket marker at end', () => {
    const fullUrl = 'https://xxx.supabase.co/storage/v1/object/public/product-images/';
    expect(extractStoragePath(fullUrl, bucket)).toBe('');
  });

  it('handles URLs with special characters in path', () => {
    const fullUrl = 'https://xxx.supabase.co/storage/v1/object/public/product-images/folder/image-name_123.jpg';
    expect(extractStoragePath(fullUrl, bucket)).toBe('folder/image-name_123.jpg');
  });
});
