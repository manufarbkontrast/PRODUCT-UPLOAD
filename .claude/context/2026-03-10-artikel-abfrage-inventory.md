## Session: 2026-03-10 - Artikel Abfrage & Inventory

### Umgebung
- **Projekt**: spz-product-upload
- **Pfad**: /Users/craftongmbh/Downloads/spz-product-upload
- **Git**: ja

### Branch & Stand
- **Branch**: main
- **Letzter Commit**: 35e102c feat: clickable variants with location detail and Shopify API upgrade
- **Uncommitted Changes**: ja (next-env.d.ts, .env.production, .env.production.template, deploy.sh)

### Was wurde gemacht
- Neue Startseite mit Modus-Auswahl nach Login: "Artikel Abfrage" und "Artikel Fotografieren" (`app/page.tsx`)
- Bisherigen Scanner-Workflow nach `/fotografieren` verschoben (`app/fotografieren/page.tsx`)
- Neue Artikel-Abfrage Seite mit EAN-Scan und Produktinfo-Anzeige (`app/abfrage/page.tsx`)
- Inventory-Lookup API-Endpoint erstellt (`app/api/inventory-lookup/route.ts`)
- Shopify-Client erweitert: `findProductInventory()` holt alle Varianten eines Produkts mit Bestandszahlen (`lib/shopify/client.ts`)
- Shopify API von 2024-01 auf 2024-10 upgraded
- Fallback fuer Inventory-Query wenn `quantities`/`inventoryLevels` GraphQL fehlschlaegt
- Location-ID zu Name Mapping via `SHOPIFY_LOCATION_NAMES` env var
- Varianten sind klickbar mit aufklappbarem Detail (SKU, EAN, Preis, Lager/Filiale)
- EanScanner wird in Abfrage mit `autoLookup=false` genutzt, Abfrage-Seite macht eigenen Lookup + Inventory parallel
- Vercel env var `SHOPIFY_LOCATION_NAMES` gesetzt: `gid://shopify/Location/65653506238=Hauptlager`

### Offene Aufgaben
- [ ] `read_locations` Scope in Shopify App freischalten fuer automatische Standort-Namen
- [ ] Standort-Name "Hauptlager" ggf. umbenennen (aktuell via env var konfiguriert)
- [ ] Weitere Filialen/Lager in `SHOPIFY_LOCATION_NAMES` hinzufuegen wenn vorhanden
- [ ] Untracked files (.env.production, deploy.sh) aufraumen oder in .gitignore

### Architektur-Entscheidungen
- Abfrage-Seite nutzt `autoLookup=false` beim EanScanner, weil der Scanner sonst im "found"-Zustand haengen bleibt und die Ergebnisanzeige blockiert
- Lookup und Inventory werden parallel geladen (Promise.all) fuer schnellere Anzeige
- Location-Namen konfigurierbar via env var statt hardcoded, weil `read_locations` Scope fehlt
- Shopify API 2024-10 fuer `quantities`-Support, mit Fallback auf einfache Query ohne inventoryLevels

### Kontext fuer naechste Session
- Shopify Access Token hat KEIN `read_locations` Scope — location.name kann nicht direkt abgefragt werden
- Location-ID `65653506238` ist der einzige Standort, gemappt auf "Hauptlager"
- Der EanScanner hat intern einen `lookupStatus === 'found'` Zustand der die UI blockiert — deshalb autoLookup=false in der Abfrage
- Alle Deploys laufen ueber `vercel --prod --yes` oder automatisch bei Push
