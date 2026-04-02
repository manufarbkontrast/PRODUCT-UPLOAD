/**
 * JTL Live Data Provider
 *
 * Connects to the local JTL API Proxy (jtl_api_proxy.py) for real-time
 * article data directly from the SQL Server.
 *
 * Replaces the Google Drive CSV/JSON approach with live queries.
 *
 * Environment:
 *   JTL_API_URL  - e.g. http://192.168.195.72:8091
 *   JTL_API_KEY  - API key for authentication
 */

import type { JtlStockItem } from '@/lib/jtl-stocks';

// ─── Config ────────────────────────────────────────────────────────────────

function getApiUrl(): string {
  return (process.env.JTL_API_URL || 'http://192.168.195.72:8091').replace(/\/$/, '');
}

function getApiKey(): string {
  return process.env.JTL_API_KEY || 'spz-jtl-live-2026';
}

// ─── Types from API Proxy ──────────────────────────────────────────────────

interface ApiVariant {
  readonly kArtikel: number;
  readonly sku: string;
  readonly barcode: string;
  readonly size: string;
  readonly ek_netto: number | null;
  readonly vk_netto: number | null;
  readonly uvp: number | null;
  readonly bestand: number;
  readonly verfuegbar: number;
}

interface ApiStockLocation {
  readonly lager: string;
  readonly lager_kuerzel: string | null;
  readonly bestand: number;
  readonly gesperrt: number | null;
}

interface ApiArticle {
  readonly kArtikel: number;
  readonly sku: string;
  readonly barcode: string;
  readonly season: string | null;
  readonly asin: string | null;
  readonly ek_netto: number;
  readonly vk_netto: number;
  readonly uvp: number;
  readonly ek_letzter: number;
  readonly aktiv: string;
  readonly lagerartikel: string;
  readonly erstellt: string | null;
  readonly vater_artikel_id: number | null;
  readonly ist_vater: number | null;
  readonly hersteller: string | null;
  readonly warengruppe: string | null;
  readonly bestand: number;
  readonly verfuegbar: number;
  readonly zulauf: number;
  readonly in_auftraegen: number;
  readonly size: string;
  readonly stock_per_warehouse: readonly ApiStockLocation[];
  readonly variants: readonly ApiVariant[];
}

interface ApiResponse {
  readonly found: boolean;
  readonly count?: number;
  readonly results?: readonly ApiArticle[];
  readonly error?: string;
}

// ─── API Client ────────────────────────────────────────────────────────────

async function apiRequest(params: Record<string, string>): Promise<ApiResponse> {
  const url = `${getApiUrl()}/api/v1/product?${new URLSearchParams(params)}`;

  const response = await fetch(url, {
    headers: { 'X-API-Key': getApiKey() },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`JTL API error (${response.status}): ${text}`);
  }

  return response.json() as Promise<ApiResponse>;
}

// ─── Mapping to existing interfaces ────────────────────────────────────────

function mapToStockItem(article: ApiArticle, storeNumber?: string): JtlStockItem {
  return {
    id: String(article.kArtikel),
    sku: article.sku,
    name: '', // Not in API response, filled from variant name
    ean: article.barcode || '',
    parentItemId: article.vater_artikel_id ? String(article.vater_artikel_id) : '',
    categories: article.warengruppe || '',
    priceNet: article.vk_netto || 0,
    suggestedRetailPrice: article.uvp || 0,
    purchasePriceNet: article.ek_letzter || article.ek_netto || 0,
    availableStock: article.verfuegbar || 0,
    totalStock: article.bestand || 0,
    storeNumber: storeNumber || 'shoesplease',
    isActive: article.aktiv === 'Y',
    changed: article.erstellt || '',
  };
}

// ─── Public API (drop-in replacements) ─────────────────────────────────────

/**
 * Look up a product by EAN/barcode via live JTL API.
 */
export async function findByEanLive(ean: string): Promise<JtlStockItem[]> {
  try {
    const data = await apiRequest({ ean });
    if (!data.found || !data.results?.length) return [];

    return data.results.map(r => mapToStockItem(r));
  } catch (error) {
    console.error('[JTL-Live] EAN lookup failed:', error);
    return [];
  }
}

/**
 * Look up a product by SKU via live JTL API.
 */
export async function findBySkuLive(sku: string): Promise<JtlStockItem[]> {
  try {
    const data = await apiRequest({ sku });
    if (!data.found || !data.results?.length) return [];

    return data.results.map(r => mapToStockItem(r));
  } catch (error) {
    console.error('[JTL-Live] SKU lookup failed:', error);
    return [];
  }
}

/**
 * Find all variants of a product by EAN (finds article, then returns siblings).
 */
export async function findVariantsLive(ean: string): Promise<JtlStockItem[]> {
  try {
    const data = await apiRequest({ ean });
    if (!data.found || !data.results?.length) return [];

    const article = data.results[0];
    const variants = article.variants || [];

    return variants.map(v => ({
      id: String(v.kArtikel),
      sku: v.sku,
      name: '',
      ean: v.barcode || '',
      parentItemId: article.vater_artikel_id ? String(article.vater_artikel_id) : '',
      categories: article.warengruppe || '',
      priceNet: v.vk_netto || 0,
      suggestedRetailPrice: v.uvp || 0,
      purchasePriceNet: v.ek_netto || 0,
      availableStock: v.verfuegbar || 0,
      totalStock: v.bestand || 0,
      storeNumber: 'shoesplease',
      isActive: true,
      changed: '',
    }));
  } catch (error) {
    console.error('[JTL-Live] Variants lookup failed:', error);
    return [];
  }
}

/**
 * Find variants by parent item ID via SKU prefix search.
 */
export async function findVariantsByParentLive(parentItemId: string): Promise<JtlStockItem[]> {
  // The API proxy finds variants automatically via kVaterArtikel
  // We search by the parent SKU to trigger variant loading
  try {
    const data = await apiRequest({ sku: parentItemId });
    if (!data.found || !data.results?.length) return [];

    const allVariants: JtlStockItem[] = [];
    for (const article of data.results) {
      for (const v of article.variants || []) {
        allVariants.push({
          id: String(v.kArtikel),
          sku: v.sku,
          name: '',
          ean: v.barcode || '',
          parentItemId: String(article.vater_artikel_id || article.kArtikel),
          categories: article.warengruppe || '',
          priceNet: v.vk_netto || 0,
          suggestedRetailPrice: v.uvp || 0,
          purchasePriceNet: v.ek_netto || 0,
          availableStock: v.verfuegbar || 0,
          totalStock: v.bestand || 0,
          storeNumber: 'shoesplease',
          isActive: true,
          changed: '',
        });
      }
    }
    return allVariants;
  } catch (error) {
    console.error('[JTL-Live] Parent variants lookup failed:', error);
    return [];
  }
}

/**
 * Get detailed article data including stock per warehouse.
 * Returns the full API response for the abfrage page.
 */
export async function getArticleDetailLive(ean: string): Promise<ApiArticle | null> {
  try {
    const data = await apiRequest({ ean });
    if (!data.found || !data.results?.length) return null;
    return data.results[0];
  } catch (error) {
    console.error('[JTL-Live] Detail lookup failed:', error);
    return null;
  }
}

/**
 * Check if the live JTL API is reachable.
 */
export async function isJtlLiveConfigured(): Promise<boolean> {
  try {
    const url = `${getApiUrl()}/api/v1/health`;
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Check if JTL_API_URL is set (sync check, no network).
 */
export function isJtlLiveEnabled(): boolean {
  return !!process.env.JTL_API_URL;
}
