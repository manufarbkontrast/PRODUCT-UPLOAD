# SPZ Produkt-Upload Tool

Web-App für Mitarbeiter zum Einpflegen von Produkten in das SPZ-System. Erfasst Produktdaten, bearbeitet Bilder automatisch und lädt alles zu Google Drive hoch.

---

## Features

- **Strukturierte Produkterfassung**: Modellname, Geschlecht, Kategorie, SKU, Preis
- **Shopify-Integration**: EAN-Scan holt automatisch Produktdaten aus Shopify
- **Automatische Bildbearbeitung**: Größenanpassung, Hintergrund, Komprimierung via Gemini
- **Google Drive Integration**: Automatischer Upload mit Ordnerstruktur
- **Produktübersicht**: Alle Produkte mit Bildern und Daten auf einen Blick

---

## Tech-Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- **Backend**: Next.js API Routes
- **Datenbank**: Supabase (PostgreSQL + Storage)
- **Bildbearbeitung**: Gemini 2.0 Flash + Sharp (Node.js)
- **Cloud**: Google Drive API, Shopify Admin API
- **Deployment**: Docker Compose

---

## Voraussetzungen

- Node.js 20+
- Git
- Supabase-Projekt (für Datenbank & Storage)
- Google Cloud Project mit aktivierter Drive API
- Shopify Store mit Admin API Access Token

---

## Schnellstart

### 1. Repository klonen

```bash
git clone <repo-url>
cd SPZ-Product
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
```

Wichtige Variablen in `.env`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Shopify API
SHOPIFY_STORE_DOMAIN=dein-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxx

# Google Drive
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
GOOGLE_DRIVE_FOLDER_ID=xxx

# Gemini API (für Bildbearbeitung)
GEMINI_API_KEY=xxx

# Entwicklung
NODE_ENV=development
AUTH_DISABLED=true
```

### 4. Entwicklungsserver starten

```bash
npm run dev
```

### 5. App öffnen

- **Web-App**: http://localhost:3000

---

## Projektstruktur

```
├── app/
│   ├── page.tsx                 # Dashboard
│   ├── products/                # Produkt-Seiten
│   │   ├── page.tsx            # Übersicht
│   │   ├── new/page.tsx        # Neues Produkt
│   │   └── [id]/               # Produkt-Details & Bilder
│   └── api/
│       ├── products/           # Produkt-API
│       ├── ean-lookup/         # EAN-Suche (Shopify + Gemini)
│       ├── google/             # Google Drive Auth
│       └── health/             # Health-Check
├── components/                  # React-Komponenten
├── lib/
│   ├── supabase/               # Supabase Client
│   └── shopify/                # Shopify API Client
├── config/                     # App-Konfiguration
│   ├── zalando-attributes.ts   # Silhouetten & Attribute
│   └── ean-lookup-mappings.ts  # EAN-Mapping
└── public/                     # Statische Dateien
```

---

## Workflow

### Produkt erstellen

1. `/products/new` öffnen
2. EAN scannen oder eingeben
3. Produktdaten werden automatisch aus Shopify geladen
4. Silhouette (Produktart) manuell auswählen
5. Bilder hochladen
6. Bilder werden automatisch bearbeitet
7. "Zu Google Drive hochladen" klicken
8. Fertig - Link zum Drive-Ordner wird angezeigt

### EAN-Lookup

Der EAN-Lookup sucht in dieser Reihenfolge:
1. **Shopify** (primär) - Holt aktuelle Produktdaten aus deinem Shop
2. **Gemini AI** (Fallback) - Sucht im Internet nach dem Produkt

---

## Bildbearbeitung

Bilder werden automatisch verarbeitet:

- **Format**: WebP (komprimiert)
- **Größe**: Max. 1200x1600px
- **Hintergrund**: Weiß
- **Qualität**: 85%

Konfigurierbar in `config/image-processing.ts`.

---

## Supabase Setup

### Tabellen

```sql
-- products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ean TEXT UNIQUE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  status TEXT DEFAULT 'draft',
  drive_url TEXT,
  zalando_attributes JSONB,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- product_images
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  original_path TEXT NOT NULL,
  processed_path TEXT,
  filename TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS aktivieren
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
```

---

## Google Drive Setup

### 1. Google Cloud Console

1. Neues Projekt erstellen
2. Drive API aktivieren
3. OAuth 2.0 Credentials erstellen
4. Redirect URI hinzufügen: `http://localhost:3000/api/google/callback`

### 2. Autorisierung

Beim ersten Upload wird zur Google-Anmeldung weitergeleitet.

---

## Shopify Setup

### Admin API Access Token

1. Shopify Admin → Apps → App-Entwicklung
2. Neue App erstellen
3. Admin API Scopes: `read_products`
4. Access Token kopieren

---

## Docker (Produktion)

```bash
# Produktions-Profil starten
docker compose --profile prod up -d --build
```

### Checkliste

- [ ] `.env` mit Produktionswerten
- [ ] `NODE_ENV=production`
- [ ] `AUTH_DISABLED=false`
- [ ] Sichere Passwörter/Tokens
- [ ] HTTPS via Caddy konfiguriert

---

## Sicherheit

- Session-basierte Authentifizierung (Username + PIN)
- Row Level Security in Supabase
- Datei-Uploads validiert (Typ, Größe)
- API-Routen geschützt
- `.env` niemals committen
