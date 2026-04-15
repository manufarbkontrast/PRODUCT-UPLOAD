# Nachbestellung (Reorder) Feature

## Überblick

Filial-Benutzer können ausverkaufte Artikel über den Scanner (`/abfrage`) nachbestellen. Pro Marke wird eine Google-Sheets-Datei geführt. Eine SKU kann nur einmal gleichzeitig in der Tabelle stehen — erst nach Entfernen der Zeile darf eine andere Filiale nachbestellen.

## Supabase Setup

### 1. Migration anwenden

```sql
-- Datei: supabase/migrations/20260414_filiale_profiles.sql
```

Über das Supabase SQL Editor ausführen oder via `supabase db push`.

### 2. Filial-User anlegen

Im Supabase Dashboard → Authentication → Users → "Add user" (Email+Passwort) für jede Filiale:

| Filiale | Vorschlag Email |
|---------|-----------------|
| J&C     | jc@craftongmbh.intern     |
| SPZ     | spz@craftongmbh.intern    |
| SPR     | spr@craftongmbh.intern    |
| SPSW    | spsw@craftongmbh.intern   |
| SPW     | spw@craftongmbh.intern    |

### 3. Profile-Zuordnung (als Service-Role im SQL Editor)

```sql
insert into public.profiles (user_id, filiale) values
  ((select id from auth.users where email = 'jc@craftongmbh.intern'),   'J&C'),
  ((select id from auth.users where email = 'spz@craftongmbh.intern'),  'SPZ'),
  ((select id from auth.users where email = 'spr@craftongmbh.intern'),  'SPR'),
  ((select id from auth.users where email = 'spsw@craftongmbh.intern'), 'SPSW'),
  ((select id from auth.users where email = 'spw@craftongmbh.intern'),  'SPW');
```

## Google Sheets Setup

### 1. OAuth-Scope erweitern

Der bisherige Scope war nur `drive`. Das Feature benötigt zusätzlich `spreadsheets`. Nach dem Deploy einmalig:

1. `/api/google/auth` öffnen → `authUrl` ausführen
2. Consent neu bestätigen — Google erteilt jetzt beide Scopes
3. `GOOGLE_OAUTH_TOKENS` (base64) in Vercel aktualisieren

### 2. Drive-Ordner

Einen Ordner in Google Drive anlegen (z. B. `SPZ Nachbestellungen`), Ordner-ID kopieren.

Env-Variable setzen:

```
REORDER_SHEETS_FOLDER_ID=<folder_id>
```

Für jede Marke wird beim ersten Aufruf automatisch ein Sheet `Nachbestellungen – <MARKE>` erzeugt und gecacht.

## Spaltenstruktur (Sheet)

| A         | B       | C   | D   | E            | F     | G     | H     |
|-----------|---------|-----|-----|--------------|-------|-------|-------|
| Timestamp | Filiale | EAN | SKU | Artikelname  | Größe | Menge | Notiz |

Die Sperre greift, solange für dieselbe **SKU** eine Zeile existiert. Zum Freigeben: Zeile in der Google-Sheets-Datei löschen.

## API

### `POST /api/reorder`

Body:
```json
{
  "ean": "4012345678901",
  "sku": "BIRK-1234-42",
  "articleName": "Birkenstock Arizona",
  "brand": "BIRKENSTOCK",
  "size": "42",
  "quantity": 1,
  "note": "Kunde wartet"
}
```

Antworten:
- `200` `{ ok: true }` — Zeile angehängt
- `401` `{ error: 'Nicht eingeloggt' }`
- `403` `{ error: 'Keine Filiale zugewiesen' }`
- `409` `{ error: 'Bereits nachbestellt', filiale: 'SPZ', timestamp: '…' }` — gesperrt durch andere Filiale

### `GET /api/reorder?brand=…&sku=…`

Antwort: `{ locked: boolean, filiale?: string, timestamp?: string }`
