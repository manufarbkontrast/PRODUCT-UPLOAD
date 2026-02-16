# Archivierte Features

Dieses Verzeichnis enthalt gesicherten Code fur Features, die vorubergehend deaktiviert wurden.
Die Dateien koennen spater wiederverwendet werden.

## Gesicherte Features

### Navigation & Layout
- `components/Header.tsx` - Vollstaendige Header-Navigation (Dashboard, Produkte, + Neu, Hamburger-Menu)
- `components/MainContent.tsx` - Responsive Container mit ViewMode-Unterstuetzung
- `contexts/ViewModeContext.tsx` - Auto/Mobile/Desktop ViewMode-Umschaltung

### Seiten
- `pages/dashboard-page.tsx` - Dashboard mit 3-Spalten-Grid (Desktop) und Quick-Actions (Mobile)
- `pages/products-list-page.tsx` - Produktuebersicht mit Liste (Mobile) und Grid (Desktop)
- `pages/product-detail-page.tsx` - Produktdetailseite mit Bildern, Details, Aktionen
- `pages/product-edit-page.tsx` - Produkt-Bearbeitungsformular
- `pages/product-new-page.tsx` - 3-Schritte-Wizard (EAN Scan, Details, Bilder)

### Google Sheets Integration
- `lib/google-sheets.ts` - Alle Sheet-Operationen (read, write, append, clear, find, update)
- `lib/google-setup.ts` - Sheet-Headers (37 Spalten), Spreadsheet-Auto-Setup
- `lib/google-product-upload.ts` - Produkt-Upload mit Sheet-Sync (syncToSheet Funktion)

### Zalando-Attribute
- `components/ZalandoAttributeForm.tsx` - Dynamisches Formular fuer Zalando-Pflichtfelder
- `config/zalando-attributes.ts` - Silhouette-basierte Attribut-Definitionen
- `config/zalando-colors.ts` - Zalando-Farbcodes
- `config/zalando-teams.ts` - Zalando-Team-Konfiguration
- `config/brands.ts` - Marken-Optionen fuer Dropdown

### API Test-Routes
- `api/google/test/route.ts` - Google Drive + Sheets Verbindungstest (mit Sheets)
- `api/google/test-products/route.ts` - Mock-Produkte in Google Sheets schreiben/lesen

## Wiederherstellung

Um ein Feature wiederherzustellen:
1. Kopiere die Datei aus `_archive/` an den urspruenglichen Ort
2. Stelle Import-Referenzen wieder her
3. Fuege ggf. Routes in der Navigation hinzu
