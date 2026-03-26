# SPZ Product Upload

Next.js 16 App fuer Produkt-Fotografie-Workflow.
EAN scannen → JTL-Lookup → Bilder hochladen → AI Background-Removal → Google Drive Upload.

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
- `lib/jtl-stocks.ts` — JTL-Bestandsdaten (EAN-Lookup via Google Drive JSON)
- `lib/gemini-processor.ts` — Gemini AI Bildbearbeitung + Sharp Normalisierung
- `config/constants.ts` — Konfigurierbare Werte (Timeouts, Retries, Limits)
- `config/shoe-views.ts` — Schuh-Ansichten Standard-Reihenfolge (5 Pflichtbilder)

## Datenquellen

- **EAN-Lookup**: Ausschliesslich JTL-Bestandsdaten (`lib/jtl-stocks.ts`)
  - Quelle: Google Drive Ordner mit JSON-Exports (shoesplease + jeansundco)
  - Cache: In-Memory, 1h TTL, ~77MB, laedt in ~10s
  - Auth: Direkter OAuth2-HTTP-Fetch (nicht googleapis-Library, nicht Service Account)
  - Warmup: `POST /api/jtl-warmup` (oeffentlich, keine Auth noetig)
- **Bilder**: Google Drive Upload via googleapis + OAuth2
- **Produkte**: Supabase (PostgreSQL)

## Konventionen

- UI-Texte auf Deutsch
- `fetch()` zu API-Routes, nie direkter Supabase-Zugriff vom Client
- `createServiceRoleClient()` in API-Routes (bypass RLS)
- `window.confirm()` fuer destruktive Aktionen
- Error-Pattern: `err instanceof Error ? err.message : 'Fallback'`
- Commit-Style: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Env-Variablen immer `.trim()` bevor sie in URLs/API-Calls genutzt werden

## Google Auth auf Vercel

- OAuth2 + Service Account sind beide konfiguriert
- `getDriveClient()` bevorzugt OAuth2 (User hat Storage-Quota)
- Service Account hat KEINEN Zugriff auf JTL-Ordner (Workspace-Beschraenkung)
- JTL-Stocks nutzt direkten OAuth2-HTTP-Fetch (Pattern in `lib/jtl-stocks.ts`)

## Session Context

Aktuelle Session-Snapshots: `.claude/context/`
Letzter Stand: `.claude/context/latest.md`

# currentDate
Today's date is 2026-03-26.

      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.
