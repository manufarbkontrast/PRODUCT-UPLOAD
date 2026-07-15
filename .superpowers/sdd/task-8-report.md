# Task 8 Report — Deploy-Vorbereitung (basePath /erfassung, Drive optional, Docker/Caddy/CI)

## Status: DONE

## Commit
`e3759435dd42ecd4ae6348d323cfac3866daf7d7` — "feat: deploy-vorbereitung (basePath /erfassung, drive optional, docker/caddy/ci)"

## Task A — basePath `/erfassung`

`next.config.ts`: single source of truth is `const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/erfassung'`,
used for `basePath`, `assetPrefix`, and re-exposed to the client bundle via Next's `env` config key
(`env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH }`) — no `'/erfassung'` literal duplicated anywhere else.
`output: 'standalone'` stays env-gated exactly as before (`DOCKER_BUILD === '1'`, this repo's
pre-existing flag name — functionally identical gating pattern to the cockpit's `BUILD_STANDALONE`,
kept as-is instead of renaming to avoid touching the legacy root `Dockerfile`/`docker-compose.yml`,
which are for a different, older deploy target — see Concerns). Also added `turbopack: { root: __dirname }`
because a stray lockfile one directory above this repo made Next mis-detect the workspace root and
nest `.next/standalone/server.js` two levels deep — this would have silently broken the Docker image's
`CMD ["node", "server.js"]`. Verified empirically: without the fix, `server.js` landed at
`.next/standalone/Downloads/product-upload/server.js`; with it, at `.next/standalone/server.js`.

`lib/base-path.ts` (new) exports `withBasePath(path: string): string`, TDD'd first
(`lib/__tests__/base-path.test.ts`, confirmed RED — "Cannot find package '@/lib/base-path'" — then GREEN,
7 tests): empty/unset base → unchanged, `/erfassung` + `/api/x` → `/erfassung/api/x`, idempotent on an
already-prefixed path, and root `/` → `/erfassung` (no trailing slash).

Every raw `fetch('/…')` in client components and every raw `/public`-asset `src` was routed through it:
- `contexts/AuthContext.tsx` — `/api/auth/logout`
- `app/fotografieren/page.tsx` — `/api/products` (GET + POST)
- `app/login/page.tsx` — `/api/auth/login`
- `app/abfrage/page.tsx` — `/api/jtl-lookup`
- `app/products/[id]/images/page.tsx` — 7 calls: get product, upload, process, upload (retry), delete, classify, delete image
- `components/ImageUploader.tsx` — image upload, classify
- `components/ReorderButton.tsx` — reorder lookup (GET) and reorder (POST)
- `components/GuidedPhotoCapture.tsx` — process trigger, image upload, **and** the two `<img src={...}>`
  refs to `config/shoe-views.ts`'s `piktogramm`/`silhouette` `/foto-guide/*.svg` files (applied at
  render time in the component, not hardcoded into the config — config stays deploy-agnostic)
- `components/EanScanner.tsx` — `/api/jtl-lookup`

Not prefixed (correctly, per the constraint): `next/link href="/"` (images/page.tsx, Header.tsx — Next
rewrites these automatically), `useRouter().push(...)` calls (also auto-rewritten), and all external/
Google/Shopify/Supabase URLs in server-side `lib/*` and `app/api/*` code.

**Extra fix beyond the explicit list**: `app/api/google/callback/route.ts` builds a raw (non-Next-Link)
`<a href="/">` in a server-rendered HTML string, and two `NextResponse.redirect(new URL('/?auth_error=…', request.url))`
calls. Neither goes through Next's basePath-aware `NextURL`/`Link` machinery (unlike `lib/supabase/middleware.ts`,
which correctly uses `request.nextUrl.clone()` and needed no change). Left unfixed, these would have
redirected/linked to the *host root* (the cockpit) instead of back into `/erfassung` after a Google OAuth
callback. Fixed by wrapping the paths in `withBasePath(...)`.

Verified via a real running `next build` (`DOCKER_BUILD=1`) + `node server.js`: `GET /erfassung/api/health`
→ 200, `GET /api/health` (no prefix) → 404 — confirming Next expects the *full* prefixed path, which is
also why the Caddy snippet in Task C uses `handle` and NOT `handle_path` (see below).

## Task B — Google Drive optional

`lib/google/auth.ts`: new pure-ish function `isDriveConfigured()` (env/file check only, no network calls)
— true if `GOOGLE_SERVICE_ACCOUNT_JSON` (env) OR a local service-account file exists OR
`GOOGLE_CLIENT_ID`+`GOOGLE_CLIENT_SECRET` (OAuth2) are set; re-exported from `lib/google/index.ts`.
TDD'd in `lib/__tests__/is-drive-configured.test.ts` (4 tests, all green): unset → false, OAuth2 pair → true,
client-id-only → false, service-account-json → true.

Two call sites gate on it, both **before** attempting `uploadProductToDrive`:
- `app/api/products/[id]/upload/route.ts`: if not configured, skip the Drive step entirely, set
  `products.status = 'uploaded'` (drive_url stays whatever it was, i.e. `null` on first upload), return
  `{ success: true, driveSkipped: true, driveUrl: null, message: '...' }`. If configured, behavior is
  byte-identical to before (unchanged code path, unchanged `drive_error` on failure).
- `app/api/webhooks/n8n/route.ts` (the auto-upload-on-all-images-done path): same guard — if not
  configured, sets `status = 'uploaded'` directly and skips the `try { uploadProductToDrive(...) } catch { status = 'drive_error' }`
  block entirely, so a missing Drive config can never produce `drive_error`. If configured, unchanged.

`'uploaded'` was chosen as the "normal success state" because it's the existing terminal/success status
in `validStatuses` (`config/product.ts`) — no schema change, no new status added. `drive_url` simply stays
`null` when Drive is skipped; nothing in the UI (`app/products/[id]/images/page.tsx`) treats a null
`drive_url` as an error — it's only used to render an optional Drive link when present.

## Task C — deploy scaffolding (new files, not executed)
- `deploy/Dockerfile` — mirrors `brain-cockpit/Dockerfile` structure (single build stage, `node:22-alpine`,
  non-root `USER node`, standalone runner), with build ARGs for `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` and
  `NEXT_PUBLIC_BASE_PATH` (defaults to `/erfassung`), `DOCKER_BUILD=1` baked in.
- `deploy/docker-compose.yml` — service named `erfassung` (not `app`, to avoid colliding with cockpit's
  own service name on the shared host), `expose: 3000` only (no host port), a healthcheck against
  `/erfassung/api/health`, and **deliberately no Caddy service** (cockpit's Caddy already owns 80/443 on
  this shared host). Documents, in comments, that a shared external Docker network (`shared-edge`) must be
  created once (`docker network create shared-edge`) and joined by *both* this compose file and the
  (out-of-repo) cockpit compose file — I cannot make that second edit myself since it lives outside this repo.
- `deploy/Caddyfile` — top comment states this belongs in the shared server Caddyfile, not deployed
  standalone. Uses `handle /erfassung/* { reverse_proxy erfassung:3000 }` — **`handle`, not `handle_path`**:
  I initially wrote `handle_path` (which strips the prefix) and caught it via the empirical basePath test
  above; `handle_path` would have made Next 404 on every request once proxied.
- `.github/workflows/deploy.yml` — mirrors cockpit's test → rsync → `docker compose build/up` shape, deploys
  to `/opt/erfassung` (deliberately distinct from the legacy `/opt/spz-product-upload` target used by the
  pre-existing `deploy.sh`, which points at a different server/91.99.3.104 and is untouched). Top comment
  lists required secrets: `HETZNER_HOST`, `HETZNER_SSH_KEY`; runtime + build-arg env comes from a
  server-side `deploy/.env` (never touched by rsync/CI), documented in `.env.example`.
- `.env.example` (root) — rewritten for this deploy target: `NEXT_PUBLIC_BASE_PATH=/erfassung` with an
  explanation of why it's the single source used by `next.config.ts`, all required vars
  (Supabase, Gemini, admin/login), and a clearly fenced OPTIONAL block for every `GOOGLE_*` Drive var
  explaining the skip behavior. `GOOGLE_REDIRECT_URI` placeholder updated to include `/erfassung` (verified
  necessary via the same curl test — Next won't match `/api/google/callback` without the prefix). No real
  secrets anywhere (grepped for API-key-shaped strings before committing — none found).

## Verification
- `npx tsc --noEmit` — clean.
- `npx vitest run lib/__tests__/base-path.test.ts`:
  ```
  ✓ lib/__tests__/base-path.test.ts (7 tests) 5ms
  Test Files  1 passed (1)
       Tests  7 passed (7)
  ```
- `npx vitest run lib/__tests__/is-drive-configured.test.ts` — 4 passed (4).
- `npx vitest run` (full suite) — **142 passed (15 test files)**, no regressions.
- `npm run build` (default, basePath active, no standalone) — succeeds.
- `DOCKER_BUILD=1 npm run build` (standalone, the Docker path) — succeeds; confirmed
  `.next/standalone/server.js` exists at the correct root path after the `turbopack.root` fix.
- Ran the standalone server locally and curled it: `/erfassung/api/health` → 200, `/api/health` → 404,
  which is *why* the Caddyfile uses `handle` instead of `handle_path`.

## Concerns
- `DOCKER_BUILD` (not `BUILD_STANDALONE`) is the env-var name gating standalone output, differing from the
  cockpit's naming. Kept for consistency with this repo's own pre-existing root `Dockerfile`/`docker-compose.yml`
  (an older, unrelated deploy target for a different server, Postgres/n8n-based, untouched by this task) —
  changing it would have meant editing that legacy Dockerfile too, which felt like unnecessary scope/risk.
  If the reviewer wants exact naming parity with the cockpit repo, this is a one-line rename plus updating
  the (already-existing, unused-by-this-task) legacy Dockerfile.
- The shared Docker network (`shared-edge`) that lets cockpit's Caddy reach `erfassung:3000` cannot be fully
  wired up from this repo — it requires a one-time `docker network create shared-edge` on the server and a
  small edit to `brain-cockpit/deploy/docker-compose.yml` (adding `shared-edge` to the `app` and `caddy`
  services), which lives outside this repo and outside my permitted scope. Documented in-line in
  `deploy/docker-compose.yml` and `deploy/Caddyfile`.
- No new deploy actions were run — no SSH, no server changes, nothing pushed to `origin`.
