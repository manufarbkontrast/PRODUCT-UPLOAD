# SPZ Produkt-Upload – Leitfaden (Next.js + Supabase + n8n)

Dieser Leitfaden beschreibt die Architektur und Einrichtung des SPZ Produkt-Upload-Systems. Die App ermöglicht es, Produkte zu erfassen, Bilder hochzuladen, diese automatisiert per n8n-Workflow zu bearbeiten und zu Google Drive/Sheets hochzuladen.

## Voraussetzungen
- Repo geklont, `.env` ausgefüllt (siehe `env.example`)
- Docker installiert
- Stack läuft: `docker compose up -d --build`
- Supabase-Projekt erstellt (https://supabase.com)
- Erreichbar:
  - Web: `http://localhost:3000`
  - n8n: `http://localhost:5678` (Basic-Auth aus `.env`)
  - Mail-UI: `http://localhost:8025`

## Tech-Stack
| Schicht        | Technologie                              |
|----------------|------------------------------------------|
| Frontend       | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend        | Next.js API Routes                       |
| Datenbank      | Supabase (PostgreSQL + Row Level Security) |
| Auth           | Supabase Auth (E-Mail/Passwort)          |
| Storage        | Supabase Storage (Produkt-Bilder)        |
| Workflow       | n8n (Orchestrierung, Automatisierung)    |
| Bildbearbeitung| n8n orchestriert Gemini 2.0 Flash + Sharp |
| Export         | Google Drive API + Google Sheets API     |
| Infrastruktur  | Docker Compose                           |

## Architektur-Überblick

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Next.js    │────▶│     Supabase     │     │     n8n      │
│   Frontend   │     │  ┌────────────┐  │     │  (Workflows) │
│   + API      │     │  │ PostgreSQL │  │     │              │
│              │     │  │ Auth       │  │     └──────┬───────┘
│              │     │  │ Storage    │  │            │
└──────┬───────┘     │  └────────────┘  │            │
       │             └──────────────────┘            │
       │                                             │
       │  POST /api/products/[id]/process            │
       │  (Dispatch: setzt Status, feuert Webhooks)  │
       ├────────────────────────────────────────────▶│
       │  { imageUrl, productId, imageId, category,  │
       │    filename, callbackUrl, adminToken }       │
       │                                             │
       │  n8n Workflow:                              │
       │  1. Webhook empfangen                       │
       │  2. POST /api/internal/process-image        │
       │     (Gemini 2.0 Flash + Sharp)              │
       │  3. Ergebnis prüfen (success/error)         │
       │  4. POST /api/webhooks/n8n (Callback)       │
       │                                             │
       │  Frontend pollt GET /api/products/[id]      │
       │  alle 3s bis Status != "processing"         │
       │                                             │
       ▼                                             ▼
┌──────────────┐                          ┌──────────────┐
│ Google Drive │                          │  Gemini 2.0  │
│ Google Sheets│                          │  Flash API   │
└──────────────┘                          └──────────────┘
```

## Sicherheit
- **App-Auth**: Benutzername + 4-Ziffern PIN (via `APP_USERNAME` + `APP_PIN` in `.env`)
- **Session-Cookie** (`spz-session`): HttpOnly, Secure, 30 Tage gültig
- **Middleware** (`middleware.ts`): Schützt alle Routen außer `/login`, `/api/auth/*`, `/api/health`, `/api/webhooks/*`, `/api/internal/*`
- **Row Level Security (RLS)** auf allen Tabellen in Supabase
- **Admin-Endpoints** per `X-Admin-Token` Header geschützt (`lib/admin-auth.ts`)
- **n8n-Webhooks** per Admin-Token validiert
- **AUTH_DISABLED=true** zum lokalen Entwickeln ohne Login

## Datenbank-Schema (Supabase SQL)

```sql
-- Tabelle: products
create table products (
  id          uuid primary key default gen_random_uuid(),
  ean         text unique,
  name        text not null,
  gender      text not null,
  category    text not null,
  description text,
  sku         text,
  price       numeric(10,2),
  status      text not null default 'draft',
  drive_url   text,
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Tabelle: product_images
create table product_images (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references products(id) on delete cascade,
  original_path  text not null,
  processed_path text,
  filename       text not null,
  sort_order     int default 0,
  status         text not null default 'pending',
  created_at     timestamptz default now()
);

-- RLS aktivieren
alter table products enable row level security;
alter table product_images enable row level security;

-- Policies: User sieht nur eigene Produkte
create policy "Users can view own products"
  on products for select using (auth.uid() = user_id);

create policy "Users can insert own products"
  on products for insert with check (auth.uid() = user_id);

create policy "Users can update own products"
  on products for update using (auth.uid() = user_id);

create policy "Users can delete own products"
  on products for delete using (auth.uid() = user_id);

-- Policies: Bilder über Produkt-Zugehörigkeit
create policy "Users can view own product images"
  on product_images for select
  using (product_id in (select id from products where user_id = auth.uid()));

create policy "Users can insert own product images"
  on product_images for insert
  with check (product_id in (select id from products where user_id = auth.uid()));

create policy "Users can update own product images"
  on product_images for update
  using (product_id in (select id from products where user_id = auth.uid()));

create policy "Users can delete own product images"
  on product_images for delete
  using (product_id in (select id from products where user_id = auth.uid()));

-- updated_at Trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger products_updated_at
  before update on products
  for each row execute function update_updated_at();
```

### Supabase Storage Buckets
| Bucket             | Zugriff   | Beschreibung              |
|--------------------|-----------|---------------------------|
| `product-images`   | Private   | Originale Produkt-Bilder  |
| `processed-images` | Public    | KI-bearbeitete Bilder     |

## API-Routen

### Produkte
| Methode | Route                         | Auth      | Beschreibung              |
|---------|-------------------------------|-----------|---------------------------|
| GET     | `/api/products`               | Supabase  | Alle Produkte listen      |
| POST    | `/api/products`               | Supabase  | Neues Produkt erstellen   |
| GET     | `/api/products/[id]`          | Supabase  | Produkt-Details           |
| PATCH   | `/api/products/[id]`          | Supabase  | Produkt aktualisieren     |
| DELETE  | `/api/products/[id]`          | Supabase  | Produkt löschen           |

### Bilder & Verarbeitung
| Methode | Route                                | Auth       | Beschreibung                          |
|---------|--------------------------------------|------------|---------------------------------------|
| POST    | `/api/products/[id]/images`          | Supabase   | Bild zu Supabase Storage              |
| POST    | `/api/products/[id]/process`         | Supabase   | n8n-Workflow starten (async Dispatch)  |
| POST    | `/api/products/[id]/upload`          | Supabase   | Zu Google Drive hochladen             |

### Interne Endpoints (n8n)
| Methode | Route                          | Auth        | Beschreibung                           |
|---------|--------------------------------|-------------|----------------------------------------|
| POST    | `/api/internal/process-image`  | Admin-Token | Gemini-Bildverarbeitung (von n8n)      |
| POST    | `/api/webhooks/n8n`            | Admin-Token | n8n Callback nach Verarbeitung         |

### System
| Methode | Route                   | Auth       | Beschreibung                    |
|---------|-------------------------|------------|---------------------------------|
| GET     | `/api/health`           | Keine      | Liveness-Check                  |
| GET     | `/api/google/auth`      | Supabase   | Google OAuth2 starten           |
| GET     | `/api/google/callback`  | Keine      | Google OAuth2 Callback          |

## n8n Workflow: Bildbearbeitung

### Ablauf (asynchron)
1. **Next.js** setzt Produkt + Bilder auf `status: processing`
2. **Next.js** sendet pro Bild einen POST an n8n Webhook
3. **Next.js** returned sofort an Frontend (`{ status: "processing" }`)
4. **n8n** ruft `/api/internal/process-image` auf (Gemini + Sharp)
5. **n8n** sendet Ergebnis per Callback an `/api/webhooks/n8n`
6. **Webhook-Endpoint** updated DB (Bild-Status + Produkt-Status)
7. **Frontend** pollt alle 3s und zeigt Fortschritt

### Workflow-Schritte (n8n)
1. **Webhook-Trigger** (POST `/webhook/process-image`)
2. **HTTP Request**: POST `http://web-dev:3000/api/internal/process-image`
   - Header: `X-Admin-Token` (aus Payload)
   - Body: `{ imageUrl, productId, imageId, filename, category }`
   - Timeout: 300s (Gemini-Verarbeitung)
3. **IF Node**: `success === true`
4. **Success → HTTP Request**: POST an `callbackUrl` mit Ergebnis
5. **Error → HTTP Request**: POST an `callbackUrl` mit Fehlermeldung
6. **Respond to Webhook**: `{ received: true }`

### n8n Webhook-Payload (Eingang)
```json
{
  "imageUrl": "https://xxx.supabase.co/storage/v1/object/public/product-images/abc/foto.jpg",
  "productId": "uuid-des-produkts",
  "imageId": "uuid-des-bildes",
  "filename": "foto.jpg",
  "category": "Schuhe",
  "callbackUrl": "http://web-dev:3000/api/webhooks/n8n",
  "adminToken": "spz-admin-token-xxx",
  "internalAppUrl": "http://web-dev:3000"
}
```

### Callback-Payload (Erfolg)
```json
{
  "success": true,
  "processedUrl": "https://xxx.supabase.co/storage/v1/object/public/processed-images/abc/foto_processed.webp",
  "storagePath": "abc/foto_processed.webp",
  "imageId": "uuid-des-bildes",
  "productId": "uuid-des-produkts"
}
```

### Callback-Payload (Fehler)
```json
{
  "success": false,
  "error": "Gemini returned no image data.",
  "imageId": "uuid-des-bildes",
  "productId": "uuid-des-produkts"
}
```

### Workflow importieren
1. `http://localhost:5678` öffnen, einloggen
2. Neuen Workflow importieren aus `n8n/workflows/process-image.json`
3. Workflow aktivieren

## Bildbearbeitungs-Profile

### Schuhe (`shoes`)
- Format: WebP, Qualität 90
- Max: 2000×2000px (Seitenverhältnis beibehalten)
- Schatten: Natürlicher Kontaktschatten
- Hintergrund: Weiß (#FFFFFF)

### Kleidung (`clothing`) – Zalando-Standard
- Format: JPG, Qualität 90
- Größe: 1801×2600px (Seitenverhältnis 1:1.44)
- Schatten: Komplett schattenlos
- Hintergrund: Reinweiß (#FFFFFF)
- Produkt zentriert

## Umgebungsvariablen

```env
# App
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Admin
ADMIN_TOKEN=spz-admin-token-change-me
AUTH_DISABLED=true

# n8n
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=change-me
N8N_HOST=localhost:5678
N8N_WEBHOOK_URL=http://n8n:5678/webhook/process-image
INTERNAL_APP_URL=http://web-dev:3000

# Google OAuth2
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback

# Google Drive/Sheets
GOOGLE_DRIVE_FOLDER_ID=...
GOOGLE_SHEET_ID=...
GOOGLE_SHEET_NAME=Tabellenblatt1

# Gemini (Bildbearbeitung via Gemini Flash)
GEMINI_API_KEY=...

# Docker Services
POSTGRES_USER=postgres
POSTGRES_DB=app
POSTGRES_PASSWORD=change-me
```

## Einrichtung

### 1. Stack starten
```bash
cp env.example .env
# .env-Werte ausfüllen
docker compose up -d --build
```

### 2. Supabase einrichten
1. Projekt auf https://supabase.com erstellen
2. URL + Anon-Key + Service-Role-Key in `.env` eintragen
3. SQL-Editor öffnen → Schema von oben ausführen
4. Storage: Buckets `product-images` (private) und `processed-images` (public) anlegen
5. Auth: E-Mail-Provider aktivieren

### 3. n8n Workflow einrichten
1. `http://localhost:5678` öffnen, einloggen
2. Workflow importieren aus `n8n/workflows/process-image.json`
3. Workflow aktivieren
4. Testen: In der n8n-UI den Webhook manuell triggern

### 4. Google OAuth2
1. Google Cloud Console → APIs aktivieren (Drive, Sheets)
2. OAuth2 Credentials erstellen
3. Redirect URI: `http://localhost:3000/api/google/callback`
4. App autorisieren unter `http://localhost:3000/api/google/auth`

## Projektstruktur

```
app/
├── api/
│   ├── products/
│   │   ├── route.ts                # GET (Liste), POST (Erstellen)
│   │   └── [id]/
│   │       ├── route.ts            # GET, PATCH, DELETE
│   │       ├── images/route.ts     # POST (Bild-Upload zu Supabase)
│   │       ├── process/route.ts    # POST (n8n-Dispatch, async)
│   │       └── upload/route.ts     # POST (Google Drive Upload)
│   ├── internal/
│   │   └── process-image/route.ts  # POST (Gemini-Verarbeitung, von n8n)
│   ├── webhooks/
│   │   └── n8n/route.ts            # POST (Callback von n8n)
│   ├── google/
│   │   ├── auth/route.ts           # OAuth2 Start
│   │   └── callback/route.ts       # OAuth2 Callback
│   ├── auth/
│   │   ├── login/route.ts          # POST Login (Username + PIN)
│   │   ├── logout/route.ts         # POST Logout
│   │   └── check/route.ts          # GET Session-Check
│   └── health/route.ts             # Liveness
├── login/
│   ├── page.tsx                    # Login-Seite (PIN-Eingabe)
│   └── layout.tsx                  # Eigenes Layout ohne Header
├── products/
│   ├── page.tsx                    # Produktübersicht
│   ├── new/page.tsx                # Neues Produkt (Formular)
│   └── [id]/
│       ├── page.tsx                # Produkt-Detail
│       └── images/page.tsx         # Bilder verwalten (mit Polling)
├── layout.tsx                      # Root Layout + AuthProvider
├── page.tsx                        # Dashboard
└── globals.css                     # Tailwind + Theme
middleware.ts                        # Auth-Middleware (Session-Cookie Check)
components/
├── AppShell.tsx                    # Layout-Wrapper (Header nur wenn eingeloggt)
├── Header.tsx                      # Navigation + Logout (Desktop + Mobile)
├── MainContent.tsx                 # Responsive Container
├── ImageUploader.tsx               # Drag & Drop Upload
├── EanScanner.tsx                  # EAN-Scanner
└── ui/                             # Button, Input, Select, Textarea
contexts/
├── AuthContext.tsx                  # Auth-State + Logout
└── ViewModeContext.tsx              # Desktop/Mobile Toggle
config/
├── product.ts                      # Kategorien, Geschlechter, Status
└── image-processing.ts             # Bildbearbeitungs-Profile + Gemini-Prompts
lib/
├── supabase/
│   ├── client.ts                   # Browser-Client (Anon Key)
│   ├── server.ts                   # Server-Client (Service Role)
│   └── middleware.ts               # Auth-Middleware
├── google/
│   ├── auth.ts                     # OAuth2-Flow
│   ├── drive.ts                    # Drive-Upload
│   ├── sheets.ts                   # Sheets-Integration
│   └── product-upload.ts           # Kompletter Upload-Flow
├── auth.ts                         # App-Auth (Session Token, PIN-Login)
├── admin-auth.ts                   # Admin-Token Validierung (n8n)
└── gemini-processor.ts             # Gemini 2.0 Flash Bildverarbeitung
n8n/
└── workflows/
    └── process-image.json          # n8n Workflow (importierbar)
```

## Nützliche Kommandos

```bash
# Stack starten
docker compose up -d --build

# Logs
docker compose logs -f web-dev
docker compose logs -f n8n

# n8n User-Management zurücksetzen
docker compose exec n8n n8n user-management:reset

# Health-Check
curl http://localhost:3000/api/health

# Interner Endpoint testen (als n8n-Aufruf simulieren)
curl -X POST http://localhost:3000/api/internal/process-image \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: <TOKEN>" \
  -d '{"imageUrl":"...","productId":"...","imageId":"...","filename":"test.jpg","category":"sneaker"}'

# Webhook-Callback testen
curl -X POST http://localhost:3000/api/webhooks/n8n \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: <TOKEN>" \
  -d '{"success":true,"processedUrl":"...","storagePath":"...","imageId":"...","productId":"..."}'
```

## Stil & Commits
- Klare Namen, frühe Rückgaben
- Kommentare nur wenn nötig
- Commits: kleine Einheiten mit Klartext (z.B. „Add Supabase image upload route")

## Roadmap
- [x] Produktdaten-Erfassung (Formular + API)
- [x] Bild-Upload (Supabase Storage)
- [x] Google Drive/Sheets Export
- [x] Responsive Desktop + Mobile UI
- [x] Gemini 2.0 Flash Bildbearbeitung
- [x] n8n Workflow-Orchestrierung (Gemini + Callback)
- [x] Auth (Benutzername + 4-Ziffern PIN, Middleware-geschützt)
- [x] Prisma entfernt, Secrets gesichert, Dockerfile Production-ready
- [ ] EAN-Scanner Verbesserung
- [ ] Bulk-Upload (CSV/Excel)
