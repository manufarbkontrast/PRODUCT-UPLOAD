/**
 * JTL Data Provider via Supabase
 *
 * Reads synced JTL article data from Supabase tables.
 * Replaces Google Drive CSV and local API proxy approaches.
 *
 * Tables:
 *   jtl_articles        - Article master data with stock totals
 *   jtl_stock_locations  - Per-warehouse stock breakdown
 */

import { createClient } from '@supabase/supabase-js';
import type { JtlStockItem } from '@/lib/jtl-stocks';

// ─── Supabase Client (server-side, service role) ───────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getClient() {
  return createClient(supabaseUrl, supabaseKey);
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface JtlArticleRow {
  readonly k_artikel: number;
  readonly sku: string;
  readonly barcode: string | null;
  readonly hersteller: string | null;
  readonly warengruppe: string | null;
  readonly saison: string | null;
  readonly ek_netto: number;
  readonly vk_netto: number;
  readonly uvp: number;
  readonly ek_letzter: number;
  readonly aktiv: boolean;
  readonly vater_artikel_id: number | null;
  readonly ist_vater: boolean;
  readonly bestand: number;
  readonly verfuegbar: number;
  readonly zulauf: number;
  readonly in_auftraegen: number;
  readonly synced_at: string;
}

interface StockLocationRow {
  readonly k_artikel: number;
  readonly lager_name: string;
  readonly bestand: number;
  readonly gesperrt: number;
}

// ─── Mapping ───────────────────────────────────────────────────────────────

function toStockItem(row: JtlArticleRow): JtlStockItem {
  return {
    id: String(row.k_artikel),
    sku: row.sku,
    name: row.sku,
    ean: row.barcode || '',
    parentItemId: row.vater_artikel_id ? String(row.vater_artikel_id) : '',
    categories: row.warengruppe || '',
    priceNet: row.vk_netto,
    suggestedRetailPrice: row.uvp,
    purchasePriceNet: row.ek_letzter || row.ek_netto,
    availableStock: row.verfuegbar,
    totalStock: row.bestand,
    storeNumber: 'shoesplease',
    isActive: row.aktiv,
    changed: row.synced_at,
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Find articles by EAN/barcode.
 */
export async function findByEanSupabase(ean: string): Promise<JtlStockItem[]> {
  const sb = getClient();
  const { data, error } = await sb
    .from('jtl_articles')
    .select('*')
    .eq('barcode', ean);

  if (error) {
    console.error('[JTL-Supabase] EAN lookup error:', error.message);
    return [];
  }

  return (data || []).map(toStockItem);
}

/**
 * Find articles by SKU (exact or prefix match).
 */
export async function findBySkuSupabase(sku: string): Promise<JtlStockItem[]> {
  const sb = getClient();

  // Try exact match first
  const { data: exact } = await sb
    .from('jtl_articles')
    .select('*')
    .eq('sku', sku);

  if (exact && exact.length > 0) {
    return exact.map(toStockItem);
  }

  // Try prefix match (parent SKU)
  const { data: prefix } = await sb
    .from('jtl_articles')
    .select('*')
    .like('sku', `${sku}-%`)
    .limit(50);

  return (prefix || []).map(toStockItem);
}

/**
 * Find all variants (siblings) by parent article ID.
 */
export async function findVariantsSupabase(parentItemId: string): Promise<JtlStockItem[]> {
  const parentId = parseInt(parentItemId, 10);
  if (isNaN(parentId) || parentId <= 0) return [];

  const sb = getClient();
  const { data, error } = await sb
    .from('jtl_articles')
    .select('*')
    .eq('vater_artikel_id', parentId)
    .order('sku');

  if (error) {
    console.error('[JTL-Supabase] Variants lookup error:', error.message);
    return [];
  }

  return (data || []).map(toStockItem);
}

/**
 * Get stock per warehouse for an article.
 */
export async function getStockLocationsSupabase(kArtikel: number): Promise<StockLocationRow[]> {
  const sb = getClient();
  const { data, error } = await sb
    .from('jtl_stock_locations')
    .select('*')
    .eq('k_artikel', kArtikel)
    .order('bestand', { ascending: false });

  if (error) {
    console.error('[JTL-Supabase] Stock locations error:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Get full article detail including stock locations and variants.
 */
export async function getArticleDetailSupabase(ean: string) {
  const articles = await findByEanSupabase(ean);
  if (articles.length === 0) return null;

  const article = articles[0];
  const kArtikel = parseInt(article.id, 10);

  const [stockLocations, variants] = await Promise.all([
    getStockLocationsSupabase(kArtikel),
    article.parentItemId
      ? findVariantsSupabase(article.parentItemId)
      : Promise.resolve([]),
  ]);

  return {
    article,
    stockLocations,
    variants,
  };
}

/**
 * Get last sync timestamp.
 */
export async function getLastSyncTime(): Promise<string | null> {
  const sb = getClient();
  const { data } = await sb
    .from('jtl_sync_log')
    .select('finished_at, status, articles_synced')
    .eq('status', 'done')
    .order('finished_at', { ascending: false })
    .limit(1);

  return data?.[0]?.finished_at || null;
}

/**
 * Check if Supabase JTL data is available.
 */
export async function isJtlSupabaseConfigured(): Promise<boolean> {
  const sb = getClient();
  const { count, error } = await sb
    .from('jtl_articles')
    .select('*', { count: 'exact', head: true });

  return !error && (count ?? 0) > 0;
}
