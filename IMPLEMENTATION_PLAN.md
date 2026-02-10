# Implementierungsplan: Google Drive/Sheets Integration + UX-Verbesserungen

## Anforderungen (Zusammenfassung)

1. **Fertige Daten werden nicht zu Google Drive und Sheets gebracht** - Fix: Automatische Erstellung von Root-Ordner/Sheet + automatischer Upload nach Bildverarbeitung
2. **Fortschrittsbalken** waehrend Bildverarbeitung + **"Naechstes Produkt" Button** zum parallelen Weiterarbeiten
3. **Debug-Code entfernen** aus `app/products/new/page.tsx`

---

## Analyse der Ursache (Drive/Sheets Problem)

Die `.env` hat `GOOGLE_DRIVE_FOLDER_ID=` und `GOOGLE_SHEET_ID=` **leer**. Der Code in `lib/google/config.ts` setzt diese als leere Strings:
```
DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || ''
SPREADSHEET_ID: process.env.GOOGLE_SHEET_ID || ''
```

Das fuehrt dazu, dass:
- `createFolder()` in `drive.ts` einen leeren `parentFolderId` hat → Fehler bei Google API
- `appendToSheet()` in `sheets.ts` einen leeren `spreadsheetId` hat → Fehler bei Google API
- Der Upload bricht ab und das Produkt bleibt im Status `error` oder `ready` stecken

Zusaetzlich: Im direkten Verarbeitungsmodus (ohne n8n) wird nach der Bildverarbeitung **kein automatischer Drive-Upload** ausgeloest. Nur der n8n-Webhook-Handler hat den Auto-Upload-Code.

---

## Phase 1: Google Drive/Sheets Auto-Setup

### 1.1 Auto-Erstellung Root-Ordner und Spreadsheet

**Datei: `lib/google/setup.ts`** (NEU)
- Funktion `ensureDriveFolder()`: Prueft ob `GOOGLE_DRIVE_FOLDER_ID` gesetzt ist. Wenn nicht:
  - Erstellt Root-Ordner "SPZ-Product-Integration" in Drive (im Root des Service Accounts)
  - Speichert die ID im laufenden Prozess (in-memory Cache)
- Funktion `ensureSpreadsheet()`: Prueft ob `GOOGLE_SHEET_ID` gesetzt ist. Wenn nicht:
  - Erstellt ein neues Google Spreadsheet "SPZ-Product-Data"
  - Verschiebt es in den Root-Ordner
  - Initialisiert Headers (Timestamp, Product ID, EAN, Name, etc.)
  - Speichert die ID im laufenden Prozess
- Funktion `getOrCreateDriveFolderId()` und `getOrCreateSpreadsheetId()` als zentrale Getter

### 1.2 Config-Update

**Datei: `lib/google/config.ts`** (EDIT)
- Statt statischer `GOOGLE_CONFIG` werden `getDriveFolderId()` und `getSpreadsheetId()` als async Funktionen bereitgestellt
- Diese rufen `ensureDriveFolder()` / `ensureSpreadsheet()` auf

### 1.3 Drive/Sheets-Funktionen anpassen

**Datei: `lib/google/drive.ts`** (EDIT)
- `createFolder()` und `uploadFile()`: Default `folderId` ueber `getOrCreateDriveFolderId()` statt statischer Config
- Fallback auf Root-Ebene wenn kein Parent vorhanden

**Datei: `lib/google/sheets.ts`** (EDIT)
- Alle Funktionen: Default `spreadsheetId` ueber `getOrCreateSpreadsheetId()` statt statischer Config

**Datei: `lib/google/product-upload.ts`** (EDIT)
- `uploadProductToDrive()`: Verwendet die neuen async Getter
- `initializeProductSheet()`: Verwendet die neuen async Getter

---

## Phase 2: Automatischer Drive-Upload nach Bildverarbeitung (Direkt-Modus)

### 2.1 Process-Route erweitern

**Datei: `app/api/products/[id]/process/route.ts`** (EDIT)

Aktuell: Im Direkt-Modus (ohne n8n) endet die Verarbeitung mit Status `ready`, aber es wird **kein Drive-Upload** ausgeloest.

Fix: Nach erfolgreicher direkter Verarbeitung (alle Bilder `done`):
1. Produkt-Status auf `uploading` setzen
2. `uploadProductToDrive()` aufrufen (gleiche Logik wie im n8n-Webhook)
3. Produkt-Status auf `uploaded` setzen + `drive_url` speichern
4. Bei Fehler: Status auf `drive_error` setzen (Mitarbeiter kann manuell nochmal versuchen)

Der Upload wird **asynchron im Hintergrund** gestartet (nicht await), damit die API-Response sofort zurueckkommen kann und der Mitarbeiter nicht warten muss.

---

## Phase 3: UX-Verbesserungen - Fortschrittsbalken + Naechstes Produkt

### 3.1 Fortschrittsbalken auf der Bilder-Seite

**Datei: `app/products/[id]/images/page.tsx`** (EDIT)

Aktuell: Es gibt nur einen Spinner ("Verarbeitung laeuft...") und Status-Badges pro Bild.

Neu:
- **Echter Fortschrittsbalken** der zeigt: "3 von 5 Bildern verarbeitet" mit prozentualem Fortschritt
- Der Balken aktualisiert sich automatisch (es gibt bereits ein 3s-Polling)
- Phasen-Anzeige: "Bilder werden verarbeitet..." → "Wird zu Google Drive hochgeladen..." → "Fertig!"
- Animierter Balken mit sanftem Uebergang

### 3.2 "Naechstes Produkt" Button

**Datei: `app/products/[id]/images/page.tsx`** (EDIT)

Sobald die Bildverarbeitung gestartet wurde:
- Grosser Button "Naechstes Produkt hinzufuegen" erscheint prominent
- Link zu `/products/new`
- Hinweis: "Die Bilder werden im Hintergrund weiterverarbeitet"
- Optional: Kleiner Link "Auf dieser Seite bleiben" fuer Mitarbeiter die den Fortschritt beobachten wollen

### 3.3 Status-Updates im Hintergrund

Die bestehende Polling-Logik (alle 3s `fetchProduct`) wird beibehalten. Der Fortschrittsbalken und die Status-Anzeige aktualisieren sich dadurch automatisch.

Neu: Wenn der Status auf `uploaded` wechselt, wird eine Erfolgsmeldung angezeigt mit dem Drive-Link.

---

## Phase 4: Debug-Code entfernen

### 4.1 Agent-Log Code entfernen

**Datei: `app/products/new/page.tsx`** (EDIT)
- Alle `#region agent log` / `#endregion agent log` Bloecke entfernen
- Die `fetch('http://127.0.0.1:7242/...')` Aufrufe komplett rausnehmen
- Die Response-Verarbeitung vereinfachen (direkt `await res.json()` statt `res.text()` + `JSON.parse`)

---

## Aenderungsumfang

| Datei | Aktion | Beschreibung |
|-------|--------|--------------|
| `lib/google/setup.ts` | NEU | Auto-Setup fuer Drive-Ordner + Spreadsheet |
| `lib/google/config.ts` | EDIT | Async Getter statt statischer Config |
| `lib/google/drive.ts` | EDIT | Async Folder-ID Default |
| `lib/google/sheets.ts` | EDIT | Async Spreadsheet-ID Default |
| `lib/google/product-upload.ts` | EDIT | Async Config + Auto-Sheet-Init |
| `lib/google/index.ts` | EDIT | Neue Exporte |
| `app/api/products/[id]/process/route.ts` | EDIT | Auto-Upload nach Verarbeitung |
| `app/products/[id]/images/page.tsx` | EDIT | Fortschrittsbalken + Naechstes-Produkt-Button |
| `app/products/new/page.tsx` | EDIT | Debug-Code entfernen |

**Geschaetzte Dateien:** 9 (1 neue, 8 bearbeitete)

---

## Risiken

| Risiko | Schwere | Mitigation |
|--------|---------|------------|
| Service Account hat keine Drive-Berechtigung | MITTEL | Fehlerbehandlung + klare Fehlermeldung im UI |
| Rate Limiting bei Google API | NIEDRIG | Sequentieller Upload (bereits vorhanden) |
| Gleichzeitige Uploads bei mehreren Mitarbeitern | NIEDRIG | Jedes Produkt hat eigenen Ordner |
| Spreadsheet hat max. Zeilenlimit (10 Mio) | NIEDRIG | Kein Problem bei erwarteter Nutzung |

---

## Reihenfolge der Implementierung

1. Phase 4 (Debug-Code entfernen) - Schnell, raeumlich begrenzt
2. Phase 1 (Google Auto-Setup) - Kernproblem loesen
3. Phase 2 (Auto-Upload) - Automatisierung vervollstaendigen
4. Phase 3 (UX-Verbesserungen) - Fortschrittsbalken + Naechstes Produkt
5. Test: Manueller Durchlauf des gesamten Flows
