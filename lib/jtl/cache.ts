/**
 * JTL Stammdaten Cache
 * Lädt transformed_items_with_stocks.csv von Google Drive,
 * parst sie und cached die Daten für 20 Minuten.
 *
 * Die CSV hat pro SKU+Lager eine Zeile. Beim Lookup werden
 * Bestände pro Lager aggregiert und separat zurückgegeben.
 */

const JTL_CACHE_TTL_MS = 20 * 60 * 1000; // 20 Minuten
const DRIVE_FILE_ID = '1vzgaUk-ULLlK_mS9GtTk9uhWczquDtEI';

export interface JtlStockLocation {
  readonly storeNumber: string;
  readonly locationName: string;
  readonly available: number;
  readonly total: number;
}

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
  readonly locationName: string;
}

/** Artikel mit aggregierten Beständen über alle Lager */
export interface JtlArticle {
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly gtin: string;
  readonly ownIdentifier: string;
  readonly manufacturerNumber: string;
  readonly salesPriceNet: number;
  readonly suggestedRetailPrice: number;
  readonly purchasePriceNet: number;
  readonly categories: string;
  readonly isActive: boolean;
  readonly parentItemId: string;
  readonly countryOfOrigin: string;
  readonly zalandoPrice: string;
  readonly availableStock: number;
  readonly totalStock: number;
  readonly stockLocations: readonly JtlStockLocation[];
}

export interface JtlLookupResult {
  readonly found: boolean;
  readonly source: 'jtl';
  readonly article?: JtlArticle;
  readonly matchField?: string;
}

// ─── In-Memory Cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  readonly rows: readonly JtlItem[];
  readonly loadedAt: number;
}

let cache: CacheEntry | null = null;
let loadPromise: Promise<readonly JtlItem[]> | null = null;

function isCacheValid(): boolean {
  if (!cache) return false;
  return Date.now() - cache.loadedAt < JTL_CACHE_TTL_MS;
}

// ─── CSV Download & Parse ─────────────────────────────────────────────────────

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
          i++;
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
 * Extrahiert den Lager-Namen aus StorageLocationId.
 * Format: "69777 (Shoesplease Zwickau)" → "Shoesplease Zwickau"
 */
function parseLocationName(storageLocationId: string): string {
  const match = storageLocationId.match(/\(([^)]+)\)/);
  return match ? match[1] : storageLocationId;
}

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
      locationName: parseLocationName(get(fields, 'StorageLocationId')),
    });
  }

  return items;
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Aggregiert CSV-Zeilen (pro Lager) zu einem Artikel mit Lager-Aufschlüsselung.
 */
function aggregateRows(rows: readonly JtlItem[]): JtlArticle {
  const first = rows[0];

  const stockLocations: JtlStockLocation[] = rows.map((r) => ({
    storeNumber: r.storeNumber,
    locationName: r.locationName,
    available: r.availableStock,
    total: r.totalStock,
  }));

  return {
    sku: first.sku,
    name: first.name,
    description: first.description,
    gtin: first.gtin,
    ownIdentifier: first.ownIdentifier,
    manufacturerNumber: first.manufacturerNumber,
    salesPriceNet: first.salesPriceNet,
    suggestedRetailPrice: first.suggestedRetailPrice,
    purchasePriceNet: first.purchasePriceNet,
    categories: first.categories,
    isActive: first.isActive,
    parentItemId: first.parentItemId,
    countryOfOrigin: first.countryOfOrigin,
    zalandoPrice: first.zalandoPrice,
    availableStock: stockLocations.reduce((sum, l) => sum + l.available, 0),
    totalStock: stockLocations.reduce((sum, l) => sum + l.total, 0),
    stockLocations,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function getRows(): Promise<readonly JtlItem[]> {
  if (isCacheValid() && cache) {
    return cache.rows;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      console.log('[JTL Cache] Lade CSV von Google Drive...');
      const csvText = await downloadCsv();
      const rows = parseCsv(csvText);
      console.log(`[JTL Cache] ${rows.length} Zeilen geladen und gecached.`);

      cache = { rows, loadedAt: Date.now() };
      return rows;
    } catch (error) {
      console.error('[JTL Cache] Fehler beim Laden:', error);
      if (cache) {
        console.warn('[JTL Cache] Verwende veralteten Cache als Fallback.');
        return cache.rows;
      }
      throw error;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

/**
 * Normalisiert eine EAN/GTIN für den Vergleich:
 * - Lowercase
 * - Führende Nullen entfernen (bei reinen Zahlen)
 */
function normalizeForSearch(value: string): string {
  const lower = value.toLowerCase().trim();
  // Bei reinen Zahlen: führende Nullen entfernen
  if (/^\d+$/.test(lower)) {
    return lower.replace(/^0+/, '');
  }
  return lower;
}

/**
 * Sucht einen Artikel anhand von EAN, GTIN, SKU oder eigener Artikelnummer.
 * Aggregiert Lager-Duplikate automatisch.
 */
export async function findJtlItem(query: string): Promise<JtlLookupResult> {
  const rows = await getRows();
  const q = query.trim().toLowerCase();
  const qNormalized = normalizeForSearch(query);

  // Exakte Suche in Reihenfolge der Wahrscheinlichkeit
  const searchFields: { field: keyof JtlItem; label: string; normalize: boolean }[] = [
    { field: 'gtin', label: 'GTIN', normalize: true },
    { field: 'storeNumber', label: 'StoreNumber', normalize: true },
    { field: 'ownIdentifier', label: 'Eigene Artikelnummer', normalize: false },
    { field: 'sku', label: 'SKU', normalize: false },
    { field: 'manufacturerNumber', label: 'Herstellernummer', normalize: true },
  ];

  for (const { field, label, normalize } of searchFields) {
    const matchingRows = rows.filter((row) => {
      const value = String(row[field]);
      if (normalize) {
        return normalizeForSearch(value) === qNormalized;
      }
      return value.toLowerCase() === q;
    });

    if (matchingRows.length > 0) {
      const article = aggregateRows(matchingRows);
      return { found: true, source: 'jtl', article, matchField: label };
    }
  }

  // Teilsuche im SKU (z.B. "CD520" findet "18533-CD520-W32/L34")
  if (q.length >= 3) {
    const matchingRows = rows.filter(
      (row) => row.sku.toLowerCase().includes(q)
    );
    if (matchingRows.length > 0) {
      // Gruppiere nach SKU und nimm die erste Gruppe
      const firstSku = matchingRows[0].sku;
      const skuRows = matchingRows.filter((r) => r.sku === firstSku);
      const article = aggregateRows(skuRows);
      return { found: true, source: 'jtl', article, matchField: 'SKU (teilweise)' };
    }
  }

  return { found: false, source: 'jtl' };
}

/**
 * Findet alle Varianten eines Artikels (gleiche ParentItemId).
 * Jede Variante wird über alle Lager aggregiert.
 */
export async function findJtlSiblings(article: JtlArticle): Promise<readonly JtlArticle[]> {
  if (!article.parentItemId) return [article];

  const rows = await getRows();
  const siblingRows = rows.filter((r) => r.parentItemId === article.parentItemId);

  // Gruppiere nach SKU
  const skuGroups = new Map<string, JtlItem[]>();
  for (const row of siblingRows) {
    const existing = skuGroups.get(row.sku) ?? [];
    skuGroups.set(row.sku, [...existing, row]);
  }

  return Array.from(skuGroups.values()).map(aggregateRows);
}

/**
 * Cache-Status für Debugging.
 */
export function getCacheStatus(): {
  loaded: boolean;
  rowCount: number;
  ageMinutes: number;
  stale: boolean;
} {
  if (!cache) {
    return { loaded: false, rowCount: 0, ageMinutes: 0, stale: true };
  }

  const ageMs = Date.now() - cache.loadedAt;
  return {
    loaded: true,
    rowCount: cache.rows.length,
    ageMinutes: Math.round(ageMs / 60000),
    stale: ageMs >= JTL_CACHE_TTL_MS,
  };
}
