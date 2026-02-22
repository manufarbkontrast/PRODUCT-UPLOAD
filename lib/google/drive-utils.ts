/**
 * Escape a string for use in Google Drive API query parameters.
 * Single quotes must be escaped with a backslash in Drive query syntax.
 */
export function escapeDriveQuery(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
