# SPZ Product Upload

Next.js 16 App fuer Produkt-Fotografie-Workflow.
EAN scannen → Shopify-Lookup → Bilder hochladen → AI Background-Removal → Google Drive Upload.

## Quick Start

```bash
npm run dev          # Dev-Server (localhost:3000, AUTH_DISABLED=true)
npx vitest run       # Tests ausfuehren (6 Tests)
npx next build       # Production Build
vercel --prod --yes  # Vercel Deployment
```

## Wichtige Pfade

- `app/page.tsx` — Startseite: EAN-Scanner + Produktliste
- `app/products/[id]/images/page.tsx` — Produktansicht: Bilder, Upload, Processing
- `app/api/` — Alle API-Routes (Products, Images, Webhooks, Auth, Google)
- `lib/supabase/` — Supabase Client/Server/Middleware
- `config/constants.ts` — Konfigurierbare Werte (Timeouts, Retries, Limits)

## Konventionen

- UI-Texte auf Deutsch
- `fetch()` zu API-Routes, nie direkter Supabase-Zugriff vom Client
- `createServiceRoleClient()` in API-Routes (bypass RLS)
- `window.confirm()` fuer destruktive Aktionen
- Error-Pattern: `err instanceof Error ? err.message : 'Fallback'`
- Commit-Style: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`

## Session Context

Aktuelle Session-Snapshots: `.claude/context/`
Letzter Stand: `.claude/context/latest.md`
