/**
 * Prefixes a path with the app's configured base path (`NEXT_PUBLIC_BASE_PATH`,
 * e.g. `/erfassung` when served under a subpath on the shared Hetzner host).
 *
 * Next.js automatically rewrites `next/link`, `next/image` and router
 * navigation to include `basePath` — but it does NOT rewrite raw
 * `fetch('/api/...')` calls or raw `<img src="/foo.svg">` references to files
 * in `/public`. Route those through this helper instead.
 *
 * - Returns the path unchanged when no base path is configured (empty string
 *   or unset), so local dev and tests without `NEXT_PUBLIC_BASE_PATH` keep
 *   working exactly as before.
 * - Idempotent: a path that is already prefixed with the base path is
 *   returned unchanged, so it is safe to call more than once on the same
 *   value.
 * - Handles the root path `/` without producing a trailing slash
 *   (`withBasePath('/')` with base `/erfassung` returns `/erfassung`, not
 *   `/erfassung/`).
 */
export function withBasePath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

  if (base === '') {
    return path;
  }

  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;

  if (path === normalizedBase || path.startsWith(`${normalizedBase}/`)) {
    return path;
  }

  if (path === '/') {
    return normalizedBase;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
}
