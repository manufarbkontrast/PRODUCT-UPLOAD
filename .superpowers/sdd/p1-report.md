# Produkt-Erfassung → mycrafton — Phase "App-Code-Migration" Report

Repo: `~/Downloads/product-upload` (github `manufarbkontrast/PRODUCT-UPLOAD`)
Ziel-DB: `mycrafton` (`genzhiywvfrsouhnkise`), gemeinsam mit Brain Cockpit.
Vorbedingung (bereits erledigt, siehe `.superpowers/sdd/progress.md`): Migration
`20260715_erfassung_products_mycrafton.sql` in mycrafton angewendet
(`products`/`product_images`, Buckets `product-images`/`processed-images`).

## Geändert

1. **`lib/auth/require-filiale.ts`**
   - `.eq('user_id', user.id)` → `.eq('id', user.id)` — mycrafton `profiles` hat
     `id` (FK auf `auth.users.id`) als PK, nicht `user_id`.
   - Neue Konstante `ERFASSUNG_ROLES = ['verkaeufer','buero','admin']` +
     `isErfassungRole()`. `requireFiliale()` selektiert jetzt zusätzlich `role`
     und liefert 403 „Keine Berechtigung zum Erfassen“, falls die Rolle nicht
     passt. (De-facto ein Defense-in-Depth-Check: mycrafton `profiles.role` hat
     bereits ein NOT-NULL-CHECK-Constraint auf genau diese drei Werte, Default
     `verkaeufer` — der Check kann in der Praxis also nicht fehlschlagen,
     solange das DB-Constraint besteht.)
   - Bestehende Login-Logik (`lib/auth/require-user.ts`, `middleware.ts`,
     `app/api/auth/*`) unverändert geprüft — nutzt bereits korrekt
     `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` +
     `SUPABASE_SERVICE_ROLE_KEY`, keine Änderung nötig.

2. **`app/api/jtl-lookup/route.ts`** — kanonischer JTL-Pfad, Spalten-Mapping
   korrigiert: `artikel_name` (existiert in mycrafton nicht) → `name`
   (mycrafton `jtl_articles.name`), an allen 3 Stellen (`loadArticleName`,
   `loadVariantsWithStock`-Select + Mapping). `jtl_stock_locations`-Zugriffe in
   `lib/jtl-supabase.ts` (`lager_name`, `bestand`, `gesperrt`, `k_artikel`)
   waren bereits korrekt gegen das echte mycrafton-Schema — keine Änderung
   nötig.

3. **`components/EanScanner.tsx`** — `performLookup()` ruft jetzt
   `/api/jtl-lookup` statt `/api/ean-lookup`. Da die Response-Formen
   unterschiedlich sind (JTL-Route liefert `{article, variants, totalStock}`,
   die UI erwartet `EanLookupResult`), wurde ein lokaler Mapper
   `mapJtlResultToLookup()` + `extractSizeFromSku()` ergänzt (Name, SKU,
   Barcode, Preis (UVP bevorzugt, sonst VK netto), Größe aus SKU-Suffix,
   Bestand, Varianten). Betrifft `app/fotografieren/page.tsx` automatisch mit
   (nutzt `EanScanner` mit `autoLookup=true`).

4. **`app/abfrage/page.tsx`** — hatte zusätzlich einen eigenen, parallelen
   Fetch auf `/api/ean-lookup` (nicht in der Aufgabenstellung genannt, aber
   direkter Konsument der jetzt gelöschten Route — ohne Fix wäre die Seite
   nach dem Löschen kaputt gegangen). Auf ausschließlich `/api/jtl-lookup`
   umgestellt; `productInfo.lookup` wird jetzt minimal aus dem JTL-Ergebnis
   abgeleitet (`{ found: jtlData.found }`), da die restliche Seite ohnehin nur
   `jtlResult`/`productInfo.ean` rendert.

5. **`.env.example`** — Supabase-Sektion kommentiert als gemeinsames
   `mycrafton`-Projekt (Cockpit-Sync-Tabellen vs. Tool-eigene Tabellen,
   Verweis auf die Migration). JTL-Sektion kommentiert: `/api/jtl-lookup`
   (mycrafton) ist kanonisch und braucht kein Env;
   `JTL_STOCKS_FOLDER_ID`/`JTL_API_URL`/`JTL_API_KEY` sind jetzt explizit als
   optionale Legacy-Fallbacks markiert. Keine Variable entfernt — PIN-Login-
   Altlasten (`APP_USERNAME`/`APP_PIN`/`ADMIN_TOKEN`) laut Auftrag bewusst
   nicht angefasst; keine andere Variable wurde durch diese Aufgabe verwaist
   (`JTL_STOCKS_FOLDER_ID`/`JTL_API_*` werden weiterhin von
   `app/api/jtl-warmup` und `lib/jtl-live.ts` referenziert, s.u.).

## Gelöscht

- **`app/api/ean-lookup/route.ts`** — Google-Drive-JSON-Cache-Pfad (133 MB),
  durch `/api/jtl-lookup` (Supabase) ersetzt. Alle Aufrufer umgestellt (s.o.).
- **`app/api/scan-ean/route.ts`** — Gemini-Vision-Barcode-Fallback. Per grep
  bestätigt: wird nirgends aufgerufen (`EanScanner.tsx` nutzt ausschließlich
  die Browser-`BarcodeDetector`-API bzw. die `barcode-detector`-ZXing-Polyfill,
  kein Fetch auf `/api/scan-ean` im gesamten Repo außerhalb der Route-Datei
  selbst). `@google/generative-ai` bleibt Dependency, da `lib/gemini-processor.ts`
  und `lib/gemini-classifier.ts` es weiterhin nutzen.

## Bewusst NICHT gelöscht (Abweichung von der Vorgabe, mit Begründung)

- **`lib/jtl-stocks.ts`** — Vorgabe war „entfernen falls danach ungenutzt
  (grep!)“. Grep nach dem Löschen von `ean-lookup` zeigt: die Datei ist NICHT
  ungenutzt — `app/api/jtl-warmup/route.ts` importiert weiterhin
  `isJtlStocksConfigured`/`refreshCache` (Laufzeit-Code, nicht nur Typen),
  `lib/jtl-supabase.ts` und `lib/jtl-live.ts` importieren den Typ
  `JtlStockItem` daraus. Vollständiges Entfernen hätte bedeutet, den Typ in
  eine andere Datei zu verschieben und `jtl-warmup`/`jtl-live` mit anzufassen
  — das ist Google-Drive-Infrastruktur, die laut Auftrag explizit „NICHT
  anfassen“ war (spätere Phase). Daher: Datei unangetastet gelassen, nur der
  einzige tote Konsument (`ean-lookup`-Route) entfernt.
- `app/api/jtl-warmup/route.ts`, `lib/jtl-live.ts`, `middleware.ts`-Eintrag für
  `/api/jtl-warmup` — aus demselben Grund unangetastet.
- `supabase/migrations/20260414_filiale_profiles.sql` — alte Migration für ein
  Schema mit `profiles.user_id` als PK (Standalone-Supabase-Projekt vor dem
  Wechsel zu mycrafton). Gegen mycrafton ist sie ein No-Op
  (`create table if not exists`, Tabelle existiert dort schon mit anderer
  Struktur), aber inhaltlich veraltet/irreführend. Nicht in der Aufgabenliste
  enthalten, daher nicht angerührt/gelöscht — Empfehlung: in einer späteren
  Aufräum-Phase entfernen oder mit Kommentar als „obsolet, siehe 20260715“
  markieren.
- Docs (`README.md` Architektur-Diagramm, `ANALYSE.md`,
  `.claude/context/*.md`) referenzieren noch `/api/ean-lookup` bzw.
  `/api/scan-ean`. Nicht aktualisiert — nur `.env.example` war im Auftrag
  genannt.
- Zweite, leicht abweichende `env.example` (ohne Punkt) im Repo-Root — nicht
  angefasst, nur `.env.example` war im Auftrag genannt.

## Check-Ergebnisse

- `npx tsc --noEmit` → **clean**, keine Fehler.
- `npx vitest run` → **83/83 Tests grün** (9 Testdateien), keine Anpassung
  nötig — kein bestehender Test zeigte auf entfernten Code.
- `npm run build` → **erfolgreich** (Next.js 16.1.6, Turbopack). Alle API-
  Routes (inkl. `/api/jtl-lookup`) bauten ohne `force-dynamic`-Marker durch,
  auch ohne `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` — Next führt
  Route-Handler beim Build nicht aus, daher kein Build-Fehler durch fehlende
  Runtime-Env. `/api/ean-lookup`, `/api/scan-ean` erscheinen erwartungsgemäß
  nicht mehr in der Routen-Liste.
- `npm run lint` → 23 Probleme (5 Errors, 18 Warnings) — **identisch vor und
  nach dieser Änderung** (per `git stash`-Vergleich verifiziert). Ausschließlich
  Altlasten in `_archive/`, `ReorderButton.tsx`, `contexts/AuthContext.tsx`
  (React-Hook-Regeln) sowie generische `no-img-element`/`no-unused-vars`-
  Warnings, u.a. zwei Warnings in `app/api/jtl-lookup/route.ts`
  (`findJtlSiblings`, `findVariantsSupabase` unused) — vorbestehend, von
  dieser Aufgabe nicht berührt.

## Runtime-Env, die für ein Deployment noch fehlt

`.env.local` enthält aktuell **nur** `NEXT_PUBLIC_SUPABASE_URL` und
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Für den laufenden Betrieb (nicht für den
Build) fehlt mindestens:

- **`SUPABASE_SERVICE_ROLE_KEY`** — zwingend erforderlich. Wird u.a. von
  `lib/auth/require-filiale.ts` (`createServiceRoleClient`),
  `app/api/jtl-lookup/route.ts` und `lib/jtl-supabase.ts` verwendet. Ohne
  diesen Key wirft `requireFiliale()` bei jedem authentifizierten Request
  eine Exception (jede erfassende Route hängt daran) — Login selbst
  funktioniert noch (nutzt nur den Anon-Key), aber jede Aktion danach schlägt
  fehl.

Optional/legacy (nur relevant falls die alten Drive-Fallbacks je gebraucht
werden — für den kanonischen mycrafton-Pfad nicht nötig):
`JTL_STOCKS_FOLDER_ID`, `JTL_API_URL`, `JTL_API_KEY`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_TOKENS` (Drive/Sheets — explizit außerhalb
dieser Phase) und `GEMINI_API_KEY` (Foto-Klassifizierung — ebenfalls
außerhalb dieser Phase).

## Concerns

1. mycrafton `profiles.filiale` CHECK erlaubt 6 Werte (inkl. `LAGER`),
   `FILIALE_CODES` in `require-filiale.ts` kennt nur 5 (kein `LAGER`). Ein
   Profil mit `filiale = 'LAGER'` würde von `requireFiliale()` mit 403
   abgewiesen. War nicht Teil des Auftrags — geprüft, aber bewusst nicht
   geändert; ggf. in Phase 2 klären, ob Lager-Profile dieses Tool nutzen
   sollen.
2. Der neue Rollen-Check ist aktuell reine Verteidigungslinie ohne
   praktischen Effekt, da das DB-CHECK-Constraint auf `profiles.role` schon
   nur `verkaeufer`/`buero`/`admin` zulässt (NOT NULL, Default
   `verkaeufer`). Sollte das Constraint je gelockert werden, greift der
   Code-Check.
3. `lib/jtl-stocks.ts` + `app/api/jtl-warmup` + `lib/jtl-live.ts` bleiben im
   Repo, obwohl der einzige direkte Nutzer des EAN-Lookups (`ean-lookup`-
   Route) weg ist — sie sind aber weiterhin über `lib/jtl/cache.ts`
   (Priority-2/3-Fallback hinter Supabase) und `jtl-warmup` verdrahtet.
   Bewusst nicht anfassen (Drive-Infrastruktur, spätere Phase, s.o.).
4. Alte Migration `20260414_filiale_profiles.sql` widerspricht dem echten
   mycrafton-Schema (harmlos als No-Op, aber verwirrend für zukünftige
   Leser).
