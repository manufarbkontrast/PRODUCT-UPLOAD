/**
 * Extract the relative storage path from a full Supabase Storage URL.
 * If the path is already relative, return it as-is.
 *
 * Example:
 *   "https://xxx.supabase.co/storage/v1/object/public/product-images/abc/photo.jpg"
 *   → "abc/photo.jpg"
 */
export function extractStoragePath(fullPath: string, bucket: string): string {
  const marker = `/${bucket}/`;
  if (fullPath.includes(marker)) {
    return fullPath.split(marker).pop()!;
  }
  return fullPath;
}
