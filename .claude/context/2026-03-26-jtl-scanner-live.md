# Session: JTL-Scanner auf Produktion live

Datum: 2026-03-26
Branch: main

## Was gemacht wurde

- JTL-Bestandsdaten als einzige Datenquelle fuer EAN-Scanner (Shopify entfernt)
- `lib/jtl-stocks.ts`: Laedt JSON-Dateien aus Google Drive, baut EAN-Index im Memory
- `app/api/ean-lookup/route.ts`: Komplett auf JTL umgestellt
- `app/api/jtl-warmup/route.ts`: Oeffentlicher Endpoint zum Cache-Vorwaermen
- Schuh-Bild-Klassifizierung geplant (Plan in `.claude/plans/precious-wishing-fern.md`)

## Produktions-Debugging (Hauptarbeit dieser Session)

Problem: JTL-Daten luden nicht auf Vercel ("File not found: .")

Debugging-Verlauf:
1. `JTL_STOCKS_FOLDER_ID` fehlte auf Vercel → hinzugefuegt
2. Service Account hatte keinen Zugriff auf JTL-Ordner → User hat geteilt, half aber nicht (Workspace-Beschraenkung)
3. googleapis-Library durch direkten OAuth2-HTTP-Fetch ersetzt → gleicher Fehler
4. **Root Cause**: Env-Variable `JTL_STOCKS_FOLDER_ID` auf Vercel hatte ein Newline (`\n`) am Ende (charCode 10)
5. **Fix**: `.trim()` auf die Folder-ID in `getStockFolderId()`

## Architektur-Entscheidungen

- `jtl-stocks.ts` nutzt direkten `fetch()` mit OAuth2-Token-Refresh statt googleapis-Library
  - Grund: Service Account hat keinen Zugriff auf JTL-Ordner (Google Workspace Beschraenkung)
  - OAuth2 funktioniert zuverlaessig ueber `loadSavedTokens()` → refresh_token → access_token
- Cache-TTL: 1 Stunde, In-Memory auf Vercel (geht bei Cold Start verloren)
- Warmup-Endpoint (`/api/jtl-warmup`) ist oeffentlich (keine Auth noetig)

## Offene Aufgaben

1. Schuh-Bild-Klassifizierung implementieren (Plan existiert)
2. Warmup-Endpoint ggf. als Vercel Cron einrichten
3. Diagnose-Code aus warmup GET-Endpoint entfernen (aktuell noch drin)

## Wichtige Dateien (geaendert)

- `lib/jtl-stocks.ts` — JTL-Datenquelle mit OAuth2-HTTP-Fetch
- `app/api/jtl-warmup/route.ts` — Cache-Warmup + Diagnose
- `app/api/ean-lookup/route.ts` — EAN-Lookup (nur JTL)
- `lib/supabase/middleware.ts` — `/api/jtl-warmup` als oeffentlicher Pfad
- `config/ean-lookup-mappings.ts` — `source: 'jtl'` + variants-Feld
