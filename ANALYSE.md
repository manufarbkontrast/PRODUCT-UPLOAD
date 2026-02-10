# Komplette Analyse: SPZ Produkt-Upload Tool v4.2

**Datum:** 2026-02-10
**Status:** Build kompiliert erfolgreich, aber kritische Sicherheits- und Architekturprobleme vorhanden

---

## Zusammenfassung

| Kategorie | Status |
|-----------|--------|
| Build | Kompiliert erfolgreich (Next.js 16.0.0 Turbopack) |
| TypeScript | Keine Typfehler |
| Sicherheit | KRITISCH - 8 kritische, 7 hohe Probleme |
| Code-Qualitaet | MITTEL - Debug-Code, duplizierte Dependencies |
| Architektur | MITTEL - Fehlende Auto-Upload-Logik, schwache Auth |
| UX | Ausbaufaehig - Kein Fortschrittsbalken, kein Drive-Upload-Button |
| Dependencies | 1 kritische + 1 moderate Schwachstelle (npm audit) |

---

## 1. Sicherheitsanalyse

### KRITISCH (Sofort beheben)

#### 1.1 Produktions-Secrets im Projektordner
- `.env` enthaelt echte API-Keys: Supabase, Google OAuth, Shopify (`shpat_...`), Gemini
- `google-service-account.json` mit privatem GCP-Schluessel vorhanden
- `google-oauth-token.json` mit Live-Tokens vorhanden
- **Aktion:** Alle Secrets SOFORT rotieren. `.gitignore` schliesst sie korrekt aus.

#### 1.2 Authentifizierung deaktiviert
- `.env`: `AUTH_DISABLED=true` - komplette App ohne Login zugaenglich
- **Aktion:** Auf `false` setzen, niemals `true` in Produktion

#### 1.3 Session-Tokens nicht signiert
- `lib/auth.ts`: Tokens sind nur Base64-kodiertes JSON - kein HMAC/JWT
- Jeder kann gueltige Tokens faelschen: `btoa(JSON.stringify({username:'admin',ts:Date.now()}))`
- **Aktion:** JWT mit Secret implementieren

#### 1.4 Kein CSRF-Schutz
- Alle API-Routes (POST/PATCH/DELETE) ohne CSRF-Token
- Cookie ist `sameSite: 'lax'` - bietet nur teilweisen Schutz
- **Aktion:** SameSite auf `strict` + CSRF-Token oder Server Actions

#### 1.5 Supabase Service Role Key ueberall verwendet
- `lib/supabase/server.ts`: `createServerClient()` nutzt Service Role Key
- Umgeht alle Row Level Security Policies
- Wird in ALLEN API-Routes genutzt
- **Aktion:** Anon Key + RLS fuer User-Operationen, Service Role nur fuer Admin

#### 1.6 Next.js 16.0.0 hat kritische CVEs
- RCE ueber React Flight Protocol (GHSA-9qr9-h5gf-34mp)
- Server Actions Source Code Exposure (GHSA-w37m-7fhw-fmv9)
- Mehrere DoS-Vektoren
- **Aktion:** `npm audit fix --force` → Next.js 16.1.6

#### 1.7 Debug-Code sendet Daten an externen Server
- `components/PortalDebugger.tsx`: Sendet DOM-Daten alle 2s an `127.0.0.1:7242`
- `app/products/new/page.tsx`: Agent-Log Code mit 10 Vorkommen
- `app/products/[id]/edit/page.tsx`: Agent-Log Code mit 10 Vorkommen
- `app/api/products/route.ts`: 12 Vorkommen
- `app/api/products/[id]/route.ts`: 10 Vorkommen
- **Aktion:** Komplett entfernen (insgesamt 44 Stellen in Source-Dateien)

#### 1.8 Schwache Admin-Authentifizierung
- `ADMIN_TOKEN=spz-admin-token-x7k9m2p4` (nur 23 Zeichen, niedrige Entropie)
- Standard-PIN: `1234` (hardcoded Default)
- Kein Timing-sicherer Vergleich
- Kein Account-Lockout
- **Aktion:** Sichere Tokens generieren, bcrypt fuer PINs, Rate Limiting

### HOCH (Vor Produktion beheben)

- Keine Input-Validierung auf API-Routes (kein Zod/Schema)
- Kein Rate Limiting auf allen Endpoints
- File-Upload ohne Groessen-/Content-Validierung
- Webhook-Endpoint: Admin-Token im Body statt Header
- Google Credentials als Dateien im Filesystem
- Keine Security Headers (CSP, X-Frame-Options, HSTS etc.)
- Sensitive Informationen in Fehlermeldungen

### MITTEL

- Kein Security Event Logging
- HTTPS nicht erzwungen
- Kein Account-Lockout nach Fehlversuchen
- Keine Request-Body-Groessen-Limitierung

---

## 2. Code-Qualitaet

### Debug-Code (44+ Stellen)
Dateien mit `#region agent log` / Debug-Fetch zu `127.0.0.1:7242`:
- `app/products/new/page.tsx` - 10 Vorkommen
- `app/products/[id]/edit/page.tsx` - 10 Vorkommen
- `app/api/products/route.ts` - 12 Vorkommen
- `app/api/products/[id]/route.ts` - 10 Vorkommen
- `components/PortalDebugger.tsx` - 2 Vorkommen (komplette Datei ist Debug)

### Duplizierte Gemini-Dependencies
- `@google/genai` (v1.39.0) - verwendet in `app/api/scan-ean/route.ts`
- `@google/generative-ai` (v0.24.0) - verwendet in `lib/gemini-processor.ts`
- **Aktion:** Auf eine Bibliothek konsolidieren (`@google/genai` ist neuer)

### Dateigroessen (Richtlinie: max 800 Zeilen)
Alle Dateien sind unter 800 Zeilen - OK.
Groesste Datei: `config/zalando-attributes.ts` (708 Zeilen) - akzeptabel fuer Config

### Code-Stil
- Konsistentes TypeScript mit korrekten Typen
- Next.js App Router Patterns korrekt verwendet
- Tailwind CSS 4 Syntax korrekt
- Deutsche Kommentare und UI-Texte (konsistent)

### Verbesserungswuerdig
- `app/products/new/page.tsx`: `handleSubmit` Funktion ist sehr lang - aufteilen
- `components/EanScanner.tsx` (388 Zeilen): Koennte in Sub-Komponenten aufgeteilt werden
- Response-Verarbeitung: Mix aus `res.text()` + `JSON.parse` und `res.json()` (durch Debug-Code)

---

## 3. Architektur-Analyse

### Was funktioniert
- **Build:** Kompiliert fehlerfrei mit Turbopack
- **Routing:** 26 Routes korrekt konfiguriert (7 statisch, 19 dynamisch)
- **Supabase-Integration:** CRUD fuer Produkte und Bilder funktioniert
- **Shopify-Integration:** EAN-Lookup ueber GraphQL + REST Fallback
- **Gemini Image Processing:** Kategorie-spezifische Prompts (Schuhe/Kleidung/Accessoires)
- **Sharp Post-Processing:** Format-Konvertierung und Groessenanpassung
- **Responsive Design:** ViewMode Context mit Auto/Mobile/Desktop Toggle
- **Zalando-Attribute:** 27+ Silhouetten mit Pflichtfeldern
- **Docker:** Multi-Stage Build + docker-compose mit Profilen

### Was NICHT funktioniert

#### Google Drive/Sheets Integration (Kernproblem)
- `GOOGLE_DRIVE_FOLDER_ID=` und `GOOGLE_SHEET_ID=` sind LEER in `.env`
- `lib/google/config.ts` setzt leere Strings als Default
- Alle Drive/Sheets-Operationen schlagen daher fehl
- **Loesung:** Auto-Setup wie in `IMPLEMENTATION_PLAN.md` Phase 1 beschrieben

#### Kein automatischer Drive-Upload im Direkt-Modus
- Im n8n-Modus: Webhook-Handler loedt zu Drive hoch
- Im Direkt-Modus (ohne n8n): Verarbeitung endet mit Status `ready`, KEIN Upload
- `app/api/products/[id]/process/route.ts` hat keinen Drive-Upload nach direkter Verarbeitung
- **Loesung:** Phase 2 aus IMPLEMENTATION_PLAN umsetzen

#### Fehlende UX-Features
- Kein Fortschrittsbalken waehrend Bildverarbeitung (nur Spinner + Status-Badges)
- Kein "Naechstes Produkt" Button
- Kein "Zu Drive hochladen" Button nach Verarbeitung
- **Loesung:** Phase 3 aus IMPLEMENTATION_PLAN umsetzen

### Architektur-Diagramm

```
Browser → Next.js App (Port 3000)
  ├── /login → Auth (Base64 Session Cookie)
  ├── /products/new → EAN Scanner + Shopify Lookup + Zalando Form
  ├── /products/[id]/images → Image Upload → Supabase Storage
  └── /api/products/[id]/process
        ├── n8n verfuegbar? → n8n Webhook → Callback → Drive Upload
        └── n8n nicht verfuegbar? → Direkt-Modus → Gemini + Sharp → ⚠ KEIN Drive Upload
```

### Middleware-Warnung
- Next.js 16: `middleware.ts` ist deprecated, `proxy.ts` empfohlen
- Build zeigt: "The middleware file convention is deprecated. Please use proxy instead."

---

## 4. Dependency-Analyse

### npm audit Ergebnisse
| Package | Version | Schwere | Problem |
|---------|---------|---------|---------|
| next | 16.0.0 | KRITISCH | RCE, Source Code Exposure, DoS (6 CVEs) |
| js-yaml | 4.0.0-4.1.0 | MODERAT | Prototype Pollution in merge |

### Duplizierte Packages
| Package 1 | Package 2 | Problem |
|-----------|-----------|---------|
| `@google/genai` ^1.39.0 | `@google/generative-ai` ^0.24.0 | Zwei verschiedene Gemini SDKs |

### Veraltete Dependencies
- `@types/sharp` ^0.31.1 ist deprecated (Sharp hat eigene Types seit v0.33)
- `baseline-browser-mapping` ist veraltet (Warnung bei jedem Build)

---

## 5. Empfohlene Massnahmen (Priorisiert)

### Sofort (Phase 0)
1. Alle Secrets rotieren (Supabase, Google, Shopify, Gemini, Admin)
2. `AUTH_DISABLED=false` setzen
3. Debug-Code entfernen (44+ Stellen in 5 Dateien + PortalDebugger)
4. `npm audit fix --force` (Next.js 16.0.0 → 16.1.6)
5. Git-Repo initialisieren (DONE)

### Kurzfristig (1-2 Tage)
6. Google Drive/Sheets Auto-Setup (Phase 1 IMPLEMENTATION_PLAN)
7. Auto-Upload nach Direkt-Verarbeitung (Phase 2)
8. Input-Validierung mit Zod auf allen API-Routes
9. JWT-basierte Session-Tokens
10. Security Headers in next.config.ts

### Mittelfristig (1 Woche)
11. UX: Fortschrittsbalken + "Naechstes Produkt" Button (Phase 3)
12. Rate Limiting
13. File Upload Validierung (Magic Bytes, Groessen-Limit)
14. CSRF-Schutz
15. Gemini SDK konsolidieren (nur `@google/genai`)
16. `middleware.ts` → `proxy.ts` Migration

### Langfristig
17. RLS Policies in Supabase
18. Proper User Management (statt Single-User PIN)
19. Security Event Logging
20. E2E Tests
21. CI/CD Pipeline

---

## 6. Dateien-Uebersicht

### Quelldateien (8.178 Zeilen Code)
| Ordner | Dateien | Zeilen | Zweck |
|--------|---------|--------|-------|
| app/ | 16 | ~3.400 | Pages + API Routes |
| lib/ | 9 | ~1.500 | Business Logic |
| components/ | 6 | ~1.200 | UI-Komponenten |
| config/ | 5 | ~1.600 | Konfiguration |
| contexts/ | 2 | ~150 | React Contexts |
| root | 5 | ~300 | Config-Dateien |

### Build-Ausgabe
- 21 Routes: 7 statisch (○), 14 dynamisch (ƒ)
- Turbopack Build: ~5 Sekunden
- Standalone Output fuer Docker

---

## 7. Was GUT gemacht ist

- Saubere Tailwind CSS 4 Implementierung
- Responsives Design mit ViewMode Context
- Kategorie-spezifische Bildverarbeitungs-Prompts (Zalando-konform)
- Docker Multi-Stage Build fuer Produktion
- Korrekte .gitignore (Secrets ausgeschlossen)
- Gute Fehlerbehandlung in Shopify Client (Retry, Fallback)
- EAN Scanner mit BarcodeDetector API + Manual Fallback
- Zalando-Attribut-System mit 27+ Silhouetten
