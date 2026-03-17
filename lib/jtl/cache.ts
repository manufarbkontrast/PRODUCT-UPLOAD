/**
 * JTL Stammdaten Cache
 * Lädt transformed_items_with_stocks.csv von Google Drive,
 * parst sie und cached die Daten für 20 Minuten.
 */

const JTL_CACHE_TTL_MS = 20 * 60 * 1000; // 20 Minuten
const DRIVE_FILE_ID = '1vzgaUk-ULLlK_mS9GtTk9uhWczquDtEI';

export interface JtlItem {
  readonly storeNumber: string;
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly gtin: string;
  readonly ownIdentifier: string;
  readonly manufacturerNumber: string;
  readonly availableStock: number;
  readonly totalStock: number;
  readonly salesPriceNet: number;
  readonly suggestedRetailPrice: number;
  readonly purchasePriceNet: number;
  readonly categories: string;
  readonly isActive: boolean;
  readonly parentItemId: string;
  readonly countryOfOrigin: string;
  readonly zalandoPrice: string;
}

export interface JtlLookupResult {
  readonly found: boolean;
  readonly source: 'jtl';
  readonly item?: JtlItem;
  readonly matchField?: string;
}

// ─── In-Memory Cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  readonly items: readonly JtlItem[];
  readonly loadedAt: number;
}

let cache: CacheEntry | null = null;
let loadPromise: Promise<readonly JtlItem[]> | null = null;

function isCacheValid(): boolean {
  if (!cache) return false;
  return Date.now() - cache.loadedAt < JTL_CACHE_TTL_MS;
}

// ─── CSV Download & Parse ─────────────────────────────────────────────────────

/**
 * Lädt die CSV von Google Drive via direktem Download-Link.
 * Unterstützt Dateien > 100KB (Bestätigungs-Redirect).
 */
async function downloadCsv(): Promise<string> {
  const url = `https://drive.google.com/uc?export=download&id=${DRIVE_FILE_ID}`;

  const response = await fetch(url, { redirect: 'follow' });

  if (!response.ok) {
    throw new Error(`Google Drive download failed: ${response.status}`);
  }

  const text = await response.text();

  // Bei großen Dateien gibt Google eine Bestätigungsseite zurück
  if (text.includes('virus scan warning') || text.includes('confirm=')) {
    const confirmMatch = text.match(/confirm=([0-9A-Za-z_-]+)/);
    if (confirmMatch) {
      const confirmUrl = `${url}&confirm=${confirmMatch[1]}`;
      const confirmResponse = await fetch(confirmUrl, { redirect: 'follow' });
      if (!confirmResponse.ok) {
        throw new Error(`Google Drive confirm download failed: ${confirmResponse.status}`);
      }
      return confirmResponse.text();
    }
  }

  return text;
}

/**
 * Parst eine CSV-Zeile unter Berücksichtigung von Quotes und Kommas innerhalb von Feldern.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  fields.push(current);
  return fields;
}

/**
 * Parst die CSV und gibt ein Array von JtlItems zurück.
 */
function parseCsv(csvText: string): JtlItem[] {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const headerIndex = new Map<string, number>();
  headers.forEach((h, i) => headerIndex.set(h.trim(), i));

  const get = (fields: string[], column: string): string => {
    const idx = headerIndex.get(column);
    if (idx === undefined || idx >= fields.length) return '';
    return fields[idx].trim();
  };

  const getNum = (fields: string[], column: string): number => {
    const val = get(fields, column);
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  const items: JtlItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCsvLine(line);
    if (fields.length < 10) continue;

    items.push({
      storeNumber: get(fields, 'StoreNumber'),
      sku: get(fields, 'SKU'),
      name: get(fields, 'Name'),
      description: get(fields, 'ShortDescription') || get(fields, 'Description'),
      gtin: get(fields, 'Identifiers_Gtin'),
      ownIdentifier: get(fields, 'Identifiers_OwnIdentifier'),
      manufacturerNumber: get(fields, 'Identifiers_ManufacturerNumber'),
      availableStock: getNum(fields, 'AvailableStock'),
      totalStock: getNum(fields, 'TotalStock'),
      salesPriceNet: getNum(fields, 'ItemPriceData_SalesPriceNet'),
      suggestedRetailPrice: getNum(fields, 'ItemPriceData_SuggestedRetailPrice'),
      purchasePriceNet: getNum(fields, 'ItemPriceData_PurchasePriceNet'),
      categories: get(fields, 'Categories'),
      isActive: get(fields, 'IsActive') === 'True',
      parentItemId: get(fields, 'ParentItemId'),
      countryOfOrigin: get(fields, 'CountryOfOrigin'),
      zalandoPrice: get(fields, 'zalando_price'),
    });
  }

  return items;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Lädt die JTL-Daten (aus Cache oder frisch von Drive).
 * Dedupliziert parallele Requests über ein shared Promise.
 */
export async function getJtlItems(): Promise<readonly JtlItem[]> {
  if (isCacheValid() && cache) {
    return cache.items;
  }

  // Verhindere parallele Downloads
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      console.log('[JTL Cache] Lade CSV von Google Drive...');
      const csvText = await downloadCsv();
      const items = parseCsv(csvText);
      console.log(`[JTL Cache] ${items.length} Artikel geladen und gecached.`);

      cache = { items, loadedAt: Date.now() };
      return items;
    } catch (error) {
      console.error('[JTL Cache] Fehler beim Laden:', error);
      // Bei Fehler: alten Cache weiterverwenden falls vorhanden
      if (cache) {
        console.warn('[JTL Cache] Verwende veralteten Cache als Fallback.');
        return cache.items;
      }
      throw error;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

/**
 * Sucht einen Artikel anhand von EAN, GTIN, SKU oder eigener Artikelnummer.
 * Sucht in mehreren Feldern gleichzeitig.
 */
export async function findJtlItem(query: string): Promise<JtlLookupResult> {
  const items = await getJtlItems();
  const q = query.trim().toLowerCase();

  // Exakte Suche in Reihenfolge der Wahrscheinlichkeit
  const searchFields: { field: keyof JtlItem; label: string }[] = [
    { field: 'gtin', label: 'GTIN' },
    { field: 'storeNumber', label: 'StoreNumber' },
    { field: 'ownIdentifier', label: 'Eigene Artikelnummer' },
    { field: 'sku', label: 'SKU' },
    { field: 'manufacturerNumber', label: 'Herstellernummer' },
  ];

  for (const { field, label } of searchFields) {
    const match = items.find(
      (item) => String(item[field]).toLowerCase() === q
    );
    if (match) {
      return { found: true, source: 'jtl', item: match, matchField: label };
    }
  }

  // Teilsuche im SKU (z.B. "CD520" findet "18533-CD520-W32/L34")
  const partialMatch = items.find(
    (item) => item.sku.toLowerCase().includes(q) && q.length >= 3
  );
  if (partialMatch) {
    return { found: true, source: 'jtl', item: partialMatch, matchField: 'SKU (teilweise)' };
  }

  return { found: false, source: 'jtl' };
}

/**
 * Findet alle Varianten eines Artikels (gleiche ParentItemId).
 */
export async function findJtlSiblings(item: JtlItem): Promise<readonly JtlItem[]> {
  if (!item.parentItemId) return [item];

  const items = await getJtlItems();
  return items.filter((i) => i.parentItemId === item.parentItemId);
}

/**
 * Cache-Status für Debugging.
 */
export function getCacheStatus(): {
  loaded: boolean;
  itemCount: number;
  ageMinutes: number;
  stale: boolean;
} {
  if (!cache) {
    return { loaded: false, itemCount: 0, ageMinutes: 0, stale: true };
  }

  const ageMs = Date.now() - cache.loadedAt;
  return {
    loaded: true,
    itemCount: cache.items.length,
    ageMinutes: Math.round(ageMs / 60000),
    stale: ageMs >= JTL_CACHE_TTL_MS,
  };
}
