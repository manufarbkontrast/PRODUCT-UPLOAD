# Plan: Google Sheets Integration & Workflow-Verbesserungen

## Analyse des aktuellen Stands

### Was existiert bereits:
- ✅ Google Sheets API-Client (`lib/google/sheets.ts`)
- ✅ Google Drive Upload (`lib/google/drive.ts`)
- ✅ Product Upload Funktion (`lib/google/product-upload.ts`)
- ✅ Upload API-Endpoint (`/api/products/[id]/upload`)
- ✅ Bildverarbeitung funktioniert (`/api/products/[id]/process`)

### Was fehlt:
1. **Kein "Speichern & Hochladen" Button** in der UI nach der Bildverarbeitung
2. **Kein Feedback** während die Bilder verarbeitet werden
3. **Kein paralleles Arbeiten** möglich (nächstes Produkt starten während Bilder laden)

---

## Implementierungsplan

### Phase 1: "Speichern zu Google Sheets" Button hinzufügen

**Datei:** `app/products/[id]/images/page.tsx`

Änderungen:
1. Neuen "Zu Google Sheets hochladen" Button hinzufügen, der nur erscheint wenn:
   - Alle Bilder `status: 'done'` haben
   - Produkt noch nicht hochgeladen wurde (`status !== 'uploaded'`)
2. Upload-Status anzeigen während des Uploads
3. Erfolgs-/Fehlermeldung nach Upload

```tsx
// Neuer State
const [uploading, setUploading] = useState(false);
const [uploadResult, setUploadResult] = useState<{success: boolean; error?: string; driveUrl?: string} | null>(null);

// Neuer Handler
const handleUploadToSheets = async () => {
  setUploading(true);
  setUploadResult(null);

  try {
    const res = await fetch(`/api/products/${id}/upload`, { method: 'POST' });
    const data = await res.json();

    if (res.ok) {
      setUploadResult({ success: true, driveUrl: data.driveUrl });
      await fetchProduct(); // Reload to update status
    } else {
      setUploadResult({ success: false, error: data.error });
    }
  } catch (err) {
    setUploadResult({ success: false, error: 'Netzwerkfehler' });
  } finally {
    setUploading(false);
  }
};
```

---

### Phase 2: Asynchrone Bildverarbeitung mit Hintergrund-Weiterarbeit

**Problem:** Benutzer muss warten bis alle Bilder verarbeitet sind.

**Lösung:** "Verarbeitung läuft" Banner mit Option zum nächsten Produkt zu gehen.

**Datei:** `app/products/[id]/images/page.tsx`

Änderungen:
1. Wenn Verarbeitung läuft: Zeige Progress-Banner mit:
   - Anzahl fertige Bilder / Gesamt
   - "Weiter zum nächsten Produkt" Button
   - Status bleibt über Polling sichtbar

```tsx
// Banner wenn Verarbeitung läuft
{isProcessing && (
  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <svg className="animate-spin w-5 h-5 text-blue-600" viewBox="0 0 24 24">...</svg>
        <div>
          <p className="font-medium text-blue-800 dark:text-blue-200">Bilder werden verarbeitet...</p>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            {doneImages.length} von {images.length} fertig
          </p>
        </div>
      </div>
      <Link href="/products/new">
        <Button variant="secondary" size="sm">
          Nächstes Produkt →
        </Button>
      </Link>
    </div>
  </div>
)}
```

---

### Phase 3: Toast/Notification System für Hintergrund-Updates

**Problem:** Wenn Benutzer bei neuem Produkt ist, weiß er nicht wann vorheriges fertig ist.

**Lösung:** Globales Notification-System das zeigt:
- "Produkt X: Bildverarbeitung abgeschlossen"
- Mit Link zurück zum Produkt

**Dateien:**
1. `contexts/NotificationContext.tsx` - Neuer Context für Notifications
2. `components/NotificationToast.tsx` - Toast-Komponente
3. `app/layout.tsx` - Provider einbinden

**Alternative (einfacher):** In `/products` Liste Status anzeigen mit Live-Updates.

---

### Phase 4: Produktliste mit Live-Status

**Datei:** `app/products/page.tsx`

Änderungen:
1. Polling für Produkte mit `status: 'processing'`
2. Visual Feedback (Spinner/Badge) für verarbeitende Produkte
3. Quick-Action Button zum Hochladen wenn fertig

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `app/products/[id]/images/page.tsx` | Upload-Button, Progress-Banner, "Weiter"-Button |
| `app/products/page.tsx` | Live-Status für processing Produkte |
| `lib/google/config.ts` | Prüfen ob SPREADSHEET_ID gesetzt ist |

---

## Reihenfolge der Implementierung

1. **Phase 1** - Upload-Button (kritisch, sofort)
2. **Phase 2** - Progress-Banner mit "Weiter"-Option (wichtig)
3. **Phase 3** - Optional: Toast-Notifications (nice-to-have)
4. **Phase 4** - Live-Status in Liste (nice-to-have)

---

## Prüfung der Google Sheets Konfiguration

Benötigte Env-Variablen:
- `GOOGLE_SHEET_ID` - ID des Ziel-Spreadsheets
- `GOOGLE_SHEET_NAME` - Name des Tabellenblatts (default: "Tabellenblatt1")
- `GOOGLE_DRIVE_FOLDER_ID` - Ordner für Bilder
- OAuth2 Token oder Service Account

**Nächster Schritt:** Prüfen ob diese Variablen in `.env` gesetzt sind.
