# Task 7 Report — Kamera-Capture mit Live-Overlay & Anleitung

## Status: DONE

## Files
- New: `lib/guided-capture.ts` — pure, immutable state machine (`start`, `openCamera`,
  `capture`, `retake`, `confirm`, `backToInstructions`, selectors `currentView`/`isComplete`).
- New: `lib/__tests__/guided-capture.test.ts` — 18 tests (flow transitions + `classifyCameraError`
  mapping), written first (RED confirmed before `lib/guided-capture.ts` existed, then GREEN).
- New: `lib/camera-errors.ts` — `classifyCameraError` extracted from `EanScanner.tsx` verbatim
  (byte-identical logic). `EanScanner.tsx` itself was **not modified** — left untouched per the
  "if unsure, leave EanScanner alone" instruction, since its geometry was just reviewed.
- New: `components/GuidedPhotoCapture.tsx` — thin client component consuming the state machine;
  Anleitung → Aufnahme (live camera + semi-transparent `pointer-events-none` silhouette overlay,
  `aspect-[4/3]` `object-cover`, same crop geometry as `EanScanner` via `computeScanCropRect`
  with `widthPct=1, heightPct=1`) → Vorschau (Wiederholen/Übernehmen) → repeat for the 4 canonical
  views → auto-triggers `/api/products/{id}/process` when complete.
- Modified: `app/products/[id]/images/page.tsx` — added a "Geführte Aufnahme starten" button
  (shoe products only) that mounts `GuidedPhotoCapture` alongside (not replacing) `ImageUploader`.
- Modified: `app/api/products/[id]/images/route.ts` — extended (not replaced) the existing upload
  endpoint to accept an optional `sortOrder` FormData field; falls back to the previous
  count-based `sort_order` when absent, so `ImageUploader`'s behavior is unchanged.
- Modified: `config/constants.ts` — added `CAPTURE_CONTAINER_ASPECT` (4/3) and
  `CAPTURE_JPEG_QUALITY` (0.9), kept separate from `SCAN_CONTAINER_ASPECT` (EanScanner-owned)
  even though the value is currently identical.

## Reuse of the existing upload path
`GuidedPhotoCapture` uploads through the SAME endpoint `ImageUploader` uses
(`POST /api/products/{id}/images`, `FormData` with `file`), writing to the same
`product-images` Storage bucket and the same `product_images` table. The only change to that
route is an additive, backward-compatible `sortOrder` field so the guided flow can write
`sort_order = view.sortOrder` deterministically (the brief requires this explicitly, and the
employee already knows which of the 4 canonical views they're capturing — no need to guess via
the Gemini vision classifier). After all 4 views are captured, it calls
`POST /api/products/{id}/process` — the identical call `page.tsx`'s `handleProcessImages` makes.

## Verification
- `npx tsc --noEmit` — clean, no errors.
- `npx vitest run lib/__tests__/guided-capture.test.ts` — **18 passed** (18).
- `npx vitest run` (full suite) — **120 passed** (12 files), no regressions.
- `npm run build` — succeeded (Next.js 16, Turbopack), all routes compiled incl.
  `/products/[id]/images`.
- `npx eslint` on touched files — 0 errors, 4 pre-existing-pattern `<img>`/`exhaustive-deps`
  warnings consistent with the rest of the codebase (e.g. `page.tsx` already used `<img>` the
  same way before this change).

## Concerns / notes
- The `sortOrder` FormData extension on `POST /api/products/[id]/images` is new server-side
  surface area; it validates the value is a non-negative integer and 400s otherwise. Worth a
  security-reviewer pass if this endpoint is internet-facing beyond `requireUser()` auth (it
  already is behind `requireUser()`, unchanged).
- No unique DB constraint exists on `(product_id, sort_order)` (confirmed via
  `supabase/migrations/20260715_erfassung_products_mycrafton.sql`), so two images can share a
  `sort_order` if the guided flow and the classic uploader/classifier are used concurrently on
  the same product — same pre-existing risk as today's `classify` endpoint reassigning
  `sort_order`, not introduced by this task.
- `GuidedPhotoCapture` computes its list of missing views once on mount
  (`getMissingViews(existingSortOrders)`) and does not re-derive mid-session; if the user
  finishes elsewhere in another tab while the guided flow is open, the two could disagree until
  the flow is reopened. Acceptable for a single-employee, single-tab workflow.

## P4b review fixes (bound sortOrder validation, camera-stream leak, process-error visibility)

Fixed all 3 findings from the P4b review, one commit.

### Fix 1 (Important) — bound sortOrder validation
- New `lib/sort-order.ts`: pure `parseSortOrder(raw: unknown): number | null`, immutable,
  strict-mode-clean, no `any`. Returns the integer only if it's an integer within
  `[0, SHOE_VIEWS.length)` (bound imported from `config/shoe-views.ts`, currently 4).
- `app/api/products/[id]/images/route.ts`: `explicitSortOrder` now derived via
  `parseSortOrder(Number(rawSortOrder))`. Out-of-range/garbage values (e.g. `999999`) now 400
  with the existing message `Ungueltiger sortOrder-Wert` instead of reaching
  `product_images.sort_order`. Absent-field fallback (count-based sort_order) untouched.
  `requireUser()` auth gate untouched.
- TDD: `lib/__tests__/sort-order.test.ts` written first (RED — module missing), then
  `lib/sort-order.ts` implemented (GREEN). 11 tests: valid 0..3, boundary `SHOE_VIEWS.length`
  (rejected) and `SHOE_VIEWS.length - 1` (accepted), `-1`, `999999`, `1.5`, `NaN`, `"2"` (string),
  `null`, `undefined`, `{}` — all rejected.

### Fix 2 (Important) — camera MediaStream leak on fast unmount/cancel
- `components/GuidedPhotoCapture.tsx`: added `mountedRef` (flipped false in unmount cleanup) and
  `requestIdRef` (bumped on every `stopCamera()` call, i.e. every phase change away from
  'aufnahme' and on unmount). `openLiveCamera()` captures the current `requestId` before the
  `await getUserMedia(...)`; after it resolves, if `!mountedRef.current` or the id is stale, the
  resolved stream's tracks are stopped immediately and it is never assigned to `streamRef`/video.
  Same guard applied to the catch branch so a stale permission-denial doesn't set error state for
  an abandoned request. The existing `useEffect` phase-cleanup already called `stopCamera()` on
  unmount (confirmed, no change needed there) — it now also correctly invalidates in-flight
  requests via the bumped `requestIdRef`.
- `components/EanScanner.tsx` intentionally left untouched (pre-existing P3-reviewed pattern).

### Fix 3 (Minor) — surface process-trigger failure
- `components/GuidedPhotoCapture.tsx`: the `complete`-phase `useEffect` that POSTs
  `/api/products/{id}/process` now checks `res.ok`, parses the error body, and throws — mirroring
  `handleProcessImages` in `app/products/[id]/images/page.tsx:151-158`. On failure it sets a new
  `processError` state (German message) instead of only `console.error`-ing.
- The "complete" screen (SHOE_VIEWS all captured) now renders `processError` in red in place of
  the "Verarbeitung wurde gestartet..." line when the trigger failed, so the UI no longer claims
  success it didn't achieve.

### Verification
- `npx tsc --noEmit` — clean, no errors.
- `npx vitest run lib/__tests__/sort-order.test.ts` — 11/11 passed.
- `npx vitest run` (full suite) — 13 files / 131 tests passed.
- `npm run build` — succeeded (Next.js 16, Turbopack), all routes compiled incl.
  `/api/products/[id]/images` and `/products/[id]/images`.

### Notes
- `.gitignore` and `.superpowers/sdd/progress.md` had pre-existing unstaged changes unrelated to
  this task at the start of this session; left out of the commit per "commit only your changed
  files."
