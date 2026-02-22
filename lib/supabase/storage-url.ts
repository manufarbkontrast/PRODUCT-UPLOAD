import { createServiceRoleClient } from './server';

/**
 * Resolve a Supabase Storage path to a public URL.
 * If the path is already a full URL, return it as-is.
 * Returns null for missing or non-string paths.
 */
export function resolveStorageUrl(
  supabase: ReturnType<typeof createServiceRoleClient>,
  path: unknown,
  bucket: string
): string | null {
  if (!path || typeof path !== 'string') return null;
  if (path.startsWith('http')) return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
