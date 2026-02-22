/**
 * Shared MIME type to file extension mapping for image files.
 */

const MIME_TO_EXTENSION: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Get file extension from a MIME type.
 * Falls back to the given default (default: 'png').
 */
export function mimeToExtension(mimeType: string, fallback: string = 'png'): string {
  return MIME_TO_EXTENSION[mimeType] || fallback;
}

/**
 * Get file extension from MIME type or URL path.
 * Used for naming files when uploading to Google Drive.
 */
export function extensionFromMimeOrUrl(mimeType: string, url: string): string {
  if (MIME_TO_EXTENSION[mimeType]) return MIME_TO_EXTENSION[mimeType];
  const urlExt = url.split('.').pop()?.split('?')[0]?.toLowerCase();
  if (urlExt && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(urlExt)) {
    return urlExt === 'jpeg' ? 'jpg' : urlExt;
  }
  return 'jpg';
}
