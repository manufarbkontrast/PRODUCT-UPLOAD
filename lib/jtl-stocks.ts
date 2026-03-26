/**
 * JTL Stock Data Provider
 *
 * Downloads stock JSON files from a Google Drive folder, builds an EAN index,
 * and provides fast lookups by barcode (Identifiers_Gtin).
 *
 * Files are cached in memory with a configurable TTL (default: 1 hour).
 */
import { loadSavedTokens } from '@/lib/google/auth';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface JtlStockItem {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly ean: string;
  readonly parentItemId: string;
  readonly categories: string;
  readonly priceNet: number;
  readonly suggestedRetailPrice: number;
  readonly purchasePriceNet: number;
  readonly availableStock: number;
  readonly totalStock: number;
  readonly storeNumber: string;
  readonly isActive: boolean;
  readonly changed: string;
}

interface RawJtlRecord {
  readonly Id?: string;
  readonly SKU?: string;
  readonly Name?: string;
  readonly Identifiers_Gtin?: string;
  readonly ParentItemId?: string;
  readonly Categories?: string;
  readonly IsActive?: string;
  readonly Changed?: string;
  readonly ItemPriceData_SalesPriceNet?: string;
  readonly ItemPriceData_SuggestedRetailPrice?: string;
  readonly ItemPriceData_PurchasePriceNet?: string;
  readonly AvailableStock?: number;
  readonly TotalStock?: number;
  readonly StoreNumber?: string;
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface StockCache {
  eanIndex: Map<string, JtlStockItem[]>;
  parentIndex: Map<string, JtlStockItem[]>;
  loadedAt: number;
}

let cache: StockCache | null = null;
let loadingPromise: Promise<StockCache> | null = null;

// ─── Parsing ────────────────────────────────────────────────────────────────

function parseJtlJson(raw: string): RawJtlRecord[] {
  // Replace NaN values with null (JTL exports invalid JSON with NaN)
  const sanitized = raw.replace(/:\s*NaN\b/g, ': null');
  return JSON.parse(sanitized) as RawJtlRecord[];
}

function toStockItem(record: RawJtlRecord): JtlStockItem | null {
  const ean = record.Identifiers_Gtin?.trim();
  if (!ean || ean === '' || ean === '0') return null;

  return {
    id: record.Id ?? '',
    sku: record.SKU ?? '',
    name: record.Name ?? '',
    ean,
    parentItemId: record.ParentItemId ?? '',
    categories: record.Categories ?? '',
    priceNet: parseFloat(record.ItemPriceData_SalesPriceNet ?? '0') || 0,
    suggestedRetailPrice: parseFloat(record.ItemPriceData_SuggestedRetailPrice ?? '0') || 0,
    purchasePriceNet: parseFloat(record.ItemPriceData_PurchasePriceNet ?? '0') || 0,
    availableStock: record.AvailableStock ?? 0,
    totalStock: record.TotalStock ?? 0,
    storeNumber: record.StoreNumber ?? '',
    isActive: record.IsActive === 'True',
    changed: record.Changed ?? '',
  };
}

/**
 * Extract size from SKU (last segment after the last hyphen).
 * e.g. "18917-62081-37" → "37"
 */
export function extractSizeFromSku(sku: string): string {
  const lastDash = sku.lastIndexOf('-');
  if (lastDash === -1) return '';
  return sku.substring(lastDash + 1);
}

/**
 * Extract color from product name.
 * JTL names often end with the color: "CARYATIS 2025 GREEK SANDAL 62081 brown-gold"
 */
export function extractColorFromName(name: string): string {
  // Common pattern: last word(s) after the article number are the color
  const parts = name.split(' ');
  // Find the last part that looks like a color (not a number, not all caps brand name)
  const colorParts: string[] = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    // Stop if we hit a number-only part (article number) or all-caps word (brand)
    if (/^\d+$/.test(part)) break;
    if (/^[A-Z]{3,}$/.test(part) && i < parts.length - 1) break;
    colorParts.unshift(part);
    // Limit color to max 3 words
    if (colorParts.length >= 3) break;
  }
  return colorParts.join(' ');
}

// ─── Drive Access (direct OAuth2 HTTP — bypasses googleapis library) ─────────

/**
 * Get a fresh OAuth2 access token via refresh_token grant.
 * Uses direct HTTP to avoid googleapis library issues on Vercel.
 */
async function getAccessToken(): Promise<string> {
  const tokens = loadSavedTokens();
  if (!tokens?.refresh_token) {
    throw new Error('No OAuth2 refresh token available (GOOGLE_OAUTH_TOKENS not set)');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`OAuth2 token refresh failed: ${data.error} – ${data.error_description}`);
  }

  return data.access_token as string;
}

interface DriveFile {
  id: string;
  name: string;
  size?: string;
}

async function jtlListFiles(folderId: string): Promise<DriveFile[]> {
  const token = await getAccessToken();
  const url = `https://www.googleapis.com/drive/v3/files`
    + `?q=${encodeURIComponent(`'${folderId}' in parents and trashed = false`)}`
    + `&fields=${encodeURIComponent('files(id,name,size)')}`
    + `&supportsAllDrives=true`
    + `&includeItemsFromAllDrives=true`;

  console.log('[JTL-Stocks] Listing folder:', folderId);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive list failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return (data.files || []) as DriveFile[];
}

async function jtlDownloadFile(fileId: string): Promise<Buffer> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    throw new Error(`Drive download failed (${res.status}): ${await res.text()}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Loading ────────────────────────────────────────────────────────────────

function getStockFolderId(): string {
  return (process.env.JTL_STOCKS_FOLDER_ID || '').trim();
}

async function loadStockFiles(): Promise<StockCache> {
  console.log('[JTL-Stocks] Loading stock files from Drive...');
  const startTime = Date.now();

  const folderId = getStockFolderId();
  if (!folderId) {
    throw new Error('JTL_STOCKS_FOLDER_ID is not set');
  }

  // List JSON files in the folder (uses Service Account)
  const files = await jtlListFiles(folderId);
  const jsonFiles = files.filter(f => f.name?.endsWith('.json'));

  if (jsonFiles.length === 0) {
    throw new Error(`No JSON files found in Drive folder ${folderId}`);
  }

  console.log(`[JTL-Stocks] Found ${jsonFiles.length} JSON files: ${jsonFiles.map(f => f.name ?? 'unnamed').join(', ')}`);

  const eanIndex = new Map<string, JtlStockItem[]>();
  const parentIndex = new Map<string, JtlStockItem[]>();
  let totalItems = 0;
  let indexedItems = 0;

  for (const file of jsonFiles) {
    console.log(`[JTL-Stocks] Downloading ${file.name} (${file.size ?? '?'} bytes)...`);
    const buffer = await jtlDownloadFile(file.id!);
    const raw = buffer.toString('utf-8');

    console.log(`[JTL-Stocks] Parsing ${file.name ?? 'unnamed'}...`);
    const records = parseJtlJson(raw);
    totalItems += records.length;

    for (const record of records) {
      const item = toStockItem(record);
      if (!item) continue;

      indexedItems++;

      // Index by EAN
      const existing = eanIndex.get(item.ean);
      if (existing) {
        existing.push(item);
      } else {
        eanIndex.set(item.ean, [item]);
      }

      // Index by parent ID (for finding siblings/variants)
      if (item.parentItemId) {
        const siblings = parentIndex.get(item.parentItemId);
        if (siblings) {
          siblings.push(item);
        } else {
          parentIndex.set(item.parentItemId, [item]);
        }
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[JTL-Stocks] Done in ${elapsed}s: ${totalItems} records, ${indexedItems} with EAN, ${eanIndex.size} unique EANs`);

  return { eanIndex, parentIndex, loadedAt: Date.now() };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get or refresh the stock cache.
 * Returns the cached data if still valid, otherwise triggers a reload.
 */
async function getCache(): Promise<StockCache> {
  const now = Date.now();

  // Return cached if still fresh
  if (cache && (now - cache.loadedAt) < CACHE_TTL_MS) {
    return cache;
  }

  // Prevent concurrent loads
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = loadStockFiles()
    .then(result => {
      cache = result;
      loadingPromise = null;
      return result;
    })
    .catch(err => {
      loadingPromise = null;
      // If we have stale cache, use it
      if (cache) {
        console.error('[JTL-Stocks] Refresh failed, using stale cache:', err instanceof Error ? err.message : err);
        return cache;
      }
      throw err;
    });

  return loadingPromise;
}

/**
 * Look up a product by EAN/barcode.
 * Returns the matching items (may be multiple if EAN is shared across stores).
 */
export async function findByEan(ean: string): Promise<JtlStockItem[]> {
  const stockCache = await getCache();
  return stockCache.eanIndex.get(ean) ?? [];
}

/**
 * Find all variants (siblings) of a product by its parent ID.
 */
export async function findVariants(parentItemId: string): Promise<JtlStockItem[]> {
  const stockCache = await getCache();
  return stockCache.parentIndex.get(parentItemId) ?? [];
}

/**
 * Force refresh the cache.
 */
export async function refreshCache(): Promise<void> {
  cache = null;
  await getCache();
}

/**
 * Check if the JTL stocks data source is available.
 */
export function isJtlStocksConfigured(): boolean {
  return !!getStockFolderId();
}
